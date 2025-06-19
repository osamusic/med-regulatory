import json
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi_cache.decorator import cache
from sqlalchemy import func
from sqlalchemy.orm import Session as SQLAlchemySession
from starlette.concurrency import run_in_threadpool

from ..auth.hybrid_auth import get_admin_user, get_current_active_user
from ..db.database import get_db
from ..db.models import ClassificationResult
from ..db.models import Guideline as GuidelineModel
from ..utils.api_cache import invalidate_cache
from .models import Guideline, GuidelineCreate, GuidelineSearch

REDIS_TTL = int(os.getenv("REDIS_CACHE_TTL", "3600"))  # Default: 1 hour
logger = logging.getLogger(__name__)

# Create two routers: one for public GET endpoints, one for protected endpoints
public_router = APIRouter(
    prefix="/guidelines",
    tags=["guidelines"],
)

protected_router = APIRouter(
    prefix="/guidelines",
    tags=["guidelines"],
    dependencies=[Depends(get_current_active_user)],
)


def _get_classification_data(
    guideline_id: int, db: SQLAlchemySession
) -> Optional[Dict[str, Any]]:
    """Retrieve classification data for a guideline"""
    try:
        classification = (
            db.query(ClassificationResult)
            .filter(ClassificationResult.document_id == guideline_id)
            .order_by(ClassificationResult.created_at.desc())
            .first()
        )
        if not classification:
            return None

        result = json.loads(classification.result_json)
        data: Dict[str, Any] = {
            "created_at": classification.created_at.isoformat(),
            "requirements": result.get("requirements", []),
            "keywords": result.get("keywords", []),
        }
        return data
    except Exception as e:
        logger.error(
            f"Error fetching classification data for guideline {guideline_id}: {e}"
        )
        return None


def check_conversion(document_req_pairs, db):
    result = {}
    for pair in document_req_pairs:
        document_id = pair.get("document_id")
        classification_id = pair.get("classification_id")
        req_ids = pair.get("req_ids", [])

        if not document_id or not classification_id or not req_ids:
            continue

        for req_id in req_ids:
            guideline_id = f"{document_id}-{req_id}"
            exists = (
                db.query(GuidelineModel)
                .filter(GuidelineModel.guideline_id == guideline_id)
                .first()
                is not None
            )

            if exists and classification_id not in result:
                result[classification_id] = True
    return result


@public_router.get("/all", response_model=List[Guideline])
@cache(expire=REDIS_TTL, namespace="guidelines:all")
async def get_guidelines(
    category: Optional[str] = Query(None),
    standard: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: SQLAlchemySession = Depends(get_db),
):
    """Retrieve guidelines with optional filters"""
    query = db.query(GuidelineModel)
    if category:
        query = query.filter(GuidelineModel.category == category)
    if standard:
        query = query.filter(GuidelineModel.standard == standard)
    if subject:
        query = query.filter(GuidelineModel.subject == subject)

    guidelines = query.order_by(GuidelineModel.id).offset(skip).limit(limit).all()
    results: List[Dict[str, Any]] = []
    for g in guidelines:
        item = {
            "id": g.id,
            "guideline_id": g.guideline_id,
            "category": g.category,
            "standard": g.standard,
            "control_text": g.control_text,
            "source_url": g.source_url,
            "subject": g.subject,
        }
        data = _get_classification_data(g.id, db)
        if data:
            item["classification"] = data
        results.append(item)
    return results


@public_router.get("/categories")
async def get_categories(
    standard: Optional[str] = None,
    subject: Optional[str] = None,
    db: SQLAlchemySession = Depends(get_db),
):
    """Get all unique guideline categories with counts, optionally filtered by standard/subject"""
    query = db.query(
        GuidelineModel.category, func.count(GuidelineModel.id).label("count")
    )
    if standard:
        query = query.filter(GuidelineModel.standard == standard)
    if subject:
        query = query.filter(GuidelineModel.subject == subject)

    category_counts = query.group_by(GuidelineModel.category).all()
    result = [{"name": c[0], "count": c[1]} for c in category_counts if c[0]]
    return result


