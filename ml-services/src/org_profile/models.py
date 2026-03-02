"""Org Profile database models."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy import ForeignKey, String, Boolean, Float, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.db.base import Base, TimestampMixin, UUIDMixin


class OrgProfile(Base, UUIDMixin, TimestampMixin):
    """Organization profile with compliance and privacy settings."""

    __tablename__ = "org_profiles"

    # References main app's Organization.id
    org_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), unique=True, nullable=False, index=True
    )

    # Compliance frameworks enabled for this org
    compliance_frameworks: Mapped[List[str]] = mapped_column(
        JSON, default=list, nullable=False
    )  # ["HIPAA", "SOC2", "GDPR"]

    # Retention policies per data type
    retention_policies: Mapped[dict] = mapped_column(
        JSON, default=dict, nullable=False
    )  # {"training_data": "6y", "audit_events": "7y"}

    # Privacy settings
    privacy_settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Differential privacy budget
    epsilon_budget: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    epsilon_consumed: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    budget_reset_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Feature flags
    model_training_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Audit routing configuration
    audit_routing_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    compliance_overrides: Mapped[List["OrgComplianceOverride"]] = relationship(
        "OrgComplianceOverride", back_populates="org_profile", cascade="all, delete-orphan"
    )
    privacy_ledger: Mapped[List["PrivacyLedger"]] = relationship(
        "PrivacyLedger", back_populates="org_profile", cascade="all, delete-orphan"
    )


class OrgComplianceOverride(Base, UUIDMixin, TimestampMixin):
    """Org-specific overrides to compliance framework defaults."""

    __tablename__ = "org_compliance_overrides"

    org_profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("org_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    framework_name: Mapped[str] = mapped_column(String(50), nullable=False)
    overrides: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    org_profile: Mapped["OrgProfile"] = relationship(
        "OrgProfile", back_populates="compliance_overrides"
    )


class PrivacyLedger(Base, UUIDMixin):
    """Immutable ledger of privacy budget consumption."""

    __tablename__ = "privacy_ledger"

    org_profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("org_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    epsilon_consumed: Mapped[float] = mapped_column(Float, nullable=False)
    operation_type: Mapped[str] = mapped_column(String(100), nullable=False)
    model_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    model_version_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(nullable=False)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Relationships
    org_profile: Mapped["OrgProfile"] = relationship("OrgProfile", back_populates="privacy_ledger")


class ComplianceFramework(Base, UUIDMixin):
    """Reference table of compliance framework defaults."""

    __tablename__ = "compliance_frameworks"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    default_retention: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    required_audit_events: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    data_handling_rules: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
