"""Audit Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from src.audit.models import RiskTier, ActorType, SinkType


class AuditEventCreate(BaseModel):
    """Schema for creating an audit event."""

    org_id: UUID
    event_type: str = Field(..., max_length=100)
    risk_tier: RiskTier
    actor_id: Optional[UUID] = None
    actor_type: ActorType
    event_data: dict = Field(default_factory=dict)
    source_service: str = Field(..., max_length=100)
    correlation_id: Optional[UUID] = None
    occurred_at: datetime


class AuditEventResponse(BaseModel):
    """Schema for audit event response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    event_type: str
    risk_tier: RiskTier
    actor_id: Optional[UUID]
    actor_type: ActorType
    event_data: dict
    source_service: str
    correlation_id: Optional[UUID]
    occurred_at: datetime
    ingested_at: datetime
    s3_archive_path: Optional[str]


class AuditEventListResponse(BaseModel):
    """Schema for paginated audit event list."""

    items: list[AuditEventResponse]
    total: int
    page: int
    page_size: int


class AuditSinkCreate(BaseModel):
    """Schema for creating an audit sink."""

    sink_type: SinkType
    config: dict = Field(default_factory=dict)
    is_active: bool = True


class AuditSinkResponse(BaseModel):
    """Schema for audit sink response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sink_type: SinkType
    config: dict
    is_active: bool


class AuditRouteCreate(BaseModel):
    """Schema for creating an audit route."""

    org_id: Optional[UUID] = None
    event_type_pattern: str = Field(..., max_length=200)
    risk_tier_min: RiskTier
    sink_id: UUID


class AuditRouteResponse(BaseModel):
    """Schema for audit route response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: Optional[UUID]
    event_type_pattern: str
    risk_tier_min: RiskTier
    sink_id: UUID
