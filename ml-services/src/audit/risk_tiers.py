"""Risk tier definitions and event type mapping for audit events.

This module defines the risk classification system used for audit event routing
and retention policies as specified in PX-898.
"""

from enum import Enum
from typing import Optional

from src.audit.models import RiskTier


# Event type to default risk tier mapping
# These are baseline defaults that can be overridden per-org or per-model
EVENT_TYPE_RISK_MAPPING: dict[str, RiskTier] = {
    # Model lifecycle - CRITICAL/HIGH events require full audit trail
    "model.deployed": RiskTier.MEDIUM,
    "model.rollback": RiskTier.HIGH,
    "model.deleted": RiskTier.HIGH,
    "model.created": RiskTier.LOW,
    "model.updated": RiskTier.LOW,

    # Model inference - risk depends on model tier (handled by oracle)
    "model.inference": RiskTier.MEDIUM,
    "model.inference.phi_accessed": RiskTier.CRITICAL,

    # Training events
    "training.started": RiskTier.LOW,
    "training.completed": RiskTier.LOW,
    "training.failed": RiskTier.MEDIUM,
    "training.cancelled": RiskTier.LOW,

    # Privacy budget events
    "privacy.budget.exhausted": RiskTier.CRITICAL,
    "privacy.budget.warning": RiskTier.HIGH,
    "privacy.budget.consumed": RiskTier.LOW,
    "privacy.synthesis.completed": RiskTier.MEDIUM,
    "privacy.synthesis.failed": RiskTier.HIGH,

    # Data access events
    "data.exported": RiskTier.HIGH,
    "data.viewed": RiskTier.LOW,
    "data.modified": RiskTier.MEDIUM,
    "data.deleted": RiskTier.HIGH,

    # User actions
    "user.correction.submitted": RiskTier.LOW,
    "user.override": RiskTier.MEDIUM,
    "user.approval": RiskTier.LOW,

    # Form matching
    "form.matched": RiskTier.LOW,
    "form.autodetected": RiskTier.LOW,
    "form.segment.detected": RiskTier.LOW,

    # System events
    "system.config.changed": RiskTier.MEDIUM,
    "system.error": RiskTier.MEDIUM,
    "system.security.alert": RiskTier.CRITICAL,

    # Authentication/Authorization
    "auth.login": RiskTier.LOW,
    "auth.logout": RiskTier.LOW,
    "auth.failed": RiskTier.MEDIUM,
    "auth.permission.denied": RiskTier.MEDIUM,
    "auth.permission.granted": RiskTier.LOW,
}


# Risk tier configurations define retention, routing, and logging behavior
class RiskTierConfig:
    """Configuration for a specific risk tier."""

    def __init__(
        self,
        tier: RiskTier,
        retention_days: int,
        archive_to_s3: bool,
        send_to_security_hub: bool,
        log_full_payload: bool,
        customer_visible: bool,
        real_time_alert: bool,
    ):
        self.tier = tier
        self.retention_days = retention_days
        self.archive_to_s3 = archive_to_s3
        self.send_to_security_hub = send_to_security_hub
        self.log_full_payload = log_full_payload
        self.customer_visible = customer_visible
        self.real_time_alert = real_time_alert


# Default tier configurations
RISK_TIER_CONFIGS: dict[RiskTier, RiskTierConfig] = {
    RiskTier.CRITICAL: RiskTierConfig(
        tier=RiskTier.CRITICAL,
        retention_days=2555,  # 7 years (HIPAA requirement)
        archive_to_s3=True,
        send_to_security_hub=True,
        log_full_payload=True,
        customer_visible=True,
        real_time_alert=True,
    ),
    RiskTier.HIGH: RiskTierConfig(
        tier=RiskTier.HIGH,
        retention_days=2555,  # 7 years
        archive_to_s3=True,
        send_to_security_hub=True,
        log_full_payload=True,
        customer_visible=True,
        real_time_alert=False,
    ),
    RiskTier.MEDIUM: RiskTierConfig(
        tier=RiskTier.MEDIUM,
        retention_days=2190,  # 6 years
        archive_to_s3=True,
        send_to_security_hub=False,
        log_full_payload=True,
        customer_visible=True,
        real_time_alert=False,
    ),
    RiskTier.LOW: RiskTierConfig(
        tier=RiskTier.LOW,
        retention_days=365,  # 1 year
        archive_to_s3=False,
        send_to_security_hub=False,
        log_full_payload=False,  # Basic metrics only for LOW tier
        customer_visible=True,
        real_time_alert=False,
    ),
}


def get_default_risk_tier(event_type: str) -> RiskTier:
    """
    Get the default risk tier for an event type.

    Uses glob-style matching for event type patterns.
    Falls back to MEDIUM for unknown event types.

    Args:
        event_type: The event type string (e.g., "model.deployed")

    Returns:
        The default risk tier for this event type
    """
    # Direct match first
    if event_type in EVENT_TYPE_RISK_MAPPING:
        return EVENT_TYPE_RISK_MAPPING[event_type]

    # Try prefix matching (e.g., "model.inference.custom" -> "model.inference")
    parts = event_type.split(".")
    for i in range(len(parts) - 1, 0, -1):
        prefix = ".".join(parts[:i])
        if prefix in EVENT_TYPE_RISK_MAPPING:
            return EVENT_TYPE_RISK_MAPPING[prefix]

    # Default to MEDIUM for unknown event types
    return RiskTier.MEDIUM


def get_tier_config(tier: RiskTier) -> RiskTierConfig:
    """
    Get the configuration for a risk tier.

    Args:
        tier: The risk tier

    Returns:
        Configuration for the tier
    """
    return RISK_TIER_CONFIGS[tier]


def compare_tiers(tier1: RiskTier, tier2: RiskTier) -> int:
    """
    Compare two risk tiers.

    Args:
        tier1: First tier
        tier2: Second tier

    Returns:
        -1 if tier1 < tier2, 0 if equal, 1 if tier1 > tier2
    """
    order = {
        RiskTier.LOW: 0,
        RiskTier.MEDIUM: 1,
        RiskTier.HIGH: 2,
        RiskTier.CRITICAL: 3,
    }
    diff = order[tier1] - order[tier2]
    if diff < 0:
        return -1
    elif diff > 0:
        return 1
    return 0


def tier_meets_minimum(tier: RiskTier, minimum: RiskTier) -> bool:
    """
    Check if a tier meets or exceeds a minimum threshold.

    Args:
        tier: The tier to check
        minimum: The minimum required tier

    Returns:
        True if tier >= minimum
    """
    return compare_tiers(tier, minimum) >= 0


def get_highest_tier(tiers: list[RiskTier]) -> RiskTier:
    """
    Get the highest risk tier from a list.

    Args:
        tiers: List of risk tiers

    Returns:
        The highest tier, or LOW if list is empty
    """
    if not tiers:
        return RiskTier.LOW

    order = {
        RiskTier.LOW: 0,
        RiskTier.MEDIUM: 1,
        RiskTier.HIGH: 2,
        RiskTier.CRITICAL: 3,
    }

    return max(tiers, key=lambda t: order[t])
