"""Common exception definitions and handlers."""

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import Request
from fastapi.responses import JSONResponse


class MLServiceError(Exception):
    """Base exception for ML Services."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)

    def to_response(self, request_id: str) -> JSONResponse:
        """Convert to FastAPI JSONResponse."""
        content: Dict[str, Any] = {
            "error": {
                "code": self.code,
                "message": self.message,
            },
            "request_id": request_id,
        }
        if self.details:
            content["error"]["details"] = self.details
        return JSONResponse(status_code=self.status_code, content=content)


class PrivacyBudgetExhausted(MLServiceError):
    """Raised when an org's privacy budget is exhausted."""

    def __init__(
        self,
        org_id: UUID,
        consumed: float,
        budget: float,
        resets_at: Optional[str] = None,
    ):
        super().__init__(
            code="PRIVACY_BUDGET_EXHAUSTED",
            message="Organization privacy budget exhausted. Model training blocked.",
            status_code=403,
            details={
                "org_id": str(org_id),
                "consumed": consumed,
                "budget": budget,
                "resets_at": resets_at,
            },
        )


class ModelNotFound(MLServiceError):
    """Raised when a model is not found."""

    def __init__(self, model_id: UUID):
        super().__init__(
            code="MODEL_NOT_FOUND",
            message=f"Model {model_id} not found",
            status_code=404,
            details={"model_id": str(model_id)},
        )


class VersionNotFound(MLServiceError):
    """Raised when a model version is not found."""

    def __init__(self, model_id: UUID, version_number: int):
        super().__init__(
            code="VERSION_NOT_FOUND",
            message=f"Version {version_number} not found for model {model_id}",
            status_code=404,
            details={"model_id": str(model_id), "version_number": version_number},
        )


class OrgProfileNotFound(MLServiceError):
    """Raised when an org profile is not found."""

    def __init__(self, org_id: UUID):
        super().__init__(
            code="ORG_PROFILE_NOT_FOUND",
            message=f"Organization profile not found for org {org_id}",
            status_code=404,
            details={"org_id": str(org_id)},
        )


class TrainingDisabled(MLServiceError):
    """Raised when training is disabled for an org."""

    def __init__(self, org_id: UUID):
        super().__init__(
            code="TRAINING_DISABLED",
            message="Model training is disabled for this organization",
            status_code=403,
            details={"org_id": str(org_id)},
        )


class RateLimitExceeded(MLServiceError):
    """Raised when rate limit is exceeded."""

    def __init__(self, limit: int, window: str, retry_after: int):
        super().__init__(
            code="RATE_LIMIT_EXCEEDED",
            message=f"Rate limit of {limit} requests per {window} exceeded",
            status_code=429,
            details={
                "limit": limit,
                "window": window,
                "retry_after_seconds": retry_after,
            },
        )


class DeploymentConflict(MLServiceError):
    """Raised when there's a deployment conflict."""

    def __init__(self, model_id: UUID, environment: str, message: str):
        super().__init__(
            code="DEPLOYMENT_CONFLICT",
            message=message,
            status_code=409,
            details={"model_id": str(model_id), "environment": environment},
        )


def register_exception_handlers(app):
    """Register exception handlers with FastAPI app."""

    @app.exception_handler(MLServiceError)
    async def ml_service_error_handler(
        request: Request, exc: MLServiceError
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "unknown")
        return exc.to_response(request_id)

    @app.exception_handler(PrivacyBudgetExhausted)
    async def privacy_budget_handler(
        request: Request, exc: PrivacyBudgetExhausted
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "unknown")
        return exc.to_response(request_id)
