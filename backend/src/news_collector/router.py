import json
import os
from datetime import datetime
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi_cache.decorator import cache
from sqlalchemy.orm import Session

from ..auth.hybrid_auth import get_admin_user, get_current_active_user
from ..db.database import get_db
from ..db.models import Article, NewsSettings
from ..utils.api_cache import invalidate_cache
from .collector import run_collector

REDIS_TTL = int(os.getenv("REDIS_CACHE_TTL", "3600"))  # Default: 1 hour
router = APIRouter(prefix="/news", tags=["news"])


@router.get("/count")
async def get_articles_count(
    keyword: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get total number of news articles"""
    query = db.query(Article)

    if keyword:
        query = query.filter(
            Article.title.contains(keyword) | Article.keywords.contains(keyword)
        )

    total = query.count()
    return {"total": total}


@router.get("/all", response_model=List[dict])
@cache(expire=REDIS_TTL, namespace="news:all")
async def get_articles(
    skip: int = 0,
    limit: int = 20,
    keyword: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get news articles with pagination"""
    query = db.query(Article)

    if keyword:
        query = query.filter(
            Article.title.contains(keyword) | Article.keywords.contains(keyword)
        )

    articles = query.order_by(Article.id.desc()).offset(skip).limit(limit).all()

    return [
        {
            "id": article.id,
            "title": article.title,
            "url": article.url,
            "summary": article.summary,
            "keywords": article.keywords,
            "saved_at": article.saved_at,
        }
        for article in articles
    ]


@router.get("/{article_id}", response_model=dict)
async def get_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get a specific news article"""
    article = db.query(Article).filter(Article.id == article_id).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    return {
        "id": article.id,
        "title": article.title,
        "url": article.url,
        "summary": article.summary,
        "keywords": article.keywords,
        "saved_at": article.saved_at,
    }


@router.post("/collect", status_code=201)
async def collect_articles(
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Collect news articles (run as background task)"""

    def collect_task(db: Session):
        count = run_collector(db)
        print(f"✅ Collected {count} articles")

    background_tasks.add_task(collect_task, db)

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "collect_articles",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": "Started news collection task",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")

    await invalidate_cache("news:all")
    return {"message": "News collection task started"}


@router.delete("/{article_id}", status_code=200)
async def delete_article(
    article_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Delete a specific news article"""
    article = db.query(Article).filter(Article.id == article_id).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    db.delete(article)
    db.commit()

    await invalidate_cache("news:all")

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "delete_article",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": f"Deleted article with ID {article_id}",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")

    return {"message": f"Article with ID {article_id} has been deleted"}


@router.delete("/all", status_code=200)
async def delete_all_articles(
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Delete all news articles"""
    db.query(Article).delete()
    db.commit()
    await invalidate_cache("news:all")

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "delete_all_articles",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": "Deleted all news articles",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")

    return {"message": "All articles have been deleted"}


@router.get("/settings/sites", response_model=List[str])
async def get_news_sites(
    db: Session = Depends(get_db), current_user=Depends(get_admin_user)
):
    """Get configurable news sites (admin only)"""
    from .fetcher import get_news_sites

    return get_news_sites(db)


@router.put("/settings/sites")
async def update_news_sites(
    sites: List[str],
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Update configurable news sites (admin only)"""
    NewsSettings.update_settings(db, "sites", json.dumps(sites))

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "update_news_sites",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": "Updated news sites configuration",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")

    return {"message": "News sites configuration updated successfully"}


@router.get("/settings/keywords", response_model=List[str])
async def get_filter_keywords(
    db: Session = Depends(get_db), current_user=Depends(get_admin_user)
):
    """Get configurable filter keywords (admin only)"""
    from .filters import get_keywords

    return get_keywords(db)


@router.put("/settings/keywords")
async def update_filter_keywords(
    keywords: List[str],
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Update configurable filter keywords (admin only)"""
    NewsSettings.update_settings(db, "keywords", json.dumps(keywords))

    client_host = request.client.host if request.client else "unknown"
    log_entry = {
        "action": "update_filter_keywords",
        "timestamp": datetime.utcnow(),
        "user_id": current_user.id,
        "details": "Updated filter keywords configuration",
        "ip_address": client_host,
    }
    print(f"AUDIT LOG: {log_entry}")

    return {"message": "Filter keywords configuration updated successfully"}
