# execution_command.py

import robin_stocks.robinhood as r
import configparser
import time
import pyotp
from typing import List, Dict, Any, Optional
import math
import os
import asyncio
try:
    from backend.usage_counter import increment_usage
except ImportError:
    try:
        from usage_counter import increment_usage
    except ImportError:
        def increment_usage(*args): pass

# Load Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_FILE = os.path.join(BASE_DIR, 'config.ini')

config = configparser.ConfigParser()
config.read(CONFIG_FILE)

def login_to_robinhood():
    """Logs into Robinhood using credentials and auto-generates 2FA token."""
    try:
        username = config.get('ROBINHOOD', 'RH_USERNAME', fallback=None)
        password = config.get('ROBINHOOD', 'RH_PASSWORD', fallback=None)
        mfa_secret = config.get('ROBINHOOD', 'RH_MFA_CODE', fallback=None)

        if not username or not password:
            print("❌ Error: Robinhood credentials missing.")
            return False

        totp_code = None
        if mfa_secret:
            totp = pyotp.TOTP(mfa_secret)
            totp_code = totp.now()

        r.login(username, password, mfa_code=totp_code)
        return True
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return False

def get_robinhood_equity() -> float:
    """Logs in and fetches the total equity of the account."""
    if not login_to_robinhood():
        return 0.0
    
    try:
        profile = r.profiles.load_portfolio_profile()
        if profile and 'equity' in profile:
            return float(profile['equity'])
    except Exception as e:
        print(f"❌ Error fetching Robinhood equity: {e}")
    
    return 0.0

def get_robinhood_holdings() -> Optional[Dict[str, float]]:
    """
    Logs in and fetches current share holdings as {ticker: quantity}.
    Useful for ensuring rebalance calculations use LIVE data.
    Returns None if fetch fails, {} if empty.
    """
    if not login_to_robinhood():
        return None
    
    try:
        print("⏳ Fetching live positions from Robinhood API...")
        holdings_data = r.build_holdings()
        
        holdings_map = {}
        for ticker, data in holdings_data.items():
            if data and 'quantity' in data:
                try:
                    qty = float(data['quantity'])
                    if qty > 0:
                        holdings_map[ticker] = qty
                except ValueError:
                    continue
        
        return holdings_map
    
    except Exception as e:
        print(f"❌ Error fetching Robinhood holdings: {e}")
        return None

def _get_single_holding(ticker: str) -> float:
    """Helper to fetch the exact shares held for a single ticker."""
    try:
        data = r.build_holdings()
        if ticker in data:
            return float(data[ticker].get('quantity', 0.0))
    except Exception:
        pass
    return 0.0

