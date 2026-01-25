import sys
import os
import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ensure project root is in path
sys.path.append(os.getcwd())

def test_api_real_dependencies():
    print("--- Starting Functional API Verification (Real Dependencies) ---")
    try:
        from backend.routers.background import router
        print("✅ Router imported.")
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        # 1. Test Status
        print("\n> Testing GET /api/background/status...")
        res = client.get("/api/background/status")
        if res.status_code == 200:
            print(f"✅ Status OK: {res.json()}")
        else:
            print(f"❌ Status Failed: {res.status_code} - {res.text}")

        # 2. Test Toggle
        print("\n> Testing POST /api/background/toggle...")
        res = client.post("/api/background/toggle", json={"active": True})
        if res.status_code == 200:
            print(f"✅ Toggle ON OK: {res.json()}")
        else:
            print(f"❌ Toggle ON Failed: {res.status_code} - {res.text}")
            
        res = client.post("/api/background/toggle", json={"active": False})
        if res.status_code == 200:
            print(f"✅ Toggle OFF OK: {res.json()}")
        else:
            print(f"❌ Toggle OFF Failed: {res.status_code} - {res.text}")

        # 3. Test Run (Dry run logic mainly, real command execution might fail dependencies)
        # We'll try to run an invalid command to check routing, 
        # as running 'optimize' might start a heavy process or fail if 'risk_command' etc aren't there.
        # But we want to verify the 'parts' construction doesn't crash.
        
        # NOTE: running 'optimize' with real Prometheus instantiates a real task. 
        # If imports are missing in Prometheus, it might error.
        # Let's try 'optimize' but expect potential failure, as long as it's not a 500 router crash.
        
        print("\n> Testing POST /api/background/run (optimize)...")
        res = client.post("/api/background/run", json={
            "command": "optimize",
            "params": {"strategy": "rsi", "ticker": "SPY", "period": "1y"}
        })
        print(f"Response: {res.status_code} - {res.text}")
        if res.status_code == 200:
            print("✅ Optimize Request Handled Success")
        elif res.status_code == 503:
            print("⚠️ Optimize Unavailable (Kronos not loaded) - Expected fallback")
        else:
            print(f"❌ Optimize Request Failed: {res.status_code}")

    except Exception as e:
        print(f"❌ Verification Failed with Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_api_real_dependencies()
