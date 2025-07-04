"""Main FastAPI application for MedShield AI Backend.

This module sets up the FastAPI application with authentication, caching,
database initialization, and routing for the medical device cybersecurity
expert system.
"""

import hashlib
import ipaddress
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Callable

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis.asyncio import Redis
from sqlalchemy.exc import OperationalError

from .admin.router import router as admin_router
from .auth.firebase_router import router as firebase_auth_router
from .auth.hybrid_auth import get_current_active_user
from .auth.router import router as auth_router
from .classifier.router import protected_router as classifier_protected_router
from .classifier.router import public_router as classifier_public_router
from .crawler.router import router as crawler_router
from .db.database import engine, get_db
from .db.models import Base, SystemSetting
from .guidelines.router import protected_router as guidelines_protected_router
from .guidelines.router import public_router as guidelines_public_router
from .indexer.router import protected_router as indexer_protected_router
from .indexer.router import public_router as indexer_public_router
from .news_collector.router import router as news_router
from .process.router import protected_router as process_protected_router
from .process.router import public_router as process_public_router
from .utils.db_health import DatabaseHealthChecker
from .utils.logging_config import configure_logging
from .workflow.router import router as workflow_router

load_dotenv()
logger = logging.getLogger(__name__)
# Configure logging based on environment
environment, audit_log = configure_logging()


REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")


