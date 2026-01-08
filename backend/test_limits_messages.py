import sys
import os
sys.path.append(os.getcwd())

from backend.database import verify_access_and_limits, verify_storage_limit

# Fake database/auth mocks are hard here because of direct firebase calls.
# However, verify_access_and_limits uses load_tier_limits which reads CSV.
# And it mocks get_db if we patch it.

from unittest.mock import MagicMock, patch

def test_limits():
    print("--- Testing Limits Messages ---")
    
    with patch('backend.database.get_db') as mock_db:
        with patch('backend.database.get_user_profile') as mock_profile:
            # Mock User Doc
            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {'tier': 'Basic'}
            mock_db.return_value.collection.return_value.document.return_value.get.return_value = mock_doc
            
            # Mock Tier Limits CSV loading (Real file read is safer if exists, but for unit test consistency...)
            # Actually, let's rely on the real file since we didn't change the CSV, just the Python code.
            
            # Test 1: Locked Feature (NA) -> Breakout for Basic
            # Breakout is NA for Basic (Line 11 in CSV)
            print("Test 1: Basic user accessing 'breakout' (NA)")
            res = verify_access_and_limits('test@example.com', 'breakout')
            print(f"Result: {res}")
            if "locked to the Pro tier" in res.get('message', ''):
                print("SUCCESS: Correct lock message.")
            else:
                print(f"FAILURE: Unexpected message: {res.get('message')}")

            # Test 2: Limit Exceeded
            # Mock Usage Check to fail
            # We need to mock the transaction part or the internal logic.
            # verify_access_and_limits has internal definition of increment_usage.
            # This is hard to mock without refactoring.
            # But we can test 'NA' logic easily.
            
            # Test 3: Guest Access
            print("Test 3: Guest accessing any feature")
            res_guest = verify_access_and_limits('guest', 'invest')
            print(f"Result: {res_guest}")
            if "Please sign in" in res_guest.get('message', ''):
                 print("SUCCESS: Correct guest message.")
            else:
                 print(f"FAILURE: Unexpected message: {res_guest.get('message')}")

if __name__ == "__main__":
    test_limits()
