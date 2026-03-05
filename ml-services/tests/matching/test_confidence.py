"""Unit tests for confidence scoring (PX-887 Phase 1)."""

import pytest
from uuid import uuid4

from src.matching.confidence import (
    ConfidenceScorer,
    ScoringConfig,
    ThresholdTier,
    DEFAULT_TIERS,
)
from src.matching.types import Signal, ConfidenceLevel


class TestConfidenceScorer:
    """Tests for the ConfidenceScorer class."""

    @pytest.fixture
    def scorer(self) -> ConfidenceScorer:
        """Create a confidence scorer instance."""
        return ConfidenceScorer()

    @pytest.fixture
    def sample_signals(self) -> list[Signal]:
        """Create sample signals for testing."""
        return [
            Signal(
                type="keyword",
                value="client",
                normalized_value="client",
                weight=1.5,
                position=0,
            ),
            Signal(
                type="keyword",
                value="intake",
                normalized_value="intake",
                weight=1.3,
                position=10,
            ),
            Signal(
                type="pattern",
                value="case #123",
                normalized_value="case #123",
                weight=1.0,
                position=20,
            ),
        ]


class TestConfidenceCalculation(TestConfidenceScorer):
    """Tests for confidence calculation."""

    def test_calculate_confidence_empty_signals(self, scorer: ConfidenceScorer):
        """Test that empty signals return 0 confidence."""
        confidence = scorer.calculate_confidence([])
        assert confidence == 0.0

    def test_calculate_confidence_single_signal(self, scorer: ConfidenceScorer):
        """Test confidence with a single signal."""
        signals = [
            Signal(
                type="keyword",
                value="client",
                normalized_value="client",
                weight=1.5,
                position=0,
            )
        ]
        confidence = scorer.calculate_confidence(signals)

        # Single signal is below min_signals_required, should be low
        assert confidence <= 0.3

    def test_calculate_confidence_multiple_signals(
        self,
        scorer: ConfidenceScorer,
        sample_signals: list[Signal],
    ):
        """Test confidence with multiple signals."""
        confidence = scorer.calculate_confidence(sample_signals)

        # Should produce a reasonable confidence score
        assert 0.0 <= confidence <= 1.0
        assert confidence > 0.3  # Above minimum with 3 signals

    def test_confidence_increases_with_signals(self, scorer: ConfidenceScorer):
        """Test that confidence increases with more signals of different types."""
        # Use just keywords for baseline
        signals_1 = [
            Signal(
                type="keyword",
                value="client",
                normalized_value="client",
                weight=1.0,
                position=0,
            ),
            Signal(
                type="keyword",
                value="intake",
                normalized_value="intake",
                weight=1.0,
                position=10,
            ),
        ]
        # Add patterns for higher score (diverse signal types)
        signals_2 = signals_1 + [
            Signal(
                type="pattern",
                value="case #123",
                normalized_value="case #123",
                weight=1.0,
                position=20,
            ),
            Signal(
                type="meeting_signal",
                value="intake_meeting",
                normalized_value="intake_meeting",
                weight=1.0,
                position=30,
            ),
        ]

        conf_1 = scorer.calculate_confidence(signals_1)
        conf_2 = scorer.calculate_confidence(signals_2)

        # Diverse signal types contribute more
        assert conf_2 > conf_1

    def test_confidence_respects_weights(self, scorer: ConfidenceScorer):
        """Test that weighted signals produce higher confidence."""
        # Use lower weights that don't immediately cap
        low_weight_signals = [
            Signal(
                type="keyword",
                value="word1",
                normalized_value="word1",
                weight=0.1,
                position=0,
            ),
            Signal(
                type="keyword",
                value="word2",
                normalized_value="word2",
                weight=0.1,
                position=10,
            ),
            Signal(
                type="pattern",
                value="pattern1",
                normalized_value="pattern1",
                weight=0.1,
                position=20,
            ),
        ]
        # Higher weights should produce higher confidence
        high_weight_signals = [
            Signal(
                type="keyword",
                value="word1",
                normalized_value="word1",
                weight=0.5,
                position=0,
            ),
            Signal(
                type="keyword",
                value="word2",
                normalized_value="word2",
                weight=0.5,
                position=10,
            ),
            Signal(
                type="pattern",
                value="pattern1",
                normalized_value="pattern1",
                weight=0.5,
                position=20,
            ),
        ]

        conf_low = scorer.calculate_confidence(low_weight_signals)
        conf_high = scorer.calculate_confidence(high_weight_signals)

        assert conf_high > conf_low

    def test_confidence_capped_at_1(self, scorer: ConfidenceScorer):
        """Test that confidence never exceeds 1.0."""
        many_signals = [
            Signal(
                type="keyword",
                value="client",
                normalized_value="client",
                weight=5.0,
                position=i * 10,
            )
            for i in range(100)
        ]

        confidence = scorer.calculate_confidence(many_signals)
        assert confidence <= 1.0

    def test_spanish_signal_bonus(self, scorer: ConfidenceScorer):
        """Test that Spanish signals add a bonus."""
        english_signals = [
            Signal(
                type="keyword",
                value="client",
                normalized_value="client",
                weight=1.0,
                position=0,
                language="en",
            ),
            Signal(
                type="keyword",
                value="intake",
                normalized_value="intake",
                weight=1.0,
                position=10,
                language="en",
            ),
        ]
        mixed_signals = [
            Signal(
                type="keyword",
                value="client",
                normalized_value="client",
                weight=1.0,
                position=0,
                language="en",
            ),
            Signal(
                type="keyword",
                value="cliente",
                normalized_value="cliente",
                weight=1.0,
                position=10,
                language="es",
            ),
        ]

        conf_english = scorer.calculate_confidence(english_signals)
        conf_mixed = scorer.calculate_confidence(mixed_signals)

        # Mixed should have Spanish bonus
        assert conf_mixed > conf_english


