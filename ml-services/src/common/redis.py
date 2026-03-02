"""Redis connection and utilities."""

from typing import Optional

import structlog
from redis.asyncio import Redis, from_url

from src.common.config import settings

logger = structlog.get_logger()

_redis_client: Optional[Redis] = None


async def get_redis() -> Redis:
    """Get Redis client instance."""
    global _redis_client
    if _redis_client is None:
        _redis_client = await from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def check_redis_connection() -> bool:
    """Check if Redis is reachable."""
    try:
        client = await get_redis()
        await client.ping()
        return True
    except Exception as e:
        logger.warning("Redis connection check failed", error=str(e))
        return False


async def close_redis() -> None:
    """Close Redis connection."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
