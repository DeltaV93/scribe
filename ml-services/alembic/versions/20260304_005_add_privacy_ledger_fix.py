"""Fix privacy_ledger column name and add model risk_tier

Revision ID: 005
Revises: 004
Create Date: 2026-03-04

PX-897 Implementation:
- Rename privacy_ledger.metadata to extra_data (align with model definition)
- Add risk_tier column to models table for AuditOracle routing
- Add index on models.risk_tier for filtering
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Fix privacy_ledger column name ===
    # The model defines 'extra_data' but migration 001 created 'metadata'
    op.alter_column(
        "privacy_ledger",
        "metadata",
        new_column_name="extra_data",
    )

    # === Add risk_tier to models table ===
    # Required by AuditOracle.get_model_risk_tier() for model-specific routing
    # Values: low, medium, high, critical (from RiskTier enum)
    op.add_column(
        "models",
        sa.Column(
            "risk_tier",
            sa.String(20),
            nullable=True,
        ),
    )

    # Create index for filtering models by risk tier
    op.create_index(
        "ix_models_risk_tier",
        "models",
        ["risk_tier"],
        postgresql_where=sa.text("risk_tier IS NOT NULL"),
    )


def downgrade() -> None:
    # Drop risk_tier index and column
    op.drop_index("ix_models_risk_tier", table_name="models")
    op.drop_column("models", "risk_tier")

    # Rename extra_data back to metadata
    op.alter_column(
        "privacy_ledger",
        "extra_data",
        new_column_name="metadata",
    )
