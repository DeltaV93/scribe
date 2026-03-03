"""Feedback Collection API endpoints."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.db import get_session
from src.feedback.models import FeedbackType, AggregationPeriod
from src.feedback.schemas import (
    FeedbackCreate,
    FeedbackResponse,
    FeedbackListResponse,
    FeedbackStatsResponse,
    FeedbackAggregateResponse,
    FeedbackExportItem,
    FeedbackExportResponse,
)
from src.feedback.service import FeedbackService

router = APIRouter(prefix="/feedback")


def get_service(session: AsyncSession = Depends(get_session)) -> FeedbackService:
    """Dependency to get feedback service."""
    return FeedbackService(session)


def get_org_and_user(request: Request) -> tuple[UUID, UUID]:
    """Extract org_id and user_id from request state."""
    org_id = getattr(request.state, "org_id", None)
    user_id = getattr(request.state, "user_id", None)

    if not org_id:
        raise HTTPException(status_code=401, detail="Organization ID required")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required")

    return UUID(org_id), UUID(user_id)


# --- Feedback Endpoints ---


@router.post("", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    request: Request,
    data: FeedbackCreate,
    service: FeedbackService = Depends(get_service),
) -> FeedbackResponse:
    """Submit feedback on a model output."""
    org_id, user_id = get_org_and_user(request)

    feedback = await service.submit_feedback(org_id, user_id, data)
    return FeedbackResponse.model_validate(feedback)


@router.get("", response_model=FeedbackListResponse)
async def list_feedback(
    request: Request,
    model_id: Optional[UUID] = Query(None),
    version_id: Optional[UUID] = Query(None),
    feedback_type: Optional[FeedbackType] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=250),
    service: FeedbackService = Depends(get_service),
) -> FeedbackListResponse:
    """List feedback with optional filtering."""
    org_id, _ = get_org_and_user(request)

    items, total = await service.list_feedback(
        org_id=org_id,
        model_id=model_id,
        version_id=version_id,
        feedback_type=feedback_type,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )

    return FeedbackListResponse(
        items=[FeedbackResponse.model_validate(f) for f in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback(
    request: Request,
    feedback_id: UUID,
    service: FeedbackService = Depends(get_service),
) -> FeedbackResponse:
    """Get feedback by ID."""
    org_id, _ = get_org_and_user(request)

    feedback = await service.get_feedback(feedback_id)
    if not feedback or feedback.org_id != org_id:
        raise HTTPException(status_code=404, detail="Feedback not found")

    return FeedbackResponse.model_validate(feedback)


@router.delete("/{feedback_id}", status_code=204)
async def delete_feedback(
    request: Request,
    feedback_id: UUID,
    service: FeedbackService = Depends(get_service),
) -> None:
    """Delete feedback."""
    org_id, _ = get_org_and_user(request)

    deleted = await service.delete_feedback(feedback_id, org_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Feedback not found")


# --- Stats Endpoints ---


@router.get("/stats/{model_id}", response_model=FeedbackStatsResponse)
async def get_feedback_stats(
    request: Request,
    model_id: UUID,
    version_id: Optional[UUID] = Query(None),
    period: AggregationPeriod = Query(AggregationPeriod.DAY),
    limit: int = Query(30, ge=1, le=365),
    service: FeedbackService = Depends(get_service),
) -> FeedbackStatsResponse:
    """Get aggregate statistics for a model/version."""
    org_id, _ = get_org_and_user(request)

    stats = await service.get_feedback_stats(
        org_id=org_id,
        model_id=model_id,
        version_id=version_id,
        period=period,
        limit=limit,
    )

    return FeedbackStatsResponse(
        model_id=stats["model_id"],
        version_id=stats["version_id"],
        aggregates=[
            FeedbackAggregateResponse.model_validate(a) for a in stats["aggregates"]
        ],
        total_feedback=stats["total_feedback"],
        total_positive=stats["total_positive"],
        total_negative=stats["total_negative"],
        total_corrections=stats["total_corrections"],
        overall_positive_rate=stats["overall_positive_rate"],
    )


# --- Export Endpoints ---


@router.get("/export/{model_id}", response_model=FeedbackExportResponse)
async def export_feedback(
    request: Request,
    model_id: UUID,
    version_id: Optional[UUID] = Query(None),
    feedback_types: Optional[List[FeedbackType]] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(10000, ge=1, le=100000),
    service: FeedbackService = Depends(get_service),
) -> FeedbackExportResponse:
    """Export feedback for model retraining."""
    org_id, _ = get_org_and_user(request)

    items, total = await service.export_feedback(
        org_id=org_id,
        model_id=model_id,
        version_id=version_id,
        feedback_types=feedback_types,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )

    return FeedbackExportResponse(
        model_id=model_id,
        version_id=version_id,
        items=[FeedbackExportItem.model_validate(f) for f in items],
        total=total,
        exported_at=datetime.utcnow(),
    )
