"""Document classification router for AI-powered cybersecurity document analysis.

This module provides endpoints for classifying medical device cybersecurity documents
using AI, managing classification results, and tracking progress.
"""

import asyncio
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from functools import partial
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi_cache.decorator import cache
from sqlalchemy.orm import Session

from ..auth.hybrid_auth import get_current_active_user, get_current_admin_user
from ..auth.models import User
from ..db.database import SessionLocal, get_db
from ..db.models import ClassificationResult as DBClassificationResult
from ..db.models import DocumentModel as DBDocument
from ..utils.api_cache import invalidate_cache
from .classifier import DocumentClassifier
from .models import ClassificationConfig, ClassificationRequest, ClassificationResult

REDIS_TTL = int(os.getenv("REDIS_CACHE_TTL", "3600"))  # Default: 1 hour

executor = ThreadPoolExecutor(max_workers=1)

classification_progress = {
    "total_documents": 0,
    "processed_documents": 0,
    "status": "idle",  # idle, initializing, in_progress, completed, error
    "started_at": None,
    "completed_at": None,
}

router = APIRouter(
    prefix="/classifier",
    tags=["classifier"],
    responses={404: {"description": "Not found"}},
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

classifier = DocumentClassifier()


@router.post("/classify", response_model=ClassificationResult)
async def classify_documents(
    classification_request: ClassificationRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Classify documents (admin only)"""
    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "classify_documents",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"Classification requested for {len(classification_request.document_ids)} documents",
        "ip_address": client_host,
    }
    logger.info(f"AUDIT LOG: {log_entry}")

    documents = []
    already_classified = []

    if classification_request.all_documents:
        if classification_request.reclassify:
            documents = db.query(DBDocument).all()
        else:
            subq = db.query(DBClassificationResult.document_id).distinct().subquery()
            documents = (
                db.query(DBDocument)
                .filter(~DBDocument.id.in_(db.query(subq.c.document_id)))
                .all()
            )
    elif classification_request.document_ids:
        for doc_id in classification_request.document_ids:
            doc = db.query(DBDocument).filter(DBDocument.id == doc_id).first()
            if not doc:
                continue
            existing = (
                db.query(DBClassificationResult)
                .filter(DBClassificationResult.document_id == doc_id)
                .first()
            )
            if existing and not classification_request.reclassify:
                already_classified.append(doc.title or f"Document {doc_id}")
            else:
                documents.append(doc)
    elif classification_request.section_ids:
        documents = (
            db.query(DBDocument)
            .filter(DBDocument.id.in_(classification_request.section_ids))
            .all()
        )

    if not documents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No documents found for classification",
        )

    task_fn = partial(
        classify_documents_background,
        [doc.id for doc in documents],
        ClassificationConfig(),
        current_user.id,
    )
    asyncio.get_event_loop().run_in_executor(executor, task_fn)

    global classification_progress
    classification_progress = {
        "total_documents": len(documents),
        "processed_documents": 0,
        "status": "initializing",
        "started_at": datetime.utcnow(),
        "completed_at": None,
    }

    message = None
    if already_classified:
        message = (
            "The following documents were skipped because they have already been classified: "
            + ", ".join(already_classified)
        )

    await invalidate_cache("classifier:all")

    return ClassificationResult(
        processed_count=len(documents),
        skipped_documents=already_classified,
        message=message,
        total_count=len(documents),
        current_count=0,
        status="initializing",
    )


@router.get("/results/{document_id}", response_model=Dict[str, Any])
async def get_classification_results(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retrieve classification result for a single document"""
    document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    classification = (
        db.query(DBClassificationResult)
        .filter(DBClassificationResult.document_id == document_id)
        .order_by(DBClassificationResult.created_at.desc())
        .first()
    )

    if not classification:
        return {
            "document_id": document_id,
            "title": document.title,
            "status": "not_classified",
            "message": "This document has not been classified yet",
        }

    try:
        result = json.loads(classification.result_json)
        return {
            "document_id": document_id,
            "title": document.title,
            "status": "classified",
            "created_at": classification.created_at,
            "result": result,
        }
    except Exception as e:
        logger.error(f"Error parsing classification result: {e}")
        return {
            "document_id": document_id,
            "title": document.title,
            "status": "error",
            "message": "Error parsing classification result",
        }


@router.get("/stats", response_model=Dict[str, Any])
async def get_classification_stats(
    current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
):
    """Retrieve classification statistics"""
    total_documents = db.query(DBDocument).count()
    classified_documents = (
        db.query(DBDocument)
        .join(
            DBClassificationResult, DBDocument.id == DBClassificationResult.document_id
        )
        .distinct()
        .count()
    )

    return {
        "total_documents": total_documents,
        "classified_documents": classified_documents,
        "classification_percentage": (
            round(classified_documents / total_documents * 100, 2)
            if total_documents > 0
            else 0
        ),
    }


@router.get("/all", response_model=List[Dict[str, Any]])
@cache(expire=REDIS_TTL, namespace="classifier:all")
async def get_all_classifications(
    skip: int = 0, 
    limit: int = 100,
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Retrieve all latest classification results with pagination"""
    logger.info("Retrieving all classification results")

    subq = (
        db.query(
            DBClassificationResult.document_id,
            DBClassificationResult.id.label("latest_id"),
        )
        .distinct(DBClassificationResult.document_id)
        .order_by(
            DBClassificationResult.document_id, DBClassificationResult.created_at.desc()
        )
        .subquery()
    )

    classifications = (
        db.query(DBClassificationResult)
        .join(subq, DBClassificationResult.id == subq.c.latest_id)
        .order_by(DBClassificationResult.id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for cls in classifications:
        try:
            doc = db.query(DBDocument).filter(DBDocument.id == cls.document_id).first()
            if not doc:
                continue

            data = json.loads(cls.result_json)
            entry = {
                "id": cls.id,
                "document_id": cls.document_id,
                "document_title": doc.title or "Unknown Document",
                "source_url": doc.url or "",
                "created_at": cls.created_at.isoformat(),
                "requirements": data.get("requirements", []),
                "keywords": data.get("keywords", []),
                "original_title": doc.original_title or "",
            }
            results.append(entry)
        except Exception as e:
            logger.error(f"Error processing classification result: {e}")

    logger.info(f"Number of classification results retrieved: {len(results)}")
    return results


@router.delete("/results/{classification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_classification(
    classification_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),  # Admins only
):
    """Delete a classification result (admin only)"""
    client_ip = request.client.host if request.client else "unknown"
    db_classification = (
        db.query(DBClassificationResult)
        .filter(DBClassificationResult.id == classification_id)
        .first()
    )
    if not db_classification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Classification ID '{classification_id}' not found",
        )

    db.delete(db_classification)
    logger.info(
        f"AUDIT LOG: {{'action':'delete_classification','user_id':{current_user.id},'classification_id':'{classification_id}','ip_address':'{client_ip}'}}"
    )
    try:
        db.commit()
        await invalidate_cache("classifier:all")
        logger.info(f"Classification '{classification_id}' deleted successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting classification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete classification: {e}",
        )
    return None


def classify_documents_background(
    documents: List[int], config: ClassificationConfig, user_id: int
):
    """Classify documents in the background using AI classification.

    Args:
        documents: List of document IDs to classify.
        config: Classification configuration settings.
        user_id: ID of the user who initiated the classification.
    """
    logger.info(f"Starting background classification for {len(documents)} documents")

    db = SessionLocal()
    try:
        classification_progress["status"] = "in_progress"

        for idx, doc_id in enumerate(documents):
            try:
                document = db.query(DBDocument).filter(DBDocument.id == doc_id).first()
                if not document:
                    logger.warning(f"Document {doc_id} not found")
                    continue

                existing_classification = (
                    db.query(DBClassificationResult)
                    .filter(DBClassificationResult.document_id == doc_id)
                    .first()
                )

                classification_result = classifier.classify_document(
                    document.content, config
                )

                if existing_classification:
                    existing_classification.result_json = json.dumps(
                        classification_result
                    )
                    existing_classification.created_at = datetime.now()
                    existing_classification.user_id = user_id
                else:
                    db_entry = DBClassificationResult(
                        document_id=doc_id,
                        user_id=user_id,
                        result_json=json.dumps(classification_result),
                        created_at=datetime.now(),
                    )
                    db.add(db_entry)
                db.commit()
                classification_progress["processed_documents"] = idx + 1
                action_type = "updated" if existing_classification else "created"
                logger.info(
                    f"Classification {action_type} for document {doc_id} ({idx + 1}/{len(documents)})"
                )
            except Exception as e:
                logger.error(f"Error classifying document {doc_id}: {e}")
                db.rollback()

        classification_progress["status"] = "completed"
        classification_progress["completed_at"] = datetime.utcnow()
    finally:
        db.close()
        logger.info("Background classification completed for all documents")


@router.get("/progress", response_model=ClassificationResult)
async def get_classification_progress(
    current_user: User = Depends(get_current_active_user),
):
    """Get current classification progress"""
    return ClassificationResult(
        processed_count=classification_progress["total_documents"],
        total_count=classification_progress["total_documents"],
        current_count=classification_progress["processed_documents"],
        status=classification_progress["status"],
    )


@router.get("/count")
async def get_classifications_count(
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Get total number of classification results"""
    subq = (
        db.query(DBClassificationResult.document_id)
        .distinct()
        .subquery()
    )
    total = db.query(subq).count()
    return {"total": total}


@router.get("/keywords", response_model=List[str])
async def get_classification_keywords(
    current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
):
    """Get all unique keywords from classification results"""
    try:
        results = (
            db.query(DBClassificationResult)
            .filter(DBClassificationResult.result_json.isnot(None))
            .all()
        )

        all_keywords = []
        for result in results:
            if result.result_json:
                try:
                    data = json.loads(result.result_json)
                    keywords = data.get("keywords", [])
                    if isinstance(keywords, list):
                        for keyword in keywords:
                            if isinstance(keyword, str):
                                all_keywords.append(keyword)
                            elif isinstance(keyword, dict) and "keyword" in keyword:
                                all_keywords.append(keyword["keyword"])
                            elif isinstance(keyword, dict) and "text" in keyword:
                                all_keywords.append(keyword["text"])
                            elif isinstance(keyword, dict) and "value" in keyword:
                                all_keywords.append(keyword["value"])
                except (json.JSONDecodeError, TypeError):
                    logger.warning(
                        f"Could not parse result_json for classification {result.id}"
                    )

        unique_keywords = []
        seen = set()
        for kw in all_keywords:
            if kw not in seen:
                seen.add(kw)
                unique_keywords.append(kw)

        common_words = {
            "and",
            "the",
            "of",
            "to",
            "in",
            "for",
            "with",
            "on",
            "at",
            "by",
            "from",
            "a",
            "an",
            "is",
            "are",
            "was",
            "were",
            "be",
            "been",
            "being",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
            "must",
            "shall",
            "can",
            "or",
            "but",
            "if",
            "then",
            "than",
            "as",
            "so",
            "not",
            "no",
        }
        filtered_keywords = [
            kw
            for kw in unique_keywords
            if kw.lower() not in common_words and len(kw) > 2
        ]

        return filtered_keywords

    except Exception as e:
        logger.error(f"Error retrieving keywords: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving keywords")
