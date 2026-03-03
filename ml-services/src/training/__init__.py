"""Training Orchestration domain.

Ray-based training job management for ML models.

Key components:
- TrainingJob: Database model for tracking training jobs
- TrainingService: Business logic for job submission, monitoring, cancellation
- RayClient: Interface to Ray cluster for job execution
- Celery tasks: Background monitoring and cleanup
"""

from src.training.models import TrainingJob, TrainingJobStatus
from src.training.schemas import (
    TrainingJobCreate,
    TrainingJobResponse,
    TrainingConfig,
    HyperParameters,
    DatasetConfig,
    ResourceRequirements,
)
from src.training.service import TrainingService
from src.training.router import router
from src.training.ray_client import RayClient, RayJobError, RayConnectionError

__all__ = [
    # Models
    "TrainingJob",
    "TrainingJobStatus",
    # Schemas
    "TrainingJobCreate",
    "TrainingJobResponse",
    "TrainingConfig",
    "HyperParameters",
    "DatasetConfig",
    "ResourceRequirements",
    # Service
    "TrainingService",
    # Router
    "router",
    # Ray
    "RayClient",
    "RayJobError",
    "RayConnectionError",
]
