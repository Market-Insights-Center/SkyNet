
import sys
print(f"Python Executable: {sys.executable}")
try:
    import duckduckgo_search
    print("SUCCESS: duckduckgo_search is installed.")
    print(f"Version: {duckduckgo_search.__version__}")
except ImportError as e:
    print(f"FAILURE: {e}")
