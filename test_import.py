import sys
import os

# Add current dir to path logic similar to main usage
sys.path.append(os.getcwd())

print("Attempting to import ModRequest from backend.schemas...")
try:
    from backend.schemas import ModRequest
    print("SUCCESS: ModRequest imported.")
    print(ModRequest)
except ImportError as e:
    print(f"FAILED to import ModRequest: {e}")
except Exception as e:
    print(f"FAILED with unexpected error: {e}")

print("Attempting to import backend.routers.auth...")
try:
    from backend.routers import auth
    print("SUCCESS: auth module imported.")
except Exception as e:
    print(f"FAILED to import auth: {e}")
