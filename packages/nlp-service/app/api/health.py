"""
Health check endpoints.
"""

from fastapi import APIRouter

from app.schemas.sensitivity import HealthResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    """Basic health check."""
    from app.main import get_classifier

    classifier = get_classifier()

    return HealthResponse(
        status="ok",
        version="1.0.0",
        model_loaded=classifier.is_loaded,
        model_version=classifier.version if classifier.is_loaded else None,
    )


@router.get("/healthz")
async def healthz():
    """Kubernetes liveness probe."""
    return {"status": "ok"}


@router.get("/readyz")
async def readyz():
    """Kubernetes readiness probe."""
    from app.main import get_classifier

    classifier = get_classifier()

    if not classifier.is_loaded:
        return {"status": "not ready", "reason": "model not loaded"}

    return {"status": "ready"}


@router.get("/livez")
async def livez():
    """Detailed liveness check."""
    from app.main import get_classifier

    classifier = get_classifier()

    return {
        "status": "ok",
        "components": {
            "spacy": classifier.ner is not None,
            "vader": classifier.sentiment is not None,
            "taxonomy": classifier.taxonomy is not None,
            "classifier": classifier.is_loaded,
        }
    }
