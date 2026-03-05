"""Add audit event enhancements for PX-898

Revision ID: 006
Revises: 005
Create Date: 2026-03-04

PX-898 Implementation:
- Add model_id and model_version_id columns to audit_events
- Add composite index for model-related audit queries
- Add index for risk_tier filtering (not present in initial migration)

These columns enable tracking which model/version triggered audit events,
required for the AuditOracle routing and model lifecycle auditing.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Add model tracking columns to audit_events ===
    # These columns link audit events to the models that triggered them
    op.add_column(
        "audit_events",
        sa.Column(
            "model_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "audit_events",
        sa.Column(
            "model_version_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # === Create indexes for audit event queries ===

    # Index for querying audit events by model
    op.create_index(
        "ix_audit_events_model_id",
        "audit_events",
        ["model_id"],
        postgresql_where=sa.text("model_id IS NOT NULL"),
    )

    # Composite index for model version + event type queries
    # Useful for: "Show all events for model X version Y of type Z"
    op.create_index(
        "ix_audit_events_model_version_type",
        "audit_events",
        ["model_id", "model_version_id", "event_type"],
        postgresql_where=sa.text("model_id IS NOT NULL"),
    )

    # Index for risk_tier filtering (enables "show all HIGH risk events")
    # Note: risk_tier column exists but was not indexed in initial migration
    op.create_index(
        "ix_audit_events_risk_tier_occurred",
        "audit_events",
        ["risk_tier", "occurred_at"],
    )

    # Composite index for org + risk tier queries
    # Useful for: "Show all CRITICAL events for org X in the last 24 hours"
    op.create_index(
        "ix_audit_events_org_risk_occurred",
        "audit_events",
        ["org_id", "risk_tier", "occurred_at"],
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_audit_events_org_risk_occurred", table_name="audit_events")
    op.drop_index("ix_audit_events_risk_tier_occurred", table_name="audit_events")
    op.drop_index("ix_audit_events_model_version_type", table_name="audit_events")
    op.drop_index("ix_audit_events_model_id", table_name="audit_events")

    # Drop columns
    op.drop_column("audit_events", "model_version_id")
    op.drop_column("audit_events", "model_id")
