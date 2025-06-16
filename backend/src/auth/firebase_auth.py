"""Firebase Authentication integration for MedShield AI.

This module provides Firebase token verification and user management
as an alternative to JWT-based authentication.
"""

import logging
import os
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    from firebase_admin import credentials

    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    firebase_admin = None
    firebase_auth = None
    credentials = None
from sqlalchemy.orm import Session as SQLAlchemySession

from ..db.database import get_db
from ..db.models import User as UserModel

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
firebase_initialized = False


def initialize_firebase():
    """Initialize Firebase Admin SDK with credentials."""
    global firebase_initialized

    if firebase_initialized or not FIREBASE_AVAILABLE:
        return

    try:
        # Try to load Firebase credentials from environment variables
        firebase_credentials_json = os.getenv("FIREBASE_CREDENTIAL_JSON")
        firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")

        if firebase_credentials_json:
            # Load credentials from JSON string
            import json

            cred_dict = json.loads(firebase_credentials_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized with JSON credentials from environment")
        elif firebase_credentials_path and os.path.exists(firebase_credentials_path):
            # Load credentials from file path
            cred = credentials.Certificate(firebase_credentials_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized with service account credentials file")
        else:
            # Use default credentials (useful for Google Cloud environments)
            firebase_admin.initialize_app()
            logger.info("Firebase initialized with default credentials")

        firebase_initialized = True
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        raise RuntimeError("Firebase initialization failed")


# Initialize Firebase on module import
if FIREBASE_AVAILABLE:
    try:
        initialize_firebase()
    except RuntimeError:
        logger.warning(
            "Firebase initialization failed - Firebase auth will not be available"
        )
else:
    logger.info("Firebase Admin SDK not available - Firebase auth disabled")

# Security scheme for Firebase Bearer tokens
firebase_bearer = HTTPBearer(auto_error=False)


async def verify_firebase_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(firebase_bearer),
) -> Optional[dict]:
    """Verify Firebase ID token from Authorization header.

    Args:
        credentials: Bearer token from Authorization header

    Returns:
        Decoded token claims if valid, None otherwise

    Raises:
        HTTPException: If token is invalid
    """
    if not credentials:
        return None

    if not firebase_initialized or not FIREBASE_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not available",
        )

    try:
        # Verify the Firebase ID token
        decoded_token = firebase_auth.verify_id_token(credentials.credentials)
        return decoded_token
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token"
        )
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token has expired",
        )
    except Exception as e:
        logger.error(f"Firebase token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


async def get_or_create_firebase_user(
    token_claims: dict, db: SQLAlchemySession = Depends(get_db)
) -> UserModel:
    """Get or create user from Firebase token claims.

    Args:
        token_claims: Decoded Firebase token claims
        db: Database session

    Returns:
        User model instance
    """
    firebase_uid = token_claims.get("uid")
    email = token_claims.get("email", "")
    # Generate username without storing email
    if email:
        # Use email prefix as username hint but don't store full email
        username = f"{email.split('@')[0][:8]}_{firebase_uid[:8]}"
    else:
        username = f"firebase_{firebase_uid[:8]}"

    # Try to find existing user by Firebase UID
    user = db.query(UserModel).filter(UserModel.firebase_uid == firebase_uid).first()

    if not user:
        # Create new user if not exists
        user = UserModel(
            username=username,
            firebase_uid=firebase_uid,
            is_admin=False,  # Default to non-admin
            is_active=True,  # Firebase users are active by default
            hashed_password="",  # No password for Firebase users
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Created new user from Firebase: {user.username}")

    return user


async def get_current_user_firebase(
    token_claims: Optional[dict] = Depends(verify_firebase_token),
    db: SQLAlchemySession = Depends(get_db),
) -> Optional[UserModel]:
    """Get current user from Firebase token.

    Args:
        token_claims: Verified Firebase token claims
        db: Database session

    Returns:
        User model if authenticated, None otherwise
    """
    if not token_claims:
        return None

    return await get_or_create_firebase_user(token_claims, db)


async def get_current_active_user_firebase(
    user: Optional[UserModel] = Depends(get_current_user_firebase),
) -> Optional[UserModel]:
    """Get current active user from Firebase auth.

    Args:
        user: Current Firebase user

    Returns:
        User if active, None otherwise
    """
    if user and user.is_active:
        return user
    return None


async def get_admin_user_firebase(
    user: Optional[UserModel] = Depends(get_current_user_firebase),
) -> Optional[UserModel]:
    """Get current admin user from Firebase auth.

    Args:
        user: Current Firebase user

    Returns:
        User if admin, None otherwise
    """
    if user and user.is_admin:
        return user
    return None
