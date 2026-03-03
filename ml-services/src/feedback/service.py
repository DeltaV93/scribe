"""Feedback Collection business logic."""

from datetime import datetime, timezone, timedelta
from typing import Optional, List
from uuid import UUID

import structlog
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.feedback.models import Feedback, FeedbackAggregate, FeedbackType, AggregationPeriod
from src.feedback.schemas import FeedbackCreate

logger = structlog.get_logger()


class FeedbackService:
    """Service for managing feedback operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # --- Feedback Operations ---

    async def submit_feedback(
        self,
        org_id: UUID,
        user_id: UUID,
        data: FeedbackCreate,
    ) -> Feedback:
        """Submit feedback on a model output."""
        feedback = Feedback(
            org_id=org_id,
            model_id=data.model_id,
            version_id=data.version_id,
            user_id=user_id,
            feedback_type=data.feedback_type,
            rating=data.rating,
            input_data=data.input_data,
            output_data=data.output_data,
            corrected_output=data.corrected_output,
            comment=data.comment,
            metadata=data.metadata,
        )
        self.session.add(feedback)
        await self.session.flush()

        logger.info(
            "Feedback submitted",
            feedback_id=str(feedback.id),
            org_id=str(org_id),
            model_id=str(data.model_id),
            feedback_type=data.feedback_type.value,
        )

        return feedback

    async def list_feedback(
        self,
        org_id: UUID,
        model_id: Optional[UUID] = None,
        version_id: Optional[UUID] = None,
        feedback_type: Optional[FeedbackType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[Feedback], int]:
        """List feedback with filtering and pagination."""
        query = select(Feedback).where(Feedback.org_id == org_id)

        # Apply filters
        if model_id:
            query = query.where(Feedback.model_id == model_id)
        if version_id:
            query = query.where(Feedback.version_id == version_id)
        if feedback_type:
            query = query.where(Feedback.feedback_type == feedback_type)
        if start_date:
            query = query.where(Feedback.created_at >= start_date)
        if end_date:
            query = query.where(Feedback.created_at <= end_date)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_query)).scalar() or 0

        # Paginate and order
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(Feedback.created_at.desc())

        result = await self.session.execute(query)
        items = list(result.scalars().all())

        return items, total

    async def get_feedback(self, feedback_id: UUID) -> Optional[Feedback]:
        """Get feedback by ID."""
        result = await self.session.execute(
            select(Feedback).where(Feedback.id == feedback_id)
        )
        return result.scalar_one_or_none()

    async def delete_feedback(self, feedback_id: UUID, org_id: UUID) -> bool:
        """Delete feedback (only if owned by org)."""
        feedback = await self.get_feedback(feedback_id)
        if not feedback or feedback.org_id != org_id:
            return False

        await self.session.delete(feedback)
        await self.session.flush()

        logger.info("Feedback deleted", feedback_id=str(feedback_id))
        return True

    # --- Stats Operations ---

    async def get_feedback_stats(
        self,
        org_id: UUID,
        model_id: UUID,
        version_id: Optional[UUID] = None,
        period: AggregationPeriod = AggregationPeriod.DAY,
        limit: int = 30,
    ) -> dict:
        """Get feedback statistics for a model/version."""
        # Query pre-computed aggregates
        query = (
            select(FeedbackAggregate)
            .where(FeedbackAggregate.model_id == model_id)
            .where(FeedbackAggregate.period == period)
        )

        if version_id:
            query = query.where(FeedbackAggregate.version_id == version_id)
        else:
            query = query.where(FeedbackAggregate.version_id.is_(None))

        query = query.order_by(FeedbackAggregate.period_start.desc()).limit(limit)

        result = await self.session.execute(query)
        aggregates = list(result.scalars().all())

        # Calculate totals across all aggregates
        total_feedback = sum(a.total_count for a in aggregates)
        total_positive = sum(a.positive_count for a in aggregates)
        total_negative = sum(a.negative_count for a in aggregates)
        total_corrections = sum(a.correction_count for a in aggregates)

        overall_positive_rate = (
            total_positive / (total_positive + total_negative) * 100
            if (total_positive + total_negative) > 0
            else 0.0
        )

        return {
            "model_id": model_id,
            "version_id": version_id,
            "aggregates": aggregates,
            "total_feedback": total_feedback,
            "total_positive": total_positive,
            "total_negative": total_negative,
            "total_corrections": total_corrections,
            "overall_positive_rate": round(overall_positive_rate, 2),
        }

    async def compute_aggregates(
        self,
        model_id: UUID,
        version_id: Optional[UUID],
        period: AggregationPeriod,
        period_start: datetime,
        period_end: datetime,
    ) -> FeedbackAggregate:
        """Compute and store aggregates for a time period."""
        # Build filter conditions
        conditions = [
            Feedback.model_id == model_id,
            Feedback.created_at >= period_start,
            Feedback.created_at < period_end,
        ]
        if version_id:
            conditions.append(Feedback.version_id == version_id)
        else:
            conditions.append(Feedback.version_id.is_(None))

        # Count by feedback type
        result = await self.session.execute(
            select(
                Feedback.feedback_type,
                func.count(Feedback.id).label("count"),
            )
            .where(and_(*conditions))
            .group_by(Feedback.feedback_type)
        )
        type_counts = {row.feedback_type: row.count for row in result.all()}

        # Calculate rating stats
        rating_result = await self.session.execute(
            select(
                func.avg(Feedback.rating).label("avg_rating"),
                func.count(Feedback.rating).label("rating_count"),
            )
            .where(and_(*conditions))
            .where(Feedback.rating.isnot(None))
        )
        rating_row = rating_result.one()

        positive_count = type_counts.get(FeedbackType.THUMBS_UP, 0)
        negative_count = type_counts.get(FeedbackType.THUMBS_DOWN, 0)
        correction_count = type_counts.get(FeedbackType.CORRECTION, 0)
        comment_count = type_counts.get(FeedbackType.COMMENT, 0)
        total_count = positive_count + negative_count + correction_count + comment_count

        # Check if aggregate already exists
        existing = await self.session.execute(
            select(FeedbackAggregate)
            .where(FeedbackAggregate.model_id == model_id)
            .where(FeedbackAggregate.period == period)
            .where(FeedbackAggregate.period_start == period_start)
            .where(
                FeedbackAggregate.version_id == version_id
                if version_id
                else FeedbackAggregate.version_id.is_(None)
            )
        )
        aggregate = existing.scalar_one_or_none()

        if aggregate:
            # Update existing
            aggregate.total_count = total_count
            aggregate.positive_count = positive_count
            aggregate.negative_count = negative_count
            aggregate.correction_count = correction_count
            aggregate.comment_count = comment_count
            aggregate.avg_rating = float(rating_row.avg_rating) if rating_row.avg_rating else None
            aggregate.rating_count = rating_row.rating_count or 0
            aggregate.computed_at = datetime.now(timezone.utc)
        else:
            # Create new
            aggregate = FeedbackAggregate(
                model_id=model_id,
                version_id=version_id,
                period=period,
                period_start=period_start,
                period_end=period_end,
                total_count=total_count,
                positive_count=positive_count,
                negative_count=negative_count,
                correction_count=correction_count,
                comment_count=comment_count,
                avg_rating=float(rating_row.avg_rating) if rating_row.avg_rating else None,
                rating_count=rating_row.rating_count or 0,
                computed_at=datetime.now(timezone.utc),
            )
            self.session.add(aggregate)

        await self.session.flush()
        return aggregate

    # --- Export Operations ---

    async def export_feedback(
        self,
        org_id: UUID,
        model_id: UUID,
        version_id: Optional[UUID] = None,
        feedback_types: Optional[List[FeedbackType]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 10000,
    ) -> tuple[List[Feedback], int]:
        """Export feedback for retraining (typically corrections)."""
        query = (
            select(Feedback)
            .where(Feedback.org_id == org_id)
            .where(Feedback.model_id == model_id)
        )

        if version_id:
            query = query.where(Feedback.version_id == version_id)

        # Default to exporting only corrections (most useful for training)
        if feedback_types:
            query = query.where(Feedback.feedback_type.in_(feedback_types))
        else:
            query = query.where(Feedback.feedback_type == FeedbackType.CORRECTION)

        if start_date:
            query = query.where(Feedback.created_at >= start_date)
        if end_date:
            query = query.where(Feedback.created_at <= end_date)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_query)).scalar() or 0

        # Limit and order
        query = query.order_by(Feedback.created_at.asc()).limit(limit)

        result = await self.session.execute(query)
        items = list(result.scalars().all())

        logger.info(
            "Feedback exported",
            org_id=str(org_id),
            model_id=str(model_id),
            count=len(items),
            total=total,
        )

        return items, total
