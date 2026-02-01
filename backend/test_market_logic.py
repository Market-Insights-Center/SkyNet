import sys
import os
# Add current directory to path so 'backend' can be imported
sys.path.append(os.getcwd())

try:
    from backend.routers.market import get_market_data
    from backend.schemas import MarketDataRequest
    
    print("Testing get_market_data logic directly...")
    req = MarketDataRequest(tickers=['SPY'])
    # This will trigger yfinance download in this process
    data = get_market_data(req)
    
    print("Result:")
    import json
    # Use default=str to handle numpy types if any
    print(json.dumps(data, indent=2, default=str)) 
    
except Exception as e:
    print(f"Test Failed: {e}")
    import traceback
    traceback.print_exc()
