"""Feedback Collection domain.

Provides feedback collection for ML model outputs, including:
- Thumbs up/down feedback
- Corrections for retraining
- Comments and ratings
- Aggregated statistics
"""

from src.feedback.models import Feedback, FeedbackAggregate, FeedbackType, AggregationPeriod
from src.feedback.schemas import (
    FeedbackCreate,
    FeedbackResponse,
    FeedbackListResponse,
    FeedbackStats,
    FeedbackStatsResponse,
    FeedbackExportResponse,
)
from src.feedback.service import FeedbackService
from src.feedback.router import router

__all__ = [
    # Models
    "Feedback",
    "FeedbackAggregate",
    "FeedbackType",
    "AggregationPeriod",
    # Schemas
    "FeedbackCreate",
    "FeedbackResponse",
    "FeedbackListResponse",
    "FeedbackStats",
    "FeedbackStatsResponse",
    "FeedbackExportResponse",
    # Service
    "FeedbackService",
    # Router
    "router",
]
