"""Authentication package for MedShield AI.

This package provides JWT-based authentication, user management, and
authorization utilities for the FastAPI application.
"""

from .auth import (
    authenticate_user,
    create_access_token,
    get_admin_user,
    get_current_active_user,
    get_current_user,
    get_password_hash,
    regenerate_session_after_login,
    verify_password,
)
from .models import RegisterRequest, Token, TokenData, User, UserBase

__all__ = [
    "get_password_hash",
    "verify_password",
    "create_access_token",
    "get_current_user",
    "get_current_active_user",
    "get_admin_user",
    "authenticate_user",
    "regenerate_session_after_login",
    "Token",
    "TokenData",
    "UserBase",
    "RegisterRequest",
    "User",
]
