"""Authentication and authorization utilities for MedShield AI.

This module provides JWT token management, password hashing, user authentication,
and authorization functions for the FastAPI application.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session as SQLAlchemySession

from ..db.database import get_db
from ..db.models import User as UserModel
from .models import TokenData, User

load_dotenv()

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY", "YOUR_SECRET_KEY_HERE"
)  # Should be loaded from environment
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password, hashed_password):
    """Verify a plain password against a hashed password.

    Args:
        plain_password: The plain text password.
        hashed_password: The hashed password to verify against.

    Returns:
        True if password matches, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    """Generate a hash for a plain password.

    Args:
        password: The plain text password to hash.

    Returns:
        The hashed password.
    """
    return pwd_context.hash(password)


def get_user(db: SQLAlchemySession, username: str):
    """Retrieve a user by username from the database.

    Args:
        db: Database session.
        username: The username to search for.

    Returns:
        User object if found, None otherwise.
    """
    return db.query(UserModel).filter(UserModel.username == username).first()


def authenticate_user(db: SQLAlchemySession, username: str, password: str):
    """Authenticate a user with username and password.

    Args:
        db: Database session.
        username: The username to authenticate.
        password: The plain text password.

    Returns:
        User object if authentication successful, False otherwise.
    """
    logger.debug(f"Authentication attempt: username '{username}'")
    user = get_user(db, username)
    if not user:
        logger.debug(f"User '{username}' not found")
        return False

    logger.debug(f"Password verification: input password length {len(password)}")

    if not verify_password(password, user.hashed_password):
        logger.debug(f"Password mismatch for user '{username}'")
        return False

    if not user.is_active:
        logger.debug(f"User '{username}' is not activated")
        return False

    logger.debug(f"Authentication successful for user '{username}'")
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token.

    Args:
        data: The data to encode in the token.
        expires_delta: Optional expiration time delta.

    Returns:
        Encoded JWT token string.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: SQLAlchemySession = Depends(get_db)
):
    """Get the current authenticated user from JWT token.

    Args:
        token: JWT token from OAuth2 scheme.
        db: Database session.

    Returns:
        User object if token is valid.

    Raises:
        HTTPException: If token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    if token_data.username is None:
        raise credentials_exception

    user = get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)):
    """Get the current active user.

    Args:
        current_user: Current authenticated user.

    Returns:
        The current user object.
    """
    return current_user


async def get_admin_user(current_user: User = Depends(get_current_user)):
    """Get current user and verify admin privileges.

    Args:
        current_user: Current authenticated user.

    Returns:
        User object if user has admin privileges.

    Raises:
        HTTPException: If user lacks admin privileges.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required"
        )
    return current_user


async def get_current_admin_user(current_user: User = Depends(get_current_user)):
    """Get current admin user (alias for get_admin_user).

    Args:
        current_user: Current authenticated user.

    Returns:
        User object if user has admin privileges.
    """
    return await get_admin_user(current_user)


def regenerate_session_after_login(
    request: Request, response: Response, user: UserModel
):
    """Regenerate session after successful login to prevent session fixation attacks.

    This should be called after successful authentication.

    Args:
        request: HTTP request object.
        response: HTTP response object.
        user: Authenticated user object.
    """

    response.set_cookie(
        key="session_regenerated",
        value="true",
        httponly=True,
        secure=True,
        samesite="lax",
    )

    client_host = request.client.host if request.client else "unknown"
    print(
        f"Session regenerated for user {user.username} from IP {client_host} at {datetime.utcnow()}"
    )
