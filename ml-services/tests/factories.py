"""Factory functions for test data generation."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from src.registry.models import ModelType, VersionStatus, DeploymentStatus
from src.audit.models import RiskTier, ActorType, SinkType


def create_model_data(
    name: Optional[str] = None,
    model_type: str = "extraction",
    description: Optional[str] = None,
    is_global: bool = False,
    org_id: Optional[UUID] = None,
) -> dict:
    """Create model data for API requests."""
    return {
        "name": name or f"test-model-{uuid4().hex[:8]}",
        "model_type": model_type,
        "description": description or "Test model description",
        "is_global": is_global,
        "org_id": str(org_id) if org_id else None,
    }


def create_version_data(
    config: Optional[dict] = None,
    artifact_s3_path: Optional[str] = None,
    parent_version_id: Optional[UUID] = None,
) -> dict:
    """Create version data for API requests."""
    data = {}
    if config is not None:
        data["config"] = config
    if artifact_s3_path is not None:
        data["artifact_s3_path"] = artifact_s3_path
    if parent_version_id is not None:
        data["parent_version_id"] = str(parent_version_id)
    return data


def create_deployment_data(
    environment: str = "staging",
    traffic_percentage: float = 100.0,
) -> dict:
    """Create deployment data for API requests."""
    return {
        "environment": environment,
        "traffic_percentage": traffic_percentage,
    }


def create_org_profile_data(
    org_id: Optional[UUID] = None,
    compliance_frameworks: Optional[list[str]] = None,
    retention_policies: Optional[dict] = None,
    privacy_settings: Optional[dict] = None,
    epsilon_budget: float = 5.0,
    model_training_enabled: bool = True,
    audit_routing_config: Optional[dict] = None,
) -> dict:
    """Create org profile data for API requests."""
    return {
        "org_id": str(org_id or uuid4()),
        "compliance_frameworks": compliance_frameworks or ["HIPAA"],
        "retention_policies": retention_policies or {"training_data": "6y"},
        "privacy_settings": privacy_settings or {"anonymization": True},
        "epsilon_budget": epsilon_budget,
        "model_training_enabled": model_training_enabled,
        "audit_routing_config": audit_routing_config or {},
    }


def create_audit_event_data(
    org_id: Optional[UUID] = None,
    event_type: str = "model.deployed",
    risk_tier: str = "medium",
    actor_id: Optional[UUID] = None,
    actor_type: str = "user",
    event_data: Optional[dict] = None,
    source_service: str = "test-service",
    correlation_id: Optional[UUID] = None,
    occurred_at: Optional[datetime] = None,
) -> dict:
    """Create audit event data for API requests."""
    return {
        "org_id": str(org_id or uuid4()),
        "event_type": event_type,
        "risk_tier": risk_tier,
        "actor_id": str(actor_id) if actor_id else None,
        "actor_type": actor_type,
        "event_data": event_data or {"model_id": str(uuid4())},
        "source_service": source_service,
        "correlation_id": str(correlation_id) if correlation_id else None,
        "occurred_at": (occurred_at or datetime.now(timezone.utc)).isoformat(),
    }


def create_audit_sink_data(
    sink_type: str = "postgresql",
    config: Optional[dict] = None,
    is_active: bool = True,
) -> dict:
    """Create audit sink data for API requests."""
    return {
        "sink_type": sink_type,
        "config": config or {},
        "is_active": is_active,
    }


def create_audit_route_data(
    org_id: Optional[UUID] = None,
    event_type_pattern: str = "model.*",
    risk_tier_min: str = "medium",
    sink_id: Optional[UUID] = None,
) -> dict:
    """Create audit route data for API requests."""
    return {
        "org_id": str(org_id) if org_id else None,
        "event_type_pattern": event_type_pattern,
        "risk_tier_min": risk_tier_min,
        "sink_id": str(sink_id or uuid4()),
    }


# Sample data generators for bulk operations
def generate_models(count: int = 5) -> list[dict]:
    """Generate multiple model data entries."""
    model_types = ["extraction", "classification", "llm"]
    return [
        create_model_data(
            name=f"model-{i}",
            model_type=model_types[i % len(model_types)],
        )
        for i in range(count)
    ]


def generate_audit_events(org_id: UUID, count: int = 10) -> list[dict]:
    """Generate multiple audit event data entries."""
    event_types = [
        "model.deployed",
        "model.rollback",
        "training.started",
        "training.completed",
        "privacy.budget.warning",
    ]
    risk_tiers = ["low", "medium", "high", "critical"]

    return [
        create_audit_event_data(
            org_id=org_id,
            event_type=event_types[i % len(event_types)],
            risk_tier=risk_tiers[i % len(risk_tiers)],
        )
        for i in range(count)
    ]
