import sys
import os
import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ensure project root is in path
sys.path.append(os.getcwd())

def test_logs_endpoint():
    print("--- Verifying Log Viewer Endpoint ---")
    try:
        from backend.routers.background import router
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        # 1. Create a dummy log file if it mimics behavior or check if it exists
        log_file = "prometheus_core.log"
        if not os.path.exists(log_file):
            print(f"   -> Creating dummy {log_file} for testing...")
            with open(log_file, "w", encoding="utf-8") as f:
                for i in range(120):
                    f.write(f"Log Line {i} - Test Event\n")
        
        # 2. Test Fetching Logs
        print("\n> Testing GET /api/background/logs?lines=10...")
        res = client.get("/api/background/logs?lines=10")
        
        if res.status_code == 200:
            data = res.json()
            logs = data.get("logs", [])
            print(f"✅ Status OK. Received {len(logs)} lines.")
            print(f"   Last Line: {logs[-1].strip() if logs else 'None'}")
            
            if len(logs) == 10:
                print("✅ Correct number of lines returned.")
            else:
                print(f"⚠️ Warning: Expected 10 lines, got {len(logs)}.")
        else:
            print(f"❌ Request Failed: {res.status_code} - {res.text}")

    except Exception as e:
        print(f"❌ Verification Failed with Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_logs_endpoint()