@public_router.get("/standards")
async def get_standards(
    category: Optional[str] = None,
    subject: Optional[str] = None,
    db: SQLAlchemySession = Depends(get_db),
):
    """Get all unique guideline standards with counts, optionally filtered by category/subject"""
    query = db.query(
        GuidelineModel.standard, func.count(GuidelineModel.id).label("count")
    )
    if category:
        query = query.filter(GuidelineModel.category == category)
    if subject:
        query = query.filter(GuidelineModel.subject == subject)

    standard_counts = query.group_by(GuidelineModel.standard).all()
    result = [{"name": s[0], "count": s[1]} for s in standard_counts if s[0]]
    return result


@public_router.get("/subjects")
async def get_subjects(
    category: Optional[str] = None,
    standard: Optional[str] = None,
    db: SQLAlchemySession = Depends(get_db),
):
    """Get all unique guideline subjects with counts, optionally filtered by category/standard"""

    query = db.query(
        GuidelineModel.subject, func.count(GuidelineModel.id).label("count")
    )
    if category:
        query = query.filter(GuidelineModel.category == category)
    if standard:
        query = query.filter(GuidelineModel.standard == standard)

    subject_counts = query.group_by(GuidelineModel.subject).all()
    result = [{"name": s[0], "count": s[1]} for s in subject_counts if s[0]]
    return result


@public_router.get("/count")
async def get_guidelines_count(
    category: Optional[str] = None,
    standard: Optional[str] = None,
    subject: Optional[str] = None,
    db: SQLAlchemySession = Depends(get_db),
):
    """Get total count of guidelines with optional filters"""
    query = db.query(func.count(GuidelineModel.id))
    if category:
        query = query.filter(GuidelineModel.category == category)
    if standard:
        query = query.filter(GuidelineModel.standard == standard)
    if subject:
        query = query.filter(GuidelineModel.subject == subject)

    return {"total": query.scalar()}


@public_router.get("/{id}", response_model=Guideline)
async def get_guideline_by_id(id: int, db: SQLAlchemySession = Depends(get_db)):
    """Retrieve a single guideline by its database ID"""
    guideline = db.query(GuidelineModel).filter(GuidelineModel.id == id).first()

    if not guideline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guideline with ID {id} not found",
        )

    result = {
        "id": guideline.id,
        "guideline_id": guideline.guideline_id,
        "category": guideline.category,
        "standard": guideline.standard,
        "control_text": guideline.control_text,
        "source_url": guideline.source_url,
        "subject": guideline.subject,
    }

    data = _get_classification_data(guideline.id, db)
    if data:
        result["classification"] = data

    return result


@public_router.get("/by-guideline-id/{guideline_id}", response_model=Guideline)
async def get_guideline_by_guideline_id(
    guideline_id: str, db: SQLAlchemySession = Depends(get_db)
):
    """Retrieve a single guideline by its guideline_id string"""
    guideline = (
        db.query(GuidelineModel)
        .filter(GuidelineModel.guideline_id == guideline_id)
        .first()
    )

    if not guideline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guideline with guideline_id '{guideline_id}' not found",
        )

    result = {
        "id": guideline.id,
        "guideline_id": guideline.guideline_id,
        "category": guideline.category,
        "standard": guideline.standard,
        "control_text": guideline.control_text,
        "source_url": guideline.source_url,
        "subject": guideline.subject,
    }

    data = _get_classification_data(guideline.id, db)
    if data:
        result["classification"] = data

    return result


@protected_router.post("/check-conversions", response_model=Dict[str, bool])
async def check_guideline_conversions(
    document_req_pairs: List[Dict[str, Any]], db: SQLAlchemySession = Depends(get_db)
):
    """Check which document-requirement pairs have been converted to guidelines

    Expects a list of objects with document_id and req_id properties
    Returns a dictionary mapping classification IDs to boolean values
    """
    result = await run_in_threadpool(check_conversion, document_req_pairs, db)
    return {str(k): v for k, v in result.items()}


