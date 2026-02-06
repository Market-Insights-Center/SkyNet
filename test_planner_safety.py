
import asyncio
import json
import logging
from unittest.mock import MagicMock, AsyncMock
import sys
import os

# Fix path
sys.path.append(os.getcwd())

# Mock backend modules
sys.modules['backend.usage_counter'] = MagicMock()
sys.modules['backend.ai_service'] = MagicMock()
sys.modules['backend.integration.market_command'] = MagicMock()
sys.modules['backend.integration.sentiment_command'] = MagicMock()
sys.modules['backend.integration.risk_command'] = MagicMock()
sys.modules['backend.integration.briefing_command'] = MagicMock()
sys.modules['backend.integration.fundamentals_command'] = MagicMock()
sys.modules['backend.integration.assess_command'] = MagicMock()
sys.modules['backend.integration.mlforecast_command'] = MagicMock()
sys.modules['backend.integration.powerscore_command'] = MagicMock()
sys.modules['backend.integration.quickscore_command'] = MagicMock()

# Import target
from backend.integration import sentinel_command

# Mock AI Service
sentinel_command.ai = MagicMock()
sentinel_command.ai.generate_content = AsyncMock()

async def test_planner_safety():
    print("--- Testing Planner Safety Net ---")
    
    # 1. Defective "Hallucinated" Plan from AI
    # AI ignores the tickers and tries to import from Nexus with no code
    bad_plan_json = json.dumps([
        {
            "step_id": 1, 
            "tool": "nexus_import", 
            "params": {"nexus_code": ""}, # Empty code!
            "description": "Importing tickers..."
        },
        {
            "step_id": 2, 
            "tool": "summary", 
            "params": {"data_source": "$CONTEXT"}
        }
    ])
    
    sentinel_command.ai.generate_content.return_value = bad_plan_json
    
    # 2. User Prompt containing Tickers
    user_prompt = "Compare LITE, DXYZ, and TER."
    
    # 3. Run Planner
    print(f"User Prompt: {user_prompt}")
    print("Simulating AI Hallucination (Nexus Import)...")
    
    plan = await sentinel_command.plan_execution(user_prompt)
    
    # 4. Assertions
    print("\n[Resulting Plan]:")
    print(json.dumps(plan, indent=2))
    
    step1 = plan[0]
    
    if step1["tool"] == "manual_list":
        print("\nSUCCESS: Planner correctly hot-swapped 'nexus_import' to 'manual_list'.")
        if "LITE" in step1["params"]["tickers"] and "DXYZ" in step1["params"]["tickers"]:
            print("PASS: Correct tickers injected.")
        else:
            print("FAIL: Tickers missing.")
    else:
        print(f"\nFAIL: Planner did NOT swap. Tool is still {step1['tool']}.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_planner_safety())
