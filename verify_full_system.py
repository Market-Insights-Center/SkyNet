
import requests
import json
import time

BASE_URL = "http://localhost:8002/api"

def check_endpoint(method, endpoint, payload=None, description=""):
    print(f"Checking {method} {endpoint} ({description})...", end=" ")
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}/{endpoint}")
        elif method == "POST":
            response = requests.post(f"{BASE_URL}/{endpoint}", json=payload)
        
        if response.status_code in [200, 201]:
            print("OK")
            return True
        else:
            print(f"FAILED ({response.status_code})")
            print(f"  Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def run_tests():
    print("\n--- Starting Full System Verification ---")
    
    # 1. Health/Basic
    check_endpoint("GET", "health_check", description="Health Check")
    
    # 2. Articles (CMS)
    check_endpoint("GET", "articles", description="List Articles")
    
    # 3. Market Data (Critical)
    # Getting market status or similar lightweight market endpoint
    check_endpoint("GET", "market_status", description="Market Status") 
    
    # 4. Automations (Medulla)
    check_endpoint("GET", "automations", description="List Automations")
    
    # 5. Nexus/Invest via API (Simulation)
    # We can't easily trigger a full nexus run via GET, but we can check if the router is alive
    # verify_nexus_fix.py handles the logic deep dive.
    
    # 6. Users
    check_endpoint("GET", "users", description="List Users")
    
    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    run_tests()
