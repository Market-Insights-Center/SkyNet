import asyncio
import sys
import os
from unittest.mock import MagicMock, patch

# Add project root to path (one level up from tests)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.integration.automation_command import evaluate_condition

# Force UTF-8 output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

async def test_evaluate_condition():
    print("Testing evaluate_condition...")

    # Test 1: Simple Comparison Failure
    node_compare = {
        'type': 'price', # Using price but mocking the fetch
        'data': {'ticker': 'TEST', 'op': '>', 'value': 100}
    }
    
    # Mock yfinance
    with patch('yfinance.Ticker') as MockTicker:
        instance = MockTicker.return_value
        instance.fast_info.last_price = 50 # 50 is NOT > 100
        
        res, reason = await evaluate_condition(node_compare)
        print(f"Test 1 Result: {res}")
        print(f"Test 1 Reason: {repr(reason)}")
        
        if res is not False:
             print("Test 1 Failed: Result should be False")
             exit(1)
        
        expected_part = "Price condition failed"
        if expected_part not in reason:
             print(f"Test 1 Failed: Expected '{expected_part}' in '{reason}'")
             exit(1)
             
        # Check values
        if "50.00" not in reason or "100.0" not in reason:
             print(f"Test 1 Failed: Value mismatch in '{reason}'")
             exit(1)

    # Test 2: Risk Failure
    node_risk = {
        'type': 'risk',
        'data': {'metric': 'general', 'op': '>', 'value': 80}
    }
    
    # Mock risk_command
    with patch('backend.integration.automation_command.risk_command') as MockRisk:
        # general, large, ema, combined, spy, vix
        MockRisk.calculate_risk_scores_singularity.return_value = (40, 40, 40, 40, 500, 20)
        
        res, reason = await evaluate_condition(node_risk)
        print(f"Test 2 Result: {res}")
        print(f"Test 2 Reason: {repr(reason)}")
        
        if res is not False:
             print("Test 2 Failed: Result should be False")
             exit(1)

        expected_part = "Risk condition failed"
        if expected_part not in reason:
             print(f"Test 2 Failed: Expected '{expected_part}' in '{reason}'")
             exit(1)
             
        if "40.00" not in reason or "80.0" not in reason:
             print(f"Test 2 Failed: Value mismatch in '{reason}'")
             exit(1)

    print("All tests passed!")

if __name__ == "__main__":
    asyncio.run(test_evaluate_condition())
