"""Rate limiting middleware using Redis."""

import time
from typing import Callable, Dict, Optional

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.common.config import settings
from src.common.redis import get_redis

logger = structlog.get_logger()

# Endpoint-specific rate limits (requests per minute)
ENDPOINT_LIMITS: Dict[str, int] = {
    # Registry reads - high limit
    "GET /v1/models": 1000,
    "GET /v1/models/{model_id}": 1000,
    "GET /v1/models/{model_id}/versions": 1000,
    # Registry writes - lower limit
    "POST /v1/models": 100,
    "POST /v1/models/{model_id}/versions": 100,
    "PATCH /v1/models/{model_id}": 100,
    # Deployments - very limited
    "POST /v1/models/{model_id}/versions/{version_number}/deploy": 10,
    "POST /v1/models/{model_id}/versions/{version_number}/rollback": 10,
    # Audit writes - high limit
    "POST /v1/audit/events": 10000,
    "GET /v1/audit/events": 1000,
    # Org profile
    "GET /v1/orgs/{org_id}/profile": 1000,
    "PUT /v1/orgs/{org_id}/profile": 100,
    "GET /v1/orgs/{org_id}/privacy/budget": 1000,
}

# Paths to skip rate limiting
SKIP_PATHS = {"/healthz", "/readyz", "/livez", "/metrics", "/docs", "/redoc", "/openapi.json"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using sliding window with Redis."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip if disabled
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        # Skip health checks and docs
        if request.url.path in SKIP_PATHS or request.url.path.startswith("/metrics"):
            return await call_next(request)

        # Get org_id for per-org limiting
        org_id = getattr(request.state, "org_id", "global")

        # Get limit for this endpoint
        limit = self._get_limit(request.method, request.url.path)

        # Check rate limit
        allowed, remaining, reset_at = await self._check_rate_limit(
            org_id, request.method, request.url.path, limit
        )

        if not allowed:
            logger.warning(
                "Rate limit exceeded",
                org_id=org_id,
                path=request.url.path,
                method=request.method,
                limit=limit,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit of {limit} requests per minute exceeded",
                        "details": {
                            "limit": limit,
                            "window": "1 minute",
                            "retry_after_seconds": reset_at,
                        },
                    },
                    "request_id": getattr(request.state, "request_id", "unknown"),
                },
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_at),
                    "Retry-After": str(reset_at),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_at)

        return response

    def _get_limit(self, method: str, path: str) -> int:
        """Get rate limit for endpoint, with path parameter normalization."""
        # Normalize path by replacing UUIDs with placeholders
        import re
        normalized = re.sub(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            "{id}",
            path,
            flags=re.IGNORECASE,
        )
        # Also replace numeric version numbers
        normalized = re.sub(r"/versions/\d+", "/versions/{version_number}", normalized)
        # Replace org IDs
        normalized = re.sub(r"/orgs/[^/]+", "/orgs/{org_id}", normalized)
        # Replace model IDs
        normalized = re.sub(r"/models/\{id\}", "/models/{model_id}", normalized)

        key = f"{method} {normalized}"
        return ENDPOINT_LIMITS.get(key, settings.RATE_LIMIT_DEFAULT)

    async def _check_rate_limit(
        self, org_id: str, method: str, path: str, limit: int
    ) -> tuple[bool, int, int]:
        """Check and update rate limit using sliding window."""
        try:
            redis = await get_redis()
            window = 60  # 1 minute window

            # Create a unique key for this org + endpoint pattern
            import re
            normalized = re.sub(
                r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
                "*",
                path,
                flags=re.IGNORECASE,
            )
            key = f"rate_limit:{org_id}:{method}:{normalized}"

            now = int(time.time())
            window_start = now - window

            # Use Redis pipeline for atomic operations
            async with redis.pipeline() as pipe:
                # Remove old entries
                await pipe.zremrangebyscore(key, 0, window_start)
                # Add current request
                await pipe.zadd(key, {str(now): now})
                # Count requests in window
                await pipe.zcard(key)
                # Set expiry
                await pipe.expire(key, window)
                results = await pipe.execute()

            count = results[2]
            remaining = max(0, limit - count)
            reset_at = window - (now % window)

            return count <= limit, remaining, reset_at

        except Exception as e:
            logger.warning("Rate limit check failed, allowing request", error=str(e))
            return True, limit, 60
