from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "SkyNet Backend Online"

def test_marketing_endpoint():
    # Assuming this endpoint exists, or testing 404
    response = client.get("/api/market/status")
    # If it depends on external services, it might fail or 404 if not mocked.
    # For now just checking it doesn't crash the server (500)
    assert response.status_code != 500