def custom_key_builder(
    func: Callable, namespace: str, request: Request, response=None, *args, **kwargs
) -> str:
    """Generate a cache key based on the URL path and a hash of sorted query parameters.

    Prevents long keys and avoids unsafe characters like /, ?, &, =.

    Args:
        func: The function being cached.
        namespace: Cache namespace.
        request: The HTTP request object.
        response: The HTTP response object (unused).
        *args: Additional arguments.
        **kwargs: Additional keyword arguments.

    Returns:
        A cache key string.
    """
    if request is None:
        return f"{namespace}:{func.__name__}"
    path = request.url.path
    query_items = sorted(request.query_params.items())
    query_str = "&".join(f"{k}={v}" for k, v in query_items)
    hash_suffix = (
        hashlib.sha256(query_str.encode()).hexdigest() if query_str else "noquery"
    )
    return f"{namespace}:{path}:{hash_suffix}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan for database and cache initialization.

    Args:
        app: The FastAPI application instance.

    Yields:
        None: Control back to the application.
    """
    redis_url = f"redis://{REDIS_HOST}:{REDIS_PORT}"
    if REDIS_PASSWORD:
        redis_url = f"rediss://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}"

    redis = Redis.from_url(redis_url, db=REDIS_DB, encoding="utf-8")

    # Test Redis connection before initializing cache
    try:
        await redis.ping()
        if environment != "production":
            print(f"✅ Redis connected at {REDIS_HOST}:{REDIS_PORT}")
        logging.info(f"Redis connected at {REDIS_HOST}:{REDIS_PORT}")
    except Exception as e:
        error_msg = f"Redis connection failed: {e}"
        if environment != "production":
            print(f"⚠️ {error_msg}")
        logging.warning(error_msg)

    FastAPICache.init(
        RedisBackend(redis), prefix="fastapi-cache", key_builder=custom_key_builder
    )

    retries = 5
    delay = 10
    for i in range(retries):
        try:
            Base.metadata.create_all(bind=engine)
            if environment != "production":
                print("✅ DB connected and tables created")
            logging.info("DB connected and tables created")
            break
        except OperationalError as e:
            error_msg = f"DB connection failed (attempt {i + 1}/{retries}): {e}"
            if environment != "production":
                print(f"⚠️ {error_msg}")
            logging.warning(error_msg)
            time.sleep(delay)
    else:
        error_msg = "DB connection failed after retries"
        if environment != "production":
            print(f"❌ {error_msg}")
        logging.error(error_msg)
        raise

    yield
    await redis.close()  # 終了時の後始末（optional）
    await redis.connection_pool.disconnect()


# Initialize FastAPI app without global dependencies
# Disable docs in production for security
docs_url = "/docs" if environment != "production" else None
redoc_url = "/redoc" if environment != "production" else None
openapi_url = "/openapi.json" if environment != "production" else None

app = FastAPI(
    title="MedShield AI",
    lifespan=lifespan,
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
)


allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost").split(",")


def is_ip_whitelisted(hostname: str) -> bool:
    """Check if an IP address is whitelisted for access.

    Args:
        hostname: The hostname or IP address to check.

    Returns:
        True if the IP is whitelisted (loopback, link-local, or private), False otherwise.
    """
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return False
    if ip.is_loopback or ip.is_link_local or ip.is_private:
        return True

    return False


@app.middleware("http")
async def block__domain(request: Request, call_next):
    """Middleware to block requests from non-whitelisted domains.

    Args:
        request: The incoming HTTP request.
        call_next: The next middleware or endpoint to call.

    Returns:
        HTTP response with 404 for blocked domains or the normal response.
    """
    host_header = request.headers.get("host", "").lower().split(":")[0]
    if is_ip_whitelisted(host_header):
        response = await call_next(request)
        return response

    # Get current allowed hosts from environment (for dynamic testing)
    current_allowed_hosts = os.environ.get("ALLOWED_HOSTS", "localhost").split(",")
    if host_header not in current_allowed_hosts:
        logger.warning(f"access for hostname : {host_header}")
        return Response(status_code=404)

    response = await call_next(request)
    return response


# Router for endpoints requiring authentication
protected_router = APIRouter(dependencies=[Depends(get_current_active_user)])

# Include protected routers
protected_router.include_router(guidelines_protected_router)
protected_router.include_router(process_protected_router)
protected_router.include_router(classifier_protected_router)
protected_router.include_router(indexer_protected_router)
protected_router.include_router(admin_router)
protected_router.include_router(crawler_router)
protected_router.include_router(news_router)
protected_router.include_router(workflow_router)

# Public router for endpoints that don't require authentication (e.g., login)
public_router = APIRouter()
public_router.include_router(auth_router)
public_router.include_router(firebase_auth_router)
public_router.include_router(guidelines_public_router)
public_router.include_router(process_public_router)
public_router.include_router(classifier_public_router)
public_router.include_router(indexer_public_router)


@public_router.get("/")
async def read_root():
    """Return a basic health check message.

    Returns:
        A message indicating the backend is running.
    """
    return {"message": "MedShield AI Backend is running"}


@public_router.get("/debug/db-info")
async def get_db_info(db=Depends(get_db)):
    """Get database connection information for debugging.

    Returns:
        Database connection details and table information.
    """
    try:
        # Get database URL without password
        db_url = str(engine.url)
        if "@" in db_url:
            parts = db_url.split("@")
            db_url = (
                parts[0].split("//")[0]
                + "//"
                + parts[0].split("//")[1].split(":")[0]
                + ":***@"
                + parts[1]
            )

        # Check tables
        from sqlalchemy import inspect

        inspector = inspect(engine)
        tables = inspector.get_table_names()

        # Count records in key tables
        from .db.models import Guideline, SystemSetting, User

        user_count = db.query(User).count()
        guideline_count = db.query(Guideline).count()
        setting_count = db.query(SystemSetting).count()

        return {
            "database_url": db_url,
            "tables": tables,
            "record_counts": {
                "users": user_count,
                "guidelines": guideline_count,
                "system_settings": setting_count,
            },
            "engine_info": {
                "driver": engine.name,
                "pool_class": str(type(engine.pool).__name__),
            },
        }
    except Exception as e:
        logger.error(f"Error getting database info: {str(e)}")
        return {"error": str(e), "database_url": "Error retrieving URL"}


@public_router.get("/health/db")
async def check_database_health(db=Depends(get_db)):
    """Check database connection health and detect idle states.

    Returns:
        Database health status including idle state detection or disabled status.
    """
    # Check if health monitoring is enabled by admin
    health_check_enabled = SystemSetting.get_setting(db, "health_check_enabled", "true")

    if health_check_enabled.lower() != "true":
        return {
            "healthy": None,
            "details": {
                "status": "disabled",
                "message": "Health check monitoring has been disabled by administrator",
            },
            "timestamp": time.time(),
        }

    is_healthy, details = DatabaseHealthChecker.check_connection()

    return {"healthy": is_healthy, "details": details, "timestamp": time.time()}


@public_router.get("/health/redis")
async def check_redis_health():
    """Check Redis connection health.

    Returns:
        Redis health status and connection details.
    """
    try:
        redis_url = f"redis://{REDIS_HOST}:{REDIS_PORT}"
        if REDIS_PASSWORD:
            redis_url = f"rediss://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}"

        redis_client = Redis.from_url(redis_url, db=REDIS_DB, encoding="utf-8")

        start_time = time.time()
        response = await redis_client.ping()
        response_time = (time.time() - start_time) * 1000

        # Test basic operations
        test_key = "health_check_test"
        await redis_client.set(test_key, "test_value", ex=10)  # Expires in 10 seconds
        test_value = await redis_client.get(test_key)
        await redis_client.delete(test_key)

        # Close the connection
        await redis_client.close()

        return {
            "healthy": True,
            "details": {
                "status": "connected",
                "host": REDIS_HOST,
                "port": REDIS_PORT,
                "db": REDIS_DB,
                "response_time_ms": round(response_time, 2),
                "ping_response": response,
                "read_write_test": test_value.decode("utf-8") == "test_value"
                if test_value
                else False,
            },
            "timestamp": time.time(),
        }
    except Exception as e:
        return {
            "healthy": False,
            "details": {
                "status": "connection_failed",
                "host": REDIS_HOST,
                "port": REDIS_PORT,
                "error": str(e),
            },
            "timestamp": time.time(),
        }


@app.get("/me")
async def read_users_me(current_user=Depends(get_current_active_user)):
    """Get current authenticated user information.

    Args:
        current_user: The current authenticated user.

    Returns:
        User information for the authenticated user.
    """
    return current_user


# Register routers
app.include_router(public_router)
app.include_router(protected_router)
