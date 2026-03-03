"""Add training_jobs table

Revision ID: 003
Revises: 002
Create Date: 2026-03-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Training Jobs ===
    op.create_table(
        "training_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "model_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("models.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("status", sa.String(50), nullable=False, default="pending", index=True),
        sa.Column("config", postgresql.JSONB(), nullable=False, default={}),
        sa.Column("metrics", postgresql.JSONB(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("ray_job_id", sa.String(255), nullable=True, index=True),
        sa.Column("artifact_path", sa.String(500), nullable=True),
        sa.Column(
            "created_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("model_versions.id"),
            nullable=True,
        ),
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

    # Index for finding active jobs by model
    op.create_index(
        "ix_training_jobs_model_status",
        "training_jobs",
        ["model_id", "status"],
    )

    # Index for finding org jobs by status
    op.create_index(
        "ix_training_jobs_org_status",
        "training_jobs",
        ["org_id", "status"],
    )

    # Index for finding active jobs (for monitoring)
    op.create_index(
        "ix_training_jobs_active",
        "training_jobs",
        ["status"],
        postgresql_where=sa.text("status IN ('pending', 'running')"),
    )


def downgrade() -> None:
    op.drop_table("training_jobs")
