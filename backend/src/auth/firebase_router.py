"""Firebase authentication router for handling client-side Firebase auth.

This module provides endpoints for Firebase authentication where the client
sends Firebase ID tokens to the backend for verification and user management.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session as SQLAlchemySession

from ..db.database import get_db
from .firebase_auth import firebase_initialized, get_or_create_firebase_user
from .models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/firebase", tags=["Firebase Authentication"])


class FirebaseLoginRequest(BaseModel):
    """Request model for Firebase login."""

    id_token: str


class FirebaseEmailAuthRequest(BaseModel):
    """Request model for Firebase email authentication."""

    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    """Request model for Google OAuth authentication."""

    credential: str


class FirebaseTokenResponse(BaseModel):
    """Response model for Firebase authentication."""

    access_token: str
    token_type: str = "bearer"
    user: User


@router.post("/login", response_model=FirebaseTokenResponse)
async def firebase_login(
    request: FirebaseLoginRequest, db: SQLAlchemySession = Depends(get_db)
):
    """Authenticate user with Firebase ID token.

    This endpoint verifies the Firebase ID token and returns it back
    for use with the hybrid authentication system.

    Args:
        request: Firebase login request with ID token
        db: Database session

    Returns:
        Firebase token response with user info

    Raises:
        HTTPException: If authentication fails
    """
    from .firebase_auth import FIREBASE_AVAILABLE

    if not firebase_initialized or not FIREBASE_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not available",
        )

    try:
        # Verify the Firebase ID token
        from firebase_admin import auth as firebase_auth

        decoded_token = firebase_auth.verify_id_token(request.id_token)

        # Get or create user in database
        user = await get_or_create_firebase_user(decoded_token, db)

        # Return the same token for use with API requests
        return FirebaseTokenResponse(
            access_token=request.id_token, user=User.from_orm(user)
        )

    except Exception as e:
        logger.error(f"Firebase login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token"
        )


@router.post("/verify", response_model=User)
async def verify_firebase_token_endpoint(
    request: FirebaseLoginRequest, db: SQLAlchemySession = Depends(get_db)
):
    """Verify Firebase ID token and return user info.

    Args:
        request: Firebase login request with ID token
        db: Database session

    Returns:
        User information

    Raises:
        HTTPException: If token is invalid
    """
    from .firebase_auth import FIREBASE_AVAILABLE

    if not firebase_initialized or not FIREBASE_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not available",
        )

    try:
        # Verify the Firebase ID token
        from firebase_admin import auth as firebase_auth

        decoded_token = firebase_auth.verify_id_token(request.id_token)

        # Get or create user in database
        user = await get_or_create_firebase_user(decoded_token, db)

        return User.from_orm(user)

    except Exception as e:
        logger.error(f"Firebase token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token"
        )


@router.post("/refresh", response_model=FirebaseTokenResponse)
async def refresh_firebase_token(
    request: FirebaseLoginRequest, db: SQLAlchemySession = Depends(get_db)
):
    """Refresh Firebase token by verifying and returning it.

    Since Firebase handles token refresh on the client side,
    this endpoint just verifies the new token is valid.

    Args:
        request: Firebase login request with new ID token
        db: Database session

    Returns:
        Firebase token response with user info

    Raises:
        HTTPException: If token is invalid
    """
    # This is essentially the same as login since Firebase
    # handles refresh on the client side
    return await firebase_login(request, db)


@router.post("/email-auth", response_model=FirebaseTokenResponse)
async def firebase_email_auth(
    request: FirebaseEmailAuthRequest, db: SQLAlchemySession = Depends(get_db)
):
    """Authenticate user with email and password via Firebase.

    This endpoint handles email/password authentication server-side,
    eliminating the need for client-side Firebase SDK.

    Args:
        request: Email authentication request
        db: Database session

    Returns:
        Firebase token response with user info

    Raises:
        HTTPException: If authentication fails
    """
    from .firebase_auth import FIREBASE_AVAILABLE

    if not firebase_initialized or not FIREBASE_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not available",
        )

    try:
        # Use Firebase REST API for email/password authentication
        import os

        import httpx

        api_key = os.getenv("FIREBASE_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Firebase API key not configured",
            )

        # Firebase REST API endpoint for email/password auth
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={
                    "email": request.email,
                    "password": request.password,
                    "returnSecureToken": True,
                },
            )

        if response.status_code != 200:
            error_data = response.json()
            error_message = error_data.get("error", {}).get(
                "message", "Authentication failed"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Firebase authentication failed: {error_message}",
            )

        firebase_response = response.json()
        id_token = firebase_response["idToken"]

        # Verify the token and create/get user
        from firebase_admin import auth as firebase_auth

        decoded_token = firebase_auth.verify_id_token(id_token)
        user = await get_or_create_firebase_user(decoded_token, db)

        return FirebaseTokenResponse(access_token=id_token, user=User.from_orm(user))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firebase email authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )


@router.post("/email-register", response_model=FirebaseTokenResponse)
async def firebase_email_register(
    request: FirebaseEmailAuthRequest, db: SQLAlchemySession = Depends(get_db)
):
    """Register new user with email and password via Firebase.

    Args:
        request: Email registration request
        db: Database session

    Returns:
        Firebase token response with user info

    Raises:
        HTTPException: If registration fails
    """
    from .firebase_auth import FIREBASE_AVAILABLE

    if not firebase_initialized or not FIREBASE_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not available",
        )

    try:
        import os

        import httpx

        api_key = os.getenv("FIREBASE_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Firebase API key not configured",
            )

        # Firebase REST API endpoint for email/password registration
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={
                    "email": request.email,
                    "password": request.password,
                    "returnSecureToken": True,
                },
            )

        if response.status_code != 200:
            error_data = response.json()
            error_message = error_data.get("error", {}).get(
                "message", "Registration failed"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Firebase registration failed: {error_message}",
            )

        firebase_response = response.json()
        id_token = firebase_response["idToken"]

        # Verify the token and create user
        from firebase_admin import auth as firebase_auth

        decoded_token = firebase_auth.verify_id_token(id_token)
        user = await get_or_create_firebase_user(decoded_token, db)

        return FirebaseTokenResponse(access_token=id_token, user=User.from_orm(user))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firebase email registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed",
        )


@router.post("/google-auth", response_model=FirebaseTokenResponse)
async def google_oauth_auth(
    request: GoogleAuthRequest, db: SQLAlchemySession = Depends(get_db)
):
    """Authenticate user with Google OAuth credential.

    This endpoint handles Google OAuth authentication by verifying
    the Google OAuth credential and exchanging it for a Firebase token.

    Args:
        request: Google OAuth credential request
        db: Database session

    Returns:
        Firebase token response with user info

    Raises:
        HTTPException: If authentication fails
    """
    from .firebase_auth import FIREBASE_AVAILABLE

    if not firebase_initialized or not FIREBASE_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not available",
        )

    try:
        import os

        import httpx

        api_key = os.getenv("FIREBASE_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Firebase API key not configured",
            )

        # Firebase REST API endpoint for Google OAuth
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key={api_key}"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={
                    "postBody": f"id_token={request.credential}&providerId=google.com",
                    "requestUri": "http://localhost",
                    "returnSecureToken": True,
                },
            )

        if response.status_code != 200:
            error_data = response.json()
            error_message = error_data.get("error", {}).get(
                "message", "Google authentication failed"
            )
            logger.error(f"Google OAuth error: {error_message}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Google authentication failed: {error_message}",
            )

        firebase_response = response.json()
        id_token = firebase_response["idToken"]

        # Verify the token and create/get user
        from firebase_admin import auth as firebase_auth

        decoded_token = firebase_auth.verify_id_token(id_token)
        user = await get_or_create_firebase_user(decoded_token, db)

        return FirebaseTokenResponse(access_token=id_token, user=User.from_orm(user))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google OAuth authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed",
        )
