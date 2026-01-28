
import sys
import os
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

# Add CWD to path to ensure 'backend' can be imported as a top-level package
sys.path.insert(0, os.getcwd())

async def verify_medulla():
    print("--- Verifying Medulla Automation ---")
    
    # 1. Load Automation
    try:
        with open('backend/data/automations.json', 'r') as f:
            autos = json.load(f)
            medulla = next((a for a in autos if 'Medulla' in a.get('name', '')), None)
            
        if not medulla:
            print("❌ Medulla automation not found")
            return

        print(f"✅ Found Medulla: {medulla['id']}")
        
        # 2. Check Time Logic
        
        # Mocking time to 09:30 AM
        now = datetime.now()
        target_today = now.replace(hour=9, minute=30, second=0, microsecond=0)
        
        print(f"🕒 Mocking Time to: {target_today}")

        with patch('backend.integration.automation_command.datetime') as mock_date:
            mock_date.now.return_value = target_today
            mock_date.fromisoformat = datetime.fromisoformat
            mock_date.strptime = datetime.strptime
            
            from backend.integration import automation_command
            
            # Also mock external calls
            automation_command.risk_command = MagicMock()
            
            # FIX: Return a Future for async call
            f = asyncio.Future()
            f.set_result((55, 60, 60, 60, 400, 15))
            automation_command.risk_command.calculate_risk_scores_singularity.return_value = f
            
            # Ensure other risk calcs don't crash (these are sync or ran in thread wrapper, checking usage)
            # calculate_recession_likelihood_ema_risk is run via asyncio.to_thread
            # So the mock just needs to be callable.
            automation_command.risk_command.calculate_recession_likelihood_ema_risk.return_value = 0.5
            automation_command.risk_command.calculate_recession_likelihood_vix_risk.return_value = 0.5
            automation_command.risk_command.calculate_market_invest_score_risk.return_value = (None, 75, None)

            automation_command.execute_action = MagicMock()
            
            # Activate it
            medulla['active'] = True
            
            # Execute
            await automation_command.process_automation(medulla)
            
            # Verify
            if automation_command.execute_action.called:
                print("✅ SUCCESS: Action execution was triggered.")
                print(f"   Called {automation_command.execute_action.call_count} times.")
            else:
                 print("⚠️ WARNING: Action execution was NOT triggered.")

    except Exception as e:
        print(f"❌ Error during verification: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(verify_medulla())
