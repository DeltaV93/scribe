"""Model Registry database models."""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from sqlalchemy import ForeignKey, String, Boolean, Integer, Float, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.db.base import Base, TimestampMixin, UUIDMixin


class ModelType(str, Enum):
    """Types of models in the registry."""

    LLM = "llm"
    EXTRACTION = "extraction"
    CLASSIFICATION = "classification"


class VersionStatus(str, Enum):
    """Model version lifecycle status."""

    TRAINING = "training"
    VALIDATING = "validating"
    READY = "ready"
    DEPLOYED = "deployed"
    DEPRECATED = "deprecated"


class DeploymentStatus(str, Enum):
    """Deployment lifecycle status."""

    PENDING = "pending"
    ACTIVE = "active"
    DRAINING = "draining"
    TERMINATED = "terminated"


class Model(Base, UUIDMixin, TimestampMixin):
    """A registered ML model."""

    __tablename__ = "models"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    model_type: Mapped[ModelType] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    is_global: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    org_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)

    # Risk tier for audit routing (PX-897/898) - used by AuditOracle
    # Values: low, medium, high, critical
    risk_tier: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Relationships
    versions: Mapped[List["ModelVersion"]] = relationship(
        "ModelVersion", back_populates="model", cascade="all, delete-orphan"
    )


class ModelVersion(Base, UUIDMixin, TimestampMixin):
    """A specific version of a model."""

    __tablename__ = "model_versions"

    model_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("models.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[VersionStatus] = mapped_column(
        String(50), default=VersionStatus.TRAINING, nullable=False
    )
    artifact_s3_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    metrics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    parent_version_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("model_versions.id"), nullable=True
    )
    deployed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    model: Mapped["Model"] = relationship("Model", back_populates="versions")
    deployments: Mapped[List["ModelDeployment"]] = relationship(
        "ModelDeployment", back_populates="version", cascade="all, delete-orphan"
    )


class ModelDeployment(Base, UUIDMixin):
    """A deployment instance of a model version."""

    __tablename__ = "model_deployments"

    version_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("model_versions.id", ondelete="CASCADE"), nullable=False
    )
    environment: Mapped[str] = mapped_column(String(50), nullable=False)  # staging, production
    deployment_status: Mapped[DeploymentStatus] = mapped_column(
        String(50), default=DeploymentStatus.PENDING, nullable=False
    )
    traffic_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    started_at: Mapped[datetime] = mapped_column(nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    version: Mapped["ModelVersion"] = relationship("ModelVersion", back_populates="deployments")
