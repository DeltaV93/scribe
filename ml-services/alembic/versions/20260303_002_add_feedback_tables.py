"""Add feedback collection tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Feedback Collection ===
    op.create_table(
        "feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "model_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("models.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("model_versions.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("feedback_type", sa.String(50), nullable=False, index=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("input_data", postgresql.JSONB(), nullable=True),
        sa.Column("output_data", postgresql.JSONB(), nullable=True),
        sa.Column("corrected_output", postgresql.JSONB(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
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

    # Composite indexes for common query patterns
    op.create_index(
        "ix_feedback_org_model_created",
        "feedback",
        ["org_id", "model_id", "created_at"],
    )
    op.create_index(
        "ix_feedback_model_version_type",
        "feedback",
        ["model_id", "version_id", "feedback_type"],
    )

    # Feedback aggregates table
    op.create_table(
        "feedback_aggregates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "model_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("models.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("model_versions.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("period", sa.String(20), nullable=False, index=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_count", sa.Integer(), nullable=False, default=0),
        sa.Column("positive_count", sa.Integer(), nullable=False, default=0),
        sa.Column("negative_count", sa.Integer(), nullable=False, default=0),
        sa.Column("correction_count", sa.Integer(), nullable=False, default=0),
        sa.Column("comment_count", sa.Integer(), nullable=False, default=0),
        sa.Column("avg_rating", sa.Float(), nullable=True),
        sa.Column("rating_count", sa.Integer(), nullable=False, default=0),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Unique constraint to prevent duplicate aggregates
    op.create_index(
        "ix_feedback_aggregates_unique",
        "feedback_aggregates",
        ["model_id", "version_id", "period", "period_start"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("feedback_aggregates")
    op.drop_table("feedback")
