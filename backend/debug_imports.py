import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
print(f"Sys path: {sys.path}")

try:
    print("Importing invest_command...")
    from integration import invest_command
    print("Success importing invest_command")
except Exception as e:
    print(f"Failed importing invest_command: {e}")
    import traceback
    traceback.print_exc()

try:
    print("Importing custom_command...")
    from integration import custom_command
    print("Success importing custom_command")
except Exception as e:
    print(f"Failed importing custom_command: {e}")
    import traceback
    traceback.print_exc()

try:
    print("Importing tracking_command...")
    from integration import tracking_command
    print("Success importing tracking_command")
except Exception as e:
    print(f"Failed importing tracking_command: {e}")
    import traceback
    traceback.print_exc()
