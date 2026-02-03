import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

@pytest.fixture
def clean_env():
    """Ensure clean environment variables for tests."""
    old_env = os.environ.copy()
    yield
    os.environ.clear()
    os.environ.update(old_env)
