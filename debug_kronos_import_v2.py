import sys
import os
import traceback

# Add project root to path
sys.path.append(os.getcwd())

print("--- Debugging Kronos Command Import ---")
print(f"CWD: {os.getcwd()}")
print(f"Python Path: {sys.path}")

try:
    print("\nAttempting: from backend.integration import kronos_command")
    from backend.integration import kronos_command
    print("✅ Success: backend.integration.kronos_command imported.")
except ImportError as e:
    print(f"❌ Failed: {e}")
    traceback.print_exc()
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
    traceback.print_exc()

print("\n--- Attempting Fallback ---")
try:
    print("Attempting: from integration import kronos_command")
    from integration import kronos_command
    print("✅ Success: integration.kronos_command imported.")
except ImportError as e:
    print(f"❌ Failed: {e}")
    traceback.print_exc()
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
    traceback.print_exc()
