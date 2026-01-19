import sys
import os
import pytest

# Add parent directory to path to allow importing backend modules
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(current_dir)) # SkyNet root
sys.path.insert(0, parent_dir)
sys.path.insert(0, os.path.join(parent_dir, 'backend'))

def test_import_main():
    """Verify that backend.main can be imported without errors."""
    try:
        from backend.main import app
        assert app is not None
    except ImportError as e:
        pytest.fail(f"Failed to import backend.main: {e}")
    except Exception as e:
        pytest.fail(f"Exception during import of backend.main: {e}")

if __name__ == "__main__":
    # Allow running this script directly
    test_import_main()
    print("✅ backend.main imported successfully.")
