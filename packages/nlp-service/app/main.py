"""
Sensitivity Detection NLP Service
PX-878: Tiered Content Classifier

FastAPI application for classifying transcript segments into sensitivity tiers:
- REDACTED: Personal/off-topic content for removal
- RESTRICTED: Sensitive business content (HR, legal, M&A)
- STANDARD: Normal work content
"""

import os
import time
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from app.api import classify, train, health
from app.models.classifier import TierClassifier


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Prometheus metrics
REQUEST_COUNT = Counter(
    "sensitivity_requests_total",
    "Total requests",
    ["method", "endpoint", "status"]
)
REQUEST_LATENCY = Histogram(
    "sensitivity_request_latency_seconds",
    "Request latency",
    ["method", "endpoint"]
)
CLASSIFICATION_COUNT = Counter(
    "sensitivity_classifications_total",
    "Total classifications",
    ["tier"]
)


# Global classifier instance
classifier: TierClassifier | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for startup/shutdown events.
    Loads the classifier model on startup.
    """
    global classifier

    logger.info("Starting Sensitivity Detection NLP Service")

    # Load classifier
    try:
        classifier = TierClassifier()
        classifier.load_models()
        logger.info("Classifier models loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load classifier models: {e}")
        # Continue with fallback/rule-based classification
        classifier = TierClassifier()

    yield

    # Cleanup on shutdown
    logger.info("Shutting down Sensitivity Detection NLP Service")


# Create FastAPI app
app = FastAPI(
    title="Sensitivity Detection NLP Service",
    description="Tiered content classifier for transcript segments (PX-878)",
    version="1.0.0",
    lifespan=lifespan,
)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing."""
    start_time = time.time()

    response = await call_next(request)

    duration = time.time() - start_time

    # Record metrics
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()

    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)

    # Log request
    logger.info(
        f"{request.method} {request.url.path} "
        f"status={response.status_code} "
        f"duration={duration:.3f}s"
    )

    return response


# API Key authentication
@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    """Verify API key for all requests except health checks."""
    # Skip auth for health endpoints and metrics
    if request.url.path in ["/health", "/healthz", "/readyz", "/livez", "/metrics"]:
        return await call_next(request)

    api_key = request.headers.get("X-Service-API-Key")
    expected_key = os.getenv("SENSITIVITY_API_KEY")

    if not expected_key:
        # API key not configured - allow requests (dev mode)
        logger.warning("SENSITIVITY_API_KEY not configured - allowing request")
        return await call_next(request)

    if api_key != expected_key:
        return JSONResponse(
            status_code=401,
            content={"error": {"code": "UNAUTHORIZED", "message": "Invalid API key"}}
        )

    return await call_next(request)


# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(classify.router, prefix="/v1", tags=["Classification"])
app.include_router(train.router, prefix="/v1", tags=["Training"])


# Prometheus metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal error occurred"
            }
        }
    )


def get_classifier() -> TierClassifier:
    """Get the global classifier instance."""
    global classifier
    if classifier is None:
        classifier = TierClassifier()
    return classifier
