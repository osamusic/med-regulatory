import json
import re
from typing import List

from sqlalchemy.orm import Session

from ..db.models import NewsSettings

DEFAULT_KEYWORDS = [
    "cyber",
    "cybersecurity",
    "IEC 81001",
    "FDA",
    "vulnerability",
    "medical device",
    "software update",
    "healthcare",
    "PMDA",
    "JIS T 2304",
    "JIS T 81001",
    "risk",
    "advisory",
]


def get_keywords(db: Session = None) -> List[str]:
    """Get keywords from database or return defaults"""
    if not db:
        return DEFAULT_KEYWORDS

    keywords_json = NewsSettings.get_settings(
        db, "keywords", json.dumps(DEFAULT_KEYWORDS)
    )
    try:
        return json.loads(keywords_json)
    except Exception:
        return DEFAULT_KEYWORDS


def contains_relevant_keywords(text: str, db: Session = None) -> bool:
    """Check if text contains relevant keywords"""
    keywords = get_keywords(db)
    return any(keyword.lower() in text.lower() for keyword in keywords)


def summarize(text: str, max_sentences: int = 3) -> str:
    """Summarize text (extract first few sentences)"""
    sentences = re.split(r"(?<=[。.!?])\s+", text.strip())
    return " ".join(sentences[:max_sentences])
