
import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.integration.mlforecast_command import handle_mlforecast_command

async def run_test():
    print("Testing handle_mlforecast_command with single ticker...")
    res = await handle_mlforecast_command(ai_params={"ticker": "AAPL"}, is_called_by_ai=True)
    print("Single output type:", type(res))
    print("Single output keys:", res.keys() if isinstance(res, dict) else "Not a dict")

    print("\nTesting handle_mlforecast_command with tickers_source list...")
    tickers = ["LITE", "DXYZ"]
    res_batch = await handle_mlforecast_command(ai_params={"tickers_source": tickers}, is_called_by_ai=True)
    print("Batch output type:", type(res_batch))
    if isinstance(res_batch, dict):
        print("Batch output keys:", res_batch.keys())
        if "table" in res_batch:
            print(f"Table rows: {len(res_batch['table'])}")
            print("Row sample:", res_batch['table'][0] if res_batch['table'] else "Empty")
    else:
        print("Batch output:", res_batch)

if __name__ == "__main__":
    try:
        asyncio.run(run_test())
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()
