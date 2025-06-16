import pytest
from fastapi.testclient import TestClient


class TestAuthEndpoints:
    """Test authentication endpoints."""

    def test_root_endpoint(self, client: TestClient):
        """Test root endpoint accessibility."""
        response = client.get("/")
        assert response.status_code == 200
        assert "MedShield AI Backend is running" in response.json()["message"]

    def test_register_user(self, client: TestClient):
        """Test user registration."""
        user_data = {
            "username": "testuser",
            "password": "testpassword123",
            "admin_code": "admin123",  # Use admin code for registration
        }

        response = client.post("/register", json=user_data)
        assert response.status_code == 200

        data = response.json()
        assert data["username"] == "testuser"
        assert "id" in data

    def test_register_duplicate_user(self, client: TestClient):
        """Test registration with duplicate username."""
        user_data = {
            "username": "duplicateuser",  # Use unique username for this test
            "password": "testpassword123",
            "admin_code": "admin123",
        }

        # First registration should succeed
        response1 = client.post("/register", json=user_data)
        assert response1.status_code == 200

        # Second registration with same username should fail
        response2 = client.post("/register", json=user_data)
        assert response2.status_code == 400

    def test_login_valid_user(self, client: TestClient):
        """Test login with valid credentials."""
        # First register a user
        user_data = {
            "username": "loginuser",  # Use unique username for this test
            "password": "testpassword123",
            "admin_code": "admin123",
        }
        client.post("/register", json=user_data)

        # Then try to login
        login_data = {"username": "loginuser", "password": "testpassword123"}

        response = client.post("/token", data=login_data)
        assert response.status_code == 200

        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_invalid_credentials(self, client: TestClient):
        """Test login with invalid credentials."""
        login_data = {"username": "nonexistent", "password": "wrongpassword"}

        response = client.post("/token", data=login_data)
        assert response.status_code == 401
