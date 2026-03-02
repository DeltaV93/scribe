"""Model Registry Pydantic schemas."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from src.registry.models import ModelType, VersionStatus, DeploymentStatus


# --- Model Schemas ---


class ModelCreate(BaseModel):
    """Schema for creating a new model."""

    name: str = Field(..., min_length=1, max_length=255)
    model_type: ModelType
    description: Optional[str] = Field(None, max_length=1000)
    is_global: bool = False
    org_id: Optional[UUID] = None


class ModelUpdate(BaseModel):
    """Schema for updating a model."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)


class ModelResponse(BaseModel):
    """Schema for model response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    model_type: ModelType
    description: Optional[str]
    is_global: bool
    org_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime


class ModelListResponse(BaseModel):
    """Schema for paginated model list."""

    items: List[ModelResponse]
    total: int
    page: int
    page_size: int


# --- Version Schemas ---


class VersionCreate(BaseModel):
    """Schema for creating a new model version."""

    config: Optional[dict] = None
    artifact_s3_path: Optional[str] = None
    parent_version_id: Optional[UUID] = None


class VersionUpdate(BaseModel):
    """Schema for updating a model version."""

    status: Optional[VersionStatus] = None
    artifact_s3_path: Optional[str] = None
    config: Optional[dict] = None
    metrics: Optional[dict] = None


class VersionResponse(BaseModel):
    """Schema for model version response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    model_id: UUID
    version_number: int
    status: VersionStatus
    artifact_s3_path: Optional[str]
    config: Optional[dict]
    metrics: Optional[dict]
    parent_version_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    deployed_at: Optional[datetime]


class VersionListResponse(BaseModel):
    """Schema for paginated version list."""

    items: List[VersionResponse]
    total: int


# --- Deployment Schemas ---


class DeploymentCreate(BaseModel):
    """Schema for creating a deployment."""

    environment: str = Field(..., pattern="^(staging|production)$")
    traffic_percentage: float = Field(default=0.0, ge=0.0, le=100.0)


class DeploymentResponse(BaseModel):
    """Schema for deployment response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_id: UUID
    environment: str
    deployment_status: DeploymentStatus
    traffic_percentage: float
    started_at: datetime
    ended_at: Optional[datetime]
