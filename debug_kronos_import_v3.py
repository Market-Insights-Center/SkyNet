import sys
import os
import traceback

# Redirect stdout/stderr to a file
log_file = os.path.join(os.getcwd(), "import_debug_log.txt")
with open(log_file, "w", encoding="utf-8") as f:
    sys.stdout = f
    sys.stderr = f
    
    print("--- Debugging Kronos Command Import (File Log) ---")
    print(f"CWD: {os.getcwd()}")
    sys.path.append(os.getcwd())
    print(f"Python Path: {sys.path}")

    try:
        print("\nAttempting: from backend.integration import kronos_command")
        from backend.integration import kronos_command
        print("✅ Success: backend.integration.kronos_command imported.")
    except Exception as e:
        print(f"❌ Failed: {e}")
        traceback.print_exc()

    print("\n--- Attempting Fallback ---")
    try:
        print("Attempting: from integration import kronos_command")
        from integration import kronos_command
        print("✅ Success: integration.kronos_command imported.")
    except Exception as e:
        print(f"❌ Failed: {e}")
        traceback.print_exc()
