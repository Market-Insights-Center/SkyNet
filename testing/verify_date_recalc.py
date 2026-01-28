
import sys
import os
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, os.getcwd())

def verify_date_logic():
    print("--- Verifying Date Recalculation ---")
    
    # We want to test logic: 
    # Current Time: 09:11 AM
    # Target Time: 09:30 AM
    # Result should be: TODAY at 09:30 AM
    
    # Logic extracted from automation_command.calculate_next_run (which we modified or want to test)
    # But wait, automation_command's logic is what we are calling into.
    
    from backend.integration import automation_command
    
    # We need to Mock datetime in automation_command to test behavior
    from unittest.mock import patch, MagicMock
    
    mock_now = datetime.now().replace(hour=9, minute=11, second=0, microsecond=0)
    print(f"🕒 Mock Current Time: {mock_now.strftime('%Y-%m-%d %H:%M:%S')}")
    
    target_str = "09:30"
    
    # Patch datetime in automation_command
    with patch('backend.integration.automation_command.datetime') as mock_date:
        mock_date.now.return_value = mock_now
        # Copy other methods
        mock_date.strptime = datetime.strptime
        mock_date.fromisoformat = datetime.fromisoformat
        mock_date.timedelta = timedelta
        
        # Call Function
        res = automation_command.calculate_next_run(target_str)
        print(f"👉 Result: {res}")
        
        res_dt = datetime.fromisoformat(res)
        
        if res_dt.date() == mock_now.date():
            print("✅ SUCCESS: Next Run is TODAY")
        else:
            print(f"❌ FAIL: Next Run is {res_dt.date()} (Should be {mock_now.date()})")

    # Test Case 2: After 9:30
    mock_now_late = datetime.now().replace(hour=9, minute=31, second=0, microsecond=0)
    print(f"\n🕒 Mock Current Time (Late): {mock_now_late.strftime('%Y-%m-%d %H:%M:%S')}")
    
    with patch('backend.integration.automation_command.datetime') as mock_date:
        mock_date.now.return_value = mock_now_late
        res_late = automation_command.calculate_next_run(target_str)
        print(f"👉 Result: {res_late}")
        
        res_late_dt = datetime.fromisoformat(res_late)
        if res_late_dt.date() > mock_now_late.date():
             print("✅ SUCCESS: Next Run is TOMORROW (or later)")
        else:
             print(f"❌ FAIL: Next Run is {res_late_dt.date()} (Should be after today)")

if __name__ == "__main__":
    verify_date_logic()
