
import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.abspath(os.path.dirname(__file__) + '/../'))

from backend.integration import automation_command

# Mock Dependencies
class MockNexus:
    async def handle_nexus_command(self, args, ai_params, is_called_by_ai):
        print(f"[MOCK] Nexus Handled: {ai_params}")
        return True

class MockMonitor:
    async def send_notification(self, subject, body, to_emails):
        print(f"[MOCK] Email Sent: {subject} to {to_emails}")
        return True

# Monkey Patch
automation_command.nexus_command = MockNexus()
automation_command.monitor_command = MockMonitor()

# Mock Automation Data
mock_auto = {
    "id": "test_auto",
    "name": "Test Automation",
    "active": True,
    "user_email": "test@example.com",
    "nodes": [
        {
            "id": "time_1",
            "type": "time_interval",
            "data": {"target_time": "00:00", "interval": 1, "unit": "days"} # Ensure it passes
        },
        {
            "id": "nexus_1",
            "type": "nexus",
            "data": {"code": "ALPHA", "value": "100", "actions": []}
        },
        {
            "id": "email_1",
            "type": "completion_email",
            "data": {"email": "target@example.com"}
        }
    ],
    "edges": [
        # Time -> Nexus
        {"source": "time_1", "target": "nexus_1", "sourceHandle": "right", "targetHandle": "left"},
        # Nexus -> Email
        {"source": "nexus_1", "target": "email_1", "sourceHandle": "right", "targetHandle": "left"}
    ]
}

# Override calculate_risk to always return True for initial conditions if any
# Actually, the automation above assumes Time Interval triggers.
# I need to ensure evaluate_condition returns True for 'time_interval'.
# Or I can just force the node_results in process_automation?
# I can't easily injection process_automation local vars.
# I'll monkey patch `evaluate_condition` to return True.

original_evaluate = automation_command.evaluate_condition

async def mock_evaluate(node):
    if node['type'] == 'time_interval':
        print("[MOCK] Time Interval Forced True")
        return True
    return await original_evaluate(node)

automation_command.evaluate_condition = mock_evaluate

async def run_test():
    print("--- Starting Test ---")
    # Patch execute_action/propagation check?
    # No, we want to test that exact logic.
    
    # We also need to patch importing inside execute_action
    # Since execute_action does localized imports:
    # try: from backend.integration import nexus_command ...
    
    # Python caches imports. If I inject them into sys.modules result or patch the module dict?
    # Better: Ensure `backend.integration.nexus_command` refers to my mock.
    
    print("--- 1. Patching Modules ---", flush=True)
    import types
    mock_mod = types.ModuleType("backend.integration.nexus_command")
    mock_mod.handle_nexus_command = MockNexus().handle_nexus_command
    sys.modules["backend.integration.nexus_command"] = mock_mod
    sys.modules["integration.nexus_command"] = mock_mod # fallback
    
    mock_mon = types.ModuleType("backend.integration.monitor_command")
    mock_mon.send_notification = MockMonitor().send_notification
    sys.modules["backend.integration.monitor_command"] = mock_mon
    
    # Need to patch usage_counter too potentially
    mock_usage = types.ModuleType("backend.usage_counter")
    mock_usage.increment_usage = lambda *args: None
    sys.modules["backend.usage_counter"] = mock_usage
    
    print("--- 2. Calling process_automation ---", flush=True)
    try:
        await automation_command.process_automation(mock_auto)
    except Exception as e:
        print(f"CRITICAL ERROR: {e}", flush=True)
        import traceback
        traceback.print_exc()

    print("--- Test Complete ---", flush=True)

if __name__ == "__main__":
    asyncio.run(run_test())