class TestThresholdTiers(TestConfidenceScorer):
    """Tests for threshold tier functionality."""

    def test_standard_tier_values(self):
        """Test standard tier threshold values."""
        tier = ThresholdTier.standard()

        assert tier.risk_tier == "low"
        assert tier.auto_apply_threshold == 0.90
        assert tier.suggest_threshold == 0.60
        assert tier.min_threshold == 0.40

    def test_elevated_tier_values(self):
        """Test elevated tier threshold values."""
        tier = ThresholdTier.elevated()

        assert tier.risk_tier == "medium"
        assert tier.auto_apply_threshold == 0.95
        assert tier.suggest_threshold == 0.70
        assert tier.min_threshold == 0.50

    def test_strict_tier_values(self):
        """Test strict tier threshold values."""
        tier = ThresholdTier.strict()

        assert tier.risk_tier == "high"
        assert tier.auto_apply_threshold == 0.98
        assert tier.suggest_threshold == 0.80
        assert tier.min_threshold == 0.60

    def test_default_tiers_exist(self):
        """Test that default tiers are defined."""
        assert "low" in DEFAULT_TIERS
        assert "medium" in DEFAULT_TIERS
        assert "high" in DEFAULT_TIERS
        assert "critical" in DEFAULT_TIERS


class TestConfidenceLevels(TestConfidenceScorer):
    """Tests for confidence level determination."""

    def test_high_confidence_level(self, scorer: ConfidenceScorer):
        """Test HIGH confidence level determination."""
        level = scorer.get_confidence_level(0.95)
        assert level == ConfidenceLevel.HIGH

    def test_medium_confidence_level(self, scorer: ConfidenceScorer):
        """Test MEDIUM confidence level determination."""
        level = scorer.get_confidence_level(0.75)
        assert level == ConfidenceLevel.MEDIUM

    def test_low_confidence_level(self, scorer: ConfidenceScorer):
        """Test LOW confidence level determination."""
        level = scorer.get_confidence_level(0.50)
        assert level == ConfidenceLevel.LOW

    def test_insufficient_confidence_level(self, scorer: ConfidenceScorer):
        """Test INSUFFICIENT confidence level determination."""
        level = scorer.get_confidence_level(0.30)
        assert level == ConfidenceLevel.INSUFFICIENT

    def test_confidence_level_with_tier(self, scorer: ConfidenceScorer):
        """Test confidence level with custom tier thresholds."""
        tier = ThresholdTier.strict()

        # 0.95 would be HIGH with standard tier, but not with strict
        level = scorer.get_confidence_level(0.95, tier)
        assert level == ConfidenceLevel.MEDIUM  # Below 0.98 strict auto-apply

    def test_confidence_level_boundary_values(self, scorer: ConfidenceScorer):
        """Test confidence level at boundary values."""
        # Exactly at boundary
        assert scorer.get_confidence_level(0.90) == ConfidenceLevel.HIGH
        assert scorer.get_confidence_level(0.60) == ConfidenceLevel.MEDIUM
        assert scorer.get_confidence_level(0.40) == ConfidenceLevel.LOW

        # Just below boundary
        assert scorer.get_confidence_level(0.899) == ConfidenceLevel.MEDIUM
        assert scorer.get_confidence_level(0.599) == ConfidenceLevel.LOW
        assert scorer.get_confidence_level(0.399) == ConfidenceLevel.INSUFFICIENT


class TestThresholdTierLookup(TestConfidenceScorer):
    """Tests for threshold tier lookup."""

    def test_get_threshold_tier_default(self, scorer: ConfidenceScorer):
        """Test default tier lookup."""
        tier = scorer.get_threshold_tier()

        assert tier.risk_tier == "low"

    def test_get_threshold_tier_with_override(self, scorer: ConfidenceScorer):
        """Test tier lookup with risk override."""
        model_id = uuid4()
        risk_overrides = {str(model_id): "high"}

        tier = scorer.get_threshold_tier(
            model_id=model_id,
            risk_overrides=risk_overrides,
        )

        assert tier.risk_tier == "high"

    def test_get_threshold_tier_unknown_risk(self, scorer: ConfidenceScorer):
        """Test tier lookup with unknown risk level falls back to standard."""
        model_id = uuid4()
        risk_overrides = {str(model_id): "unknown_tier"}

        tier = scorer.get_threshold_tier(
            model_id=model_id,
            risk_overrides=risk_overrides,
        )

        # Should fall back to standard
        assert tier.auto_apply_threshold == 0.90


