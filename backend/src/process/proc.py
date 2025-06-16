import json
import logging
import os
import re
from enum import Enum
from typing import Dict, List
from uuid import UUID

from dotenv import load_dotenv
from llama_index.core import Document as LlamaDocument
from openai import OpenAI
from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..db.models import (
    PhaseEnum,
    PriorityEnum,
    ProcessCluster,
    ProcessDocument,
    RoleEnum,
    SubjectEnum,
)
from ..utils.llama import LlamaIndexer

load_dotenv()
MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
BATCH_SIZE = 10
logger = logging.getLogger(__name__)


def classify_batch(texts: List[str]) -> List[Dict]:
    prompt = "Classify each of the following cybersecurity requirements:\n\n"

    for i, text in enumerate(texts):
        prompt += f"{i + 1}. {text}\n"

    prompt += """
    Return a JSON list. Each item should have:
    - subject (Manufacturer, Healthcare Provider, Regulatory Authority)
    - phase (Design, Development, Pre-market, Operation, Incident Response, Disposal)
    - priority (Shall, Should)
    - role (if subject is Manufacturer: choose from Development Engineer, Security Architect, Quality Assurance, Regulatory Affairs, Product Manager, Operations Engineer, Incident Response Specialist; otherwise: use Other)
    - processed_text (normalized summary)"""

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=MODEL_NAME, messages=[{"role": "user", "content": prompt}], temperature=0
    )
    raw = response.choices[0].message.content
    match = re.search(r"```json\s*(.*?)\s*```", raw, re.DOTALL)
    if match:
        cleaned = match.group(1)
    else:
        cleaned = raw  # fallback: 全体をそのまま使う

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON parse failed: {e}\n\nOriginal:\n{cleaned}")


def normalize_enum_input(input_value: str, enum_cls: Enum) -> str:
    cleaned_input = input_value.lower().replace(" ", "").replace("-", "_")
    for member in enum_cls:
        cleaned_enum_name = member.name.lower().replace(" ", "").replace("-", "_")
        cleaned_enum_value = member.value.lower().replace(" ", "").replace("-", "_")
        if cleaned_input == cleaned_enum_name or cleaned_input == cleaned_enum_value:
            return member.value
    return enum_cls.unknown.value


def normalize_result(raw: dict) -> dict:
    return {
        "subject": normalize_enum_input(raw["subject"], SubjectEnum),
        "phase": normalize_enum_input(raw["phase"], PhaseEnum),
        "priority": normalize_enum_input(raw["priority"], PriorityEnum),
        "role": normalize_enum_input(raw["role"], RoleEnum),
        "processed_text": raw["processed_text"],
    }


def classify_and_save(db: Session, texts_with_ids: list[tuple[str, UUID]]):
    batch_size = BATCH_SIZE
    for i in range(0, len(texts_with_ids), batch_size):
        batch = texts_with_ids[i : i + batch_size]
        texts = [text for text, _ in batch]
        results = classify_batch(texts)

        for (_, doc_id), result in zip(batch, results):
            doc = db.query(ProcessDocument).filter(ProcessDocument.id == doc_id).first()
            if not doc:
                continue
            normalized = normalize_result(result)
            doc.processed_text = normalized["processed_text"]
            doc.subject = normalized.get("subject", "unknown")
            doc.phase = normalized.get("phase", "unknown")
            doc.priority = normalized.get("priority", "unknown")
            doc.role = normalized.get("role", "unknown")

        db.commit()


# Initialize process indexer
proc_indexer = LlamaIndexer(
    storage_dir=os.getenv("INDEX_DATA_PATH", "./storage"),
    index_dir="proc_index",
)


def cluster_documents(db: Session, similarity_threshold: float = 0.88):
    docs = db.query(ProcessDocument).filter(ProcessDocument.cluster_id.is_(None)).all()
    if not docs:
        return {"clustered": 0, "clusters": []}

    llama_docs = [
        LlamaDocument(text=doc.original_text, metadata={"id": doc.id}) for doc in docs
    ]
    proc_indexer.store_index(llama_docs)
    retriever = proc_indexer.index.as_retriever(similarity_top_k=5)

    clustered = set()
    clusters = []

    for doc in llama_docs:
        doc_id = doc.metadata["id"]
        if doc_id in clustered:
            continue
        results = retriever.retrieve(doc.text)

        cluster_ids = []
        for r in results:
            if r.score >= similarity_threshold and r.metadata["id"] not in clustered:
                cluster_ids.append(r.metadata["id"])
                clustered.add(r.metadata["id"])

        if cluster_ids:
            clusters.append(cluster_ids)

    for cluster in clusters:
        rep_id = cluster[0]
        rep_doc = db.query(ProcessDocument).filter(ProcessDocument.id == rep_id).first()
        new_cluster = ProcessCluster(rep_text=rep_doc.processed_text)
        db.add(new_cluster)
        db.flush()  # cluster.idを使うため

        for cid in cluster:
            doc = db.query(ProcessDocument).filter(ProcessDocument.id == cid).first()
            doc.cluster_id = new_cluster.id

    db.commit()
    return {"clustered": len(clusters), "clusters": clusters}


if __name__ == "__main__":
    db = SessionLocal()
    docs = (
        db.query(ProcessDocument)
        .filter(ProcessDocument.subject == SubjectEnum.unknown)
        .all()
    )
    texts_with_ids = [(doc.original_text, doc.id) for doc in docs]
    classify_and_save(db, texts_with_ids)
