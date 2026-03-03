"""Training Orchestration database models."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy import ForeignKey, String, Float, JSON, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.db.base import Base, TimestampMixin, UUIDMixin


class TrainingJobStatus(str, Enum):
    """Training job lifecycle status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TrainingJob(Base, UUIDMixin, TimestampMixin):
    """A training job for a model."""

    __tablename__ = "training_jobs"

    model_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("models.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)

    status: Mapped[TrainingJobStatus] = mapped_column(
        String(50), default=TrainingJobStatus.PENDING, nullable=False, index=True
    )

    # Training configuration
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Training metrics (accuracy, loss, etc.)
    metrics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamps for job lifecycle
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Error information if job failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Ray job tracking
    ray_job_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    # Path to trained model artifacts (S3 or local)
    artifact_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Reference to created model version (populated on successful completion)
    created_version_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("model_versions.id"), nullable=True
    )

    # Relationships
    model: Mapped["Model"] = relationship("Model", foreign_keys=[model_id])
    created_version: Mapped[Optional["ModelVersion"]] = relationship(
        "ModelVersion", foreign_keys=[created_version_id]
    )


# Import at the end to avoid circular imports
from src.registry.models import Model, ModelVersion  # noqa: E402, F401
