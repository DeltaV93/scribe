"""Unit tests for audit event routing logic."""

import pytest

from src.audit.models import RiskTier
from src.audit.service import RISK_TIER_ORDER, AuditService


class TestRiskTierOrdering:
    """Test risk tier comparison logic."""

    def test_risk_tier_order_values(self):
        """Verify risk tier ordering is correct."""
        assert RISK_TIER_ORDER[RiskTier.LOW] < RISK_TIER_ORDER[RiskTier.MEDIUM]
        assert RISK_TIER_ORDER[RiskTier.MEDIUM] < RISK_TIER_ORDER[RiskTier.HIGH]
        assert RISK_TIER_ORDER[RiskTier.HIGH] < RISK_TIER_ORDER[RiskTier.CRITICAL]

    def test_critical_is_highest(self):
        """Critical should be the highest risk tier."""
        assert RISK_TIER_ORDER[RiskTier.CRITICAL] == max(RISK_TIER_ORDER.values())

    def test_low_is_lowest(self):
        """Low should be the lowest risk tier."""
        assert RISK_TIER_ORDER[RiskTier.LOW] == min(RISK_TIER_ORDER.values())


class TestPatternMatching:
    """Test event type pattern matching."""

    @pytest.mark.parametrize(
        "pattern,event_type,expected",
        [
            ("model.*", "model.deployed", True),
            ("model.*", "model.rollback", True),
            ("model.*", "training.started", False),
            ("*", "anything", True),
            ("model.deployed", "model.deployed", True),
            ("model.deployed", "model.rollback", False),
            ("*.exhausted", "privacy.budget.exhausted", True),
            ("training.*", "training.started", True),
            ("training.*", "training.completed", True),
        ],
    )
    def test_pattern_matching(self, pattern: str, event_type: str, expected: bool):
        """Test glob pattern matching for event types."""
        import fnmatch

        result = fnmatch.fnmatch(event_type, pattern)
        assert result == expected
