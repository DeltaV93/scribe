"""Model Registry API endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.db import get_session
from src.registry.models import ModelType
from src.registry.schemas import (
    ModelCreate,
    ModelUpdate,
    ModelResponse,
    ModelListResponse,
    VersionCreate,
    VersionUpdate,
    VersionResponse,
    VersionListResponse,
    DeploymentCreate,
    DeploymentResponse,
)
from src.registry.service import ModelRegistryService

router = APIRouter(prefix="/models")


def get_service(session: AsyncSession = Depends(get_session)) -> ModelRegistryService:
    """Dependency to get registry service."""
    return ModelRegistryService(session)


# --- Model Endpoints ---


@router.get("", response_model=ModelListResponse)
async def list_models(
    request: Request,
    model_type: Optional[ModelType] = Query(None),
    include_global: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    service: ModelRegistryService = Depends(get_service),
) -> ModelListResponse:
    """List models with optional filtering."""
    org_id = getattr(request.state, "org_id", None)
    org_uuid = UUID(org_id) if org_id else None

    models, total = await service.list_models(
        org_id=org_uuid,
        model_type=model_type.value if model_type else None,
        include_global=include_global,
        page=page,
        page_size=page_size,
    )

    return ModelListResponse(
        items=[ModelResponse.model_validate(m) for m in models],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ModelResponse, status_code=201)
async def create_model(
    data: ModelCreate,
    service: ModelRegistryService = Depends(get_service),
) -> ModelResponse:
    """Register a new model."""
    model = await service.create_model(data)
    return ModelResponse.model_validate(model)


@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(
    model_id: UUID,
    service: ModelRegistryService = Depends(get_service),
) -> ModelResponse:
    """Get model details."""
    model = await service.get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return ModelResponse.model_validate(model)


@router.patch("/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: UUID,
    data: ModelUpdate,
    service: ModelRegistryService = Depends(get_service),
) -> ModelResponse:
    """Update model metadata."""
    model = await service.update_model(model_id, data)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return ModelResponse.model_validate(model)


# --- Version Endpoints ---


@router.get("/{model_id}/versions", response_model=VersionListResponse)
async def list_versions(
    model_id: UUID,
    service: ModelRegistryService = Depends(get_service),
) -> VersionListResponse:
    """List all versions of a model."""
    versions = await service.list_versions(model_id)
    return VersionListResponse(
        items=[VersionResponse.model_validate(v) for v in versions],
        total=len(versions),
    )


@router.post("/{model_id}/versions", response_model=VersionResponse, status_code=201)
async def create_version(
    model_id: UUID,
    data: VersionCreate,
    service: ModelRegistryService = Depends(get_service),
) -> VersionResponse:
    """Create a new version of a model."""
    # Verify model exists
    model = await service.get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    version = await service.create_version(model_id, data)
    return VersionResponse.model_validate(version)


@router.get("/{model_id}/versions/{version_number}", response_model=VersionResponse)
async def get_version(
    model_id: UUID,
    version_number: int,
    service: ModelRegistryService = Depends(get_service),
) -> VersionResponse:
    """Get version details by version number."""
    versions = await service.list_versions(model_id)
    version = next((v for v in versions if v.version_number == version_number), None)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return VersionResponse.model_validate(version)


@router.patch("/{model_id}/versions/{version_number}", response_model=VersionResponse)
async def update_version(
    model_id: UUID,
    version_number: int,
    data: VersionUpdate,
    service: ModelRegistryService = Depends(get_service),
) -> VersionResponse:
    """Update version metadata or status."""
    versions = await service.list_versions(model_id)
    version = next((v for v in versions if v.version_number == version_number), None)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    updated = await service.update_version(version.id, data)
    return VersionResponse.model_validate(updated)


# --- Deployment Endpoints ---


@router.post(
    "/{model_id}/versions/{version_number}/deploy",
    response_model=DeploymentResponse,
    status_code=201,
)
async def deploy_version(
    model_id: UUID,
    version_number: int,
    data: DeploymentCreate,
    service: ModelRegistryService = Depends(get_service),
) -> DeploymentResponse:
    """Deploy a version to an environment."""
    versions = await service.list_versions(model_id)
    version = next((v for v in versions if v.version_number == version_number), None)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    deployment = await service.deploy_version(version.id, data)
    return DeploymentResponse.model_validate(deployment)


@router.post(
    "/{model_id}/versions/{version_number}/rollback",
    response_model=DeploymentResponse,
)
async def rollback_to_version(
    model_id: UUID,
    version_number: int,
    environment: str = Query(..., pattern="^(staging|production)$"),
    service: ModelRegistryService = Depends(get_service),
) -> DeploymentResponse:
    """Rollback to a specific version."""
    deployment = await service.rollback_to_version(model_id, version_number, environment)
    if not deployment:
        raise HTTPException(status_code=404, detail="Version not found")
    return DeploymentResponse.model_validate(deployment)