@public_router.post("/search", response_model=List[Guideline])
async def search_guidelines(
    search: GuidelineSearch, db: SQLAlchemySession = Depends(get_db)
):
    """Search guidelines by text and filters"""
    query = db.query(GuidelineModel).filter(
        GuidelineModel.control_text.contains(search.query)
    )
    if search.category:
        query = query.filter(GuidelineModel.category == search.category)
    if search.standard:
        query = query.filter(GuidelineModel.standard == search.standard)
    if search.subject:
        query = query.filter(GuidelineModel.subject == search.subject)
    guidelines = query.all()
    results: List[Dict[str, Any]] = []
    for g in guidelines:
        item = {
            "id": g.id,
            "guideline_id": g.guideline_id,
            "category": g.category,
            "standard": g.standard,
            "control_text": g.control_text,
            "source_url": g.source_url,
            "subject": g.subject,
        }
        data = _get_classification_data(g.id, db)
        if data:
            item["classification"] = data
        results.append(item)
    return results


@protected_router.post("/create", response_model=Guideline)
async def create_guideline(
    guideline: GuidelineCreate,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),  # Admins only
):
    """Create a new guideline (admin only)"""
    client_ip = request.client.host if request.client else "unknown"
    existing = (
        db.query(GuidelineModel)
        .filter(GuidelineModel.guideline_id == guideline.guideline_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Guideline ID '{guideline.guideline_id}' already exists",
        )

    db_g = GuidelineModel(
        guideline_id=guideline.guideline_id,
        category=guideline.category,
        standard=guideline.standard,
        control_text=guideline.control_text,
        source_url=guideline.source_url,
        subject=guideline.subject,
    )
    db.add(db_g)
    db.flush()  # Get generated ID

    logger.info(
        f"AUDIT LOG: {{'action':'create_guideline','user_id':{current_user.id},'guideline_id':'{guideline.guideline_id}','ip_address':'{client_ip}'}}"
    )
    try:
        db.commit()
        await invalidate_cache("guidelines:all")
        logger.info(f"Guideline '{guideline.guideline_id}' created successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating guideline: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create guideline: {e}",
        )

    return {
        "id": db_g.id,
        "guideline_id": db_g.guideline_id,
        "category": db_g.category,
        "standard": db_g.standard,
        "control_text": db_g.control_text,
        "source_url": db_g.source_url,
        "subject": db_g.subject,
    }


@protected_router.put("/{guideline_id}", response_model=Guideline)
async def update_guideline(
    guideline_id: str,
    guideline: GuidelineCreate,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),  # Admins only
):
    """Update an existing guideline (admin only)"""
    client_ip = request.client.host if request.client else "unknown"
    db_g = (
        db.query(GuidelineModel)
        .filter(GuidelineModel.guideline_id == guideline_id)
        .first()
    )
    if not db_g:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guideline ID '{guideline_id}' not found",
        )
    db_g.category = guideline.category
    db_g.standard = guideline.standard
    db_g.control_text = guideline.control_text
    db_g.source_url = guideline.source_url
    db_g.subject = guideline.subject

    logger.info(
        f"AUDIT LOG: {{'action':'update_guideline','user_id':{current_user.id},'guideline_id':'{guideline_id}','ip_address':'{client_ip}'}}"
    )
    try:
        db.commit()
        await invalidate_cache("guidelines:all")
        logger.info(f"Guideline '{guideline_id}' updated successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating guideline: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update guideline: {e}",
        )

    return {
        "id": db_g.id,
        "guideline_id": db_g.guideline_id,
        "category": db_g.category,
        "standard": db_g.standard,
        "control_text": db_g.control_text,
        "source_url": db_g.source_url,
        "region": db_g.region,
    }


@protected_router.delete("/{guideline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guideline(
    guideline_id: str,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),  # Admins only
):
    """Delete a guideline (admin only)"""
    client_ip = request.client.host if request.client else "unknown"
    db_g = (
        db.query(GuidelineModel)
        .filter(GuidelineModel.guideline_id == guideline_id)
        .first()
    )
    if not db_g:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guideline ID '{guideline_id}' not found",
        )
    db.delete(db_g)
    logger.info(
        f"AUDIT LOG: {{'action':'delete_guideline','user_id':{current_user.id},'guideline_id':'{guideline_id}','ip_address':'{client_ip}'}}"
    )
    try:
        db.commit()
        await invalidate_cache("guidelines:all")
        logger.info(f"Guideline '{guideline_id}' deleted successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting guideline: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete guideline: {e}",
        )
    return None


# Export both routers
router = public_router  # For backward compatibility
