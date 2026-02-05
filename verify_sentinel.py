
import sys
import os
import asyncio

# Fix path to allow importing backend modules
sys.path.append(os.getcwd())

try:
    print("Importing sentinel_command...")
    from backend.integration import sentinel_command
    print("Import successful.")

    print("\nChecking for handle_summary_tool...")
    if hasattr(sentinel_command, 'handle_summary_tool'):
        print("PASS: handle_summary_tool exists in module.")
    else:
        print("FAIL: handle_summary_tool NOT found in module.")
        sys.exit(1)

    print("\nChecking COMMAND_REGISTRY...")
    if hasattr(sentinel_command, 'COMMAND_REGISTRY'):
        print("PASS: COMMAND_REGISTRY exists.")
        registry = sentinel_command.COMMAND_REGISTRY
        
        if "summary" in registry:
            print("PASS: 'summary' tool is in registry.")
            handler = registry["summary"]
            print(f"Handler for summary: {handler}")
            
            # Verify handler is callable (it might be a lambda)
            if callable(handler):
                print("PASS: Handler is callable.")
            else:
                print("FAIL: Handler is not callable.")
                sys.exit(1)
        else:
            print("FAIL: 'summary' tool missing from registry.")
            sys.exit(1)
    else:
        print("FAIL: COMMAND_REGISTRY NOT found.")
        sys.exit(1)

    print("\nSentinel Integrity Check Passed!")

except Exception as e:
    print(f"\nCRITICAL ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