class TestScoreMatches(TestConfidenceScorer):
    """Tests for match scoring."""

    def test_score_matches_basic(
        self,
        scorer: ConfidenceScorer,
        sample_signals: list[Signal],
    ):
        """Test basic match scoring."""
        form_id = uuid4()
        confidence, matches = scorer.score_matches(
            signals=sample_signals,
            form_id=form_id,
            form_name="Test Form",
        )

        assert 0.0 <= confidence <= 1.0
        assert len(matches) == len(sample_signals)

    def test_score_matches_primary_keywords(self, scorer: ConfidenceScorer):
        """Test that primary keywords get higher score contribution."""
        form_id = uuid4()
        signals = [
            Signal(
                type="keyword",
                value="client",
                normalized_value="client",
                weight=1.0,
                position=0,
            ),
            Signal(
                type="keyword",
                value="other",
                normalized_value="other",
                weight=1.0,
                position=10,
            ),
        ]

        confidence, matches = scorer.score_matches(
            signals=signals,
            form_id=form_id,
            form_name="Test Form",
            primary_keywords=["client"],
        )

        # Find the client match
        client_match = next(m for m in matches if m.signal.normalized_value == "client")
        other_match = next(m for m in matches if m.signal.normalized_value == "other")

        assert client_match.is_primary is True
        assert other_match.is_primary is False
        assert client_match.score_contribution > other_match.score_contribution


class TestDiminishingReturns(TestConfidenceScorer):
    """Tests for diminishing returns on repeated signals."""

    def test_diminishing_returns_applied(self, scorer: ConfidenceScorer):
        """Test that diminishing returns are applied to repeated signals."""
        # All same signal with high weight
        signals = [
            Signal(
                type="keyword",
                value="client",
                normalized_value="client",
                weight=2.0,
                position=i * 10,
            )
            for i in range(10)
        ]

        confidence = scorer.calculate_confidence(signals)

        # Without diminishing returns, this would max out contribution
        # With diminishing returns, it should be less
        assert confidence < 1.0

    def test_diverse_signals_score_higher(self, scorer: ConfidenceScorer):
        """Test that diverse signal types score higher than repeated."""
        # All keyword signals
        same_type_signals = [
            Signal(
                type="keyword",
                value="word",
                normalized_value="word",
                weight=1.0,
                position=i * 10,
            )
            for i in range(3)
        ]

        # Mixed signal types
        diverse_signals = [
            Signal(
                type="keyword",
                value="client",
                normalized_value="client",
                weight=1.0,
                position=0,
            ),
            Signal(
                type="pattern",
                value="case #123",
                normalized_value="case #123",
                weight=1.0,
                position=10,
            ),
            Signal(
                type="meeting_signal",
                value="intake",
                normalized_value="intake",
                weight=1.0,
                position=20,
            ),
        ]

        conf_same = scorer.calculate_confidence(same_type_signals)
        conf_diverse = scorer.calculate_confidence(diverse_signals)

        # Diverse should score higher due to multiple type contributions
        assert conf_diverse > conf_same


class TestCustomConfiguration(TestConfidenceScorer):
    """Tests for custom scoring configuration."""

    def test_custom_base_weights(self):
        """Test scorer with custom base weights."""
        config = ScoringConfig(
            keyword_base_weight=2.0,
            pattern_base_weight=3.0,
        )
        scorer = ConfidenceScorer(config=config)

        signals = [
            Signal(
                type="keyword",
                value="test",
                normalized_value="test",
                weight=1.0,
                position=0,
            ),
            Signal(
                type="pattern",
                value="pattern",
                normalized_value="pattern",
                weight=1.0,
                position=10,
            ),
        ]

        confidence = scorer.calculate_confidence(signals)
        assert confidence > 0

    def test_custom_min_signals(self):
        """Test scorer with custom minimum signals requirement."""
        config = ScoringConfig(min_signals_required=5)
        scorer = ConfidenceScorer(config=config)

        signals = [
            Signal(
                type="keyword",
                value="test",
                normalized_value="test",
                weight=1.0,
                position=i * 10,
            )
            for i in range(3)
        ]

        confidence = scorer.calculate_confidence(signals)

        # Below min_signals_required, should be capped
        assert confidence <= 0.3

    def test_custom_threshold_tiers(self):
        """Test scorer with custom threshold tiers."""
        custom_tier = ThresholdTier(
            risk_tier="custom",
            auto_apply_threshold=0.99,
            suggest_threshold=0.85,
            min_threshold=0.70,
        )
        scorer = ConfidenceScorer(custom_tiers={"custom": custom_tier})

        # Access custom tier
        tier = scorer.tiers.get("custom")
        assert tier is not None
        assert tier.auto_apply_threshold == 0.99
