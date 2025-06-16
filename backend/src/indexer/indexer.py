"""Document indexer for vector search and AI-powered querying.

This module provides document indexing capabilities using LlamaIndex and OpenAI
embeddings, enabling semantic search and conversational AI over cybersecurity documents.
"""

import hashlib
import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
import openai
from dotenv import load_dotenv
from langchain.memory import ConversationBufferMemory
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableMap
from langchain_openai import ChatOpenAI
from llama_index.core import (
    Document,
    StorageContext,
    VectorStoreIndex,
    load_index_from_storage,
)
from llama_index.core.query_engine import BaseQueryEngine

from ..utils.llama import LlamaIndexer
from .models import IndexConfig, IndexStats

MAX_HISTORY = 10

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configure LLM and embedding models based on environment
if os.getenv("OPENROUTER_API_KEY"):
    openai.api_type = "openrouter"
    openai.api_key = os.getenv("OPENROUTER_API_KEY")
    MODEL = "deepseek/deepseek-r1:free"
    logger.info(f"Using OpenRouter model: {MODEL}")
else:
    openai.api_key = os.getenv("OPENAI_API_KEY")
    openai.api_type = "openai"
    MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    logger.info(f"Using OpenAI model: {MODEL}")


if not openai.api_key:
    logger.warning("API_KEY environment variable not set")


# Patch httpx client to remove 'proxies' parameter
original_client_init = httpx.Client.__init__


def patched_client_init(self, *args, **kwargs):
    if "proxies" in kwargs:
        logger.info("Removing 'proxies' parameter from httpx.Client.__init__")
        del kwargs["proxies"]
    original_client_init(self, *args, **kwargs)


httpx.Client.__init__ = patched_client_init

original_async_client_init = httpx.AsyncClient.__init__


def patched_async_client_init(self, *args, **kwargs):
    if "proxies" in kwargs:
        logger.info("Removing 'proxies' parameter from httpx.AsyncClient.__init__")
        del kwargs["proxies"]
    original_async_client_init(self, *args, **kwargs)


httpx.AsyncClient.__init__ = patched_async_client_init


