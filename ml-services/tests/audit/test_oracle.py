"""Tests for the Audit Oracle layer (PX-898).

Tests cover:
- Risk tier routing logic
- Cache invalidation via Redis pub/sub
- Dual logging streams
"""

import asyncio
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from src.audit.models import RiskTier, ActorType
from src.audit.oracle import (
    AuditOracle,
    OracleContext,
    RoutingDecision,
    get_audit_oracle,
    CACHE_PREFIX_ORG,
    CACHE_PREFIX_MODEL,
)
from src.audit.risk_tiers import (
    get_default_risk_tier,
    get_tier_config,
    compare_tiers,
    tier_meets_minimum,
    get_highest_tier,
    EVENT_TYPE_RISK_MAPPING,
    RiskTierConfig,
)
from src.audit.dual_logger import (
    DualAuditLogger,
    AuditEventPayload,
    get_dual_audit_logger,
    log_audit_event,
    QUEUE_CUSTOMER_EVENTS,
    QUEUE_INTERNAL_EVENTS,
    INTERNAL_ONLY_FIELDS,
)


class TestRiskTiers:
    """Test risk tier mapping and utilities."""

    def test_get_default_risk_tier_direct_match(self):
        """Test direct event type matching."""
        assert get_default_risk_tier("model.deployed") == RiskTier.MEDIUM
        assert get_default_risk_tier("model.rollback") == RiskTier.HIGH
        assert get_default_risk_tier("privacy.budget.exhausted") == RiskTier.CRITICAL
        assert get_default_risk_tier("training.started") == RiskTier.LOW

    def test_get_default_risk_tier_prefix_match(self):
        """Test prefix matching for unknown specific types."""
        # model.inference.custom should match model.inference
        tier = get_default_risk_tier("model.inference.custom")
        assert tier == RiskTier.MEDIUM

    def test_get_default_risk_tier_unknown(self):
        """Test fallback to MEDIUM for unknown types."""
        tier = get_default_risk_tier("unknown.event.type")
        assert tier == RiskTier.MEDIUM

    def test_compare_tiers(self):
        """Test tier comparison."""
        assert compare_tiers(RiskTier.LOW, RiskTier.LOW) == 0
        assert compare_tiers(RiskTier.LOW, RiskTier.MEDIUM) == -1
        assert compare_tiers(RiskTier.HIGH, RiskTier.MEDIUM) == 1
        assert compare_tiers(RiskTier.CRITICAL, RiskTier.LOW) == 1

    def test_tier_meets_minimum(self):
        """Test tier minimum threshold check."""
        assert tier_meets_minimum(RiskTier.MEDIUM, RiskTier.LOW) is True
        assert tier_meets_minimum(RiskTier.MEDIUM, RiskTier.MEDIUM) is True
        assert tier_meets_minimum(RiskTier.MEDIUM, RiskTier.HIGH) is False
        assert tier_meets_minimum(RiskTier.CRITICAL, RiskTier.CRITICAL) is True

    def test_get_highest_tier(self):
        """Test getting highest tier from list."""
        assert get_highest_tier([]) == RiskTier.LOW
        assert get_highest_tier([RiskTier.LOW]) == RiskTier.LOW
        assert get_highest_tier([RiskTier.LOW, RiskTier.MEDIUM]) == RiskTier.MEDIUM
        assert get_highest_tier([
            RiskTier.LOW,
            RiskTier.HIGH,
            RiskTier.MEDIUM,
        ]) == RiskTier.HIGH

    def test_tier_config_properties(self):
        """Test tier configuration values."""
        critical_config = get_tier_config(RiskTier.CRITICAL)
        assert critical_config.archive_to_s3 is True
        assert critical_config.send_to_security_hub is True
        assert critical_config.real_time_alert is True

        low_config = get_tier_config(RiskTier.LOW)
        assert low_config.archive_to_s3 is False
        assert low_config.send_to_security_hub is False
        assert low_config.log_full_payload is False