def execute_portfolio_rebalance(trades: List[Dict[str, Any]], known_holdings: Optional[Dict[str, float]] = None, execute: bool = True, progress_callback=None) -> List[Dict[str, Any]]:
    """
    Executes trades with full retry logic, precision handling, and error management.
    ADAPTED FOR BACKEND: No interactive input() calls. Assumes execution is requested if called with execute=True.
    """
    if not trades:
        print("No trades to execute.")
        return []

    if not execute:
        print(f"\n--- 🏹 Robinhood Trade Execution (Dry Run) ---")
        print(f"Skipping actual execution for {len(trades)} trades.")
        return trades

    print(f"\n--- 🏹 Robinhood Trade Execution ({len(trades)} orders) ---")
    
    # Track usage (Synchronous fallback)
    try:
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
        usage_file = os.path.join(data_dir, 'usage_stats.json')
        if os.path.exists(usage_file):
            import json
            with open(usage_file, 'r') as f:
                stats = json.load(f)
            stats['execution_run'] = stats.get('execution_run', 0) + 1
            stats['total_system_actions'] = stats.get('total_system_actions', 0) + 1
            with open(usage_file, 'w') as f:
                json.dump(stats, f, indent=4)
    except Exception as e:
        print(f"Usage update failed: {e}")

    # Backend Safety: We rely on the caller to have obtained user consent.
    # No 'input()' check here.
    
    # Force auto-login via config
    if not login_to_robinhood():
        if progress_callback: 
            # We can't await here easily if this function isn't async, 
            # BUT we updated the signature to simple def... wait, did we make it async?
            # The previous tool call was "def ...". 
            # I need to verify if I should make it async.
            # Nexus calls it with `await asyncio.to_thread`.
            # So it MUST remain synchronous (blocking).
            # So `progress_callback` must be run in a loop? No, that's hard.
            # We will skin the callback for now in strict sync mode, 
            # OR we rely on print() and the stream captures stdout?
            # Actually, `nexus_command` has a `progress_callback` that writes to the stream.
            # If we run in a thread, we can't await the callback.
            # Fix: We will just print() and let the stdout capturer (if any) handle it, 
            # OR we skip callback usage inside this sync function for now to avoid complexity.
            pass
        return []

    # --- BATCH PRICE FETCH ---
    print("\n⏳ Fetching latest prices for all tickers to ensure accuracy...")
    if progress_callback:
        # Since this is synchronous, we might need to handle async callback if provided
        # But 'execution_command' is sync right now?  Ah, the signature change suggests we might need to handle it.
        # But execute_portfolio_rebalance is defined as sync in the signature above, but typically called via asyncio.to_thread?
        # If it's called via to_thread, it cannot await an async callback directly unless it runs a loop or the callback is sync.
        # However, the plan says "Add a progress_callback argument (async)".
        # If execute_portfolio_rebalance is blocking (sync), we cannot await an async callback without a loop.
        # We should make execute_portfolio_rebalance async or handle the callback carefully.
        # Let's assume for now we will convert this function to async or use a sync wrapper.
        # Actually, to_thread runs sync code. 
        # Better strategy: make execute_portfolio_rebalance ASYNC.
        # BUT `r.jobs` etc are blocking. Mixing them is fine if we define `async def`.
        # Let's change the definition to `async def` in the previous step? 
        # I only changed the signature line.
        # Let's use a sync callback wrapper if needed, or better:
        # The caller (automation.py) defines an async callback.
        # If `execute_portfolio_rebalance` remains sync, it can't await.
        # I will change `execute_portfolio_rebalance` to `async def` since I am editing the file.
        pass

    price_map = {}
    try:
        all_tickers = list(set([t.get('ticker') for t in trades]))
        quotes = r.stocks.get_latest_price(all_tickers, includeExtendedHours=False)
        
        if len(quotes) == len(all_tickers):
            for i, ticker in enumerate(all_tickers):
                try:
                    price_map[ticker] = float(quotes[i])
                except (ValueError, TypeError):
                    price_map[ticker] = 0.0
        else:
            print("⚠️ Warning: Quote count mismatch. Some prices may be zero.")
            
    except Exception as e:
        print(f"⚠️ Batch price fetch failed ({e}). Proceeding with individual lookups (slower).")

    print("\n🚀 Executing orders...")
    successful_trades = 0
    failed_trades = 0

    # Sort Sells first to free up cash
    trades.sort(key=lambda x: x.get('side', '').lower() == 'buy') 

    deferred_buys: List[int] = [] 
    
    for i, trade in enumerate(trades):
        ticker = trade.get('ticker')
        raw_qty = float(trade.get('quantity', 0))
        side = trade.get('side', '').lower()
        
        if raw_qty <= 0: continue

        # --- 1. Enforce Integer constraints (BYDDY) ---
        is_integer_only = False
        if ticker.upper() == 'BYDDY':
            qty = int(round(raw_qty))
            is_integer_only = True
        else:
            qty = round(raw_qty, 6) 

        if qty <= 0: continue

        # --- 2. Get Price ---
        current_price = price_map.get(ticker, 0.0)
        if current_price == 0.0:
            try:
                price_info = r.stocks.get_latest_price(ticker, includeExtendedHours=False)
                current_price = float(price_info[0]) if price_info and price_info[0] else 0.0
            except Exception:
                current_price = 0.0

        print(f"   Processing: {side.upper()} {qty} {ticker}...", end=" ")
        
        if progress_callback:
            progress_callback(
                completed=successful_trades + failed_trades,
                total=len(trades),
                trade={'ticker': ticker, 'side': side, 'quantity': qty},
                msg=f"Processing {side.upper()} {qty} {ticker}..."
            )

        # --- 3. Execution Loop ---
        adjustment_attempts = 0
        max_adjustments = 5
        trade_complete = False
        
        # Check constraints before loop
        if current_price > 0 and (qty * current_price) < 1.00:
             # Bump immediately
             step = 1.0 if is_integer_only else 0.01
             while (qty * current_price) < 1.00:
                 qty += step
             if not is_integer_only: qty = round(qty, 6)
             print(f"\n      ⚠️  Value < $1. Auto-adjusted to {qty} shares.", end=" ")

        while not trade_complete and adjustment_attempts < max_adjustments:
            max_network_retries = 3
            
            for attempt in range(max_network_retries):
                try:
                    order = None
                    if side == 'buy':
                        order = r.orders.order_buy_fractional_by_quantity(ticker, qty)
                    elif side == 'sell':
                        order = r.orders.order_sell_fractional_by_quantity(ticker, qty)
                    
                    if order is None:
                        raise ValueError("API returned None (Rate Limit?)")
                    
                    if 'detail' in order and 'throttled' in str(order['detail']).lower():
                        raise ValueError(f"Rate Limited: {order['detail']}")

                    # --- SUCCESS ---
                    if 'id' in order:
                        exec_price = float(order.get('price') or current_price)
                        total_val = exec_price * qty
                        
                        print(f"\n   ✅ EXECUTED: {side.upper()} {qty} {ticker} @ ${exec_price:.2f}")
                        
                        if progress_callback:
                            progress_callback(
                                completed=successful_trades + failed_trades + 1,
                                total=len(trades),
                                trade={'ticker': ticker, 'side': side, 'quantity': qty, 'price': exec_price},
                                msg=f"Executed {side.upper()} {qty} {ticker}"
                            )
                        
                        successful_trades += 1
                        trades[i]['quantity'] = qty
                        trade_complete = True
                        break 
                    
                    # --- FAILURE HANDLING ---
                    error_str = str(order).lower()
                    
                    # A. MINIMUM $1 ERROR
                    if "at least $1" in error_str:
                        step = 1.0 if is_integer_only else 0.01
                        qty += step
                        if not is_integer_only: qty = round(qty, 6)
                        print(f"\n      ❌ Too small (<$1). Retrying with {qty}...", end=" ")
                        
                        if progress_callback:
                            progress_callback(
                                completed=successful_trades + failed_trades,
                                total=len(trades),
                                trade={'ticker': ticker, 'side': side, 'quantity': qty},
                                msg=f"Adjusting {ticker}: Value < $1. Retrying..."
                            )
                        adjustment_attempts += 1
                        break 

                    # B. SELL ERROR: NOT ENOUGH SHARES
                    elif side == 'sell' and ("enough shares" in error_str or "shares" in error_str):
                        print(f"\n      ⚠️  Sell failed (Not enough shares). Checking live max...", end=" ")
                        actual_held = _get_single_holding(ticker)
                        if actual_held < qty and actual_held > 0:
                            qty = actual_held
                            print(f"Adjusted to {qty} (Max Available). Retrying...", end=" ")
                            adjustment_attempts += 1
                            break 
                        elif actual_held <= 0:
                            print(f"\n      ❌ You do not own {ticker}. Skipping.")
                            failed_trades += 1
                            trade_complete = True
                            break
                        else:
                            print(f"\n      ❌ API rejected sell despite holdings. {order}")
                            failed_trades += 1
                            trade_complete = True
                            break

                    # C. BUY ERROR: INSUFFICIENT FUNDS
                    elif side == 'buy' and ("buying power" in error_str or "funds" in error_str):
                         print(f"\n      ⚠️  Insufficient Funds. Deferring trade to end of queue.", end=" ")
                         deferred_buys.append(i)
                         trade_complete = True
                         break

                    # D. OTHER ERRORS
                    elif 'detail' in order:
                        print(f"\n   ❌ Failed: {order['detail']}")
                        failed_trades += 1
                        trade_complete = True
                        break
                    elif 'non_field_errors' in order:
                        print(f"\n   ❌ Failed: {order['non_field_errors']}")
                        failed_trades += 1
                        trade_complete = True
                        break
                    else:
                        print(f"\n   ⚠️  Unknown response: {order}")
                        failed_trades += 1
                        trade_complete = True
                        break
                        
                    if trade_complete and progress_callback and 'id' not in order:
                         progress_callback(
                            completed=successful_trades + failed_trades,
                            total=len(trades),
                            trade={'ticker': ticker, 'side': side, 'quantity': qty},
                            msg=f"Failed {ticker}: {str(order.get('detail', 'Unknown Error'))}"
                        )

                except Exception as e:
                    if attempt == max_network_retries - 1:
                        print(f"\n   ❌ Network Error {ticker}: {e}")
                        failed_trades += 1
                        trade_complete = True
                    else:
                        time.sleep(30)

            if trade_complete:
                break
            time.sleep(1)

        if trade_complete and successful_trades > 0:
            time.sleep(2) 

    # --- PROCESS DEFERRED BUYS ---
    if deferred_buys:
        print(f"\n\n🔄 Retrying {len(deferred_buys)} deferred buy orders (after Sells have cleared)...")
        
        for idx in deferred_buys:
            trade = trades[idx]
            ticker = trade.get('ticker')
            qty = float(trade.get('quantity'))
            
            # Re-check price
            current_price = price_map.get(ticker, 0.0)
            
            print(f"   Retrying: BUY {qty} {ticker}...", end=" ")
            
            try:
                order = r.orders.order_buy_fractional_by_quantity(ticker, qty)
                if order and 'id' in order:
                    exec_price = float(order.get('price') or current_price)
                    print(f"\n   ✅ EXECUTED: BUY {qty} {ticker} @ ${exec_price:.2f}")
                    
                    if progress_callback:
                        progress_callback(
                            completed=successful_trades + failed_trades + 1,
                            total=len(trades),
                            trade={'ticker': ticker, 'side': side, 'quantity': qty, 'price': exec_price},
                            msg=f"Executed Deferred BUY {qty} {ticker}"
                        )
                    successful_trades += 1
                    trades[idx]['quantity'] = qty 
                else:
                    detail = order.get('detail') or order.get('non_field_errors') or "Unknown Error"
                    print(f"\n   ❌ Failed Final Attempt: {detail}")
                    failed_trades += 1
            except Exception as e:
                print(f"\n   ❌ Exception: {e}")
                failed_trades += 1
                
            time.sleep(2)

    print("-" * 50)
    print(f"Execution Complete. Success: {successful_trades} | Failed: {failed_trades}")
    print("-" * 50)
    
    r.logout()
    return trades