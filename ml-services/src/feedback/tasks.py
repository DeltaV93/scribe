"""Feedback Collection Celery tasks."""

from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import select, distinct

from src.common.celery_app import app
from src.common.db.session import get_async_session
from src.feedback.models import Feedback, AggregationPeriod
from src.feedback.service import FeedbackService

logger = structlog.get_logger()


def get_period_boundaries(
    period: AggregationPeriod, reference_date: datetime
) -> tuple[datetime, datetime]:
    """Calculate start and end of a time period containing reference_date."""
    if period == AggregationPeriod.DAY:
        start = reference_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
    elif period == AggregationPeriod.WEEK:
        # Start of week (Monday)
        days_since_monday = reference_date.weekday()
        start = (reference_date - timedelta(days=days_since_monday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end = start + timedelta(weeks=1)
    elif period == AggregationPeriod.MONTH:
        start = reference_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # First day of next month
        if start.month == 12:
            end = start.replace(year=start.year + 1, month=1)
        else:
            end = start.replace(month=start.month + 1)
    else:
        raise ValueError(f"Unknown period: {period}")

    return start, end


@app.task(name="src.feedback.tasks.compute_feedback_aggregates")
def compute_feedback_aggregates(
    model_id: Optional[str] = None,
    periods: Optional[list[str]] = None,
    lookback_days: int = 7,
) -> dict:
    """
    Compute feedback aggregates for models.

    Args:
        model_id: Specific model to compute for, or None for all models
        periods: List of periods to compute (day, week, month), or None for all
        lookback_days: How many days back to compute aggregates for

    Returns:
        Summary of aggregates computed
    """
    import asyncio

    async def _compute():
        async with get_async_session() as session:
            service = FeedbackService(session)

            # Determine which periods to compute
            period_list = (
                [AggregationPeriod(p) for p in periods]
                if periods
                else list(AggregationPeriod)
            )

            # Get distinct model/version combinations with feedback
            query = select(
                distinct(Feedback.model_id),
                Feedback.version_id,
            )

            if model_id:
                query = query.where(Feedback.model_id == UUID(model_id))

            # Only look at recent feedback
            cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
            query = query.where(Feedback.created_at >= cutoff)

            result = await session.execute(query)
            model_versions = list(result.all())

            computed = 0
            errors = 0

            for model_uuid, version_uuid in model_versions:
                for period in period_list:
                    try:
                        # Compute for each day/week/month in the lookback period
                        current = cutoff
                        while current < datetime.now(timezone.utc):
                            start, end = get_period_boundaries(period, current)

                            await service.compute_aggregates(
                                model_id=model_uuid,
                                version_id=version_uuid,
                                period=period,
                                period_start=start,
                                period_end=end,
                            )
                            computed += 1

                            # Move to next period
                            current = end

                        await session.commit()
                    except Exception as e:
                        errors += 1
                        logger.error(
                            "Failed to compute aggregate",
                            model_id=str(model_uuid),
                            version_id=str(version_uuid) if version_uuid else None,
                            period=period.value,
                            error=str(e),
                        )

            logger.info(
                "Feedback aggregates computed",
                computed=computed,
                errors=errors,
                model_versions=len(model_versions),
            )

            return {
                "computed": computed,
                "errors": errors,
                "model_versions": len(model_versions),
            }

    return asyncio.get_event_loop().run_until_complete(_compute())


@app.task(name="src.feedback.tasks.compute_daily_aggregates")
def compute_daily_aggregates() -> dict:
    """
    Daily scheduled task to compute aggregates for all feedback.
    Run by Celery Beat.
    """
    return compute_feedback_aggregates(
        periods=["day", "week", "month"],
        lookback_days=1,  # Just compute for yesterday/current period
    )


@app.task(name="src.feedback.tasks.backfill_aggregates")
def backfill_aggregates(model_id: str, days: int = 90) -> dict:
    """
    Backfill aggregates for a specific model.
    Useful when adding a new model or after data migration.

    Args:
        model_id: Model ID to backfill
        days: Number of days to backfill

    Returns:
        Summary of aggregates computed
    """
    return compute_feedback_aggregates(
        model_id=model_id,
        periods=["day", "week", "month"],
        lookback_days=days,
    )
