"""Feedback Collection database models."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy import ForeignKey, String, Integer, Float, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.common.db.base import Base, TimestampMixin, UUIDMixin


class FeedbackType(str, Enum):
    """Types of feedback that can be submitted."""

    THUMBS_UP = "thumbs_up"
    THUMBS_DOWN = "thumbs_down"
    CORRECTION = "correction"
    COMMENT = "comment"


class AggregationPeriod(str, Enum):
    """Time periods for feedback aggregation."""

    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class Feedback(Base, UUIDMixin, TimestampMixin):
    """User feedback on model outputs."""

    __tablename__ = "feedback"

    org_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False, index=True
    )
    model_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("model_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False, index=True
    )

    # Feedback content
    feedback_type: Mapped[FeedbackType] = mapped_column(
        String(50), nullable=False, index=True
    )
    rating: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # 1-5 optional rating

    # Context: what was the input/output
    input_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    output_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # For corrections: what should the output have been
    corrected_output: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Free-form comment
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Additional metadata (e.g., session info, UI context)
    metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)


class FeedbackAggregate(Base, UUIDMixin):
    """Pre-computed aggregates of feedback for reporting."""

    __tablename__ = "feedback_aggregates"

    model_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("model_versions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Time period
    period: Mapped[AggregationPeriod] = mapped_column(
        String(20), nullable=False, index=True
    )
    period_start: Mapped[datetime] = mapped_column(nullable=False, index=True)
    period_end: Mapped[datetime] = mapped_column(nullable=False)

    # Counts
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    positive_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    negative_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    correction_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Rating statistics (only from feedback with ratings)
    avg_rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rating_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # When this aggregate was computed
    computed_at: Mapped[datetime] = mapped_column(nullable=False)
