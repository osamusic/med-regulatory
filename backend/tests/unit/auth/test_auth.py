from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from jose import jwt

from src.auth.auth import (
    ALGORITHM,
    SECRET_KEY,
    authenticate_user,
    create_access_token,
    get_password_hash,
    verify_password,
)


class TestPasswordFunctions:
    """Test password hashing and verification."""

    def test_password_hashing(self):
        """Test password hashing and verification."""
        password = "test_password"
        hashed = get_password_hash(password)

        assert hashed != password
        assert verify_password(password, hashed) is True
        assert verify_password("wrong_password", hashed) is False

    def test_different_passwords_different_hashes(self):
        """Test that different passwords produce different hashes."""
        password1 = "password1"
        password2 = "password2"

        hash1 = get_password_hash(password1)
        hash2 = get_password_hash(password2)

        assert hash1 != hash2


class TestTokenFunctions:
    """Test JWT token creation and verification."""

    def test_create_access_token(self):
        """Test JWT token creation."""
        data = {"sub": "test_user"}
        token = create_access_token(data)

        assert isinstance(token, str)
        assert len(token) > 0

    def test_verify_valid_token(self):
        """Test verification of valid token."""
        data = {"sub": "test_user"}
        token = create_access_token(data)

        # Manually verify token using jose
        verified_data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert verified_data["sub"] == "test_user"

    def test_verify_invalid_token(self):
        """Test verification of invalid token."""
        invalid_token = "invalid.token.here"

        with pytest.raises(Exception):  # jose.JWTError
            jwt.decode(invalid_token, SECRET_KEY, algorithms=[ALGORITHM])


class TestAuthenticateUser:
    """Test user authentication function."""

    def test_authenticate_user_success(self):
        """Test successful user authentication."""
        # Mock database session
        mock_db = MagicMock()
        mock_user = MagicMock()
        mock_user.hashed_password = get_password_hash("testpassword")
        mock_user.is_active = True

        # Mock the get_user function
        with patch("src.auth.auth.get_user", return_value=mock_user):
            result = authenticate_user(mock_db, "testuser", "testpassword")
            assert result == mock_user

    def test_authenticate_user_not_found(self):
        """Test authentication with non-existent user."""
        mock_db = MagicMock()

        with patch("src.auth.auth.get_user", return_value=None):
            result = authenticate_user(mock_db, "nonexistent", "password")
            assert result is False

    def test_authenticate_user_wrong_password(self):
        """Test authentication with wrong password."""
        mock_db = MagicMock()
        mock_user = MagicMock()
        mock_user.hashed_password = get_password_hash("correctpassword")
        mock_user.is_active = True

        with patch("src.auth.auth.get_user", return_value=mock_user):
            result = authenticate_user(mock_db, "testuser", "wrongpassword")
            assert result is False

    def test_authenticate_user_inactive(self):
        """Test authentication with inactive user."""
        mock_db = MagicMock()
        mock_user = MagicMock()
        mock_user.hashed_password = get_password_hash("testpassword")
        mock_user.is_active = False

        with patch("src.auth.auth.get_user", return_value=mock_user):
            result = authenticate_user(mock_db, "testuser", "testpassword")
            assert result is False
