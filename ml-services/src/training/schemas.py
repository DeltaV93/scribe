"""Training Orchestration Pydantic schemas."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator

from src.training.models import TrainingJobStatus


# --- Training Config Schemas ---


class ResourceRequirements(BaseModel):
    """Resource requirements for a training job."""

    cpu: float = Field(default=1.0, ge=0.1, le=64.0, description="Number of CPU cores")
    memory_gb: float = Field(default=2.0, ge=0.5, le=256.0, description="Memory in GB")
    gpu: int = Field(default=0, ge=0, le=8, description="Number of GPUs")


class DatasetConfig(BaseModel):
    """Configuration for training dataset."""

    source: str = Field(..., description="Dataset source (s3://... or database query)")
    train_split: float = Field(default=0.8, ge=0.1, le=0.95, description="Training split ratio")
    validation_split: float = Field(default=0.1, ge=0.05, le=0.3, description="Validation split")
    test_split: float = Field(default=0.1, ge=0.0, le=0.3, description="Test split ratio")
    shuffle: bool = Field(default=True, description="Shuffle dataset before splitting")
    random_seed: Optional[int] = Field(default=None, description="Random seed for reproducibility")

    @field_validator("test_split")
    @classmethod
    def validate_splits(cls, v: float, info) -> float:
        """Validate that splits sum to 1.0."""
        train = info.data.get("train_split", 0.8)
        val = info.data.get("validation_split", 0.1)
        if abs(train + val + v - 1.0) > 0.001:
            raise ValueError("train_split + validation_split + test_split must equal 1.0")
        return v


class HyperParameters(BaseModel):
    """Hyperparameters for model training."""

    learning_rate: float = Field(default=0.001, gt=0, le=1.0)
    batch_size: int = Field(default=32, ge=1, le=10000)
    epochs: int = Field(default=10, ge=1, le=1000)
    optimizer: str = Field(default="adam", pattern="^(adam|sgd|rmsprop|adamw)$")
    weight_decay: float = Field(default=0.0, ge=0, le=1.0)
    early_stopping_patience: Optional[int] = Field(default=None, ge=1, le=100)
    custom: Optional[dict] = Field(default=None, description="Custom hyperparameters")


class TrainingConfig(BaseModel):
    """Full training configuration."""

    hyperparameters: HyperParameters = Field(default_factory=HyperParameters)
    dataset: DatasetConfig
    resources: ResourceRequirements = Field(default_factory=ResourceRequirements)
    checkpoint_interval: int = Field(
        default=5, ge=1, le=100, description="Save checkpoint every N epochs"
    )
    max_runtime_hours: float = Field(
        default=24.0, gt=0, le=168.0, description="Maximum runtime in hours"
    )


# --- Job Schemas ---


class TrainingJobCreate(BaseModel):
    """Schema for creating a training job."""

    model_id: UUID
    config: TrainingConfig
    parent_version_id: Optional[UUID] = Field(
        default=None, description="Parent version for fine-tuning"
    )


class TrainingJobUpdate(BaseModel):
    """Schema for updating a training job (internal use)."""

    status: Optional[TrainingJobStatus] = None
    metrics: Optional[dict] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    ray_job_id: Optional[str] = None
    artifact_path: Optional[str] = None
    created_version_id: Optional[UUID] = None


class TrainingJobResponse(BaseModel):
    """Schema for training job response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    model_id: UUID
    org_id: UUID
    status: TrainingJobStatus
    config: dict
    metrics: Optional[dict]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    ray_job_id: Optional[str]
    artifact_path: Optional[str]
    created_version_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime


class TrainingJobListResponse(BaseModel):
    """Schema for paginated training job list."""

    items: List[TrainingJobResponse]
    total: int
    page: int
    page_size: int


class TrainingMetricsResponse(BaseModel):
    """Schema for training metrics response."""

    job_id: UUID
    status: TrainingJobStatus
    metrics: Optional[dict]
    current_epoch: Optional[int] = None
    total_epochs: Optional[int] = None
    elapsed_time_seconds: Optional[float] = None


class TrainingLogsResponse(BaseModel):
    """Schema for training logs response."""

    job_id: UUID
    logs: str
    offset: int
    has_more: bool