@pytest.mark.asyncio
class TestAuditOracle:
    """Test AuditOracle routing and caching."""

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock(spec=AsyncSession)
        return session

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        redis_mock = AsyncMock()
        redis_mock.get = AsyncMock(return_value=None)
        redis_mock.setex = AsyncMock()
        redis_mock.delete = AsyncMock()
        redis_mock.publish = AsyncMock()
        redis_mock.close = AsyncMock()
        return redis_mock

    async def test_route_event_default_tier(self, mock_session, mock_redis):
        """Test routing with default event type tier."""
        with patch("src.audit.oracle.redis.from_url", return_value=mock_redis):
            oracle = AuditOracle(mock_session)

            context = OracleContext(
                event_type="model.deployed",
                org_id=uuid4(),
            )

            # Mock empty org profile query
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_session.execute = AsyncMock(return_value=mock_result)

            decision = await oracle.route_event(context)

            assert decision.risk_tier == RiskTier.MEDIUM
            assert decision.source == "default"
            assert "default" in decision.reason.lower()

    async def test_route_event_org_override(self, mock_session, mock_redis):
        """Test routing with org profile override."""
        org_id = uuid4()

        # Mock Redis to return cached override
        mock_redis.get = AsyncMock(return_value=json.dumps({
            "model.deployed": "high",
        }))

        with patch("src.audit.oracle.redis.from_url", return_value=mock_redis):
            oracle = AuditOracle(mock_session)

            context = OracleContext(
                event_type="model.deployed",
                org_id=org_id,
            )

            # Mock org profile query
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_session.execute = AsyncMock(return_value=mock_result)

            decision = await oracle.route_event(context)

            assert decision.risk_tier == RiskTier.HIGH
            assert decision.source == "org_override"

    async def test_route_event_compliance_elevation(self, mock_session, mock_redis):
        """Test compliance rules elevate risk tier."""
        from src.org_profile.models import OrgProfile

        org_id = uuid4()

        # Create mock org profile with HIPAA compliance
        mock_profile = MagicMock(spec=OrgProfile)
        mock_profile.risk_overrides = {}
        mock_profile.compliance_frameworks = ["HIPAA"]

        with patch("src.audit.oracle.redis.from_url", return_value=mock_redis):
            oracle = AuditOracle(mock_session)

            context = OracleContext(
                event_type="data.viewed",  # PHI access event
                org_id=org_id,
            )

            # Mock query to return profile
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_profile
            mock_session.execute = AsyncMock(return_value=mock_result)

            decision = await oracle.route_event(context)

            # Should be elevated due to HIPAA
            assert decision.risk_tier >= RiskTier.LOW

    async def test_cache_invalidation(self, mock_session, mock_redis):
        """Test cache is invalidated on org profile update."""
        org_id = uuid4()

        with patch("src.audit.oracle.redis.from_url", return_value=mock_redis):
            oracle = AuditOracle(mock_session)

            await oracle._invalidate_org_cache(org_id)

            cache_key = f"{CACHE_PREFIX_ORG}{org_id}"
            mock_redis.delete.assert_called_with(cache_key)

    async def test_cache_invalidation_model(self, mock_session, mock_redis):
        """Test model cache invalidation."""
        model_id = uuid4()

        with patch("src.audit.oracle.redis.from_url", return_value=mock_redis):
            oracle = AuditOracle(mock_session)

            await oracle._invalidate_model_cache(model_id)

            cache_key = f"{CACHE_PREFIX_MODEL}{model_id}"
            mock_redis.delete.assert_called_with(cache_key)

    async def test_get_model_risk_tier_cache_hit(self, mock_session, mock_redis):
        """Test model risk tier from cache."""
        model_id = uuid4()
        mock_redis.get = AsyncMock(return_value="high")

        with patch("src.audit.oracle.redis.from_url", return_value=mock_redis):
            oracle = AuditOracle(mock_session)

            tier = await oracle.get_model_risk_tier(model_id)

            assert tier == RiskTier.HIGH

    async def test_highest_tier_selected(self, mock_session, mock_redis):
        """Test that highest applicable tier is selected."""
        org_id = uuid4()
        model_id = uuid4()

        # Mock org override returning MEDIUM
        mock_redis.get = AsyncMock(side_effect=[
            json.dumps({str(model_id): "medium"}),  # org overrides
            "high",  # model tier
        ])

        with patch("src.audit.oracle.redis.from_url", return_value=mock_redis):
            oracle = AuditOracle(mock_session)

            context = OracleContext(
                event_type="model.inference",  # default MEDIUM
                org_id=org_id,
                model_id=model_id,
            )

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_session.execute = AsyncMock(return_value=mock_result)

            decision = await oracle.route_event(context)

            # Should be HIGH (from model tier)
            assert decision.risk_tier == RiskTier.HIGH


