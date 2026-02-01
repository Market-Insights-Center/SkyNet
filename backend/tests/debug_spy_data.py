
import yfinance as yf
import pandas as pd
from datetime import datetime
import sys
import os

def debug_spy():
    output = []
    def log(msg):
        print(msg)
        output.append(str(msg))

    log("--- Debugging SPY Data ---")
    ticker = "SPY"
    
    # 1. Fetch Data (logic from market.py)
    log("Fetching 1y data...")
    df = yf.download(ticker, period="1y", interval="1d", progress=False, auto_adjust=True)
    
    log("Fetching 5d data...")
    df_short = yf.download(ticker, period="5d", interval="1d", progress=False, auto_adjust=True)
    
    if df.empty:
        log("ERROR: 1y DataFrame is empty")
        with open("debug_output.txt", "w") as f:
            f.write("\n".join(output))
        return

    # Extract Close series
    log(f"1Y Columns: {df.columns}")
    
    hist_close = df['Close']
    if isinstance(hist_close, pd.DataFrame):
        # Handle multi-level columns if present
        if ticker in hist_close.columns:
            hist_close = hist_close[ticker]
        else:
            hist_close = hist_close.iloc[:, 0]
        
    log(f"1Y Tail:\n{hist_close.tail(5)}")
    
    hist_short = None
    if not df_short.empty:
        hist_short = df_short['Close']
        if isinstance(hist_short, pd.DataFrame):
            if ticker in hist_short.columns:
                hist_short = hist_short[ticker]
            else:
                hist_short = hist_short.iloc[:, 0]
        log(f"5D Tail:\n{hist_short.tail(5)}")
        
    # logic from new market.py

    # Helper to find price closest to days_ago
    def get_val(series, idx):
        try: return float(series.iloc[idx].item())
        except: return float(series.iloc[idx])

    def get_price_days_ago(series, days_ago):
        if series.empty: return 0
        target_date = datetime.now() - pd.Timedelta(days=days_ago)
        # Find nearest index
        try:
            # Convert series index to datetime if not already (yfinance usually is)
            # Ensure index is sorted
            series = series.sort_index()
            idx = series.index.get_indexer([target_date], method='nearest')[0]
            val = get_val(series, idx)
            found_date = series.index[idx]
            log(f"  [Date Lookup] Target: {target_date.date()}, Found: {found_date.date()}, Price: {val:.2f}")
            return val
        except Exception as e:
            log(f"  [Date Lookup Error] {e}")
            # Fallback to roughly correct index if date lookup fails
            approx_idx = -1 - int(days_ago * 0.69) # roughly trading days
            if abs(approx_idx) > len(series): return get_val(series, 0)
            return get_val(series, approx_idx)

    # 1. Fetch Data (logic from market.py)
    log("Fetching 2y data...")
    df = yf.download(ticker, period="2y", interval="1d", progress=False, auto_adjust=True)
    
    log("Fetching 5d data...")
    df_short = yf.download(ticker, period="5d", interval="1d", progress=False, auto_adjust=True)
    
    # ... extraction logic ...
    hist_close = df['Close']
    if isinstance(hist_close, pd.DataFrame):
        if ticker in hist_close.columns:
            hist_close = hist_close[ticker]
        else:
            hist_close = hist_close.iloc[:, 0]
    hist_close = hist_close.dropna()

    hist_short = None
    if not df_short.empty:
        hist_short = df_short['Close']
        if isinstance(hist_short, pd.DataFrame):
             if ticker in hist_short.columns:
                hist_short = hist_short[ticker]
             else:
                hist_short = hist_short.iloc[:, 0]
        hist_short = hist_short.dropna()

    # Current Price
    if hist_short is not None and not hist_short.empty:
        current_price = get_val(hist_short, -1)
        price_1d = get_val(hist_short, -2) if len(hist_short) > 1 else current_price
    else:
        current_price = get_val(hist_close, -1)
        price_1d = get_val(hist_close, -2) if len(hist_close) > 1 else current_price

    change_1d = ((current_price - price_1d) / price_1d) * 100 if price_1d != 0 else 0
    
    log(f"\nCalculated Current: ${current_price:.2f}")
    
    # Historical
    log("Calculating Historical Changes...")
    price_1w = get_price_days_ago(hist_close, 7)
    change_1w = ((current_price - price_1w) / price_1w) * 100 if price_1w != 0 else 0
    
    price_1m = get_price_days_ago(hist_close, 30)
    change_1m = ((current_price - price_1m) / price_1m) * 100 if price_1m != 0 else 0
    
    price_1y = get_price_days_ago(hist_close, 365)
    change_1y = ((current_price - price_1y) / price_1y) * 100 if price_1y != 0 else 0
    
    log(f"\nHistorical Reference Prices:")
    log(f"1 Week Ago: ${price_1w:.2f} -> Change: {change_1w:.2f}%")
    log(f"1 Month Ago: ${price_1m:.2f} -> Change: {change_1m:.2f}%")
    log(f"1 Year Ago: ${price_1y:.2f} -> Change: {change_1y:.2f}%")

    with open("debug_output.txt", "w") as f:
        f.write("\n".join(output))

if __name__ == "__main__":
    debug_spy()
