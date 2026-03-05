"""Audit database models."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy import ForeignKey, String, Boolean, JSON, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.db.base import Base, UUIDMixin


class RiskTier(str, Enum):
    """Risk classification for audit events."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ActorType(str, Enum):
    """Type of actor that triggered the event."""

    USER = "user"
    SYSTEM = "system"
    MODEL = "model"


class SinkType(str, Enum):
    """Types of audit sinks."""

    POSTGRESQL = "postgresql"
    S3 = "s3"
    SECURITY_HUB = "security_hub"


class AuditEvent(Base, UUIDMixin):
    """Audit event record."""

    __tablename__ = "audit_events"

    org_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    risk_tier: Mapped[RiskTier] = mapped_column(String(20), nullable=False, index=True)

    actor_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    actor_type: Mapped[ActorType] = mapped_column(String(20), nullable=False)

    event_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(100), nullable=False)
    correlation_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    occurred_at: Mapped[datetime] = mapped_column(nullable=False, index=True)
    ingested_at: Mapped[datetime] = mapped_column(nullable=False)

    # Model tracking (PX-898) - links audit events to triggering models
    model_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    model_version_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    # S3 archive reference (if archived)
    s3_archive_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class AuditSink(Base, UUIDMixin):
    """Configuration for an audit sink destination."""

    __tablename__ = "audit_sinks"

    sink_type: Mapped[SinkType] = mapped_column(String(50), nullable=False)
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    routes: Mapped[list["AuditRoute"]] = relationship(
        "AuditRoute", back_populates="sink", cascade="all, delete-orphan"
    )


class AuditRoute(Base, UUIDMixin):
    """Routing rules for audit events to sinks."""

    __tablename__ = "audit_routes"

    org_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )  # null = default route
    event_type_pattern: Mapped[str] = mapped_column(
        String(200), nullable=False
    )  # glob pattern like "model.*"
    risk_tier_min: Mapped[RiskTier] = mapped_column(String(20), nullable=False)

    sink_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("audit_sinks.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    sink: Mapped["AuditSink"] = relationship("AuditSink", back_populates="routes")
