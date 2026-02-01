import yfinance as yf
import pandas as pd
from datetime import datetime
import time

def get_val(series, idx):
    try: return float(series.iloc[idx].item())
    except: return float(series.iloc[idx])

def get_price_days_ago(series, days_ago):
    if series.empty: return 0
    target_date = datetime.now() - pd.Timedelta(days=days_ago)
    print(f"Target Date for {days_ago} days ago: {target_date}")
    # Find nearest index
    try:
        # Convert series index to datetime if not already (yfinance usually is)
        # Check if index is tz aware
        if series.index.tz is not None:
             # Make target_date tz aware (using local tz? or UTC?)
             # yfinance is usually America/New_York
             target_date = pd.Timestamp(target_date).tz_localize(series.index.tz)
        
        idx = series.index.get_indexer([target_date], method='nearest')[0]
        print(f"Found index: {idx} for date {series.index[idx]}")
        return get_val(series, idx)
    except Exception as e:
        print(f"Indexer failed: {e}")
        # Fallback to roughly correct index if date lookup fails
        approx_idx = -1 - int(days_ago * 0.69) # roughly trading days
        if abs(approx_idx) > len(series): return get_val(series, 0)
        return get_val(series, approx_idx)

def test_market_data():
    tickers = ['SPY']
    print("Downloading data...")
    df = yf.download(tickers, period="2y", interval="1d", progress=False, auto_adjust=True)
    df_short = yf.download(tickers, period="5d", interval="1d", progress=False, auto_adjust=True)
    
    print("Data Downloaded.")
    # Extract Series
    if len(tickers) > 1:
        hist_close = df['Close']['SPY'].dropna() if 'SPY' in df['Close'].columns else pd.Series()
    else:
        hist_close = df['Close'].dropna()
        if isinstance(hist_close, pd.DataFrame):
            hist_close = hist_close.iloc[:, 0]
            
    if hist_close.empty:
        print("Empty history")
        return

    # Short history
    hist_short = None
    if not df_short.empty:
        hist_short = df_short['Close'].dropna()
        if isinstance(hist_short, pd.DataFrame):
            hist_short = hist_short.iloc[:, 0]

    current_price = get_val(hist_short if hist_short is not None else hist_close, -1)
    print(f"Current Price: {current_price}")

    # 1 Week
    price_1w = get_price_days_ago(hist_close, 7)
    change_1w = ((current_price - price_1w) / price_1w) * 100 if price_1w != 0 else 0
    print(f"Price 1W ago: {price_1w}, Change: {change_1w}%")
    
    # 1 Month
    price_1m = get_price_days_ago(hist_close, 30)
    change_1m = ((current_price - price_1m) / price_1m) * 100 if price_1m != 0 else 0
    print(f"Price 1M ago: {price_1m}, Change: {change_1m}%")

    # 1 Year
    price_1y = get_price_days_ago(hist_close, 365)
    change_1y = ((current_price - price_1y) / price_1y) * 100 if price_1y != 0 else 0
    print(f"Price 1Y ago: {price_1y}, Change: {change_1y}%")

    # Check fallback logic
    # print all dates in hist_close
    # print(hist_close.index)

if __name__ == "__main__":
    test_market_data()
