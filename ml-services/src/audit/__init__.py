"""Audit domain.

PX-898: Risk-Tiered Audit Event Schema & Routing Layer

This module provides:
- Risk tier definitions and event type mapping (risk_tiers.py)
- Oracle layer with caching for risk tier routing (oracle.py)
- Dual logging for customer and internal streams (dual_logger.py)
- API endpoints for events, export, and queue management (router.py)
"""

from src.audit.models import RiskTier, ActorType, SinkType, AuditEvent
from src.audit.oracle import AuditOracle, OracleContext, RoutingDecision, get_audit_oracle
from src.audit.dual_logger import (
    DualAuditLogger,
    AuditEventPayload,
    get_dual_audit_logger,
    log_audit_event,
)
from src.audit.risk_tiers import (
    get_default_risk_tier,
    get_tier_config,
    compare_tiers,
    tier_meets_minimum,
    get_highest_tier,
    RiskTierConfig,
)
from src.audit.service import (
    AuditService,
    emit_model_deployed,
    emit_model_rollback,
    emit_privacy_budget_exhausted,
    emit_training_started,
    emit_training_completed,
    emit_training_failed,
    emit_training_cancelled,
)

__all__ = [
    # Models
    "RiskTier",
    "ActorType",
    "SinkType",
    "AuditEvent",
    # Oracle
    "AuditOracle",
    "OracleContext",
    "RoutingDecision",
    "get_audit_oracle",
    # Dual Logger
    "DualAuditLogger",
    "AuditEventPayload",
    "get_dual_audit_logger",
    "log_audit_event",
    # Risk Tiers
    "get_default_risk_tier",
    "get_tier_config",
    "compare_tiers",
    "tier_meets_minimum",
    "get_highest_tier",
    "RiskTierConfig",
    # Service
    "AuditService",
    "emit_model_deployed",
    "emit_model_rollback",
    "emit_privacy_budget_exhausted",
    "emit_training_started",
    "emit_training_completed",
    "emit_training_failed",
    "emit_training_cancelled",
]
