"""Application configuration."""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Application
    VERSION: str = "0.1.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/ml_services"
    )

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # Authentication
    SERVICE_API_KEY: str = Field(default="")
    SERVICE_API_KEY_HEADER: str = "X-Service-API-Key"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # AWS
    AWS_REGION: str = "us-east-1"
    AWS_ACCOUNT_ID: str = ""  # Required for Security Hub
    AWS_S3_BUCKET_MODELS: str = "inkra-ml-models"
    AWS_S3_BUCKET_AUDIT: str = "inkra-ml-audit"

    # Next.js App (for callbacks)
    NEXT_APP_URL: str = "http://localhost:3000"

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: int = 1000  # requests per minute

    # Circuit Breaker
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = 5
    CIRCUIT_BREAKER_RECOVERY_TIMEOUT: int = 30

    # Ray Cluster (Training Orchestration)
    RAY_ADDRESS: str = "ray://localhost:10001"
    RAY_WORKING_DIR: str = ""  # Working directory for Ray jobs
    RAY_PIP_PACKAGES: str = "scikit-learn,numpy,pandas"  # Comma-separated pip packages


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
