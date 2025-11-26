import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
try:
    import main
    print("Import successful")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()
