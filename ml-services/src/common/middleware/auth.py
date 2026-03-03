"""Service-to-service authentication middleware."""

import secrets
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.common.config import settings

logger = structlog.get_logger()

# Paths that don't require authentication
PUBLIC_PATHS = {
    "/healthz",
    "/readyz",
    "/livez",
    "/metrics",
    "/docs",
    "/redoc",
    "/openapi.json",
}


class ServiceAuthMiddleware(BaseHTTPMiddleware):
    """Validate service API key for protected endpoints."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip auth for public paths
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # Skip auth for metrics (prefix match)
        if request.url.path.startswith("/metrics"):
            return await call_next(request)

        # Get API key from header
        api_key = request.headers.get(settings.SERVICE_API_KEY_HEADER)

        if not api_key:
            logger.warning(
                "Missing API key",
                path=request.url.path,
                request_id=getattr(request.state, "request_id", "unknown"),
            )
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Missing API key",
                    }
                },
            )

        # Constant-time comparison to prevent timing attacks
        if not secrets.compare_digest(api_key, settings.SERVICE_API_KEY):
            logger.warning(
                "Invalid API key",
                path=request.url.path,
                request_id=getattr(request.state, "request_id", "unknown"),
            )
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Invalid API key",
                    }
                },
            )

        # Extract org_id from header for multi-tenant context
        org_id = request.headers.get("X-Org-ID")
        if org_id:
            request.state.org_id = org_id

        # Extract user_id from header for user context
        user_id = request.headers.get("X-User-ID")
        if user_id:
            request.state.user_id = user_id

        return await call_next(request)