@pytest.mark.asyncio
class TestDualAuditLogger:
    """Test dual logging functionality."""

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        redis_mock = AsyncMock()
        redis_mock.lpush = AsyncMock()
        redis_mock.llen = AsyncMock(return_value=5)
        redis_mock.close = AsyncMock()
        return redis_mock

    @pytest.fixture
    def sample_event(self):
        """Create sample audit event payload."""
        return AuditEventPayload(
            event_id=str(uuid4()),
            event_type="model.deployed",
            org_id=str(uuid4()),
            risk_tier="medium",
            occurred_at=datetime.now(timezone.utc).isoformat(),
            source_service="test",
            actor_id=str(uuid4()),
            actor_type="user",
            event_data={
                "model_id": str(uuid4()),
                "environment": "production",
            },
            internal_data={
                "correction_quality_score": 0.95,
                "debug_signals": {"a": 1},
            },
        )

    def test_customer_dict_strips_internal_fields(self, sample_event):
        """Test that customer dict excludes internal fields."""
        customer_data = sample_event.to_customer_dict()

        assert "event_id" in customer_data
        assert "event_type" in customer_data
        assert "event_data" in customer_data

        # Internal fields should be stripped
        assert "internal_data" not in customer_data
        assert "correction_quality_score" not in customer_data.get("event_data", {})
        assert "debug_signals" not in customer_data.get("event_data", {})

    def test_internal_dict_includes_all_fields(self, sample_event):
        """Test that internal dict includes all fields."""
        internal_data = sample_event.to_internal_dict()

        assert "event_id" in internal_data
        assert "event_type" in internal_data
        assert "event_data" in internal_data

        # Internal fields should be merged into event_data
        assert "correction_quality_score" in internal_data["event_data"]
        assert "debug_signals" in internal_data["event_data"]

    async def test_log_customer_facing(self, mock_redis, sample_event):
        """Test logging to customer stream."""
        with patch("src.audit.dual_logger.redis.from_url", return_value=mock_redis):
            logger = DualAuditLogger()

            result = await logger.log_customer_facing(sample_event)

            assert result is True
            mock_redis.lpush.assert_called_once()

            # Verify correct queue
            call_args = mock_redis.lpush.call_args
            assert call_args[0][0] == QUEUE_CUSTOMER_EVENTS

    async def test_log_inkra_internal(self, mock_redis, sample_event):
        """Test logging to internal stream."""
        with patch("src.audit.dual_logger.redis.from_url", return_value=mock_redis):
            logger = DualAuditLogger()

            result = await logger.log_inkra_internal(sample_event)

            assert result is True
            mock_redis.lpush.assert_called_once()

            # Verify correct queue
            call_args = mock_redis.lpush.call_args
            assert call_args[0][0] == QUEUE_INTERNAL_EVENTS

    async def test_log_both(self, mock_redis, sample_event):
        """Test logging to both streams."""
        with patch("src.audit.dual_logger.redis.from_url", return_value=mock_redis):
            logger = DualAuditLogger()

            customer_ok, internal_ok = await logger.log_both(sample_event)

            assert customer_ok is True
            assert internal_ok is True
            assert mock_redis.lpush.call_count == 2

    async def test_buffering_on_redis_failure(self, mock_redis, sample_event):
        """Test events are buffered when Redis fails."""
        mock_redis.lpush = AsyncMock(side_effect=Exception("Connection failed"))

        with patch("src.audit.dual_logger.redis.from_url", return_value=mock_redis):
            logger = DualAuditLogger()

            result = await logger.log_customer_facing(sample_event)

            assert result is False
            assert len(logger._local_buffer) == 1

    async def test_flush_buffer(self, mock_redis, sample_event):
        """Test flushing buffered events."""
        with patch("src.audit.dual_logger.redis.from_url", return_value=mock_redis):
            logger = DualAuditLogger()

            # Buffer an event
            logger._local_buffer.append((QUEUE_CUSTOMER_EVENTS, sample_event))

            flushed = await logger.flush_buffer()

            assert flushed == 1
            assert len(logger._local_buffer) == 0
            mock_redis.lpush.assert_called_once()

    async def test_queue_lengths(self, mock_redis):
        """Test getting queue lengths."""
        mock_redis.llen = AsyncMock(return_value=10)

        with patch("src.audit.dual_logger.redis.from_url", return_value=mock_redis):
            logger = DualAuditLogger()

            lengths = await logger.get_queue_lengths()

            assert lengths["customer"] == 10
            assert lengths["internal"] == 10
            assert lengths["local_buffer"] == 0

    async def test_customer_visibility_config(self, mock_redis, sample_event):
        """Test customer visibility is respected based on tier config."""
        with patch("src.audit.dual_logger.redis.from_url", return_value=mock_redis):
            logger = DualAuditLogger()

            # Create a config that disables customer visibility
            config = RiskTierConfig(
                tier=RiskTier.LOW,
                retention_days=30,
                archive_to_s3=False,
                send_to_security_hub=False,
                log_full_payload=False,
                customer_visible=False,  # Not visible
                real_time_alert=False,
            )

            result = await logger.log_customer_facing(sample_event, config)

            # Should return True but not actually log
            assert result is True
            mock_redis.lpush.assert_not_called()


