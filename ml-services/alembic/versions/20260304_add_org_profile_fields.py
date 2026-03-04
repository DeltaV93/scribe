"""Add new org profile fields for PX-889

Revision ID: 004
Revises: 003
Create Date: 2026-03-04

Adds:
- industry, secondary_industry, company_type columns
- team_roles, model_tier, data_sharing_consent columns
- custom_signals, matching_rules, risk_overrides JSON columns
- Indexes on industry and model_tier

All columns have defaults for backwards compatibility with existing profiles.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add industry classification columns
    op.add_column(
        "org_profiles",
        sa.Column("industry", sa.String(50), nullable=True),
    )
    op.add_column(
        "org_profiles",
        sa.Column("secondary_industry", sa.String(50), nullable=True),
    )
    op.add_column(
        "org_profiles",
        sa.Column("company_type", sa.String(50), nullable=True),
    )

    # Add team roles
    op.add_column(
        "org_profiles",
        sa.Column(
            "team_roles",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
    )

    # Add model tier configuration
    op.add_column(
        "org_profiles",
        sa.Column(
            "model_tier",
            sa.String(20),
            nullable=False,
            server_default="shared",
        ),
    )
    op.add_column(
        "org_profiles",
        sa.Column(
            "data_sharing_consent",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )

    # Add custom signals & matching rules
    op.add_column(
        "org_profiles",
        sa.Column(
            "custom_signals",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
    )
    op.add_column(
        "org_profiles",
        sa.Column(
            "matching_rules",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
    )
    op.add_column(
        "org_profiles",
        sa.Column(
            "risk_overrides",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
    )

    # Create indexes for filtering
    op.create_index(
        "ix_org_profiles_industry",
        "org_profiles",
        ["industry"],
        postgresql_where=sa.text("industry IS NOT NULL"),
    )
    op.create_index(
        "ix_org_profiles_model_tier",
        "org_profiles",
        ["model_tier"],
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_org_profiles_model_tier", table_name="org_profiles")
    op.drop_index("ix_org_profiles_industry", table_name="org_profiles")

    # Drop columns
    op.drop_column("org_profiles", "risk_overrides")
    op.drop_column("org_profiles", "matching_rules")
    op.drop_column("org_profiles", "custom_signals")
    op.drop_column("org_profiles", "data_sharing_consent")
    op.drop_column("org_profiles", "model_tier")
    op.drop_column("org_profiles", "team_roles")
    op.drop_column("org_profiles", "company_type")
    op.drop_column("org_profiles", "secondary_industry")
    op.drop_column("org_profiles", "industry")
