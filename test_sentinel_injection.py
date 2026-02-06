import asyncio
from unittest.mock import MagicMock
import sys
import os

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from backend.integration.sentinel_command import plan_execution

# Mock AI and Logger
import backend.integration.sentinel_command as sc

# Mock the ai.generate_content to return a bad plan
async def mock_generate_content(*args, **kwargs):
    # Returns a plan that uses nexus_import without a code, triggering the swap
    return '{"steps": [{"step_id": 1, "tool": "nexus_import", "params": {"nexus_code": ""}, "description": "Analyzing SPY"}]}'

sc.ai = MagicMock()
sc.ai.generate_content = mock_generate_content

async def test_analysis_injection():
    # Context: User asks for "SPY Report"
    # Expected: The plan should swap nexus_import -> manual_list AND add quickscore, etc.
    
    plan = await plan_execution("Report on SPY", execution_mode="auto")
    
    print("\n Generated Plan:", plan)
    
    # Assertions
    tools = [step["tool"] for step in plan]
    
    # 1. Check Swap
    assert "manual_list" in tools
    assert "nexus_import" not in tools
    
    # 2. Check Injection
    assert "quickscore" in tools
    assert "mlforecast" in tools
    assert "fundamentals" in tools
    assert "sentiment" in tools
    
    # 3. Check Order (manual_list must be first)
    assert tools[0] == "manual_list"
    
    # 4. Check Data Source Linking
    qs_step = next(s for s in plan if s["tool"] == "quickscore")
    assert qs_step["params"]["tickers_source"] == "$manual_list.tickers"

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(test_analysis_injection())
    print("\nTest Passed!")
