import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture
def client():
    # Use TestClient as a context manager if using lifespan events
    with TestClient(app) as c:
        yield c
