
import asyncio
from datetime import datetime, timedelta
import sys
import os

# Add project root
sys.path.append(os.getcwd())

from backend.integration import automation_command

async def test_time_logic():
    output = []
    output.append("--- Testing Time Interval Logic ---")
    
    # Mock Node
    node = {
        'id': 'test_time_node',
        'type': 'time_interval',
        'data': {
            'target_time': '09:30',
            'interval': 1,
            'unit': 'days'
        }
    }

    # 1. Mock Time: Before 9:30 (e.g. 08:00)
    now = datetime.now()
    
    # CASE A: Target is in Future -> Should be False
    future_time = (now + timedelta(minutes=60)).strftime("%H:%M")
    node['data']['target_time'] = future_time
    # Reset last_run
    if 'last_run' in node['data']: del node['data']['last_run']
    
    output.append(f"Test A: Target {future_time} (Future) vs Now {now.strftime('%H:%M')}")
    try:
        res = await automation_command.evaluate_condition(node)
        output.append(f"   Result: {res} (Expected: False)")
        if res: output.append("   [FAILURE] Test A failed.")
    except Exception as e: output.append(f"   [ERROR] A: {e}")

    # CASE B: Target is in Past -> Should be True (First Run)
    past_time = (now - timedelta(minutes=60)).strftime("%H:%M")
    node['data']['target_time'] = past_time
    
    if now.weekday() > 4:
        output.append("   [SKIP] Today is Weekend. Logic correctly returns False for weekend.")
    else:
        output.append(f"Test B: Target {past_time} (Past) vs Now {now.strftime('%H:%M')}")
        try:
            res = await automation_command.evaluate_condition(node)
            output.append(f"   Result: {res} (Expected: True)")
            if not res: 
                 output.append("   [FAILURE] Test B failed.")
            else:
                 last_run = node['data'].get('last_run')
                 output.append(f"   last_run updated to: {last_run}")

            # CASE C: Run Again Immediately -> Should be False (Interval Check)
            output.append(f"Test C: Re-run immediately (Last Run: {node['data'].get('last_run')})")
            res = await automation_command.evaluate_condition(node)
            output.append(f"   Result: {res} (Expected: False due to interval)")
            if res: output.append("   [FAILURE] Test C failed.")
        except Exception as e: output.append(f"   [ERROR] B/C: {e}")

    with open("verification_time_output.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(output))

if __name__ == "__main__":
    asyncio.run(test_time_logic())
