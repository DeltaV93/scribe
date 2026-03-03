"""Training Orchestration business logic."""

import json
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.training.models import TrainingJob, TrainingJobStatus
from src.training.schemas import (
    TrainingJobCreate,
    TrainingJobUpdate,
    TrainingConfig,
    TrainingLogsResponse,
    TrainingMetricsResponse,
)
from src.training.ray_client import RayClient, map_ray_status, RayJobError
from src.registry.models import Model, ModelVersion, VersionStatus
from src.registry.schemas import VersionCreate
from src.registry.service import ModelRegistryService
from src.common.config import settings

logger = structlog.get_logger()


class TrainingService:
    """Service for managing training job operations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._ray_client: Optional[RayClient] = None

    @property
    def ray_client(self) -> RayClient:
        """Lazy-load Ray client."""
        if self._ray_client is None:
            self._ray_client = RayClient()
        return self._ray_client

    # --- Job Submission ---

    async def submit_job(self, data: TrainingJobCreate, org_id: UUID) -> TrainingJob:
        """
        Submit a new training job.

        Creates job record, validates model exists, and submits to Ray.
        """
        # Verify model exists and belongs to org (or is global)
        model = await self._get_model(data.model_id, org_id)
        if not model:
            raise ValueError(f"Model {data.model_id} not found or not accessible")

        # Create job record
        job = TrainingJob(
            model_id=data.model_id,
            org_id=org_id,
            status=TrainingJobStatus.PENDING,
            config=data.config.model_dump(),
        )
        self.session.add(job)
        await self.session.flush()

        logger.info(
            "Training job created",
            job_id=str(job.id),
            model_id=str(data.model_id),
            org_id=str(org_id),
        )

        # Submit to Ray cluster
        try:
            ray_job_id = await self._submit_to_ray(job, data.config, data.parent_version_id)
            job.ray_job_id = ray_job_id
            job.status = TrainingJobStatus.RUNNING
            job.started_at = datetime.now(timezone.utc)
            await self.session.flush()

            logger.info(
                "Training job submitted to Ray",
                job_id=str(job.id),
                ray_job_id=ray_job_id,
            )

        except RayJobError as e:
            job.status = TrainingJobStatus.FAILED
            job.error_message = str(e)
            await self.session.flush()
            logger.error(
                "Failed to submit training job to Ray",
                job_id=str(job.id),
                error=str(e),
            )
            # Re-raise to inform caller
            raise

        return job

    async def _submit_to_ray(
        self,
        job: TrainingJob,
        config: TrainingConfig,
        parent_version_id: Optional[UUID],
    ) -> str:
        """Build and submit Ray job."""
        # Build entrypoint command
        config_json = json.dumps(config.model_dump())

        # The training script will read config from env var
        entrypoint = f"python -m src.training.train_runner"

        # Build runtime environment
        runtime_env = {
            "pip": settings.RAY_PIP_PACKAGES.split(",") if settings.RAY_PIP_PACKAGES else [],
            "env_vars": {
                "INKRA_JOB_ID": str(job.id),
                "INKRA_MODEL_ID": str(job.model_id),
                "INKRA_ORG_ID": str(job.org_id),
                "INKRA_TRAINING_CONFIG": config_json,
                "INKRA_PARENT_VERSION_ID": str(parent_version_id) if parent_version_id else "",
                "DATABASE_URL": settings.DATABASE_URL,
                "AWS_S3_BUCKET_MODELS": settings.AWS_S3_BUCKET_MODELS,
            },
            "working_dir": settings.RAY_WORKING_DIR or ".",
        }

        # Build resource requirements
        resources = config.resources
        entrypoint_resources = {
            "CPU": resources.cpu,
        }
        if resources.gpu > 0:
            entrypoint_resources["GPU"] = resources.gpu

        return await self.ray_client.submit_job(
            job_id=job.id,
            entrypoint=entrypoint,
            runtime_env=runtime_env,
            entrypoint_resources=entrypoint_resources,
        )

    # --- Job Status ---

    async def get_job_status(self, job_id: UUID) -> TrainingJob:
        """Get job and sync status from Ray if running."""
        job = await self.get_job(job_id)
        if not job:
            raise ValueError(f"Training job {job_id} not found")

        # Sync with Ray if job is active
        if job.ray_job_id and job.status in (
            TrainingJobStatus.PENDING,
            TrainingJobStatus.RUNNING,
        ):
            await self._sync_ray_status(job)

        return job

    async def _sync_ray_status(self, job: TrainingJob) -> None:
        """Sync job status from Ray cluster."""
        if not job.ray_job_id:
            return

        try:
            ray_status = await self.ray_client.get_job_status(job.ray_job_id)
            new_status = map_ray_status(ray_status["status"])

            if new_status != job.status.value:
                job.status = TrainingJobStatus(new_status)

                if new_status == "completed":
                    job.completed_at = datetime.now(timezone.utc)
                    # Create model version on successful completion
                    await self._create_model_version(job)

                elif new_status == "failed":
                    job.completed_at = datetime.now(timezone.utc)
                    job.error_message = ray_status.get("message") or "Job failed"

                elif new_status == "cancelled":
                    job.completed_at = datetime.now(timezone.utc)

                await self.session.flush()
                logger.info(
                    "Training job status synced",
                    job_id=str(job.id),
                    new_status=new_status,
                )

        except RayJobError as e:
            logger.warning(
                "Failed to sync Ray job status",
                job_id=str(job.id),
                ray_job_id=job.ray_job_id,
                error=str(e),
            )

    async def _create_model_version(self, job: TrainingJob) -> None:
        """Create a new model version from completed training job."""
        if job.created_version_id:
            return  # Already created

        registry_service = ModelRegistryService(self.session)

        version = await registry_service.create_version(
            job.model_id,
            VersionCreate(
                config=job.config,
                artifact_s3_path=job.artifact_path,
            ),
        )

        # Mark version as ready
        version.status = VersionStatus.READY
        version.metrics = job.metrics

        job.created_version_id = version.id

        logger.info(
            "Model version created from training job",
            job_id=str(job.id),
            version_id=str(version.id),
            version_number=version.version_number,
        )

    # --- Job Cancellation ---

    async def cancel_job(self, job_id: UUID) -> TrainingJob:
        """Cancel a running training job."""
        job = await self.get_job(job_id)
        if not job:
            raise ValueError(f"Training job {job_id} not found")

        if job.status not in (TrainingJobStatus.PENDING, TrainingJobStatus.RUNNING):
            raise ValueError(f"Cannot cancel job with status {job.status}")

        # Cancel in Ray
        if job.ray_job_id:
            try:
                await self.ray_client.cancel_job(job.ray_job_id)
            except RayJobError as e:
                logger.warning(
                    "Failed to cancel Ray job",
                    job_id=str(job_id),
                    ray_job_id=job.ray_job_id,
                    error=str(e),
                )

        # Update status
        job.status = TrainingJobStatus.CANCELLED
        job.completed_at = datetime.now(timezone.utc)
        await self.session.flush()

        logger.info("Training job cancelled", job_id=str(job_id))

        return job

    # --- Job Logs ---

    async def get_job_logs(
        self,
        job_id: UUID,
        tail_lines: Optional[int] = None,
        offset: int = 0,
    ) -> TrainingLogsResponse:
        """Get logs from a training job."""
        job = await self.get_job(job_id)
        if not job:
            raise ValueError(f"Training job {job_id} not found")

        logs = ""
        has_more = False

        if job.ray_job_id:
            try:
                full_logs = await self.ray_client.get_job_logs(job.ray_job_id)
                lines = full_logs.split("\n")

                # Apply offset
                if offset > 0:
                    lines = lines[offset:]

                # Apply tail limit
                if tail_lines:
                    has_more = len(lines) > tail_lines
                    lines = lines[:tail_lines]

                logs = "\n".join(lines)

            except RayJobError as e:
                logs = f"[Error fetching logs: {e}]"

        return TrainingLogsResponse(
            job_id=job_id,
            logs=logs,
            offset=offset,
            has_more=has_more,
        )

    # --- Job Metrics ---

    async def get_job_metrics(self, job_id: UUID) -> TrainingMetricsResponse:
        """Get training metrics for a job."""
        job = await self.get_job(job_id)
        if not job:
            raise ValueError(f"Training job {job_id} not found")

        # Calculate elapsed time
        elapsed = None
        if job.started_at:
            end_time = job.completed_at or datetime.now(timezone.utc)
            elapsed = (end_time - job.started_at).total_seconds()

        # Extract epoch info from metrics if available
        current_epoch = None
        total_epochs = None
        if job.metrics:
            current_epoch = job.metrics.get("current_epoch")
            total_epochs = job.config.get("hyperparameters", {}).get("epochs")

        return TrainingMetricsResponse(
            job_id=job_id,
            status=job.status,
            metrics=job.metrics,
            current_epoch=current_epoch,
            total_epochs=total_epochs,
            elapsed_time_seconds=elapsed,
        )

    # --- Job Listing ---

    async def list_jobs(
        self,
        org_id: UUID,
        model_id: Optional[UUID] = None,
        status: Optional[TrainingJobStatus] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[TrainingJob], int]:
        """List training jobs with filtering and pagination."""
        query = select(TrainingJob).where(TrainingJob.org_id == org_id)

        if model_id:
            query = query.where(TrainingJob.model_id == model_id)

        if status:
            query = query.where(TrainingJob.status == status)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_query)).scalar() or 0

        # Paginate
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(TrainingJob.created_at.desc())

        result = await self.session.execute(query)
        jobs = list(result.scalars().all())

        return jobs, total

    # --- Helper Methods ---

    async def get_job(self, job_id: UUID) -> Optional[TrainingJob]:
        """Get a training job by ID."""
        result = await self.session.execute(
            select(TrainingJob)
            .where(TrainingJob.id == job_id)
            .options(
                selectinload(TrainingJob.model),
                selectinload(TrainingJob.created_version),
            )
        )
        return result.scalar_one_or_none()

    async def _get_model(self, model_id: UUID, org_id: UUID) -> Optional[Model]:
        """Get model if accessible by org."""
        result = await self.session.execute(
            select(Model).where(
                (Model.id == model_id)
                & ((Model.org_id == org_id) | (Model.is_global == True))
            )
        )
        return result.scalar_one_or_none()

    async def update_job(self, job_id: UUID, data: TrainingJobUpdate) -> Optional[TrainingJob]:
        """Update a training job (internal use for callbacks)."""
        job = await self.get_job(job_id)
        if not job:
            return None

        if data.status is not None:
            job.status = data.status
        if data.metrics is not None:
            job.metrics = data.metrics
        if data.error_message is not None:
            job.error_message = data.error_message
        if data.started_at is not None:
            job.started_at = data.started_at
        if data.completed_at is not None:
            job.completed_at = data.completed_at
        if data.ray_job_id is not None:
            job.ray_job_id = data.ray_job_id
        if data.artifact_path is not None:
            job.artifact_path = data.artifact_path
        if data.created_version_id is not None:
            job.created_version_id = data.created_version_id

        await self.session.flush()

        logger.info("Training job updated", job_id=str(job_id), status=job.status)

        return job
