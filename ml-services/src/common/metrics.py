"""Prometheus metrics instrumentation."""

from prometheus_client import Counter, Histogram, Gauge, Info

# Application info
APP_INFO = Info("ml_services", "ML Services application information")

# Request metrics (in addition to default FastAPI metrics)
REQUEST_COUNT = Counter(
    "ml_services_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
)

REQUEST_LATENCY = Histogram(
    "ml_services_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0],
)

# Model Registry metrics
MODELS_TOTAL = Gauge(
    "ml_services_models_total",
    "Total number of registered models",
    ["model_type", "is_global"],
)

MODEL_VERSIONS_TOTAL = Gauge(
    "ml_services_model_versions_total",
    "Total number of model versions",
    ["status"],
)

MODEL_DEPLOYMENTS_ACTIVE = Gauge(
    "ml_services_model_deployments_active",
    "Number of active model deployments",
    ["environment"],
)

# Training metrics
TRAINING_JOBS_TOTAL = Counter(
    "ml_services_training_jobs_total",
    "Total training jobs",
    ["status"],  # started, completed, failed
)

TRAINING_JOB_DURATION = Histogram(
    "ml_services_training_job_duration_seconds",
    "Training job duration",
    ["model_type"],
    buckets=[60, 300, 600, 1800, 3600, 7200, 14400, 28800],  # 1m to 8h
)

# Privacy budget metrics
PRIVACY_BUDGET_REMAINING = Gauge(
    "ml_services_privacy_budget_remaining",
    "Remaining privacy budget (epsilon)",
    ["org_id"],
)

PRIVACY_BUDGET_CONSUMED = Counter(
    "ml_services_privacy_budget_consumed_total",
    "Total privacy budget consumed",
    ["org_id", "operation_type"],
)

PRIVACY_BUDGET_EXHAUSTED = Counter(
    "ml_services_privacy_budget_exhausted_total",
    "Number of times privacy budget was exhausted",
    ["org_id"],
)

# Audit metrics
AUDIT_EVENTS_TOTAL = Counter(
    "ml_services_audit_events_total",
    "Total audit events",
    ["event_type", "risk_tier"],
)

AUDIT_EVENTS_ROUTED = Counter(
    "ml_services_audit_events_routed_total",
    "Audit events routed to sinks",
    ["sink_type"],
)

AUDIT_ROUTING_ERRORS = Counter(
    "ml_services_audit_routing_errors_total",
    "Audit routing errors",
    ["sink_type", "error_type"],
)

# Feedback metrics
FEEDBACK_SUBMITTED = Counter(
    "ml_services_feedback_submitted_total",
    "Total feedback submissions",
    ["feedback_type"],  # field_correction, classification_override, quality_rating
)

FEEDBACK_APPLIED = Counter(
    "ml_services_feedback_applied_total",
    "Feedback applied to training data",
    ["feedback_type"],
)

# Validation metrics
VALIDATION_GATE_RESULTS = Counter(
    "ml_services_validation_gate_results_total",
    "Validation gate results",
    ["gate_name", "result"],  # passed, failed
)

MODEL_DRIFT_SCORE = Gauge(
    "ml_services_model_drift_score",
    "Current drift score for deployed models",
    ["model_id", "metric_name"],
)

# Circuit breaker metrics
CIRCUIT_BREAKER_STATE = Gauge(
    "ml_services_circuit_breaker_state",
    "Circuit breaker state (0=closed, 1=open, 2=half-open)",
    ["service"],
)

CIRCUIT_BREAKER_FAILURES = Counter(
    "ml_services_circuit_breaker_failures_total",
    "Circuit breaker failure count",
    ["service"],
)


def init_metrics(version: str):
    """Initialize application metrics."""
    APP_INFO.info({"version": version, "service": "ml-services"})
