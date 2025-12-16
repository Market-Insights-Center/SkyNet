import asyncio
import os
import csv
import math
import traceback
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

# --- CONSTANTS ---
# Robust path finding
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if 'backend' not in str(BASE_DIR) and 'integration' not in str(BASE_DIR):
     # Fallback if structure is flat
     BASE_DIR = os.getcwd()

NEXUS_DB_FILE = os.path.join(BASE_DIR, 'backend', 'nexus_portfolios.csv')

# --- IMPORTS ---
try:
    from backend.integration.invest_command import process_custom_portfolio, calculate_ema_invest
    from backend.integration.market_command import calculate_market_invest_scores_singularity, get_sp500_symbols_singularity
    from backend.integration.breakout_command import run_breakout_analysis_singularity
    from backend.integration.cultivate_command import run_cultivate_analysis_singularity
    from backend.integration.custom_command import load_portfolio_config, _save_custom_portfolio_run_to_csv, _get_custom_portfolio_run_csv_filepath
    try:
        from backend.integration.execution_command import get_robinhood_equity, get_robinhood_holdings, execute_portfolio_rebalance
    except ImportError:
        def get_robinhood_equity(): return 0.0
        def get_robinhood_holdings(): return {}
        def execute_portfolio_rebalance(trades): pass
except ImportError as e:
    print(f"!!! CRITICAL NEXUS IMPORT ERROR: {e} !!!")
    import traceback
    traceback.print_exc()
    # Dummies to prevent crash
    async def process_custom_portfolio(*args, **kwargs): 
        print("[DEBUG NEXUS] DUMMY process_custom_portfolio called (Import Failed)")
        return []
    async def create_portfolio_run(*args, **kwargs): return []
    async def calculate_ema_invest(*args, **kwargs): return (0, 0)
    async def calculate_market_invest_scores_singularity(*args, **kwargs): return []
    def get_sp500_symbols_singularity(): return []
    async def run_breakout_analysis_singularity(*args, **kwargs): return {}
    async def run_cultivate_analysis_singularity(*args, **kwargs): return (None, [], None, None, None, None, None)
    async def load_portfolio_config(*args): return {}
    async def _save_custom_portfolio_run_to_csv(*args, **kwargs): pass
    async def _get_custom_portfolio_run_csv_filepath(*args, **kwargs): return ""
    
    # --- SYNTAX FIX HERE ---
    if 'get_robinhood_equity' not in locals():
        def get_robinhood_equity(): 
            return 0.0
    if 'get_robinhood_holdings' not in locals():
        def get_robinhood_holdings(): return {}
    if 'execute_portfolio_rebalance' not in locals():
        def execute_portfolio_rebalance(trades): pass

# --- HELPER FUNCTIONS ---



def safe_float(val: Any) -> float:
    try:
        if val is None: return 0.0
        s_val = str(val).lower().strip()
        if s_val in ['nan', 'none', 'null', '']: return 0.0
        
        if isinstance(val, (float, int)):
            if math.isnan(val): return 0.0
            return float(val)
        
        # Clean string
        clean_str = s_val.replace('$', '').replace('%', '').replace(',', '')
        if not clean_str: return 0.0
        
        # Parse
        f_val = float(clean_str)
        if math.isnan(f_val): return 0.0
        return f_val
    except Exception:
        return 0.0



