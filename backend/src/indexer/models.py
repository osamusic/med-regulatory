from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class IndexConfig(BaseModel):
    """Configuration for document indexing"""

    chunk_size: int = 256
    chunk_overlap: int = 20
    embedding_model: str = "text-embedding-ada-002"
    force_reindex: bool = False


class IndexStats(BaseModel):
    """Statistics about the index"""

    total_documents: int
    total_chunks: int
    last_updated: datetime


class SearchQuery(BaseModel):
    """Search query for the index"""

    query: str
    top_k: int = 5
    filters: Optional[Dict[str, Any]] = None


class ChatRequest(BaseModel):
    """Request model for chat interactions"""

    user_id: str
    question: str


class ChatResponse(BaseModel):
    """Response model for chat interactions"""

    user_id: str
    answer: str
