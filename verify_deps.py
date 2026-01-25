import sys
import os
import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ensure project root is in path
sys.path.append(os.getcwd())

def test_full_dependency_load():
    print("--- Verifying Full Dependency Load ---")
    try:
        from backend.routers.background import get_prometheus_instance
        
        # Trigger instance creation which loads all modules
        prom = get_prometheus_instance()
        
        if not prom:
            print("❌ Prometheus instance is None!")
            return

        print("\n> Checking Loaded Functions:")
        funcs = [
            ("Risk", prom.risk_command_func),
            ("Derivative", prom.derivative_func),
            ("ML Forecast", prom.mlforecast_func),
            ("Sentiment", prom.sentiment_func),
            ("Fundamentals", prom.fundamentals_func),
            ("QuickScore", prom.quickscore_func),
            ("PowerScore", prom.powerscore_func)
        ]
        
        all_present = True
        for name, func in funcs:
            status = "✅ Loaded" if func else "❌ Missing"
            print(f"   - {name}: {status}")
            if not func: all_present = False
            
        if all_present:
            print("\n✅ All core command modules are successfully loaded!")
        else:
            print("\n⚠️ Some modules are still missing.")

    except Exception as e:
        print(f"❌ Verification Failed with Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_full_dependency_load()
