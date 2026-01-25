import sys
import os
import asyncio

# Ensure project root is in path
sys.path.append(os.getcwd())

async def test_import_and_init():
    print("--- Starting Verification of Background Router ---")
    try:
        from backend.routers.background import get_prometheus_instance
        print("✅ Import backend.routers.background successful")
        
        prom = get_prometheus_instance()
        print(f"✅ Prometheus instance obtained: {prom}")
        
        if prom:
            print(f"   Is active: {prom.is_active}")
            # print(f"   Loaded modules: {prom.__dict__.keys()}")
            
            # Check if Kronos command is importable/available via router logic
            # (Note: we can't easily check the local variable inside the module without inspecting it, 
            # but getting the instance implies the module loaded)
            
        else:
            print("❌ Prometheus instance is None!")
            
    except Exception as e:
        print(f"❌ Verification Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_import_and_init())
