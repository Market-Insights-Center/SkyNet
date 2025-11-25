import requests
import json

BASE_URL = "http://localhost:8000"
SUPER_ADMIN = "marketinsightscenter@gmail.com"

def test_get_mods():
    print("Testing GET /api/mods...")
    try:
        res = requests.get(f"{BASE_URL}/api/mods")
        if res.status_code == 200:
            print("SUCCESS: Retrieved mods list:", res.json())
        else:
            print(f"FAILURE: Status {res.status_code}, Response: {res.text}")
    except Exception as e:
        print(f"ERROR: {e}")

def test_add_mod():
    print("\nTesting POST /api/mods (ADD)...")
    payload = {
        "email": "test_mod@example.com",
        "action": "add",
        "requester_email": SUPER_ADMIN
    }
    try:
        res = requests.post(f"{BASE_URL}/api/mods", json=payload)
        if res.status_code == 200:
            print("SUCCESS: Added mod:", res.json())
        else:
            print(f"FAILURE: Status {res.status_code}, Response: {res.text}")
    except Exception as e:
        print(f"ERROR: {e}")

def test_remove_mod():
    print("\nTesting POST /api/mods (REMOVE)...")
    payload = {
        "email": "test_mod@example.com",
        "action": "remove",
        "requester_email": SUPER_ADMIN
    }
    try:
        res = requests.post(f"{BASE_URL}/api/mods", json=payload)
        if res.status_code == 200:
            print("SUCCESS: Removed mod:", res.json())
        else:
            print(f"FAILURE: Status {res.status_code}, Response: {res.text}")
    except Exception as e:
        print(f"ERROR: {e}")

def test_unauthorized_add():
    print("\nTesting POST /api/mods (UNAUTHORIZED)...")
    payload = {
        "email": "hacker@example.com",
        "action": "add",
        "requester_email": "random_user@example.com"
    }
    try:
        res = requests.post(f"{BASE_URL}/api/mods", json=payload)
        if res.status_code == 403:
            print("SUCCESS: Unauthorized request blocked.")
        else:
            print(f"FAILURE: Expected 403, got {res.status_code}, Response: {res.text}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_get_mods()
    test_add_mod()
    test_get_mods() # Verify addition
    test_remove_mod()
    test_get_mods() # Verify removal
    test_unauthorized_add()
