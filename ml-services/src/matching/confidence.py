"""Confidence scoring for form matching (PX-887 Phase 1).

Provides confidence calculation based on detected signals,
with support for PX-896 accuracy tier thresholds.
"""

import time
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

import structlog

from src.matching.types import (
    ConfidenceLevel,
    Signal,
    Match,
    MatchingContext,
)


logger = structlog.get_logger()


@dataclass
class ScoringConfig:
    """Configuration for confidence scoring."""

    # Base weights for signal types
    keyword_base_weight: float = 1.0
    pattern_base_weight: float = 1.5  # Patterns are more specific
    meeting_signal_base_weight: float = 2.0  # Meeting signals are strong indicators

    # Multipliers
    primary_signal_multiplier: float = 1.5  # For primary form signals
    spanish_signal_bonus: float = 0.1  # Bonus for Spanish signals (indicates LEP support)

    # Diminishing returns for repeated signals
    repetition_decay: float = 0.8  # Each repeat worth 80% of previous

    # Maximum contribution from any single signal type
    max_keyword_contribution: float = 0.5
    max_pattern_contribution: float = 0.3
    max_meeting_signal_contribution: float = 0.3

    # Minimum signals required for valid score
    min_signals_required: int = 2


@dataclass
class ThresholdTier:
    """Threshold configuration for a risk tier.

    Based on PX-896 accuracy tier research:
    - LOW tier forms: Standard thresholds
    - MEDIUM tier forms: Elevated thresholds
    - HIGH/CRITICAL tier forms: Strict thresholds
    """

    risk_tier: str
    auto_apply_threshold: float  # Confidence needed for auto-apply
    suggest_threshold: float  # Confidence needed for suggestion
    min_threshold: float  # Minimum to show at all

    @classmethod
    def standard(cls) -> "ThresholdTier":
        """Standard thresholds for LOW risk forms."""
        return cls(
            risk_tier="low",
            auto_apply_threshold=0.90,
            suggest_threshold=0.60,
            min_threshold=0.40,
        )

    @classmethod
    def elevated(cls) -> "ThresholdTier":
        """Elevated thresholds for MEDIUM risk forms."""
        return cls(
            risk_tier="medium",
            auto_apply_threshold=0.95,
            suggest_threshold=0.70,
            min_threshold=0.50,
        )

    @classmethod
    def strict(cls) -> "ThresholdTier":
        """Strict thresholds for HIGH/CRITICAL risk forms."""
        return cls(
            risk_tier="high",
            auto_apply_threshold=0.98,
            suggest_threshold=0.80,
            min_threshold=0.60,
        )


# Default tier thresholds
DEFAULT_TIERS = {
    "low": ThresholdTier.standard(),
    "medium": ThresholdTier.elevated(),
    "high": ThresholdTier.strict(),
    "critical": ThresholdTier.strict(),
}


