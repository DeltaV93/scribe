"""Audit Pydantic schemas."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from src.audit.models import RiskTier, ActorType, SinkType


class ExportFormat(str, Enum):
    """Supported export formats."""

    CSV = "csv"
    JSON = "json"


class ExportStatus(str, Enum):
    """Status of an export job."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AuditEventCreate(BaseModel):
    """Schema for creating an audit event."""

    org_id: UUID
    event_type: str = Field(..., max_length=100)
    risk_tier: Optional[RiskTier] = None  # Auto-determined if not provided
    actor_id: Optional[UUID] = None
    actor_type: ActorType
    event_data: dict = Field(default_factory=dict)
    source_service: str = Field(..., max_length=100)
    correlation_id: Optional[UUID] = None
    occurred_at: datetime
    model_id: Optional[UUID] = None
    model_version_id: Optional[UUID] = None


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


# === Export Schemas (PX-898) ===


class AuditExportRequest(BaseModel):
    """Request to export audit events."""

    org_id: UUID
    start_date: datetime
    end_date: datetime
    format: ExportFormat = ExportFormat.CSV
    event_types: Optional[list[str]] = None
    risk_tiers: Optional[list[RiskTier]] = None


class AuditExportResponse(BaseModel):
    """Response from export request."""

    job_id: UUID
    status: ExportStatus
    status_url: str
    created_at: datetime


class AuditExportStatusResponse(BaseModel):
    """Status of an export job."""

    job_id: UUID
    status: ExportStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    download_url: Optional[str] = None
    error_message: Optional[str] = None
    event_count: Optional[int] = None
    file_size_bytes: Optional[int] = None


# === Auto Risk Tier Schemas (PX-898) ===


class AuditEventCreateAutoTier(BaseModel):
    """
    Schema for creating an audit event with auto risk tier detection.

    Risk tier is automatically determined by the oracle based on
    event type, org profile, and model configuration.
    """

    org_id: UUID
    event_type: str = Field(..., max_length=100)
    actor_id: Optional[UUID] = None
    actor_type: ActorType = ActorType.SYSTEM
    event_data: dict = Field(default_factory=dict)
    source_service: str = Field(default="ml-services", max_length=100)
    correlation_id: Optional[UUID] = None
    occurred_at: Optional[datetime] = None  # Defaults to now
    model_id: Optional[UUID] = None
    model_version_id: Optional[UUID] = None


class AuditEventResponseWithRouting(AuditEventResponse):
    """Audit event response with routing decision info."""

    routing_source: Optional[str] = None
    routing_reason: Optional[str] = None


# === Queue Status Schemas ===


class AuditQueueStatus(BaseModel):
    """Status of audit event queues."""

    customer_queue_length: int
    internal_queue_length: int
    local_buffer_length: int
    healthy: bool
