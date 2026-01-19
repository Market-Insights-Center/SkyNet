import sys
import os
import traceback

# Setup path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)
sys.path.insert(0, current_dir)

# Enforce UTF-8 for stdout/stderr
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

print("--- Attempting to import backend.main ---")
try:
    from backend.main import app
    print("✅ Successfully imported backend.main:app")
except Exception as e:
    with open("server_error.log", "w", encoding="utf-8") as f:
        f.write("❌ Failed to import backend.main:\n")
        traceback.print_exc(file=f)
    print("❌ Failed. Check server_error.log")
    sys.exit(1)

print("--- Checking Startup Events ---")
print("App loaded successfully.")
