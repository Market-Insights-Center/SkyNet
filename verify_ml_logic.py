import asyncio
import sys
import os

# Add current directory to path so imports work
current_dir = os.getcwd()
sys.path.insert(0, current_dir)

try:
    from backend.integration import mlforecast_command
    
    async def main():
        print("Starting ML Forecast Logic Test...")
        # Use SPY as it likely has data
        result = await mlforecast_command.handle_mlforecast_command(ai_params={"ticker": "SPY"}, is_called_by_ai=True)
        
        if result and "error" in result:
            print(f"Logic handled error gracefully: {result['error']}")
        elif result:
            print("Success! Result keys:", result.keys())
        else:
            print("Result was None.")

    asyncio.run(main())

except Exception as e:
    print(f"CRASH: {e}")
    import traceback
    traceback.print_exc()
