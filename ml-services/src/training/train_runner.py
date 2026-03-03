"""
Training runner script executed by Ray jobs.

This script is invoked by Ray with training configuration in environment variables.
It performs the actual model training and reports results back to the database.
"""

import asyncio
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import structlog

# Configure logging early
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()


def get_env_config() -> dict:
    """Get training configuration from environment."""
    config_json = os.environ.get("INKRA_TRAINING_CONFIG", "{}")
    try:
        return json.loads(config_json)
    except json.JSONDecodeError:
        logger.error("Failed to parse INKRA_TRAINING_CONFIG")
        return {}


def get_job_context() -> dict:
    """Get job context from environment."""
    return {
        "job_id": os.environ.get("INKRA_JOB_ID", ""),
        "model_id": os.environ.get("INKRA_MODEL_ID", ""),
        "org_id": os.environ.get("INKRA_ORG_ID", ""),
        "parent_version_id": os.environ.get("INKRA_PARENT_VERSION_ID", ""),
        "database_url": os.environ.get("DATABASE_URL", ""),
        "s3_bucket": os.environ.get("AWS_S3_BUCKET_MODELS", ""),
    }


async def update_job_status(
    database_url: str,
    job_id: str,
    status: str = None,
    metrics: dict = None,
    error_message: str = None,
    artifact_path: str = None,
) -> None:
    """Update job status in database."""
    if not database_url or not job_id:
        logger.warning("Cannot update job status: missing database_url or job_id")
        return

    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import update

        # Import models
        sys.path.insert(0, str(Path(__file__).parent.parent.parent))
        from src.training.models import TrainingJob, TrainingJobStatus

        engine = create_async_engine(database_url)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            values = {"updated_at": datetime.now(timezone.utc)}
            if status:
                values["status"] = TrainingJobStatus(status)
            if metrics:
                values["metrics"] = metrics
            if error_message:
                values["error_message"] = error_message
            if artifact_path:
                values["artifact_path"] = artifact_path
            if status in ("completed", "failed", "cancelled"):
                values["completed_at"] = datetime.now(timezone.utc)

            await session.execute(
                update(TrainingJob).where(TrainingJob.id == UUID(job_id)).values(**values)
            )
            await session.commit()

        await engine.dispose()
        logger.info("Updated job status", job_id=job_id, status=status)

    except Exception as e:
        logger.error("Failed to update job status", job_id=job_id, error=str(e))


def run_training(config: dict, context: dict) -> dict:
    """
    Run the actual training process.

    This is a placeholder implementation. In production, this would:
    1. Load the dataset from the configured source
    2. Initialize the model (or load from parent version)
    3. Run training loop with configured hyperparameters
    4. Save checkpoints periodically
    5. Save final model artifacts to S3
    6. Return training metrics
    """
    hyperparams = config.get("hyperparameters", {})
    dataset_config = config.get("dataset", {})
    resources = config.get("resources", {})

    logger.info(
        "Starting training",
        job_id=context["job_id"],
        model_id=context["model_id"],
        epochs=hyperparams.get("epochs", 10),
        batch_size=hyperparams.get("batch_size", 32),
        learning_rate=hyperparams.get("learning_rate", 0.001),
    )

    # Simulate training epochs
    epochs = hyperparams.get("epochs", 10)
    metrics_history = []

    for epoch in range(1, epochs + 1):
        # Simulated training step
        import time
        import random

        time.sleep(1)  # Simulate computation time

        # Simulated metrics
        train_loss = 1.0 / (epoch + 1) + random.uniform(-0.05, 0.05)
        val_loss = 1.0 / (epoch + 0.8) + random.uniform(-0.05, 0.05)
        accuracy = min(0.99, 0.5 + (epoch / epochs) * 0.4 + random.uniform(-0.02, 0.02))

        epoch_metrics = {
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "val_loss": round(val_loss, 4),
            "accuracy": round(accuracy, 4),
        }
        metrics_history.append(epoch_metrics)

        logger.info(
            "Epoch completed",
            job_id=context["job_id"],
            **epoch_metrics,
        )

        # Update metrics in database periodically
        if epoch % config.get("checkpoint_interval", 5) == 0:
            asyncio.run(
                update_job_status(
                    context["database_url"],
                    context["job_id"],
                    metrics={
                        "current_epoch": epoch,
                        "history": metrics_history,
                        **epoch_metrics,
                    },
                )
            )

    # Final metrics
    final_metrics = {
        "final_train_loss": metrics_history[-1]["train_loss"],
        "final_val_loss": metrics_history[-1]["val_loss"],
        "final_accuracy": metrics_history[-1]["accuracy"],
        "total_epochs": epochs,
        "history": metrics_history,
    }

    logger.info(
        "Training completed",
        job_id=context["job_id"],
        **{k: v for k, v in final_metrics.items() if k != "history"},
    )

    return final_metrics


def save_artifacts(context: dict, metrics: dict) -> str:
    """
    Save model artifacts to S3.

    Returns the S3 path to the saved artifacts.
    """
    s3_bucket = context.get("s3_bucket", "")
    job_id = context.get("job_id", "")
    model_id = context.get("model_id", "")

    if not s3_bucket:
        logger.warning("No S3 bucket configured, skipping artifact upload")
        return ""

    try:
        import boto3

        s3 = boto3.client("s3")

        # Create temporary model artifact file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(
                {
                    "job_id": job_id,
                    "model_id": model_id,
                    "metrics": metrics,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                f,
            )
            temp_path = f.name

        # Upload to S3
        s3_key = f"models/{model_id}/training-{job_id}/model.json"
        s3.upload_file(temp_path, s3_bucket, s3_key)

        artifact_path = f"s3://{s3_bucket}/{s3_key}"
        logger.info("Artifacts saved", artifact_path=artifact_path)

        # Clean up temp file
        os.unlink(temp_path)

        return artifact_path

    except Exception as e:
        logger.error("Failed to save artifacts", error=str(e))
        return ""


def main():
    """Main entry point for training runner."""
    config = get_env_config()
    context = get_job_context()

    if not context["job_id"]:
        logger.error("Missing INKRA_JOB_ID environment variable")
        sys.exit(1)

    logger.info(
        "Training runner started",
        job_id=context["job_id"],
        model_id=context["model_id"],
    )

    try:
        # Run training
        metrics = run_training(config, context)

        # Save artifacts
        artifact_path = save_artifacts(context, metrics)

        # Update final status
        asyncio.run(
            update_job_status(
                context["database_url"],
                context["job_id"],
                status="completed",
                metrics=metrics,
                artifact_path=artifact_path,
            )
        )

        logger.info("Training runner completed successfully", job_id=context["job_id"])

    except Exception as e:
        logger.error(
            "Training runner failed",
            job_id=context["job_id"],
            error=str(e),
        )

        # Update error status
        asyncio.run(
            update_job_status(
                context["database_url"],
                context["job_id"],
                status="failed",
                error_message=str(e),
            )
        )

        sys.exit(1)


if __name__ == "__main__":
    main()
