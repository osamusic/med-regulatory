"""API caching utilities for MedShield AI.

This module provides safe caching decorators and cache invalidation utilities
for FastAPI endpoints using Redis backend.
"""

import logging
from functools import wraps

from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache
from redis.asyncio import Redis

logger = logging.getLogger(__name__)


def safe_cache(*args, **kwargs):
    """Safe cache decorator that falls back to original function on cache failures.

    Args:
        *args: Arguments to pass to the cache decorator.
        **kwargs: Keyword arguments to pass to the cache decorator.

    Returns:
        Decorated function with safe caching.
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*f_args, **f_kwargs):
            try:
                cached_func = cache(*args, **kwargs)(func)
                return await cached_func(*f_args, **f_kwargs)
            except Exception as e:
                logger.warning(f"Cache failed, falling back to original function: {e}")
                return await func(*f_args, **f_kwargs)

        return wrapper

    return decorator


async def invalidate_cache(namespace: str):
    """Invalidate all cache keys for the given namespace.

    Args:
        namespace: Cache namespace to invalidate.
    """
    try:
        redis: Redis = FastAPICache.get_backend().redis
        keys = [
            "{namespace}:*",
        ]
        for key in keys:
            res = await redis.keys(key)
            if res:
                await redis.delete(*res)
        logger.info(f"Cache invalidated {namespace}")
    except Exception as e:
        logger.warning(f"Cache Error {e}")
