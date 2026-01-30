
import sys
import os
import asyncio
from datetime import datetime

# Setup path to root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from backend.integration import automation_command
except ImportError:
    print("Failed to import automation_command. Check paths.")
    sys.exit(1)

async def test_email_action():
    print("--- Testing Real Email Action Flow ---")
    
    # Mock Node
    node = {
        "id": "test_completion_email",
        "type": "completion_email",
        "data": {
            "email": "marketinsightscenter@gmail.com" # Using sender as recipient for safety
        }
    }
    
    # Mock Args
    user_email = "test@example.com"
    nodes = [node]
    edges = []
    
    print("Calling execute_action...")
    try:
        await automation_command.execute_action(
            node, nodes, edges, user_email, 
            node_results={}, 
            auto_name="Debugging Test Auto"
        )
        print("execute_action finished without raising exception.")
    except Exception as e:
        print(f"execute_action FAILED with: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_email_action())
