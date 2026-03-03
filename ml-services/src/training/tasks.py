"""Celery tasks for training orchestration."""

import asyncio
from datetime import datetime, timezone, timedelta
from uuid import UUID

import structlog
from celery import shared_task
from sqlalchemy import select

from src.common.celery_app import app
from src.common.db.session import AsyncSessionLocal
from src.training.models import TrainingJob, TrainingJobStatus
from src.training.service import TrainingService

logger = structlog.get_logger()


def run_async(coro):
    """Helper to run async code in Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@app.task(name="src.training.tasks.monitor_training_job")
def monitor_training_job(job_id: str) -> dict:
    """
    Monitor a specific training job and sync its status.

    This task is called periodically to update job status from Ray.
    """
    return run_async(_monitor_training_job(UUID(job_id)))


async def _monitor_training_job(job_id: UUID) -> dict:
    """Async implementation of monitor_training_job."""
    async with AsyncSessionLocal() as session:
        service = TrainingService(session)

        try:
            job = await service.get_job_status(job_id)
            await session.commit()

            logger.info(
                "Training job status monitored",
                job_id=str(job_id),
                status=job.status.value,
            )

            return {
                "job_id": str(job_id),
                "status": job.status.value,
                "updated": True,
            }

        except ValueError as e:
            logger.warning(
                "Training job not found for monitoring",
                job_id=str(job_id),
                error=str(e),
            )
            return {
                "job_id": str(job_id),
                "status": "not_found",
                "updated": False,
            }


@app.task(name="src.training.tasks.monitor_all_active_jobs")
def monitor_all_active_jobs() -> dict:
    """
    Monitor all active training jobs.

    This task runs periodically to sync status for all running jobs.
    """
    return run_async(_monitor_all_active_jobs())


async def _monitor_all_active_jobs() -> dict:
    """Async implementation of monitor_all_active_jobs."""
    async with AsyncSessionLocal() as session:
        # Find all active jobs
        result = await session.execute(
            select(TrainingJob.id).where(
                TrainingJob.status.in_([
                    TrainingJobStatus.PENDING,
                    TrainingJobStatus.RUNNING,
                ])
            )
        )
        job_ids = [row[0] for row in result.fetchall()]

        logger.info(
            "Found active training jobs to monitor",
            count=len(job_ids),
        )

        # Monitor each job
        updated_count = 0
        for job_id in job_ids:
            try:
                service = TrainingService(session)
                await service.get_job_status(job_id)
                await session.commit()
                updated_count += 1
            except Exception as e:
                logger.error(
                    "Failed to monitor training job",
                    job_id=str(job_id),
                    error=str(e),
                )

        return {
            "total_active": len(job_ids),
            "updated": updated_count,
        }


@app.task(name="src.training.tasks.cleanup_completed_jobs")
def cleanup_completed_jobs(days_old: int = 30) -> dict:
    """
    Archive old completed training jobs.

    Moves job data to S3 and removes from primary database.
    """
    return run_async(_cleanup_completed_jobs(days_old))


async def _cleanup_completed_jobs(days_old: int) -> dict:
    """Async implementation of cleanup_completed_jobs."""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)

    async with AsyncSessionLocal() as session:
        # Find completed jobs older than cutoff
        result = await session.execute(
            select(TrainingJob).where(
                (TrainingJob.status.in_([
                    TrainingJobStatus.COMPLETED,
                    TrainingJobStatus.FAILED,
                    TrainingJobStatus.CANCELLED,
                ]))
                & (TrainingJob.completed_at < cutoff_date)
            )
        )
        old_jobs = list(result.scalars().all())

        logger.info(
            "Found old training jobs to clean up",
            count=len(old_jobs),
            cutoff_date=cutoff_date.isoformat(),
        )

        archived_count = 0
        for job in old_jobs:
            try:
                # TODO: Archive job data to S3 before deletion
                # For now, just log and skip actual deletion
                logger.info(
                    "Would archive training job",
                    job_id=str(job.id),
                    completed_at=job.completed_at.isoformat() if job.completed_at else None,
                )
                archived_count += 1
            except Exception as e:
                logger.error(
                    "Failed to archive training job",
                    job_id=str(job.id),
                    error=str(e),
                )

        return {
            "found": len(old_jobs),
            "archived": archived_count,
        }


@app.task(name="src.training.tasks.check_model_drift")
def check_model_drift() -> dict:
    """
    Check for model drift in deployed models.

    This task runs hourly to detect performance degradation.
    """
    return run_async(_check_model_drift())


async def _check_model_drift() -> dict:
    """Async implementation of check_model_drift."""
    # TODO: Implement drift detection logic
    # 1. Get all deployed model versions
    # 2. Compare recent prediction metrics to baseline
    # 3. Alert if drift exceeds threshold

    logger.info("Model drift check completed (placeholder)")

    return {
        "models_checked": 0,
        "drift_detected": 0,
    }


# Register beat schedule tasks
@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    """Setup periodic tasks for training monitoring."""
    # Monitor active jobs every 5 minutes
    sender.add_periodic_task(
        300.0,  # 5 minutes
        monitor_all_active_jobs.s(),
        name="monitor-active-training-jobs",
    )

    # Clean up old jobs daily
    sender.add_periodic_task(
        86400.0,  # 24 hours
        cleanup_completed_jobs.s(days_old=30),
        name="cleanup-old-training-jobs",
    )
