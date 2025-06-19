"""Admin router for MedShield AI backend."""

import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session as SQLAlchemySession

from ..auth.hybrid_auth import get_admin_user, get_current_user
from ..db.database import get_db
from ..db.models import ClassificationResult as DBClassificationResult
from ..db.models import DocumentModel, SystemSetting
from ..db.models import User as UserModel
from .models import (
    DeleteConfirmation,
    DocumentInfo,
    DocumentUpdate,
    SystemSettingRequest,
    SystemSettingResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


@router.get("/documents", response_model=List[DocumentInfo])
async def get_all_documents(
    skip: int = 0,
    limit: int = 100,
    db: SQLAlchemySession = Depends(get_db),
    current_user: UserModel = Depends(get_admin_user),
):
    """Get all documents (admin only)."""
    from sqlalchemy import case, exists

    # Single query with LEFT JOIN to efficiently check classification status
    query = (
        db.query(
            DocumentModel,
            case(
                (
                    exists().where(
                        DBClassificationResult.document_id == DocumentModel.id
                    ),
                    True,
                ),
                else_=False,
            ).label("is_classified"),
        )
        .order_by(DocumentModel.id)
        .offset(skip)
        .limit(limit)
    )

    results = query.all()

    # Convert to dict format
    documents = []
    for doc, is_classified in results:
        doc_dict = vars(doc).copy()
        # Remove SQLAlchemy internal attributes
        if "_sa_instance_state" in doc_dict:
            del doc_dict["_sa_instance_state"]
        doc_dict["is_classified"] = is_classified
        documents.append(doc_dict)

    return documents


@router.get("/documents/count")
async def get_documents_count(
    db: SQLAlchemySession = Depends(get_db),
    current_user: UserModel = Depends(get_admin_user),
):
    """Get total number of documents."""
    try:
        total = db.query(DocumentModel).count()
        return {"total": total}
    except Exception as e:
        logger.error(f"Error getting document count: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get document count: {str(e)}",
        )


@router.get("/documents/{document_id}", response_model=DocumentInfo)
async def get_document_by_id(
    document_id: int,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get a single document by its ID (all authenticated users)."""
    document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document ID '{document_id}' not found",
        )

    doc_dict = vars(document)
    classified_doc_ids = (
        db.query(DBClassificationResult.document_id).distinct().subquery()
    )
    doc_dict["is_classified"] = (
        db.query(classified_doc_ids.c.document_id)
        .filter(classified_doc_ids.c.document_id == document.id)
        .first()
        is not None
    )

    return doc_dict


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    confirmation: DeleteConfirmation,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Delete a document (admin only)."""
    if not confirmation.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Please confirm deletion"
        )

    document = db.query(DocumentModel).filter(DocumentModel.doc_id == doc_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "document_delete",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"Deleted document '{document.title}' (ID: {doc_id})",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")  # In production, store this in an audit log

    db.delete(document)
    db.commit()

    return {"message": "Document has been deleted."}


@router.put("/documents/{doc_id}")
async def update_document(
    doc_id: str,
    document_update: DocumentUpdate,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Update a document (admin only)."""
    document = db.query(DocumentModel).filter(DocumentModel.doc_id == doc_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    if document_update.title is not None:
        document.title = document_update.title
    if document_update.original_title is not None:
        document.original_title = document_update.original_title

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "document_update",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"Updated document '{document.title}' (ID: {doc_id})",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")  # In production, store this in an audit log

    db.commit()

    return {"message": "Document has been updated."}


@router.get("/users")
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    db: SQLAlchemySession = Depends(get_db),
    current_user: UserModel = Depends(get_admin_user),
):
    """Get all users (admin only)."""
    users = db.query(UserModel).order_by(UserModel.id).offset(skip).limit(limit).all()
    return users


@router.put("/users/{user_id}/admin")
async def toggle_admin_status(
    user_id: int,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Toggle a user's admin status (admin only)."""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    user.is_admin = not user.is_admin

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "admin_status_change",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"User '{user.username}' (ID: {user_id}) admin status changed to {user.is_admin}",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")  # In production, store this in an audit log

    db.commit()

    status_text = "granted" if user.is_admin else "revoked"
    return {"message": f"Admin privileges {status_text} for user '{user.username}'."}


@router.put("/users/{user_id}/activate")
async def toggle_activation_status(
    user_id: int,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Toggle a user's activation status (admin only)."""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    user.is_active = not user.is_active

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "activation_status_change",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"User '{user.username}' (ID: {user_id}) activation status changed to {user.is_active}",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")  # In production, store this in an audit log

    db.commit()

    status_text = "activated" if user.is_active else "deactivated"
    return {"message": f"User '{user.username}' has been {status_text}."}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Delete a user account (admin only)."""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    db.delete(user)

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "user_deleted",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"User '{user.username}' (ID: {user_id}) deleted",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")  # In production, store this in an audit log

    db.commit()
    return  # 204 No Content


@router.get("/users/count")
async def get_users_count(
    db: SQLAlchemySession = Depends(get_db),
    current_user: UserModel = Depends(get_admin_user),
):
    """Get total number of users."""
    total = db.query(UserModel).count()
    return {"total": total}


@router.get("/settings/health-check", response_model=SystemSettingResponse)
async def get_health_check_setting(
    current_user: UserModel = Depends(get_admin_user),
    db: SQLAlchemySession = Depends(get_db),
):
    """Get health check enabled/disabled setting."""
    setting = SystemSetting.get_setting(db, "health_check_enabled", "true")

    # Create a response object since we might not have a database record yet
    return SystemSettingResponse(
        key="health_check_enabled",
        value=setting,
        description="Enable or disable database health check monitoring",
        updated_at=datetime.utcnow(),
        updated_by=None,
    )


@router.put("/settings/health-check", response_model=SystemSettingResponse)
async def update_health_check_setting(
    setting_request: SystemSettingRequest,
    request: Request,
    current_user: UserModel = Depends(get_admin_user),
    db: SQLAlchemySession = Depends(get_db),
):
    """Toggle health check enabled/disabled setting."""
    if setting_request.value.lower() not in ["true", "false"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Value must be 'true' or 'false'",
        )

    setting = SystemSetting.set_setting(
        db=db,
        key="health_check_enabled",
        value=setting_request.value.lower(),
        user_id=current_user.id,
        description="Enable or disable database health check monitoring",
    )

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "health_check_setting_change",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"Health check monitoring {setting_request.value.lower()}d",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")

    return SystemSettingResponse(
        key=setting.key,
        value=setting.value,
        description=setting.description,
        updated_at=setting.updated_at,
        updated_by=setting.updated_by,
    )
