"""Authentication router for login and registration endpoints.

This module provides FastAPI routes for user authentication, including
login token generation and user registration with role-based access.
"""

import logging
import os
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session as SQLAlchemySession

from ..db.database import get_db
from ..db.models import User as UserModel
from .auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    authenticate_user,
    create_access_token,
    get_password_hash,
    regenerate_session_after_login,
    verify_password,
)
from .hybrid_auth import get_admin_user, get_current_active_user
from .models import (
    AdminChangePasswordRequest,
    ChangePasswordRequest,
    RegisterRequest,
    Token,
    User,
)
from .password_validation import validate_password_strength

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])  # Authentication endpoints


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: SQLAlchemySession = Depends(get_db),
    request: Request = None,
    response: Response = None,
):
    """Authenticate user and return JWT access token.

    Args:
        form_data: OAuth2 form with username and password.
        db: Database session.
        request: HTTP request object.
        response: HTTP response object.

    Returns:
        JWT access token and token type.

    Raises:
        HTTPException: If authentication fails.
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        logger.error("Authentication failed: invalid credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if request and response:
        regenerate_session_after_login(request, response, user)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=User)
async def register_user(req: RegisterRequest, db: SQLAlchemySession = Depends(get_db)):
    """Register a new user with optional admin privileges.

    Args:
        req: Registration request with credentials and codes.
        db: Database session.

    Returns:
        Created user object.

    Raises:
        HTTPException: If registration fails or invalid codes provided.
    """
    username = req.username
    password = req.password
    user_registration_code = req.user_registration_code
    admin_code = req.admin_code

    existing_user = db.query(UserModel).filter(UserModel.username == username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to register with provided credentials",
        )

    admin_secret = os.getenv("ADMIN_REGISTRATION_SECRET", "admin123")
    user_secret = os.getenv("USER_REGISTRATION_SECRET", "user123")

    is_admin = admin_code is not None and admin_code == admin_secret
    is_valid_user = (
        user_registration_code is not None and user_registration_code == user_secret
    )

    if not (is_admin or is_valid_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to register with provided credentials",
        )

    # Validate password strength
    password_validation = validate_password_strength(password)
    if not password_validation["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password does not meet security requirements: {'; '.join(password_validation['errors'])}",
        )

    user_count = db.query(UserModel).count()
    is_first_user = user_count == 0

    hashed_password = get_password_hash(password)
    db_user = UserModel(
        username=username,
        hashed_password=hashed_password,
        is_admin=(is_admin or is_first_user),
        is_active=is_first_user,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    db: SQLAlchemySession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user),
):
    """Change user password.

    Args:
        request: Password change request with current and new passwords.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        Success message.

    Raises:
        HTTPException: If current password is incorrect.
    """
    # Verify current password
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Validate new password strength
    password_validation = validate_password_strength(request.new_password)
    if not password_validation["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New password does not meet security requirements: {'; '.join(password_validation['errors'])}",
        )

    # Update password
    current_user.hashed_password = get_password_hash(request.new_password)
    db.commit()

    logger.info(f"Password changed for user: {current_user.username}")
    return {"message": "Password changed successfully"}


@router.post("/admin/change-password")
async def admin_change_password(
    request: AdminChangePasswordRequest,
    db: SQLAlchemySession = Depends(get_db),
    current_user: UserModel = Depends(get_admin_user),
):
    """Admin-only endpoint to change another user's password.

    Args:
        request: Admin password change request with user ID and new password.
        db: Database session.
        current_user: Current authenticated admin user.

    Returns:
        Success message.

    Raises:
        HTTPException: If target user is not found.
    """
    # Find target user
    target_user = db.query(UserModel).filter(UserModel.id == request.user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent admin from changing their own password via this endpoint
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own password via admin endpoint. Use regular change-password endpoint.",
        )

    # Validate new password strength
    password_validation = validate_password_strength(request.new_password)
    if not password_validation["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New password does not meet security requirements: {'; '.join(password_validation['errors'])}",
        )

    # Update password
    target_user.hashed_password = get_password_hash(request.new_password)
    db.commit()

    logger.info(
        f"Password changed by admin {current_user.username} for user: {target_user.username}"
    )
    return {"message": f"Password changed successfully for user {target_user.username}"}