async def _load_nexus_config(nexus_code: str) -> Optional[Dict[str, Any]]:
    print(f"[DEBUG NEXUS] Loading config for code: {nexus_code}")
    if not os.path.exists(NEXUS_DB_FILE): 
        print(f"[DEBUG NEXUS] DB File not found at: {NEXUS_DB_FILE}")
        return None
    try:
        with open(NEXUS_DB_FILE, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('nexus_code', '').strip().lower() == nexus_code.lower():
                    print(f"[DEBUG NEXUS] Found config: {row}")
                    return row
    except Exception as e:
        print(f"[DEBUG NEXUS] Error reading config: {e}")
    return None

async def _save_nexus_config(config_data: Dict[str, Any]):
    print(f"[DEBUG NEXUS] Saving config: {config_data}")
    file_exists = os.path.exists(NEXUS_DB_FILE)
    existing_data = []
    
    # Read existing
    if file_exists:
        try:
            with open(NEXUS_DB_FILE, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader: existing_data.append(row)
        except: pass

    # Update/Append
    updated = False
    for i, row in enumerate(existing_data):
        if row.get('nexus_code') == config_data['nexus_code']:
            existing_data[i] = {**row, **config_data}
            updated = True
            break
    if not updated: existing_data.append(config_data)

    # Write
    keys = list(config_data.keys())
    # Ensure we include all keys from existing data too
    if existing_data:
        for k in existing_data[0].keys():
            if k not in keys: keys.append(k)

    try:
        with open(NEXUS_DB_FILE, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=keys, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(existing_data)
    except Exception as e:
        print(f"Error saving nexus config: {e}")

async def _resolve_nexus_component(comp_type: str, comp_value: str, allocated_value: float, parent_path: str, allow_fractional: bool = True) -> List[Dict[str, Any]]:
    print(f"[DEBUG NEXUS] Resolving Component: Type={comp_type}, Value={comp_value}, Alloc=${allocated_value:.2f}, Frac={allow_fractional}")
    holdings = []
    try:
        if comp_type.lower() == 'portfolio':
            sub_config = await load_portfolio_config(comp_value)
            if sub_config:
                print(f"[DEBUG NEXUS] Loaded sub-portfolio config for {comp_value}: {sub_config}")
                print(f"[DEBUG NEXUS] Calling process_custom_portfolio with Alloc=${allocated_value}, Frac={allow_fractional}")
                # Force tailor=True based on allocated value
                res = await process_custom_portfolio(
                    portfolio_data_config=sub_config,
                    tailor_portfolio_requested=True,
                    total_value_singularity=allocated_value,
                    frac_shares_singularity=allow_fractional,
                    is_custom_command_simplified_output=True,
                    is_called_by_ai=True
                )
                print(f"[DEBUG NEXUS] Raw result from process_custom_portfolio: {type(res)}")
                if isinstance(res, tuple):
                     print(f"  -> Tuple Length: {len(res)}")
                     if len(res) >= 1: print(f"  -> Item 0 (Holdings) Type: {type(res[0])}, Count: {len(res[0]) if isinstance(res[0], list) else 'N/A'}")
                     if len(res) >= 4: print(f"  -> Item 3 (Raw Holdings) Count: {len(res[3]) if isinstance(res[3], list) else 'N/A'}")
                
                sub_holdings = []
                # Unwrap logic for different return signatures
                if isinstance(res, (list, tuple)):
                    # signature: (inputs, tailored_data, final_cash, ...) or similar
                    # Backend signature usually: (inputs, tailored_data, final_cash, tailored_data) OR
                    # (inputs, tailored_data, final_cash, tailored_data) check invest_command
                    # Assuming we find the list in "res"
                    found_list = False
                    for item in res:
                        if isinstance(item, list):
                            sub_holdings = item
                            found_list = True
                            print(f"[DEBUG NEXUS] Found holding list with {len(sub_holdings)} items")
                            break # Assume first list is it
                    if not found_list:
                         print("[DEBUG NEXUS] WARNING: Could not find a list in process_custom_portfolio output.")
                else:
                    print(f"[DEBUG NEXUS] process_custom_portfolio return was not a tuple/list: {res}")
                
                for h in sub_holdings:
                    raw_val = h.get('value', h.get('actual_money_allocation', 0.0))
                    raw_price = h.get('price', h.get('live_price_at_eval', 0.0))
                    
                    val = safe_float(raw_val)
                    shares = safe_float(h.get('shares', 0.0))
                    price = safe_float(raw_price)

                    if val <= 0 and shares <= 0: 
                        print(f"[DEBUG NEXUS] Skipping zero-val holding: {h.get('ticker')} val={val}")
                        continue
                    
                    if math.isnan(val): val = 0.0
                    
                    holdings.append({
                        'ticker': str(h.get('ticker')).upper(),
                        'shares': shares,
                        'value': val,
                        'live_price_at_eval': price,
                        'sub_portfolio_id': comp_value,
                        'path': [parent_path, comp_value] + (h.get('path', []) if isinstance(h.get('path'), list) else [h.get('path')])
                    })
            else:
                 print(f"[DEBUG NEXUS] Failed to load config for sub-portfolio: {comp_value}")

        elif comp_type.lower() == 'command':
            tickers = []
            comp_val_lower = comp_value.lower()
            
            if "market" in comp_val_lower:
                print("[DEBUG NEXUS] Resolving 'Market' command...")
                sp500 = await asyncio.to_thread(get_sp500_symbols_singularity)
                if sp500:
                    scores = await calculate_market_invest_scores_singularity(sp500, 2)
                    valid_scores = [s for s in scores if s.get('score') is not None]
                    tickers = [s['ticker'] for s in valid_scores[:10]]
                    print(f"[DEBUG NEXUS] Market generated {len(tickers)} tickers")
            
            elif "breakout" in comp_val_lower:
                print("[DEBUG NEXUS] Resolving 'Breakout' command...")
                res = await run_breakout_analysis_singularity(is_called_by_ai=True)
                if isinstance(res, dict) and res.get('status') == 'success':
                    # Fix: Handle potential key differences
                    start_list = res.get('current_breakout_stocks', [])
                    tickers = [item['Ticker'] for item in start_list if 'Ticker' in item]
                    print(f"[DEBUG NEXUS] Breakout generated {len(tickers)} tickers")

            elif "cultivate" in comp_val_lower:
                print(f"[DEBUG NEXUS] Resolving 'Cultivate' command ({comp_value})...")
                code = "A" if "a" in comp_val_lower else "B"
                # Cultivate logic
                cult_res = await run_cultivate_analysis_singularity(
                    portfolio_value=allocated_value, 
                    frac_shares=allow_fractional, 
                    cultivate_code_str=code, 
                    is_called_by_ai=True
                )
                tailored = []
                if isinstance(cult_res, (list, tuple)):
                    for item in cult_res:
                        if isinstance(item, list): tailored = item; break
                
                print(f"[DEBUG NEXUS] Cultivate generated {len(tailored)} tailored items")
                for h in tailored:
                    raw_val = h.get('value', h.get('actual_money_allocation', 0.0))
                    raw_price = h.get('price', h.get('live_price_at_eval', 0.0))
                    
                    val = safe_float(raw_val)
                    shares = safe_float(h.get('shares', 0.0))
                    price = safe_float(raw_price)

                    if math.isnan(val): val = 0.0
                    
                    # Debug if bad data
                    if val == 0 and shares > 0 and price == 0:
                        print(f"[DEBUG NEXUS] WARNING: {h.get('ticker')} has Shares={shares} but Price=0 and Value=0")

                    holdings.append({
                        'ticker': str(h.get('ticker')).upper(),
                        'shares': shares,
                        'value': val,
                        'live_price_at_eval': price,
                        'sub_portfolio_id': comp_value,
                        'path': [parent_path, comp_value]
                    })
                return holdings
            
            if tickers:
                weight_per_stock = allocated_value / len(tickers)
                print(f"[DEBUG NEXUS] Allocating ${weight_per_stock:.2f} to top tickers: {tickers}")
                tasks = [calculate_ema_invest(t, 2, is_called_by_ai=True) for t in tickers]
                prices = await asyncio.gather(*tasks)
                
                for i, t in enumerate(tickers):
                    price_info = prices[i]
                    raw_price = price_info[0] if isinstance(price_info, (list, tuple)) else price_info
                    price = safe_float(raw_price)

                    if price > 0:
                        shares = weight_per_stock / price
                        if not allow_fractional: shares = math.floor(shares)
                        
                        if shares > 0:
                            holdings.append({
                                'ticker': str(t).upper(), 
                                'shares': shares, 
                                'value': shares * price, 
                                'live_price_at_eval': price,
                                'sub_portfolio_id': comp_value, 
                                'path': [parent_path, comp_value]
                            })
                    else:
                        print(f"[DEBUG NEXUS] Zero/Null price for {t}: {price}")

    except Exception as e:
        print(f"Error resolving {comp_value}: {e}")
        traceback.print_exc()
    
    print(f"[DEBUG NEXUS] Component {comp_value} returned {len(holdings)} holdings")
    return holdings

async def process_nexus_portfolio(nexus_config, total_value, nexus_code, ai_params=None):
    print(f"[DEBUG NEXUS] Processing Portfolio {nexus_code} Value=${total_value}")
    all_holdings = []
    num_components = int(nexus_config.get('num_components', 0))
    allow_fractional = str(nexus_config.get('frac_shares', 'true')).lower() == 'true'

    # Check Total Weight First
    total_assigned_weight = 0.0
    for i in range(1, num_components + 1):
        total_assigned_weight += float(nexus_config.get(f'component_{i}_weight', 0))
    
    # Auto-Equalize if weights are missing/zero
    auto_weight = 0.0
    if total_assigned_weight <= 0 and num_components > 0:
        auto_weight = 100.0 / num_components
        print(f"[DEBUG NEXUS] Warning: Total Weight is 0. Auto-balancing to {auto_weight:.2f}% each.")

    for i in range(1, num_components + 1):
        c_type = nexus_config.get(f'component_{i}_type')
        c_value = nexus_config.get(f'component_{i}_value')
        c_weight = float(nexus_config.get(f'component_{i}_weight', 0))
        
        # Use auto-weight if needed
        if total_assigned_weight <= 0:
            c_weight = auto_weight
        elif c_weight <= 0: 
            # If total is positive but this specific one is 0, skip it
            continue
        
        alloc = total_value * (c_weight / 100.0)
        res = await _resolve_nexus_component(c_type, c_value, alloc, nexus_code, allow_fractional)
        if res: all_holdings.extend(res)

    # Aggregation
    agg_map = defaultdict(lambda: {'ticker': '', 'shares': 0.0, 'value': 0.0, 'live_price': 0.0, 'paths': set()})
    
    for h in all_holdings:
        t = h['ticker']
        agg_map[t]['ticker'] = t
        agg_map[t]['shares'] += h['shares']
        agg_map[t]['value'] += h['value']
        if h.get('live_price_at_eval'): agg_map[t]['live_price'] = h['live_price_at_eval']
        
        p_raw = h.get('path', [])
        path_str = " > ".join([str(p) for p in p_raw if p]) if isinstance(p_raw, list) else str(p_raw)
        if path_str: agg_map[t]['paths'].add(path_str)

    # Final List Build
    final = []
    total_spent = 0.0
    
    print(f"[DEBUG NEXUS] Aggregating {len(agg_map)} stored positions...")

    for t, d in agg_map.items():
        sh = safe_float(d['shares'])
        val = safe_float(d['value'])
        price = safe_float(d['live_price'])
        
        # BYDDY Rounding Exception (Always Integer)
        if t == 'BYDDY':
            sh = round(sh)
            if price > 0: val = sh * price
        
        # Global Rule: Check "frac_shares" setting (passed as allow_fractional)
        elif not allow_fractional:
            # If Fractional OFF, force to Integer
            sh = round(sh) # Nearest int
            if price > 0: val = sh * price
        
        # If Fractional ON:
        # User requested: "generally accepts raw float... step 0.01 implies 2 decimal precision"
        # Standardize to 2 decimal places to match typical SkyNet/Tracking behavior.
        else:
            sh = round(sh, 2)
            if price > 0: val = sh * price

        if sh > 0:
            final.append({
                'ticker': t,
                'shares': sh,
                'actual_money_allocation': val,
                'live_price_at_eval': price,
                'actual_percent_allocation': 0, # Calc later
                'path': list(d['paths'])
            })
            total_spent += val
        else:
            print(f"[DEBUG NEXUS] Dropped {t} due to shares={sh}")
            
    final_cash = total_value - total_spent
    print(f"[DEBUG NEXUS] Final Holdings List: {final}")
    print(f"[DEBUG NEXUS] Final Holdings Count: {len(final)}, Cash Left: ${final_cash:.2f}")

    # Recalc percents
    for h in final:
        h['actual_percent_allocation'] = (h['actual_money_allocation'] / total_value * 100)
        
    return final, final_cash

async def handle_nexus_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    print(f"\n[DEBUG NEXUS] handle_nexus_command Called. Args={args}, AI Params={ai_params}")
    """
    MAIN ENTRY POINT - GUARANTEED RETURN
    """
    try:
        nexus_code = None
        if ai_params: nexus_code = ai_params.get("nexus_code")
        elif args: nexus_code = args[0]
        
        if not nexus_code:
            print("[DEBUG NEXUS] No Code Provided")
            return {"status": "error", "message": "Nexus code is required."}

        # Create
        if ai_params and ai_params.get("create_new"):
            print(f"[DEBUG NEXUS] Creating New: {nexus_code}")
            comps = ai_params.get("components", [])
            cfg = {'nexus_code': nexus_code, 'num_components': len(comps), 'frac_shares': 'true'}
            for i, c in enumerate(comps, 1):
                cfg[f'component_{i}_type'] = c.get('type')
                cfg[f'component_{i}_value'] = c.get('value')
                cfg[f'component_{i}_weight'] = c.get('weight')
            await _save_nexus_config(cfg)

        # Load
        config = await _load_nexus_config(nexus_code)
        if not config:
            print(f"[DEBUG NEXUS] Config Not Found: {nexus_code}")
            return {"status": "not_found", "message": f"Nexus '{nexus_code}' not found."}

        # Override with runtime options if provided
        if ai_params:
            if 'frac_shares' in ai_params:
                config['frac_shares'] = str(ai_params['frac_shares']).lower()
            if 'use_fractional_shares' in ai_params: # Handle potential alternative key
                config['frac_shares'] = str(ai_params['use_fractional_shares']).lower()
        
        print(f"[DEBUG NEXUS] Effective Config: Frac={config.get('frac_shares')}")

        # Value
        rh_equity = 0.0
        execute_rh = is_called_by_ai and ai_params and ai_params.get('execute_rh')
        if execute_rh:
            try: rh_equity = await asyncio.to_thread(get_robinhood_equity)
            except: pass
            
        total_value = float(ai_params.get("total_value") or 10000)
        if rh_equity > 0 and (not ai_params.get("total_value")):
             total_value = math.floor(rh_equity * 0.98)

        # Process Target
        new_holdings, new_cash_unadjusted = await process_nexus_portfolio(config, total_value, nexus_code, ai_params)
        new_cash = new_cash_unadjusted # Will be updated by sweep


        # --- CONSTRAINTS VERIFICATION (Robust Logic vs Old Holdings) ---
        old_holdings_map = {}
        if execute_rh:
             live_h = await asyncio.to_thread(get_robinhood_holdings)
             if live_h: old_holdings_map = live_h
        
        if not old_holdings_map:
             # Fallback to saved
             run_path = _get_custom_portfolio_run_csv_filepath(f"nexus_{nexus_code}")
             if os.path.exists(run_path):
                 try:
                     with open(run_path, 'r') as f:
                        lines = [l for l in f.readlines() if not l.startswith('#')]
                        reader = csv.DictReader(lines)
                        for r in reader:
                            if r['Ticker'] != 'Cash': old_holdings_map[r['Ticker']] = float(r['Shares'])
                 except: pass

        # Apply $1 Min Logic
        allow_frac = str(config.get('frac_shares', 'true')).lower() == 'true'
        
        for h in new_holdings:
            t = h['ticker']
            price = safe_float(h.get('live_price_at_eval', 0))
            if price <= 0: continue
            
            # BYDDY Check
            is_byddy = (t == 'BYDDY')
            use_frac_here = allow_frac and (not is_byddy)
            
            target_shares = safe_float(h['shares'])
            current_shares = safe_float(old_holdings_map.get(t, 0.0))
            diff = target_shares - current_shares
            
            # If buying, ensure trade value >= $1.00
            if diff > 0:
                trade_val = diff * price
                
                # Correction Loop
                # If trade < $1.00, bump step by step
                if trade_val < 1.00:
                    step = 0.01 if use_frac_here else 1.0
                    loops = 0
                    while (diff * price) < 1.00 and loops < 1000:
                        target_shares += step
                        diff = target_shares - current_shares
                        loops += 1
                    
                    if loops > 0:
                        # Update holding
                        h['shares'] = target_shares
                        h['actual_money_allocation'] = target_shares * price
                        h['actual_percent_allocation'] = (h['actual_money_allocation']/total_value)*100
                        print(f"[DEBUG NEXUS] Bumped {t} by {loops} steps (size {step}) to meet $1.00 min.")

        # --- CASH SWEEP (For Integer Rounding Mode) ---
        # If we have excess cash (e.g. > $500) due to integer rounding, try to buy more shares.
        current_spent = sum(h['actual_money_allocation'] for h in new_holdings)
        current_cash = total_value - current_spent
        
        # Only sweep if cash is significant (e.g. > 1% or > $100) and we have buyable stocks
        if current_cash > 100:
            print(f"[DEBUG NEXUS] Starting Cash Sweep. Cash Left: ${current_cash:.2f}")
            # Sort cheap to expensive? Or by weight? 
            # Simple approach: Sort by price ascending to maximize usage.
            sorted_by_price = sorted([h for h in new_holdings if h.get('live_price_at_eval', 999999) > 0], key=lambda x: x['live_price_at_eval'])
            
            swept = True
            loop_count = 0
            while swept and current_cash > 0 and loop_count < 50:
                swept = False
                loop_count += 1
                for h in sorted_by_price:
                    p = h['live_price_at_eval']
                    if p > 0 and current_cash > (p * 1.05): # Buffer for safety
                        # Buy 1 share
                        step = 0.01 if allow_frac and h['ticker'] != 'BYDDY' else 1.0
                        h['shares'] += step
                        cost = step * p
                        h['actual_money_allocation'] += cost
                        current_cash -= cost
                        current_spent += cost
                        swept = True # Continue loop to see if we can buy more
            
            # Final Recalc
            new_cash = current_cash
            for h in new_holdings:
                 h['actual_percent_allocation'] = (h['actual_money_allocation']/total_value)*100
            print(f"[DEBUG NEXUS] Cash Sweep Complete. New Cash: ${new_cash:.2f}")
        else:
            new_cash = current_cash

        # Calculate Trades
        trades = []
        for h in new_holdings:
            t = h['ticker']
            diff = h['shares'] - old_holdings_map.get(t, 0.0)
            if abs(diff) > 0.0001:
                action = 'Buy' if diff > 0 else 'Sell'
                trades.append({'ticker': t, 'action': action, 'diff': abs(diff)})
                
        # Handle sells for full exit
        new_tickers = set(h['ticker'] for h in new_holdings)
        for t, s in old_holdings_map.items():
            if t not in new_tickers and s > 0:
                trades.append({'ticker': t, 'action': 'Sell', 'diff': s})

        # Save
        save_data = []
        for h in new_holdings:
            hc = h.copy()
            if isinstance(hc.get('path'), list): hc['path'] = " > ".join(hc['path'])
            save_data.append(hc)
            
        await _save_custom_portfolio_run_to_csv(
            portfolio_code=f"nexus_{nexus_code}",
            tailored_stock_holdings=save_data,
            final_cash=new_cash,
            total_portfolio_value_for_percent_calc=total_value
        )
        
        # Execute if requested
        # --- 6. EXECUTE (Conditional) ---
        # MODIFIED: specific rebalance logic is deferred. We ALWAYS run "dry run" first to get trades.
        # The frontend will see "requires_execution_confirmation" and prompt the user.
        
        # We need to get Robinhood credentials to determine if execution is possible
        rh_user = os.environ.get("RH_USERNAME")
        rh_pass = os.environ.get("RH_PASSWORD")

        # Prepare trades for function call (Map keys)
        # Nexus: {'ticker': t, 'action': 'Buy', 'diff': 10}
        # Exec:  {'ticker': t, 'side': 'buy', 'quantity': 10}
        rebal_trades = []
        for t in trades:
            rebal_trades.append({
                'ticker': t['ticker'],
                'side': t['action'].lower(),
                'quantity': float(t['diff'])
            })

        # Call execute_portfolio_rebalance in dry-run mode
        rebal_res = await asyncio.to_thread(
            execute_portfolio_rebalance,
            trades=rebal_trades,
            execute=False # ALWAYS FALSE INITIALLY - Defer to frontend button
        )

        # Check if we SHOULD offer execution (Triggers frontend button)
        # We allow execution if there are trades, regardless of predefined credentials,
        # because the frontend Modal will collect them if missing.
        can_execute = len(trades) > 0
        
        # Standardize for Frontend (Results.jsx)
        table_data = []
        for h in new_holdings:
            table_data.append({
                'ticker': h['ticker'],
                'shares': h['shares'],
                'value': h['actual_money_allocation'],
                'weight': h['actual_percent_allocation'],
                'price': h.get('live_price_at_eval', 0.0),
                'path': h.get('path', 'N/A')
            })

        # Summary for Cards
        summary_cards = [
                {"label": "Portfolio Value", "value": f"${total_value:,.2f}"},
                {"label": "Cash Balance", "value": f"${new_cash:,.2f}"},
                {"label": "Holdings Count", "value": str(len(new_holdings))}
        ]

        return {
            "status": "success",
            "message": "Nexus Portfolio Calculated.",
            "nexus_code": nexus_code,
            "total_value": total_value,
            "equity": rh_equity, # Keep for consistency, though total_value is primary
            "table": table_data,
            "summary": summary_cards,
            "cash": new_cash,
            "trades": trades, # Use original logic trades (Frontend friendly)
            "requires_execution_confirmation": can_execute
        }

    except Exception as e:
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"Backend Error: {str(e)}",
            "traceback": traceback.format_exc()
        }