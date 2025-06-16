"""Hybrid authentication supporting both JWT and Firebase.

This module provides a unified authentication interface that supports
both traditional JWT tokens and Firebase authentication.
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session as SQLAlchemySession

from ..db.database import get_db
from ..db.models import User as UserModel
from .auth import ALGORITHM, SECRET_KEY, TokenData, get_user, oauth2_scheme

logger = logging.getLogger(__name__)


async def get_current_user_jwt_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: SQLAlchemySession = Depends(get_db),
) -> Optional[UserModel]:
    """Try to get user from JWT token, return None if failed."""
    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            return None
        token_data = TokenData(username=username)
    except JWTError:
        return None

    if token_data.username is None:
        return None

    user = get_user(db, username=token_data.username)
    return user


async def get_current_user_hybrid(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: SQLAlchemySession = Depends(get_db),
) -> UserModel:
    """Get current user from either JWT or Firebase authentication.

    Uses X-Auth-Type header to determine which authentication method to use.
    Falls back to JWT if no header is specified.

    Args:
        request: HTTP request object to read headers
        token: Bearer token from Authorization header
        db: Database session

    Returns:
        Authenticated user model

    Raises:
        HTTPException: If authentication fails
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check X-Auth-Type header to determine authentication method
    auth_type = request.headers.get("X-Auth-Type", "jwt").lower()
    logger.debug(f"Authentication type specified: {auth_type}")

    if auth_type == "firebase":
        # Use Firebase authentication
        try:
            from fastapi.security import HTTPAuthorizationCredentials

            from .firebase_auth import (
                get_or_create_firebase_user,
                verify_firebase_token,
            )

            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=token
            )
            token_claims = await verify_firebase_token(credentials)

            if token_claims:
                firebase_user = await get_or_create_firebase_user(token_claims, db)
                if firebase_user:
                    logger.debug(
                        f"User authenticated via Firebase: {firebase_user.username}"
                    )
                    return firebase_user

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Firebase authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Firebase authentication error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        # Use JWT authentication (default)
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if username:
                token_data = TokenData(username=username)
                jwt_user = get_user(db, username=token_data.username)
                if jwt_user:
                    logger.debug(f"User authenticated via JWT: {jwt_user.username}")
                    return jwt_user

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        except JWTError as e:
            logger.debug(f"JWT authentication failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )


async def get_current_active_user_hybrid(
    current_user: UserModel = Depends(get_current_user_hybrid),
) -> UserModel:
    """Get current active user from hybrid authentication.

    Args:
        current_user: Authenticated user from hybrid auth

    Returns:
        Active user model

    Raises:
        HTTPException: If user is not active
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user"
        )
    return current_user


async def get_admin_user_hybrid(
    current_user: UserModel = Depends(get_current_user_hybrid),
) -> UserModel:
    """Get current admin user from hybrid authentication.

    Args:
        current_user: Authenticated user from hybrid auth

    Returns:
        Admin user model

    Raises:
        HTTPException: If user is not admin
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required"
        )
    return current_user


# Export convenience aliases that match existing auth module interface
get_current_user = get_current_user_hybrid
get_current_active_user = get_current_active_user_hybrid
get_admin_user = get_admin_user_hybrid
get_current_admin_user = get_admin_user_hybrid
