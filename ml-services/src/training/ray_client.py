"""Ray cluster client for training job management."""

import asyncio
from typing import Optional
from uuid import UUID

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.common.config import settings

logger = structlog.get_logger()

# Lazy import Ray to avoid import errors when Ray is not installed
_ray_initialized = False
_job_client: Optional["JobSubmissionClient"] = None


class RayConnectionError(Exception):
    """Raised when unable to connect to Ray cluster."""

    pass


class RayJobError(Exception):
    """Raised when Ray job operation fails."""

    pass


def _ensure_ray_imported():
    """Lazily import Ray modules."""
    global _ray_initialized

    try:
        from ray.job_submission import JobSubmissionClient, JobStatus
        return JobSubmissionClient, JobStatus
    except ImportError as e:
        logger.error("Ray not installed. Install with: pip install 'ray[default]'")
        raise ImportError(
            "Ray is required for training orchestration. "
            "Install with: pip install 'ray[default]'"
        ) from e


def get_job_client() -> "JobSubmissionClient":
    """Get or create Ray JobSubmissionClient singleton."""
    global _job_client

    if _job_client is None:
        JobSubmissionClient, _ = _ensure_ray_imported()
        ray_address = settings.RAY_ADDRESS

        try:
            _job_client = JobSubmissionClient(ray_address)
            logger.info("Connected to Ray cluster", address=ray_address)
        except Exception as e:
            logger.error("Failed to connect to Ray cluster", address=ray_address, error=str(e))
            raise RayConnectionError(f"Cannot connect to Ray at {ray_address}: {e}") from e

    return _job_client


class RayClient:
    """Client for interacting with Ray cluster for training jobs."""

    def __init__(self):
        self._client: Optional["JobSubmissionClient"] = None

    @property
    def client(self) -> "JobSubmissionClient":
        """Lazy-load job submission client."""
        if self._client is None:
            self._client = get_job_client()
        return self._client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    )
    async def submit_job(
        self,
        job_id: UUID,
        entrypoint: str,
        runtime_env: Optional[dict] = None,
        entrypoint_resources: Optional[dict] = None,
    ) -> str:
        """
        Submit a training job to Ray cluster.

        Args:
            job_id: Internal job ID for tracking
            entrypoint: Command to run (e.g., "python train.py --config config.json")
            runtime_env: Ray runtime environment config
            entrypoint_resources: Resource requirements {"CPU": 1, "GPU": 0}

        Returns:
            Ray job ID
        """
        try:
            # Build submission ID from our job ID for traceability
            submission_id = f"inkra-training-{job_id}"

            # Default runtime environment
            if runtime_env is None:
                runtime_env = {
                    "pip": ["scikit-learn", "numpy", "pandas"],
                    "env_vars": {
                        "INKRA_JOB_ID": str(job_id),
                    },
                }
            else:
                # Ensure our job ID is in env vars
                runtime_env.setdefault("env_vars", {})
                runtime_env["env_vars"]["INKRA_JOB_ID"] = str(job_id)

            # Submit job in executor to avoid blocking event loop
            loop = asyncio.get_event_loop()
            ray_job_id = await loop.run_in_executor(
                None,
                lambda: self.client.submit_job(
                    entrypoint=entrypoint,
                    submission_id=submission_id,
                    runtime_env=runtime_env,
                    entrypoint_resources=entrypoint_resources or {"CPU": 1},
                ),
            )

            logger.info(
                "Submitted training job to Ray",
                job_id=str(job_id),
                ray_job_id=ray_job_id,
                entrypoint=entrypoint,
            )

            return ray_job_id

        except Exception as e:
            logger.error(
                "Failed to submit job to Ray",
                job_id=str(job_id),
                error=str(e),
            )
            raise RayJobError(f"Failed to submit job: {e}") from e

    async def get_job_status(self, ray_job_id: str) -> dict:
        """
        Get the status of a Ray job.

        Returns:
            Dict with status info: {"status": "RUNNING", "message": "..."}
        """
        _, JobStatus = _ensure_ray_imported()

        try:
            loop = asyncio.get_event_loop()
            status = await loop.run_in_executor(
                None,
                lambda: self.client.get_job_status(ray_job_id),
            )

            # Get additional info if available
            info = await loop.run_in_executor(
                None,
                lambda: self.client.get_job_info(ray_job_id),
            )

            return {
                "status": status.value if hasattr(status, "value") else str(status),
                "message": info.message if info and hasattr(info, "message") else None,
                "error_type": info.error_type if info and hasattr(info, "error_type") else None,
                "start_time": info.start_time if info and hasattr(info, "start_time") else None,
                "end_time": info.end_time if info and hasattr(info, "end_time") else None,
            }

        except Exception as e:
            logger.error("Failed to get job status", ray_job_id=ray_job_id, error=str(e))
            raise RayJobError(f"Failed to get job status: {e}") from e

    async def cancel_job(self, ray_job_id: str) -> bool:
        """
        Cancel a running Ray job.

        Returns:
            True if cancellation was successful
        """
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.client.stop_job(ray_job_id),
            )

            logger.info("Cancelled Ray job", ray_job_id=ray_job_id, result=result)
            return result

        except Exception as e:
            logger.error("Failed to cancel job", ray_job_id=ray_job_id, error=str(e))
            raise RayJobError(f"Failed to cancel job: {e}") from e

    async def get_job_logs(
        self,
        ray_job_id: str,
        tail_lines: Optional[int] = None,
    ) -> str:
        """
        Get logs from a Ray job.

        Args:
            ray_job_id: Ray job ID
            tail_lines: If set, only return last N lines

        Returns:
            Job logs as string
        """
        try:
            loop = asyncio.get_event_loop()
            logs = await loop.run_in_executor(
                None,
                lambda: self.client.get_job_logs(ray_job_id),
            )

            if tail_lines and logs:
                lines = logs.split("\n")
                logs = "\n".join(lines[-tail_lines:])

            return logs or ""

        except Exception as e:
            logger.error("Failed to get job logs", ray_job_id=ray_job_id, error=str(e))
            raise RayJobError(f"Failed to get job logs: {e}") from e

    async def list_jobs(self) -> list:
        """List all jobs in the Ray cluster."""
        try:
            loop = asyncio.get_event_loop()
            jobs = await loop.run_in_executor(
                None,
                lambda: self.client.list_jobs(),
            )
            return jobs

        except Exception as e:
            logger.error("Failed to list jobs", error=str(e))
            raise RayJobError(f"Failed to list jobs: {e}") from e


# Map Ray job status to our TrainingJobStatus
RAY_STATUS_MAP = {
    "PENDING": "pending",
    "RUNNING": "running",
    "SUCCEEDED": "completed",
    "FAILED": "failed",
    "STOPPED": "cancelled",
}


def map_ray_status(ray_status: str) -> str:
    """Map Ray job status to TrainingJobStatus value."""
    return RAY_STATUS_MAP.get(ray_status.upper(), "pending")