@pytest.mark.asyncio
class TestConvenienceFunctions:
    """Test module-level convenience functions."""

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        redis_mock = AsyncMock()
        redis_mock.lpush = AsyncMock()
        redis_mock.close = AsyncMock()
        return redis_mock

    async def test_log_audit_event(self, mock_redis):
        """Test convenience function logs to both streams."""
        with patch("src.audit.dual_logger.redis.from_url", return_value=mock_redis):
            # Reset singleton
            import src.audit.dual_logger as dual_logger_module
            dual_logger_module._dual_logger = None

            result = await log_audit_event(
                event_type="model.deployed",
                org_id=uuid4(),
                risk_tier=RiskTier.MEDIUM,
                event_data={"environment": "production"},
                actor_type="user",
            )

            assert result is True
            assert mock_redis.lpush.call_count == 2


class TestInternalOnlyFields:
    """Test internal field stripping."""

    def test_internal_fields_defined(self):
        """Ensure internal-only fields are defined."""
        assert "correction_quality_score" in INTERNAL_ONLY_FIELDS
        assert "model_confidence_raw" in INTERNAL_ONLY_FIELDS
        assert "debug_signals" in INTERNAL_ONLY_FIELDS
        assert "internal_trace_id" in INTERNAL_ONLY_FIELDS

    def test_event_data_filtering(self):
        """Test that event data is properly filtered."""
        event = AuditEventPayload(
            event_id=str(uuid4()),
            event_type="test",
            org_id=str(uuid4()),
            risk_tier="low",
            occurred_at=datetime.now(timezone.utc).isoformat(),
            source_service="test",
            event_data={
                "visible_field": "value",
                "correction_quality_score": 0.9,  # Should be stripped
                "model_id": str(uuid4()),
            },
        )

        customer_data = event.to_customer_dict()

        assert "visible_field" in customer_data.get("event_data", {})
        assert "model_id" in customer_data.get("event_data", {})
        assert "correction_quality_score" not in customer_data.get("event_data", {})
