"""Celery application configuration."""

from celery import Celery

from src.common.config import settings

app = Celery(
    "ml_services",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "src.training.tasks",
        "src.feedback.tasks",
        "src.privacy.tasks",
    ],
)

# Celery configuration
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    task_soft_time_limit=3300,  # 55 minutes
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Beat schedule for periodic tasks
app.conf.beat_schedule = {
    "check-drift-hourly": {
        "task": "src.training.tasks.check_model_drift",
        "schedule": 3600.0,  # Every hour
    },
    "archive-old-events-daily": {
        "task": "src.audit.tasks.archive_old_events",
        "schedule": 86400.0,  # Every 24 hours
    },
    "compute-feedback-aggregates-daily": {
        "task": "src.feedback.tasks.compute_daily_aggregates",
        "schedule": 86400.0,  # Every 24 hours
    },
    "monitor-active-training-jobs": {
        "task": "src.training.tasks.monitor_all_active_jobs",
        "schedule": 300.0,  # Every 5 minutes
    },
    "cleanup-old-training-jobs": {
        "task": "src.training.tasks.cleanup_completed_jobs",
        "schedule": 86400.0,  # Every 24 hours
        "args": (30,),  # days_old=30
    },
}
