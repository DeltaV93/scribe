"""Training Orchestration API endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.db import get_session
from src.training.models import TrainingJobStatus
from src.training.schemas import (
    TrainingJobCreate,
    TrainingJobResponse,
    TrainingJobListResponse,
    TrainingMetricsResponse,
    TrainingLogsResponse,
)
from src.training.service import TrainingService
from src.training.ray_client import RayJobError

router = APIRouter(prefix="/training")


def get_service(session: AsyncSession = Depends(get_session)) -> TrainingService:
    """Dependency to get training service."""
    return TrainingService(session)


# --- Job Submission ---


@router.post("/jobs", response_model=TrainingJobResponse, status_code=201)
async def submit_training_job(
    request: Request,
    data: TrainingJobCreate,
    service: TrainingService = Depends(get_service),
) -> TrainingJobResponse:
    """
    Submit a new training job.

    Creates a training job record and submits it to the Ray cluster for execution.
    The job will train the specified model using the provided configuration.
    """
    org_id = getattr(request.state, "org_id", None)
    if not org_id:
        raise HTTPException(status_code=401, detail="Organization context required")

    try:
        job = await service.submit_job(data, UUID(org_id))
        return TrainingJobResponse.model_validate(job)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RayJobError as e:
        raise HTTPException(status_code=503, detail=f"Training cluster unavailable: {e}")


# --- Job Listing ---


@router.get("/jobs", response_model=TrainingJobListResponse)
async def list_training_jobs(
    request: Request,
    model_id: Optional[UUID] = Query(None, description="Filter by model ID"),
    status: Optional[TrainingJobStatus] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    service: TrainingService = Depends(get_service),
) -> TrainingJobListResponse:
    """
    List training jobs for the organization.

    Supports filtering by model and status, with pagination.
    """
    org_id = getattr(request.state, "org_id", None)
    if not org_id:
        raise HTTPException(status_code=401, detail="Organization context required")

    jobs, total = await service.list_jobs(
        org_id=UUID(org_id),
        model_id=model_id,
        status=status,
        page=page,
        page_size=page_size,
    )

    return TrainingJobListResponse(
        items=[TrainingJobResponse.model_validate(j) for j in jobs],
        total=total,
        page=page,
        page_size=page_size,
    )


# --- Job Details ---


@router.get("/jobs/{job_id}", response_model=TrainingJobResponse)
async def get_training_job(
    job_id: UUID,
    service: TrainingService = Depends(get_service),
) -> TrainingJobResponse:
    """
    Get training job details.

    Automatically syncs status with Ray cluster for active jobs.
    """
    try:
        job = await service.get_job_status(job_id)
        return TrainingJobResponse.model_validate(job)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# --- Job Logs ---


@router.get("/jobs/{job_id}/logs", response_model=TrainingLogsResponse)
async def get_training_job_logs(
    job_id: UUID,
    tail: Optional[int] = Query(None, ge=1, le=10000, description="Return last N lines"),
    offset: int = Query(0, ge=0, description="Skip first N lines"),
    service: TrainingService = Depends(get_service),
) -> TrainingLogsResponse:
    """
    Get logs from a training job.

    Supports pagination via offset and tail parameters.
    """
    try:
        return await service.get_job_logs(job_id, tail_lines=tail, offset=offset)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# --- Job Cancellation ---


@router.post("/jobs/{job_id}/cancel", response_model=TrainingJobResponse)
async def cancel_training_job(
    job_id: UUID,
    service: TrainingService = Depends(get_service),
) -> TrainingJobResponse:
    """
    Cancel a running training job.

    Only jobs in PENDING or RUNNING status can be cancelled.
    """
    try:
        job = await service.cancel_job(job_id)
        return TrainingJobResponse.model_validate(job)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RayJobError as e:
        raise HTTPException(status_code=503, detail=f"Failed to cancel job: {e}")


# --- Job Metrics ---


@router.get("/jobs/{job_id}/metrics", response_model=TrainingMetricsResponse)
async def get_training_job_metrics(
    job_id: UUID,
    service: TrainingService = Depends(get_service),
) -> TrainingMetricsResponse:
    """
    Get training metrics for a job.

    Returns current training progress including epoch, loss, accuracy, etc.
    """
    try:
        return await service.get_job_metrics(job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
