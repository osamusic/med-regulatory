import json
from typing import Any, Dict, List

import newspaper
from sqlalchemy.orm import Session
from tqdm import tqdm

from ..db.models import NewsSettings
from .filters import contains_relevant_keywords, summarize

DEFAULT_NEWS_SITES = [
    "https://www.medtechdive.com",
    "https://www.himss.org/news",
    "https://www.healthcareitnews.com",
    "https://www.securityweek.com",
    "https://www.healthcareinfosecurity.com",
    "https://www.fda.gov/medical-devices/news-events-medical-devices",
    "https://www.medtechinsight.com",
    "https://www.cyberscoop.com",
    "https://www.icd10monitor.com",
    "https://www.healthitsecurity.com",
]


def get_news_sites(db: Session = None) -> List[str]:
    """Get list of news sites from database or return defaults"""
    if not db:
        return DEFAULT_NEWS_SITES

    sites_json = NewsSettings.get_settings(db, "sites", json.dumps(DEFAULT_NEWS_SITES))
    try:
        return json.loads(sites_json)
    except Exception:
        return DEFAULT_NEWS_SITES


def fetch_and_filter_articles(db: Session = None) -> List[Dict[str, Any]]:
    """Fetch and filter relevant news articles"""
    relevant_articles = []
    for site_url in get_news_sites(db):
        print(f"\n🔍 Scanning: {site_url}")
        paper = newspaper.build(site_url, memoize_articles=False)
        for article in tqdm(paper.articles[:10], desc="Checking articles"):
            try:
                article.download()
                article.parse()
                if contains_relevant_keywords(article.title + article.text, db):
                    article.nlp()
                    relevant_articles.append(
                        {
                            "title": article.title,
                            "url": article.url,
                            "summary": summarize(article.text),
                            "keywords": article.keywords,
                        }
                    )
            except Exception as e:
                print(f"[!] Error: {e}")
    return relevant_articles
