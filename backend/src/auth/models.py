"""Pydantic models for authentication and user management.

This module defines request/response models for authentication endpoints,
token data, and user information.
"""

from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    """JWT token response model."""

    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Token data extracted from JWT."""

    username: Optional[str] = None


class UserBase(BaseModel):
    """Base user model with common fields."""

    username: str


class RegisterRequest(BaseModel):
    """User registration request model."""

    username: str
    password: str
    user_registration_code: Optional[str] = None
    admin_code: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    """Password change request model."""

    current_password: str
    new_password: str


class User(UserBase):
    """User response model with database fields."""

    id: int
    is_admin: bool = False

    class Config:
        from_attributes = True
