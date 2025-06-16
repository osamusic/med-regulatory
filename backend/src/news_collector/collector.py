from datetime import datetime

from sqlalchemy.orm import Session

from ..db.models import Article
from .fetcher import fetch_and_filter_articles


def run_collector(db: Session) -> int:
    """Collect and save news articles"""
    articles = fetch_and_filter_articles(db)
    print(f"\n🔎 Extracted articles: {len(articles)}\n")

    count = 0
    for art in articles:
        existing = db.query(Article).filter(Article.url == art["url"]).first()
        if existing:
            continue

        new_article = Article(
            title=art["title"],
            url=art["url"],
            summary=art["summary"],
            keywords=", ".join(art["keywords"]),
            saved_at=datetime.now().isoformat(),
        )
        db.add(new_article)
        count += 1

        print(f"📄 {art['title']}")
        print(f"🔗 {art['url']}")

    db.commit()
    return count