class ConfidenceScorer:
    """Calculates confidence scores for form matching.

    Uses a weighted scoring algorithm that considers:
    - Signal type (keyword, pattern, meeting_signal)
    - Signal weight from configuration
    - Diminishing returns for repeated signals
    - Risk tier thresholds per PX-896
    """

    def __init__(
        self,
        config: Optional[ScoringConfig] = None,
        custom_tiers: Optional[dict[str, ThresholdTier]] = None,
    ):
        """Initialize the confidence scorer.

        Args:
            config: Scoring configuration
            custom_tiers: Custom threshold tiers by risk level
        """
        self.config = config or ScoringConfig()
        self.tiers = custom_tiers or DEFAULT_TIERS.copy()

    def calculate_confidence(
        self,
        signals: list[Signal],
        context: Optional[MatchingContext] = None,
    ) -> float:
        """Calculate confidence score from detected signals.

        The algorithm:
        1. Group signals by type
        2. Apply base weights per type
        3. Apply diminishing returns for repetitions
        4. Cap contributions per type
        5. Normalize to 0.0-1.0 range

        Args:
            signals: List of detected signals
            context: Optional matching context for additional weighting

        Returns:
            Confidence score between 0.0 and 1.0
        """
        if not signals:
            return 0.0

        if len(signals) < self.config.min_signals_required:
            # Not enough signals for a confident match
            return min(0.3, len(signals) * 0.1)

        # Group signals by type
        keyword_signals = [s for s in signals if s.type == "keyword"]
        pattern_signals = [s for s in signals if s.type == "pattern"]
        meeting_signals = [s for s in signals if s.type == "meeting_signal"]

        # Calculate contributions
        keyword_contribution = self._calculate_type_contribution(
            keyword_signals,
            self.config.keyword_base_weight,
            self.config.max_keyword_contribution,
        )

        pattern_contribution = self._calculate_type_contribution(
            pattern_signals,
            self.config.pattern_base_weight,
            self.config.max_pattern_contribution,
        )

        meeting_contribution = self._calculate_type_contribution(
            meeting_signals,
            self.config.meeting_signal_base_weight,
            self.config.max_meeting_signal_contribution,
        )

        # Sum contributions
        raw_score = keyword_contribution + pattern_contribution + meeting_contribution

        # Apply Spanish signal bonus
        spanish_signals = [s for s in signals if s.language == "es"]
        if spanish_signals:
            raw_score += self.config.spanish_signal_bonus

        # Normalize to 0.0-1.0
        confidence = min(1.0, max(0.0, raw_score))

        logger.debug(
            "Calculated confidence score",
            confidence=confidence,
            keyword_contribution=keyword_contribution,
            pattern_contribution=pattern_contribution,
            meeting_contribution=meeting_contribution,
            total_signals=len(signals),
            spanish_signals=len(spanish_signals),
        )

        return confidence

    def _calculate_type_contribution(
        self,
        signals: list[Signal],
        base_weight: float,
        max_contribution: float,
    ) -> float:
        """Calculate contribution from a signal type with diminishing returns.

        Args:
            signals: Signals of this type
            base_weight: Base weight for this type
            max_contribution: Maximum contribution allowed

        Returns:
            Contribution score (capped at max_contribution)
        """
        if not signals:
            return 0.0

        # Sort by weight descending
        sorted_signals = sorted(signals, key=lambda s: s.weight, reverse=True)

        contribution = 0.0
        for i, signal in enumerate(sorted_signals):
            # Apply diminishing returns
            decay = self.config.repetition_decay**i
            signal_contribution = signal.weight * base_weight * decay
            contribution += signal_contribution

        # Cap at maximum
        return min(contribution, max_contribution)

    def get_threshold_tier(
        self,
        org_id: Optional[UUID] = None,
        model_id: Optional[UUID] = None,
        risk_overrides: Optional[dict[str, str]] = None,
    ) -> ThresholdTier:
        """Get the threshold tier for a model/org combination.

        Uses PX-896 accuracy tier research to determine appropriate
        thresholds based on form risk level.

        Args:
            org_id: Organization ID for custom overrides
            model_id: Model ID to check risk tier
            risk_overrides: Optional risk tier overrides from org profile

        Returns:
            ThresholdTier with appropriate thresholds
        """
        # Default to standard tier
        tier_key = "low"

        # Check for model-specific override
        if model_id and risk_overrides:
            model_key = str(model_id)
            if model_key in risk_overrides:
                tier_key = risk_overrides[model_key].lower()

        # Return appropriate tier
        if tier_key in self.tiers:
            return self.tiers[tier_key]

        return ThresholdTier.standard()

    def get_confidence_level(
        self,
        confidence: float,
        tier: Optional[ThresholdTier] = None,
    ) -> ConfidenceLevel:
        """Convert a confidence score to a confidence level.

        Uses tier-specific thresholds if provided.

        Args:
            confidence: Confidence score (0.0-1.0)
            tier: Optional threshold tier for custom thresholds

        Returns:
            ConfidenceLevel enum value
        """
        if tier:
            if confidence >= tier.auto_apply_threshold:
                return ConfidenceLevel.HIGH
            elif confidence >= tier.suggest_threshold:
                return ConfidenceLevel.MEDIUM
            elif confidence >= tier.min_threshold:
                return ConfidenceLevel.LOW
            else:
                return ConfidenceLevel.INSUFFICIENT

        # Use default thresholds
        return ConfidenceLevel.from_score(confidence)

    def score_matches(
        self,
        signals: list[Signal],
        form_id: UUID,
        form_name: str,
        primary_keywords: Optional[list[str]] = None,
    ) -> tuple[float, list[Match]]:
        """Score signals and create matches for a specific form.

        Args:
            signals: Detected signals
            form_id: Form being scored
            form_name: Form name for display
            primary_keywords: Keywords that are primary for this form

        Returns:
            Tuple of (confidence_score, list_of_matches)
        """
        start_time = time.perf_counter()

        primary_set = set(kw.lower() for kw in (primary_keywords or []))
        matches: list[Match] = []

        for signal in signals:
            is_primary = signal.normalized_value in primary_set

            # Calculate score contribution
            base_weight = {
                "keyword": self.config.keyword_base_weight,
                "pattern": self.config.pattern_base_weight,
                "meeting_signal": self.config.meeting_signal_base_weight,
            }.get(signal.type, 1.0)

            contribution = signal.weight * base_weight
            if is_primary:
                contribution *= self.config.primary_signal_multiplier

            matches.append(
                Match(
                    signal=signal,
                    matched_form_id=form_id,
                    matched_form_name=form_name,
                    score_contribution=contribution,
                    is_primary=is_primary,
                )
            )

        # Calculate overall confidence
        confidence = self.calculate_confidence(signals)

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.debug(
            "Scored matches",
            form_id=str(form_id),
            form_name=form_name,
            confidence=confidence,
            match_count=len(matches),
            processing_time_ms=elapsed_ms,
        )

        return confidence, matches

    def adjust_for_risk_tier(
        self,
        confidence: float,
        tier: ThresholdTier,
    ) -> ConfidenceLevel:
        """Adjust confidence level based on risk tier thresholds.

        Higher risk forms require higher confidence for auto-apply.

        Args:
            confidence: Raw confidence score
            tier: Threshold tier to apply

        Returns:
            Adjusted confidence level
        """
        return self.get_confidence_level(confidence, tier)
