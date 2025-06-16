"""LlamaIndex utilities for document indexing and retrieval.

This module provides utilities for integrating LlamaIndex with the MedShield AI
system, including document indexing, vector storage, and retrieval adapters.
"""

import logging
import os
from datetime import datetime
from typing import Any, List, Optional

from dotenv import load_dotenv
from langchain_core.retrievers import BaseRetriever
from langchain_openai import OpenAIEmbeddings
from llama_index.core import (
    Document,
    Settings,
    StorageContext,
    VectorStoreIndex,
    load_index_from_storage,
)
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.openai import OpenAI as LlamaOpenAI
from llama_index.llms.openrouter import OpenRouter as LlamaOpenRouter


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Global default settings
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
if os.getenv("OPENROUTER_API_KEY"):
    Settings.llm = LlamaOpenRouter(model=MODEL)
    Settings.embed_model = HuggingFaceEmbedding()
else:
    Settings.llm = LlamaOpenAI(model=MODEL)
    Settings.embed_model = OpenAIEmbeddings(model="text-embedding-ada-002")


Settings.node_parser = SimpleNodeParser(chunk_size=256, chunk_overlap=20)
Settings.num_output = 512
Settings.context_window = int(os.getenv("MAX_DOCUMENT_SIZE", 4000))
logger.info("llama-index settings initialized with model: %s", MODEL)


class LlamaIndexRetrieverAdapter(BaseRetriever):
    """Adapter to use LlamaIndex retriever with LangChain."""

    def __init__(self, llama_ret: Any):
        """Initialize the adapter with a LlamaIndex retriever.

        Args:
            llama_ret: LlamaIndex retriever instance.
        """
        super().__init__()
        self._llama_ret = llama_ret

    def _get_relevant_documents(self, query: str) -> List[Document]:
        """Retrieve relevant documents for the given query.

        Args:
            query: The search query string.

        Returns:
            List of relevant documents.
        """
        return self._llama_ret.retrieve(query)


class LlamaIndexer:
    """llama Indexer for managing vector store indices and chat interactions"""

    def __init__(self, storage_dir: str = "./storage", index_dir: str = "index"):
        """Initialize the indexer with a storage directory.
        
        Args:
            storage_dir: Local storage directory
            index_dir: Index directory name
        """
        self.storage_dir = storage_dir
        self.index_dir = os.path.join(storage_dir, index_dir)
        os.makedirs(self.index_dir, exist_ok=True)
        
        logger.info(f"Using local storage: {self.index_dir}")
            
        self.index = self._load_or_create_index()
        # Initialize LlamaIndex retriever
        llama_retriever = self.index.as_retriever(similarity_top_k=5)
        self.retriever = LlamaIndexRetrieverAdapter(llama_ret=llama_retriever)

    def store_index(self, documents: List[Document]) -> None:
        try:
            self.index.insert_nodes(documents)
            self.index.storage_context.persist(persist_dir=self.index_dir)
        except Exception as e:
            logger.error(f"Error storing index: {e}")

    def query_engine(self, query: str, top_k: int = 5) -> Optional[Any]:
        """Query the index and return relevant documents"""
        if not self.index:
            logger.warning("No index available for search")
            return None
        query_engine = self.index.as_query_engine(similarity_top_k=top_k)
        response = query_engine.query(query)
        return response

    def get_retriever(self) -> BaseRetriever:
        """Get the retriever for querying the index"""
        return self.retriever

    def get_total_chunks(self) -> int:
        """Get the total number of chunks in the index"""
        if not self.index:
            return 0
        return len(self.index.storage_context.docstore.docs)

    def get_last_updated(self) -> datetime:
        """Get the last updated timestamp of the index"""
        index_file = os.path.join(self.index_dir, "docstore.json")
        if os.path.exists(index_file):
            last_updated = datetime.fromtimestamp(os.path.getmtime(index_file))
        else:
            last_updated = datetime.now()
        return last_updated

    def _create_empty_index(self) -> VectorStoreIndex:
        """Create a new empty vector store index"""
        try:
            storage_context = StorageContext.from_defaults()
            index = VectorStoreIndex.from_documents([], storage_context=storage_context)
            index.storage_context.persist(persist_dir=self.index_dir)
            return index
        except Exception as e:
            logger.error(f"Error creating empty index: {e}")
            raise

    def _load_or_create_index(self) -> VectorStoreIndex:
        """Load an existing index or create a new one"""
        try:
            index_file = os.path.join(self.index_dir, "docstore.json")
            if os.path.exists(index_file):
                storage_context = StorageContext.from_defaults(persist_dir=self.index_dir)
                logger.info(f"Loaded index from {self.index_dir}")
                return load_index_from_storage(storage_context=storage_context)
            else:
                logger.info("Creating new empty index")
                return self._create_empty_index()
        except Exception as e:
            logger.error(f"Error loading index: {e}")
            return self._create_empty_index()
