"""Feedback Collection Pydantic schemas."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator

from src.feedback.models import FeedbackType, AggregationPeriod


# --- Feedback Schemas ---


class FeedbackCreate(BaseModel):
    """Schema for creating feedback."""

    model_id: UUID
    version_id: Optional[UUID] = None
    feedback_type: FeedbackType
    rating: Optional[int] = Field(None, ge=1, le=5)
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    corrected_output: Optional[dict] = None
    comment: Optional[str] = Field(None, max_length=5000)
    metadata: Optional[dict] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: Optional[int], info) -> Optional[int]:
        """Ensure rating is only provided for certain feedback types."""
        return v


class FeedbackResponse(BaseModel):
    """Schema for feedback response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    model_id: UUID
    version_id: Optional[UUID]
    user_id: UUID
    feedback_type: FeedbackType
    rating: Optional[int]
    input_data: Optional[dict]
    output_data: Optional[dict]
    corrected_output: Optional[dict]
    comment: Optional[str]
    metadata: Optional[dict]
    created_at: datetime
    updated_at: datetime


class FeedbackListResponse(BaseModel):
    """Schema for paginated feedback list."""

    items: List[FeedbackResponse]
    total: int
    page: int
    page_size: int


# --- Feedback Stats Schemas ---


class FeedbackStats(BaseModel):
    """Aggregate statistics for feedback."""

    model_id: UUID
    version_id: Optional[UUID]
    period: AggregationPeriod
    period_start: datetime
    period_end: datetime
    total_count: int
    positive_count: int
    negative_count: int
    correction_count: int
    comment_count: int
    avg_rating: Optional[float]
    rating_count: int
    positive_rate: float = Field(description="Percentage of positive feedback")
    computed_at: datetime


class FeedbackAggregateResponse(BaseModel):
    """Schema for feedback aggregate response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    model_id: UUID
    version_id: Optional[UUID]
    period: AggregationPeriod
    period_start: datetime
    period_end: datetime
    total_count: int
    positive_count: int
    negative_count: int
    correction_count: int
    comment_count: int
    avg_rating: Optional[float]
    rating_count: int
    computed_at: datetime


class FeedbackStatsResponse(BaseModel):
    """Response containing multiple aggregate periods."""

    model_id: UUID
    version_id: Optional[UUID]
    aggregates: List[FeedbackAggregateResponse]
    # Summary stats across all time
    total_feedback: int
    total_positive: int
    total_negative: int
    total_corrections: int
    overall_positive_rate: float


# --- Export Schemas ---


class FeedbackExportItem(BaseModel):
    """Single feedback item in export format (for training)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    feedback_type: FeedbackType
    input_data: Optional[dict]
    output_data: Optional[dict]
    corrected_output: Optional[dict]
    rating: Optional[int]
    created_at: datetime


class FeedbackExportResponse(BaseModel):
    """Export response with corrections for retraining."""

    model_id: UUID
    version_id: Optional[UUID]
    items: List[FeedbackExportItem]
    total: int
    exported_at: datetime
