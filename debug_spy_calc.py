
import yfinance as yf
import pandas as pd
import time
from datetime import datetime

def get_val(series, idx):
    try: return float(series.iloc[idx].item())
    except: return float(series.iloc[idx])

def get_price_days_ago(series, days_ago):
    if series.empty: return 0.0
    try:
        # 1. Determine Target Date with correct Timezone
        now = pd.Timestamp.now()
        if series.index.tz is not None:
            if now.tz is None:
                # Assume 'now' is local/system time, localize it to the series TZ if possible, 
                # or just use UTC now converted? 
                # Safer: Use now(tz=...)
                try:
                    now = pd.Timestamp.now(tz=series.index.tz)
                except:
                     now = now.tz_localize(series.index.tz)
            else:
                now = now.tz_convert(series.index.tz)
        
        target_date = now - pd.Timedelta(days=days_ago)
        
        print(f"DEBUG: days_ago={days_ago}, target_date={target_date}")
        
        # 2. Find Nearest Index
        indexer = series.index.get_indexer([target_date], method='nearest')
        idx = indexer[0]
        
        print(f"DEBUG: Found index={idx} for target_date")
        
        if idx == -1: 
            if target_date < series.index[0]: idx = 0
            elif target_date > series.index[-1]: idx = len(series) - 1
        
        val = get_val(series, idx)
        print(f"DEBUG: Value at index {idx} (date={series.index[idx]}) = {val}")
        return val
        
    except Exception as e:
        print(f"Date Lookup Error for {days_ago}d ago: {e}")
        return 0.0

def test_spy_calc():
    print(f"YFinance Version: {yf.__version__}")
    tickers = ["SPY"]
    print("Downloading data...")
    # Matches market.py logic
    df = yf.download(tickers, period="2y", interval="1d", progress=False, auto_adjust=True)
    df_short = yf.download(tickers, period="5d", interval="1d", progress=False, auto_adjust=True)
    
    ticker = "SPY"
    
    print("DEBUG DF Info:")
    print(df.info())
    print("DEBUG DF Head:")
    print(df.head())
    print("DEBUG DF Columns:", df.columns)
    
    # Extract Hist Close
    # Note: yf.download with single ticker might return Series or DataFrame depending on version/args
    # but with list ["SPY"] it usually returns DataFrame with MultiIndex columns if group_by='ticker' (default logic varies)
    # market.py logic:
    if len(tickers) > 1:
        hist_close = df['Close'][ticker].dropna()
    else:
        # If single ticker passed as list, yfinance often returns just the DataFrame for that ticker columns directly?
        # Or MultiIndex?
        # Let's inspect structure
        print("DEBUG DF Columns:", df.columns)
        print("DEBUG DF Head:", df.head())
        
        if isinstance(df.columns, pd.MultiIndex):
             # If multiindex (Price, Ticker)
             if ticker in df['Close'].columns:
                 hist_close = df['Close'][ticker].dropna()
             else:
                 # Maybe columns are just Price and no ticker level?
                 hist_close = df['Close'].dropna()
        else:
             hist_close = df['Close'].dropna()

        # market.py logic for single ticker:
        # hist_close = df['Close'].dropna()
        # if isinstance(hist_close, pd.DataFrame) and not hist_close.empty:
        #     hist_close = hist_close.iloc[:, 0]

    # Replicate exactly what market.py does for list case of 1 item
    # market.py: logic differs if len(tickers) > 1.
    # Here we passed ["SPY"], check market.py logic again.
    # market.py: 
    # if len(tickers) > 1: ...
    # else:
    #      hist_close = df['Close'].dropna()
    #      if isinstance(hist_close, pd.DataFrame) and not hist_close.empty:
    #          hist_close = hist_close.iloc[:, 0]

    # Let's clean up logic here to match market.py runtime path
    try:
        hist_close = df['Close'].dropna()
        if isinstance(hist_close, pd.DataFrame) and not hist_close.empty:
            hist_close = hist_close.iloc[:, 0]
    except Exception as e:
        print(f"Error extracting hist_close: {e}")
        return

    # Extract Short
    try:
        hist_short = df_short['Close'].dropna()
        if isinstance(hist_short, pd.DataFrame) and not hist_short.empty:
             hist_short = hist_short.iloc[:, 0]
    except:
        hist_short = None

    # Current Price
    if hist_short is not None and not hist_short.empty:
        current_price = get_val(hist_short, -1)
    else:
        current_price = get_val(hist_close, -1)
        
    print(f"Current Price: {current_price}")

    # History
    days_map = {7: "1W", 30: "1M", 365: "1Y"}
    for day, label in days_map.items():
        price_old = get_price_days_ago(hist_close, day)
        change = ((current_price - price_old) / price_old) * 100 if price_old != 0 else 0
        print(f"{label}: Old={price_old}, Current={current_price}, Change={change:.2f}%")

if __name__ == "__main__":
    test_spy_calc()
