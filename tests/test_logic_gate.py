import asyncio
import sys
import os
from unittest.mock import MagicMock, patch

# Add project root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock modules BEFORE importing automation_command
sys.modules['backend.automation_storage'] = MagicMock()
sys.modules['backend.integration.risk_command'] = MagicMock()
sys.modules['backend.integration.market'] = MagicMock()

from backend.integration.automation_command import process_automation, AUTOMATION_STATUS

# Force UTF-8
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

async def test_logic_gate_reasoning():
    print("Testing Logic Gate Reason Propagation...")

    # Setup Automation: Risk Node -> Logic Gate
    automation = {
        'id': 'test_auto_1',
        'name': 'Test Auto',
        'active': True,
        'nodes': [
            {
                'id': 'risk_1',
                'type': 'risk',
                'data': {'metric': 'market', 'op': '>', 'value': 50}
            },
            {
                'id': 'gate_1',
                'type': 'logic_gate',
                'data': {'operation': 'AND'}
            }
        ],
        'edges': [
            {'source': 'risk_1', 'target': 'gate_1'}
        ],
        'user_email': 'test@example.com'
    }

    # Mock evaluate_condition to fail with specific reason
    with patch('backend.integration.automation_command.evaluate_condition') as mock_eval:
        # Return (False, "Risk too high (60 > 50)")
        mock_eval.return_value = (False, "Risk condition failed: 40 is not > 50")
        
        # Run process
        await process_automation(automation)
        
        # Check Status
        status = AUTOMATION_STATUS.get('test_auto_1')
        print(f"Final Status: {status}")
        
        if not status:
            print("No status found!")
            exit(1)
            
        if status['step'] != 'Stopped':
            print(f"Status is not Stopped: {status['step']}")
            exit(1)
            
        final_reason = status['detail']
        print(f"Final Reason: '{final_reason}'")
        
        expected = "Logic Gate (AND) Failed: Risk condition failed: 40 is not > 50"
        if "Risk condition failed" not in final_reason:
            print(f"Reason missing specific detail. Got: '{final_reason}'")
            exit(1)
            
    print("Logic Gate Propagated Error Correctly!")

if __name__ == "__main__":
    asyncio.run(test_logic_gate_reasoning())
