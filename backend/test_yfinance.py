import yfinance as yf
import time

tickers = ['AAPL', 'MSFT', 'GOOG']

print("--- Testing Bulk Download (Price/Volume) ---")
start = time.time()
data = yf.download(tickers, period="1d", progress=False)
print(f"Bulk download took: {time.time() - start:.2f}s")
print(data.head())

print("\n--- Testing Individual Info (IV/Earnings) ---")
for t in tickers:
    start = time.time()
    ticker = yf.Ticker(t)
    try:
        # info = ticker.info # This is usually very slow
        # iv = info.get('impliedVolatility')
        # earnings = ticker.calendar
        
        # Alternative: fast_info?
        # fast_info = ticker.fast_info
        
        # Let's try to get calendar and basic info
        cal = ticker.calendar
        print(f"{t} Calendar: {cal}")
        
        # IV might need options chain which is slow, or info
        # print(f"{t} Info IV: {ticker.info.get('impliedVolatility')}")
        pass
    except Exception as e:
        print(f"{t} Error: {e}")
    print(f"{t} Details took: {time.time() - start:.2f}s")
