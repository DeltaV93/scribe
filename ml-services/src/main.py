"""
ML Services - FastAPI Application

Inkra's ML infrastructure for model registry, training orchestration,
audit routing, feedback collection, and differential privacy.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app

from src.common.config import settings
from src.common.db.session import init_db, close_db
from src.common.exceptions import register_exception_handlers
from src.common.metrics import init_metrics
from src.common.middleware.auth import ServiceAuthMiddleware
from src.common.middleware.request_id import RequestIDMiddleware
from src.common.middleware.logging import LoggingMiddleware
from src.common.middleware.rate_limit import RateLimitMiddleware

# Domain routers
from src.registry.router import router as registry_router
from src.org_profile.router import router as org_profile_router
from src.audit.router import router as audit_router
from src.feedback.router import router as feedback_router
from src.training.router import router as training_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    # Startup
    logger.info("Starting ML Services", version=settings.VERSION)
    init_metrics(settings.VERSION)
    await init_db()
    yield
    # Shutdown
    logger.info("Shutting down ML Services")
    await close_db()


app = FastAPI(
    title="Inkra ML Services",
    description="Model Registry, Training Orchestration, and Privacy Infrastructure",
    version=settings.VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Register domain exception handlers
register_exception_handlers(app)

# Middleware (order matters - last added is first executed)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(ServiceAuthMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# Health endpoints
@app.get("/healthz", tags=["Health"])
async def healthz() -> dict:
    """Liveness probe - is the process running?"""
    return {"status": "ok"}


@app.get("/readyz", tags=["Health"])
async def readyz() -> dict:
    """Readiness probe - are dependencies connected?"""
    from src.common.db.session import check_db_connection
    from src.common.redis import check_redis_connection

    db_ok = await check_db_connection()
    redis_ok = await check_redis_connection()

    if db_ok and redis_ok:
        return {"status": "ok", "db": "connected", "redis": "connected"}

    return JSONResponse(
        status_code=503,
        content={
            "status": "degraded",
            "db": "connected" if db_ok else "disconnected",
            "redis": "connected" if redis_ok else "disconnected",
        },
    )


@app.get("/livez", tags=["Health"])
async def livez() -> dict:
    """Detailed liveness with component status."""
    from src.common.db.session import check_db_connection
    from src.common.redis import check_redis_connection

    return {
        "status": "ok",
        "version": settings.VERSION,
        "components": {
            "database": "ok" if await check_db_connection() else "error",
            "redis": "ok" if await check_redis_connection() else "error",
        },
    }


# API Routers
app.include_router(registry_router, prefix="/v1", tags=["Model Registry"])
app.include_router(org_profile_router, prefix="/v1", tags=["Org Profile"])
app.include_router(audit_router, prefix="/v1", tags=["Audit"])
app.include_router(feedback_router, prefix="/v1", tags=["Feedback"])
app.include_router(training_router, prefix="/v1", tags=["Training"])


# Global exception handler for uncaught exceptions
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle uncaught exceptions."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(
        "Unhandled exception",
        request_id=request_id,
        path=request.url.path,
        method=request.method,
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            },
            "request_id": request_id,
        },
    )
