import os
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session as SQLAlchemySession

from ..auth.hybrid_auth import get_current_active_user
from ..db.database import get_db
from ..db.models import DocumentModel
from .indexer import DocumentIndexer
from .models import ChatRequest, ChatResponse, IndexConfig, IndexStats, SearchQuery

router = APIRouter(
    prefix="/index",
    tags=["index"],  # Authenticated users only
    dependencies=[Depends(get_current_active_user)],
)

# Load environment variables
load_dotenv()

# Initialize the document indexer with the storage directory
indexer = DocumentIndexer(storage_dir=os.getenv("INDEX_DATA_PATH", "./storage"))


@router.post("/documents")
async def index_documents(
    config: IndexConfig = Body(None), db: SQLAlchemySession = Depends(get_db)
):
    """Index all documents in the database"""
    # Retrieve all documents
    documents = db.query(DocumentModel).all()

    # Prepare document payloads for indexing
    docs_to_index = []
    for doc in documents:
        docs_to_index.append(
            {
                "doc_id": doc.doc_id,
                "doc_title": doc.original_title,
                "title": doc.title,
                "content": doc.content,
                "url": doc.url,
                "source_type": doc.source_type,
                "downloaded_at": (
                    doc.downloaded_at.isoformat() if doc.downloaded_at else None
                ),
            }
        )

    # Perform indexing
    stats = indexer.index_documents(docs_to_index, config)

    # Build response message
    result = {
        "message": (
            f"{stats['indexed']} documents have been indexed"
            f" ({stats['skipped']} documents were skipped)"
        ),
        "stats": stats,
    }

    return result


@router.get("/metadata/keys", response_model=List[str])
async def get_metadata_keys():
    return indexer.list_metadata_keys()


@router.get("/metadata/values/{key}", response_model=List[Any])
async def get_metadata_values(key: str):
    return indexer.list_metadata_values(key)


@router.post("/search", response_model=List[Dict[str, Any]])
async def search_index(query: SearchQuery):
    """Search the index for documents matching the query"""
    return indexer.search(query.query, query.top_k, query.filters)


@router.get("/stats", response_model=IndexStats)
async def get_index_stats():
    """Get statistics about the document index"""
    return indexer.get_stats()


memory_store = {}


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    answer = indexer.chat_with_memory(req.user_id, req.question, memory_store)
    return ChatResponse(user_id=req.user_id, answer=answer)
