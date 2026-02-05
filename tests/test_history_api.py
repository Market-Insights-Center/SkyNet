
import requests
import json
import time

BASE_URL = "http://localhost:8000/api/sentinel"
EMAIL = "marketinsightscenter@gmail.com"

def test_history():
    print("Testing Sentinel History API...")

    # 1. Save Session
    payload = {
        "user_prompt": "Test Prompt",
        "email": EMAIL,
        "plan": [{"step_id": 1, "tool": "test"}],
        "summary": "Test Summary",
        "logs": "Test Logs"
    }
    
    print("1. Saving Session...")
    res = requests.post(f"{BASE_URL}/save-session", json=payload)
    if res.status_code != 200:
        print(f"FAILED: {res.text}")
        return
    
    data = res.json()
    session_id = data.get("id")
    print(f"   -> Session Saved. ID: {session_id}")
    
    # 2. List History
    print("2. Listing History...")
    res = requests.get(f"{BASE_URL}/history?email={EMAIL}")
    history = res.json()
    print(f"   -> Found {len(history)} sessions.")
    
    found = False
    for h in history:
        if h["id"] == session_id:
            found = True
            print("   -> Verify: Found saved session in list.")
            break
    
    if not found:
        print("FAILED: Session not found in history list.")
        return

    # 3. Delete Session
    print("3. Deleting Session...")
    res = requests.post(f"{BASE_URL}/history/delete", json={"id": session_id})
    if res.status_code == 200:
        print("   -> Delete successful.")
    else:
        print(f"FAILED: Delete returned {res.status_code}")

    # Verify Delete
    res = requests.get(f"{BASE_URL}/history?email={EMAIL}")
    history = res.json()
    found_after = any(h["id"] == session_id for h in history)
    if not found_after:
        print("   -> Verify: Session correctly removed.")
    else:
        print("FAILED: Session still exists after delete.")

if __name__ == "__main__":
    try:
        test_history()
    except Exception as e:
        print(f"Error: {e}")
