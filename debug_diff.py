import yfinance as yf
import pandas as pd

def debug():
    ticker = "SPY"
    print("--- 1Y Data ---")
    df_1y = yf.download(ticker, period="1y", interval="1d", progress=False, auto_adjust=True)
    c1y = df_1y['Close']
    if isinstance(c1y, pd.DataFrame): c1y = c1y[ticker]
    c1y = c1y.dropna()
    print(c1y.tail(3))
    
    curr_1y = c1y.iloc[-1]
    prev_1y = c1y.iloc[-2]
    chg_1y = (curr_1y - prev_1y) / prev_1y * 100
    print(f"1Y Change: {chg_1y:.4f}% ({curr_1y} vs {prev_1y})")
    
    print("\n--- 5D Data ---")
    df_5d = yf.download(ticker, period="5d", interval="1d", progress=False, auto_adjust=True)
    c5d = df_5d['Close']
    if isinstance(c5d, pd.DataFrame): c5d = c5d[ticker]
    c5d = c5d.dropna()
    print(c5d.tail(3))
    
    curr_5d = c5d.iloc[-1]
    prev_5d = c5d.iloc[-2]
    chg_5d = (curr_5d - prev_5d) / prev_5d * 100
    print(f"5D Change: {chg_5d:.4f}% ({curr_5d} vs {prev_5d})")

if __name__ == "__main__":
    debug()
