from unittest.mock import patch

def test_check_username_available(client):
    # Mock database call to return empty list (no users)
    with patch("backend.routers.auth.get_all_users_from_db", return_value=[]):
        response = client.post("/api/auth/check-username", json={"username": "newuser123"})
        assert response.status_code == 200
        assert response.json() == {"available": True, "message": "Username is available"}

def test_check_username_taken(client):
    # Mock database call to return a user with the requested username
    existing_users = [{"username": "existinguser", "email": "test@example.com"}]
    with patch("backend.routers.auth.get_all_users_from_db", return_value=existing_users):
        response = client.post("/api/auth/check-username", json={"username": "ExistingUser"})
        assert response.status_code == 200
        assert response.json() == {"available": False, "message": "Username already taken"}

def test_check_username_empty(client):
    with patch("backend.routers.auth.get_all_users_from_db", return_value=[]):
        response = client.post("/api/auth/check-username", json={"username": ""})
        assert response.status_code == 200
        assert response.json() == {"available": False, "message": "Username cannot be empty"}
