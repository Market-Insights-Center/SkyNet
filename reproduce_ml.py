
import asyncio
import sys
import logging
from backend.integration.mlforecast_command import handle_mlforecast_command

logging.basicConfig(level=logging.ERROR)

async def test_ml_recycling():
    tickers = ["SNDK", "TER", "DXYZ"]
    print(f"Testing tickers: {tickers}")
    
    # Run in parallel like chart_command does
    tasks = [
        handle_mlforecast_command(
            [], ai_params={"ticker": t}, is_called_by_ai=True
        ) 
        for t in tickers
    ]
    
    results = await asyncio.gather(*tasks)
    
    for i, res in enumerate(results):
        t = tickers[i]
        if not res or "error" in res:
            print(f"{t}: Error or None -> {res}")
            continue
            
        table = res.get("table", [])
        # Sample the 5-Day forecast
        match = next((row for row in table if row.get("Period") == "5-Day"), None)
        if match:
            print(f"{t}: Period=5-Day Prediction={match.get('Prediction')} Change={match.get('Est. % Change')}")
        else:
            print(f"{t}: No 5-Day forecast found")

if __name__ == "__main__":
    import os
    # Ensure backend import works
    sys.path.append(os.getcwd())
    try:
        asyncio.run(test_ml_recycling())
    except Exception as e:
        print(f"Exception: {e}")
