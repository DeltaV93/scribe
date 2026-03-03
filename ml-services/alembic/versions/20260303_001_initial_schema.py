"""Initial schema for ml-services

Revision ID: 001
Revises:
Create Date: 2026-03-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Model Registry ===
    op.create_table(
        "models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("model_type", sa.String(50), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("is_global", sa.Boolean(), nullable=False, default=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "model_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "model_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("models.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, default="training"),
        sa.Column("artifact_s3_path", sa.String(500), nullable=True),
        sa.Column("config", postgresql.JSONB(), nullable=True),
        sa.Column("metrics", postgresql.JSONB(), nullable=True),
        sa.Column(
            "parent_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("model_versions.id"),
            nullable=True,
        ),
        sa.Column("deployed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_model_versions_model_version",
        "model_versions",
        ["model_id", "version_number"],
        unique=True,
    )

    op.create_table(
        "model_deployments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("model_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("environment", sa.String(50), nullable=False),
        sa.Column("deployment_status", sa.String(50), nullable=False, default="pending"),
        sa.Column("traffic_percentage", sa.Float(), nullable=False, default=0.0),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_model_deployments_active",
        "model_deployments",
        ["version_id", "environment"],
        postgresql_where=sa.text("deployment_status = 'active'"),
    )

    # === Org Profile ===
    op.create_table(
        "compliance_frameworks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("default_retention", postgresql.JSONB(), nullable=False, default={}),
        sa.Column(
            "required_audit_events", postgresql.JSONB(), nullable=False, default=[]
        ),
        sa.Column("data_handling_rules", postgresql.JSONB(), nullable=False, default={}),
    )

    op.create_table(
        "org_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True, index=True
        ),
        sa.Column(
            "compliance_frameworks", postgresql.JSONB(), nullable=False, default=[]
        ),
        sa.Column("retention_policies", postgresql.JSONB(), nullable=False, default={}),
        sa.Column("privacy_settings", postgresql.JSONB(), nullable=False, default={}),
        sa.Column("epsilon_budget", sa.Float(), nullable=False, default=5.0),
        sa.Column("epsilon_consumed", sa.Float(), nullable=False, default=0.0),
        sa.Column("budget_reset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("model_training_enabled", sa.Boolean(), nullable=False, default=True),
        sa.Column("audit_routing_config", postgresql.JSONB(), nullable=False, default={}),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "org_compliance_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("framework_name", sa.String(50), nullable=False),
        sa.Column("overrides", postgresql.JSONB(), nullable=False, default={}),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "privacy_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_profiles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("epsilon_consumed", sa.Float(), nullable=False),
        sa.Column("operation_type", sa.String(100), nullable=False),
        sa.Column("model_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("model_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
    )
    op.create_index(
        "ix_privacy_ledger_recorded",
        "privacy_ledger",
        ["org_profile_id", "recorded_at"],
    )

    # === Audit ===
    op.create_table(
        "audit_sinks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sink_type", sa.String(50), nullable=False),
        sa.Column("config", postgresql.JSONB(), nullable=False, default={}),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
    )

    op.create_table(
        "audit_routes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("event_type_pattern", sa.String(200), nullable=False),
        sa.Column("risk_tier_min", sa.String(20), nullable=False),
        sa.Column(
            "sink_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("audit_sinks.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("event_type", sa.String(100), nullable=False, index=True),
        sa.Column("risk_tier", sa.String(20), nullable=False, index=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_type", sa.String(20), nullable=False),
        sa.Column("event_data", postgresql.JSONB(), nullable=False, default={}),
        sa.Column("source_service", sa.String(100), nullable=False),
        sa.Column("correlation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("s3_archive_path", sa.String(500), nullable=True),
    )
    # Composite index for common query patterns
    op.create_index(
        "ix_audit_events_org_occurred",
        "audit_events",
        ["org_id", "occurred_at"],
    )
    op.create_index(
        "ix_audit_events_org_type_occurred",
        "audit_events",
        ["org_id", "event_type", "occurred_at"],
    )


def downgrade() -> None:
    # Audit
    op.drop_table("audit_events")
    op.drop_table("audit_routes")
    op.drop_table("audit_sinks")

    # Org Profile
    op.drop_table("privacy_ledger")
    op.drop_table("org_compliance_overrides")
    op.drop_table("org_profiles")
    op.drop_table("compliance_frameworks")

    # Model Registry
    op.drop_table("model_deployments")
    op.drop_table("model_versions")
    op.drop_table("models")
