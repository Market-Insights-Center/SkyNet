# debug_fix.py
import yfinance as yf
import pandas as pd
import datetime
import time

def test_ticker_diagnostics(symbol):
    print(f"\n{'='*20} DIAGNOSTICS FOR: {symbol} {'='*20}")
    
    try:
        t = yf.Ticker(symbol)
        
        # --- TEST 1: PRICE (FastInfo vs History) ---
        print("\n[1] Testing Price Fetch...")
        price = 0.0
        
        # Method A: Fast Info
        try:
            print(f"    - Checking fast_info (Type: {type(t.fast_info)})...")
            if hasattr(t.fast_info, 'last_price'):
                p = t.fast_info.last_price
                print(f"      > Found via attribute .last_price: {p}")
                price = p
            elif hasattr(t.fast_info, 'regular_market_price'):
                p = t.fast_info.regular_market_price
                print(f"      > Found via attribute .regular_market_price: {p}")
                price = p
        except Exception as e:
            print(f"      ! FastInfo Error: {e}")

        # Method B: History Fallback
        if price == 0:
            print("    - FastInfo failed or 0, trying History...")
            hist = t.history(period="5d")
            if not hist.empty:
                price = hist['Close'].iloc[-1]
                print(f"      > Found via History: {price}")
            else:
                print("      ! History returned empty DataFrame")
        
        if price > 0:
            print("    ✅ PRICE STATUS: OK")
        else:
            print("    ❌ PRICE STATUS: FAILED")

        # --- TEST 2: METADATA (Name & Market Cap) ---
        print("\n[2] Testing Metadata (Info)...")
        # Note: .info triggers a network request that often gets rate-limited
        try:
            info = t.info
            name = info.get('shortName') or info.get('longName')
            mkt_cap = info.get('marketCap')
            print(f"    > Name: {name}")
            print(f"    > Market Cap: {mkt_cap}")
            if name:
                print("    ✅ NAME STATUS: OK")
            else:
                print("    ⚠️ NAME MISSING (Using Symbol)")
        except Exception as e:
            print(f"    ❌ INFO FETCH ERROR (Likely Rate Limit/Connection): {e}")

        # --- TEST 3: EARNINGS ---
        print("\n[3] Testing Earnings Date...")
        try:
            cal = t.calendar
            print(f"    - Calendar Data Type: {type(cal)}")
            if cal is not None:
                # Handle Dict vs DataFrame vs None
                if isinstance(cal, dict):
                    dates = cal.get('Earnings Date') or cal.get('Earnings High')
                    print(f"    > Dates (Dict): {dates}")
                else:
                    print(f"    > Raw Calendar: {cal}")
            print("    ✅ EARNINGS CHECK COMPLETE")
        except Exception as e:
            print(f"    ❌ EARNINGS ERROR: {e}")

        # --- TEST 4: IV (Options) ---
        print("\n[4] Testing IV (Options)...")
        try:
            exps = t.options
            if exps:
                print(f"    > Expirations Found: {len(exps)} dates")
                print(f"    > First Exp: {exps[0]}")
                chain = t.option_chain(exps[0])
                print(f"    > Calls Found: {len(chain.calls)}")
                print("    ✅ IV DATA AVAILABLE")
            else:
                print("    ⚠️ NO OPTIONS DATA (Normal for some stocks)")
        except Exception as e:
            print(f"    ❌ OPTIONS ERROR: {e}")

    except Exception as e:
        print(f"CRITICAL TICKER FAILURE: {e}")

# Run for a few diverse tickers
tickers_to_test = ['AAPL', 'IONQ', 'RGTI']
for tick in tickers_to_test:
    test_ticker_diagnostics(tick)
    time.sleep(1) # Sleep to avoid rate limits during test