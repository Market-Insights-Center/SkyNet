
import asyncio
import sys
import os
import traceback

# Adjust path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from backend.integration.nexus_command import handle_nexus_command

async def verify_nexus():
    print("--- Verifying Nexus Fix ---")
    try:
        # Mock parameters simulating a user request
        params = {
            "nexus_code": "skynet",
            "total_value": 10000,
            "execute_rh": False,
            "use_fractional_shares": True
        }
        
        print(f"Running Nexus 'skynet' with $10,000...")
        result = await handle_nexus_command([], ai_params=params, is_called_by_ai=True)
        
        if result.get("status") == "success":
            holdings = result.get("table", [])
            count = len(holdings)
            print(f"SUCCESS: Nexus returned {count} holdings.")
            if count > 0:
                print("Top 3 Holdings:")
                for h in holdings[:3]:
                    print(f" - {h['ticker']}: {h['shares']} shares (${h['value']:.2f})")
            else:
                print("WARNING: Holdings count is 0. Fix might not be effective yet.")
                
            return True
        else:
            print(f"FAILED: Nexus returned error status: {result.get('message')}")
            return False

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    asyncio.run(verify_nexus())
