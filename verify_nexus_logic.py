
import sys
import os
import asyncio
import json

# Add project root to path
sys.path.append(os.getcwd())

try:
    from backend.integration import nexus_command
except ImportError:
    with open("verification_logic_output_2.txt", "w") as f:
        f.write("Could not import nexus_command. Check paths.")
    sys.exit(1)

async def test_nexus_logic():
    output = []
    output.append("--- Testing Nexus Logic & Progress Callbacks ---")
    
    async def progress(msg):
        output.append(f"[CALLBACK] {msg}")

    ai_params = {
        "nexus_code": "SKYNET",
        "total_value": 5000,
        "create_new": False,
        "use_fractional_shares": True,
        "execute_rh": False,
        "overwrite": False
    }

    try:
        # Run command with progress callback
        result = await nexus_command.handle_nexus_command(
            [],
            ai_params=ai_params, 
            is_called_by_ai=True,
            progress_callback=progress
        )
        
        if result and result.get("status") == "success":
             output.append("\n[SUCCESS] Nexus Calculated Successfully.")
             output.append(f"Total Value: ${result.get('total_value')}")
             output.append(f"Trades Generated: {len(result.get('trades'))}")
             output.append(f"Holdings Count: {len(result.get('table'))}")
             # Check if trades look reasonable
             trades = result.get('trades')
             if trades:
                 output.append(f"Sample Trade: {trades[0]}")
        else:
             output.append(f"\n[FAILURE] Status: {result.get('status')} Message: {result.get('message')}")

    except Exception as e:
        output.append(f"[ERROR] Exception during execution: {e}")
    
    with open("verification_logic_output_2.txt", "w") as f:
        f.write("\n".join(output))

if __name__ == "__main__":
    asyncio.run(test_nexus_logic())
