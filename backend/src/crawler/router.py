"""Document crawler router for collecting cybersecurity documents.

This module provides endpoints for crawling websites to collect cybersecurity
documents, uploading files, and managing the document collection process.
"""

import hashlib
import logging
from datetime import datetime
from typing import List

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session as SQLAlchemySession

from ..auth.hybrid_auth import get_admin_user
from ..db.database import get_db
from ..db.models import DocumentModel
from .crawler import Crawler
from .models import CrawlTarget, Document

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/crawler",
    tags=["Crawler"],
    dependencies=[Depends(get_admin_user)],  # Only administrators can access
)


@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def run_crawler(
    target: CrawlTarget,
    background_tasks: BackgroundTasks,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Run the crawler (admin only)"""
    client_host = request.client.host if request.client else "unknown"

    log_entry = {
        "action": "crawler_run",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"Crawler started for URL {target.url} with depth {target.depth}",
        "ip_address": client_host,
    }
    logger.info(f"AUDIT LOG: {log_entry}")

    background_tasks.add_task(
        run_crawler_task, target=target, db=db, user_id=current_user.id
    )

    return {
        "message": "Crawler has been started",
        "target": target.dict(),
        "status": "processing",
    }


@router.get("/status", response_model=List[Document])
async def get_crawler_status(
    limit: int = 10,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Get the status of recently crawled documents (admin only)"""
    recent_documents = (
        db.query(DocumentModel)
        .order_by(DocumentModel.downloaded_at.desc())
        .limit(limit)
        .all()
    )

    return [
        Document(
            doc_id=doc.doc_id,
            url=doc.url,
            title=doc.title,
            original_title=doc.original_title or doc.title,
            content=doc.content,
            source_type=doc.source_type,
            downloaded_at=doc.downloaded_at,
            lang=doc.lang,
        )
        for doc in recent_documents
    ]


@router.post("/upload-pdf", status_code=status.HTTP_202_ACCEPTED)
async def upload_pdf(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    request: Request,
    db: SQLAlchemySession = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Upload a PDF file and process it (admin only)"""
    client_host = request.client.host if request.client else "unknown"

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed"
        )

    log_entry = {
        "action": "pdf_upload",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"PDF uploaded: {file.filename}",
        "ip_address": client_host,
    }
    logger.info(f"AUDIT LOG: {log_entry}")

    content = await file.read()
    doc_id = hashlib.sha256(
        f"{file.filename}_{datetime.utcnow().isoformat()}".encode()
    ).hexdigest()
    background_tasks.add_task(
        process_uploaded_pdf,
        content=content,
        filename=file.filename,
        doc_id=doc_id,
        db=db,
        user_id=current_user.id,
    )

    return {
        "message": f"PDF file {file.filename} has been uploaded and is being processed",
        "doc_id": doc_id,
        "status": "processing",
    }


def run_crawler_task(target: CrawlTarget, db: SQLAlchemySession, user_id: int):
    """Background task to run the crawler"""
    try:
        crawler = Crawler(db=db)  # Pass the DB session to the crawler
        documents = crawler.crawl(target)

        for doc in documents:
            existing_doc = (
                db.query(DocumentModel)
                .filter(DocumentModel.doc_id == doc.doc_id)
                .first()
            )

            if existing_doc:
                existing_doc.title = doc.title
                existing_doc.original_title = doc.original_title
                existing_doc.content = doc.content
                existing_doc.downloaded_at = doc.downloaded_at
            else:
                db_doc = DocumentModel(
                    doc_id=doc.doc_id,
                    url=doc.url,
                    title=doc.title,
                    original_title=doc.original_title,
                    content=doc.content,
                    source_type=doc.source_type,
                    downloaded_at=doc.downloaded_at,
                    lang=doc.lang,
                    owner_id=user_id,
                )
                db.add(db_doc)

        db.commit()
        logger.info(
            f"Crawler completed for {target.url}, saved {len(documents)} documents"
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Error in crawler task: {str(e)}")


def process_uploaded_pdf(
    content: bytes, filename: str, doc_id: str, db: SQLAlchemySession, user_id: int
):
    """Process an uploaded PDF file and save it to the database"""
    try:
        import fitz  # PyMuPDF

        title = filename

        pdf_document = fitz.open(stream=content, filetype="pdf")

        crawler = Crawler(db=db)

        toc_info = crawler._extract_pdf_toc(pdf_document)
        text_content, original_title = crawler._extract_pdf_text(pdf_document, filename)

        pdf_document.close()

        db.query(DocumentModel).filter(DocumentModel.doc_id == doc_id).first()

        documents = crawler._split_document(
            content=text_content,
            source_type="PDF",
            url=f"local://{filename}",
            title=title,
            original_title=original_title or title,
            toc_info=toc_info,
        )

        for doc in documents:
            doc.doc_id = hashlib.sha256(
                f"{doc.doc_id}_{doc.title}".encode()
            ).hexdigest()

            existing = (
                db.query(DocumentModel)
                .filter(DocumentModel.doc_id == doc.doc_id)
                .first()
            )

            if existing:
                existing.title = doc.title
                existing.original_title = doc.original_title
                existing.content = doc.content
                existing.downloaded_at = doc.downloaded_at
            else:
                db_doc = DocumentModel(
                    doc_id=doc.doc_id,
                    url=doc.url,
                    title=doc.title,
                    original_title=doc.original_title,
                    content=doc.content,
                    source_type=doc.source_type,
                    downloaded_at=doc.downloaded_at,
                    lang=doc.lang,
                    owner_id=user_id,
                )
                db.add(db_doc)

        db.commit()
        logger.info(
            f"PDF processing completed for {filename}, saved {len(documents)} documents"
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Error in PDF processing task: {str(e)}")