class DocumentIndexer:
    """Indexer for medical device cybersecurity documents"""

    def __init__(self, storage_dir: str = "./storage"):
        """Initialize the indexer with a storage directory"""
        self.storage_dir = storage_dir
        self.documents_dir = os.path.join(storage_dir, "documents")
        os.makedirs(self.documents_dir, exist_ok=True)

        # Initialize LlamaIndexer
        self.indexer = LlamaIndexer(storage_dir=storage_dir, index_dir="index")
        
        self.retriever = self.indexer.get_retriever()
        self.llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
        self.memory = ConversationBufferMemory(return_messages=True)
        self.prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a helpful cybersecurity expert. Use the context below to answer the question.\n\n{context}",
                ),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{question}"),
            ]
        )
        self.chain = (
            RunnableMap(
                {
                    "context": lambda x: self.retriever.invoke(x["question"]),
                    "question": lambda x: x["question"],
                    "chat_history": lambda x: x.get("chat_history", []),
                }
            )
            | self.prompt
            | self.llm
            | StrOutputParser()
        ).with_config(run_name="cyber-chat")

        self._filtered_indices: Dict[Tuple[str, Any], VectorStoreIndex] = {}

    def index_documents(
        self, documents: List[Dict[str, Any]], config: Optional[IndexConfig] = None
    ) -> Dict[str, int]:
        """Index a list of documents and track how many were indexed or skipped"""
        if not documents:
            logger.warning("No documents to index")
            return {"indexed": 0, "skipped": 0, "total": 0}

        config = config or IndexConfig()

        existing_docs = set()
        if not config.force_reindex:
            if os.path.exists(self.documents_dir):
                existing_files = [f for f in os.listdir(self.documents_dir) if f.endswith('.json')]
                existing_docs = {f.replace(".json", "") for f in existing_files}
            logger.info(f"Found {len(existing_docs)} already indexed documents")

        new_docs, skipped = [], []
        llama_docs = []
        for doc in documents:
            doc_id = doc.get("doc_id", "")
            content = doc.get("content", "")
            if not doc_id:
                logger.warning("Skipping document with empty doc_id")
                continue
            if not config.force_reindex and doc_id in existing_docs:
                logger.info(f"Skipping already indexed document: {doc_id}")
                skipped.append(doc_id)
                continue

            # Save raw document
            doc_path = os.path.join(self.documents_dir, f"{doc_id}.json")
            with open(doc_path, "w", encoding="utf-8") as f:
                json.dump(doc, f, indent=2, ensure_ascii=False)

            metadata = {
                "doc_id": doc_id,
                "doc_title": doc.get("doc_title", ""),
                "title": doc.get("title", ""),
                "url": doc.get("url", ""),
                "source_type": doc.get("source_type", ""),
                "downloaded_at": doc.get("downloaded_at", datetime.now().isoformat()),
            }
            llama_docs.append(Document(text=content, metadata=metadata))
            new_docs.append(doc_id)

        # Insert new documents into the index
        if llama_docs:
            self.indexer.store_index(llama_docs)
        else:
            logger.info("No new documents to index")

        return {
            "indexed": len(new_docs),
            "skipped": len(skipped),
            "total": len(documents),
        }

    def _to_markdown(self, text: str) -> str:
        """Convert raw text lines into markdown format with headings and lists"""
        lines = text.splitlines()
        md = []
        for line in lines:
            line = line.strip()
            if not line:
                md.append("")
                continue
            # [SECTION: X] -> ### SECTION: X
            sec = re.match(r"\[SECTION:\s*(.*?)\]", line)
            if sec:
                md.append(f"### SECTION: {sec.group(1)}")
                continue
            # [PAGE_15] -> ### PAGE_15
            if re.match(r"^\[PAGE_[0-9]+\]", line):
                md.append(f"### {line.strip('[]')}")
                continue
            # Numeric headings e.g., 5.4 Title
            if re.match(r"^\d+(\.\d+)*\s+[A-Z].*", line):
                md.append(f"### {line}")
                continue
            # Subheadings e.g., 5.5.1 Labeling
            if re.match(r"^\d+\.\d+\.\d+\s+.*", line):
                md.append(f"#### {line}")
                continue
            # Bullet list starting with special character
            if line.startswith("") or line.startswith(" •"):
                md.append(f"- {line.lstrip(' •')} ")
                continue
            # Lines ending with colon -> bold
            if re.match(r"^[A-Za-z\s]+:$", line):
                md.append(f"**{line}**")
                continue
            # URLs -> block quote
            if "http" in line:
                md.append(f"> ({line})")
                continue
            md.append(line)
        return "\n".join(md)

    def list_metadata_keys(self) -> List[str]:
        """
        return metadata keys
        """
        # get docstore VectorStoreIndex
        docstore = self.indexer.index.docstore
        keys = set()
        # docstore.docs is dictionary {doc_id: Node}
        for node in docstore.docs.values():
            # node.metadata is dictionary {key: value}
            keys.update(node.metadata.keys())
        return sorted(keys)

    def list_metadata_values(self, key: str) -> List[Any]:
        """
        Return all unique values for a given metadata key across indexed documents
        """
        docstore = self.indexer.index.docstore
        values = set()
        for node in docstore.docs.values():
            if key in node.metadata:
                values.add(node.metadata[key])
        return sorted(values)

    def _make_safe_subdir(self, key: str, value: Any) -> str:
        raw = f"{key}:{value}".encode("utf-8")
        digest = hashlib.sha256(raw).hexdigest()[:8]
        return os.path.join(self.storage_dir, digest)

    def _get_filtered_query_engine(
        self,
        key: str,
        value: Any,
        top_k: int = 5,
    ) -> BaseQueryEngine:
        cache_key = (key, value)
        subdir = self._make_safe_subdir(key, value)

        if cache_key not in self._filtered_indices:
            if os.path.isdir(subdir) and os.listdir(subdir):
                # Load existing filtered index
                storage_context = StorageContext.from_defaults(persist_dir=subdir)
                idx = load_index_from_storage(storage_context)
            else:
                # Create new filtered index
                all_nodes = list(self.indexer.index.docstore.docs.values())
                filtered_nodes = [n for n in all_nodes if n.metadata.get(key) == value]
                docs = [
                    Document(text=n.get_content() or "", metadata=n.metadata)
                    for n in filtered_nodes
                ]
                storage_context = StorageContext.from_defaults()
                idx = VectorStoreIndex.from_documents(
                    docs, storage_context=storage_context
                )
                idx.storage_context.persist(persist_dir=subdir)

            self._filtered_indices[cache_key] = idx
        idx = self._filtered_indices[cache_key]
        return idx.as_query_engine(similarity_top_k=top_k)


    def search(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, List[str]]] = None,
    ) -> List[Dict[str, Any]]:
        """Search the index for relevant documents"""
        if filters:
            key, value = next(iter(filters.items()))
            query_engine = self._get_filtered_query_engine(key, value, top_k)
        else:
            query_engine = self.indexer.index.as_query_engine(
                similarity_top_k=top_k,
            )

        response = query_engine.query(query)
        results = []
        for scored_node in response.source_nodes:
            node = scored_node.node
            try:
                content = node.get_content()
            except Exception:
                content = "No text content available"
            results.append(
                {
                    "text": self._to_markdown(content),
                    "score": scored_node.score,
                    "metadata": getattr(node, "metadata", {}),
                }
            )
        return results

    def get_stats(self) -> IndexStats:
        """Return statistics about the index and stored documents"""
        # Count stored documents
        total_docs = len(os.listdir(self.documents_dir)) if os.path.exists(self.documents_dir) else 0
        # Determine total chunks/nodes in the index structure
        total_chunks = self.indexer.get_total_chunks() if self.indexer else 0
        # Get last updated timestamp
        last_updated = (
            self.indexer.get_last_updated() if self.indexer else datetime.now()
        )
        return IndexStats(
            total_documents=total_docs,
            total_chunks=total_chunks,
            last_updated=last_updated,
        )

    def chat_with_memory(self, user_id: str, question: str, memory_store: dict) -> str:
        """Handle chat interactions with the indexed documents"""
        # セッションに応じた履歴を取得または初期化
        if user_id not in memory_store:
            memory_store[user_id] = []

        chat_history = memory_store[user_id]

        inputs = {"question": question, "chat_history": chat_history}
        answer = self.chain.invoke(inputs)

        chat_history.append(HumanMessage(content=question))
        chat_history.append(AIMessage(content=answer))
        memory_store[user_id] = chat_history[-MAX_HISTORY:]
        return answer

