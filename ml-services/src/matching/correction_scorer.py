"""Correction quality scoring for form matching feedback (PX-887 Phase 3).

Scores user corrections before they enter the retraining pool to ensure
only valid feedback drives model improvement. Uses:
- Outlier detection (corrections that differ significantly from norm)
- Confidence-weighted scoring (higher weight for high-confidence overrides)
- User trust scoring (longitudinal user reliability metrics)

All scoring is internal to Inkra - end users never see correction scores.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional, Callable
from uuid import UUID
import math

import structlog

from src.matching.feedback import (
    FormMatchingFeedback,
    FeedbackSignal,
    FormMatchingFeedbackType,
)

logger = structlog.get_logger()


class QualityTier(str, Enum):
    """Quality tier for corrections."""

    HIGH = "high"  # High confidence, include in training
    MEDIUM = "medium"  # Moderate confidence, include with reduced weight
    LOW = "low"  # Low confidence, may need review
    REJECTED = "rejected"  # Do not include in training


# Thresholds
MINIMUM_QUALITY_SCORE = 0.3  # Below this, correction is rejected
OUTLIER_THRESHOLD = 2.5  # Standard deviations for outlier detection
USER_TRUST_DECAY_DAYS = 90  # Half-life for user trust decay


@dataclass
class UserTrustMetrics:
    """Trust metrics for a user based on correction history."""

    user_id: UUID
    total_corrections: int = 0
    accepted_corrections: int = 0
    rejected_corrections: int = 0
    override_accuracy: float = 0.0  # How often user overrides proved correct
    last_correction_at: Optional[datetime] = None

    # Computed score (0.0 to 1.0)
    trust_score: float = 0.5  # Default neutral trust

    def update(
        self,
        was_accepted: bool,
        timestamp: Optional[datetime] = None,
    ) -> None:
        """Update trust metrics with a new correction outcome."""
        self.total_corrections += 1

        if was_accepted:
            self.accepted_corrections += 1
        else:
            self.rejected_corrections += 1

        self.last_correction_at = timestamp or datetime.now(timezone.utc)

        # Recalculate trust score
        if self.total_corrections > 0:
            acceptance_rate = self.accepted_corrections / self.total_corrections

            # Bayesian adjustment: start with prior of 0.5, converge to actual rate
            # More corrections = more confidence in the rate
            prior_weight = 10  # Equivalent to 10 prior observations
            posterior_weight = self.total_corrections + prior_weight
            self.trust_score = (
                acceptance_rate * self.total_corrections + 0.5 * prior_weight
            ) / posterior_weight


@dataclass
class CorrectionScore:
    """Scored correction ready for training pipeline."""

    feedback: FormMatchingFeedback
    quality_score: float  # 0.0 to 1.0
    quality_tier: QualityTier
    training_weight: float  # Weight to use in training
    flags: list[str] = field(default_factory=list)

    # Component scores
    signal_score: float = 0.0
    confidence_score: float = 0.0
    user_trust_score: float = 0.0
    consistency_score: float = 0.0

    # Metadata
    scored_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    scorer_version: str = "1.0.0"


class CorrectionScorer:
    """Scores corrections for training data quality.

    Uses multiple signals to determine if a correction is reliable:
    1. Signal strength (strong negative > negative > neutral)
    2. Confidence delta (overriding high-confidence = more informative)
    3. User trust (historically reliable users get higher weight)
    4. Consistency (corrections matching patterns get higher weight)
    """

    def __init__(
        self,
        user_trust_provider: Optional[Callable[[UUID], UserTrustMetrics]] = None,
        consistency_checker: Optional[Callable[[FormMatchingFeedback], float]] = None,
    ):
        """Initialize the scorer.

        Args:
            user_trust_provider: Optional function to fetch user trust metrics
            consistency_checker: Optional function to check consistency with patterns
        """
        self._user_trust_provider = user_trust_provider
        self._consistency_checker = consistency_checker

        # Running statistics for outlier detection
        self._confidence_mean: float = 0.5
        self._confidence_std: float = 0.2
        self._sample_count: int = 0

    def score(self, feedback: FormMatchingFeedback) -> CorrectionScore:
        """Score a correction for training quality.

        Args:
            feedback: The form matching feedback to score

        Returns:
            CorrectionScore with quality metrics
        """
        flags: list[str] = []

        # 1. Signal strength score
        signal_score = self._score_signal(feedback.signal)
        if signal_score < 0.3:
            flags.append("weak_signal")

        # 2. Confidence delta score
        confidence_score = self._score_confidence_delta(feedback)
        if confidence_score > 0.8:
            flags.append("high_confidence_override")

        # 3. User trust score
        user_trust_score = self._get_user_trust(feedback.user_id)

        # 4. Consistency score
        consistency_score = self._check_consistency(feedback)
        if consistency_score < 0.3:
            flags.append("inconsistent_pattern")

        # Combine scores with weights
        quality_score = (
            signal_score * 0.25
            + confidence_score * 0.25
            + user_trust_score * 0.25
            + consistency_score * 0.25
        )

        # Apply outlier penalty
        if self._is_outlier(feedback):
            quality_score *= 0.5
            flags.append("outlier_correction")

        # Determine tier
        quality_tier = self._get_tier(quality_score)

        # Calculate training weight
        training_weight = self._calculate_training_weight(
            quality_score,
            quality_tier,
            feedback,
        )

        # Update running statistics
        self._update_statistics(feedback)

        result = CorrectionScore(
            feedback=feedback,
            quality_score=quality_score,
            quality_tier=quality_tier,
            training_weight=training_weight,
            flags=flags,
            signal_score=signal_score,
            confidence_score=confidence_score,
            user_trust_score=user_trust_score,
            consistency_score=consistency_score,
        )

        # Update feedback with quality info
        feedback.quality_score = quality_score
        feedback.quality_flags = flags

        logger.debug(
            "Correction scored",
            feedback_type=feedback.feedback_type.value if feedback.feedback_type else None,
            quality_score=quality_score,
            quality_tier=quality_tier.value,
            training_weight=training_weight,
            flags=flags,
        )

        return result

    def score_batch(
        self,
        feedback_items: list[FormMatchingFeedback],
    ) -> list[CorrectionScore]:
        """Score a batch of corrections.

        Args:
            feedback_items: List of feedback to score

        Returns:
            List of CorrectionScore objects
        """
        return [self.score(f) for f in feedback_items]

    def filter_for_training(
        self,
        scored: list[CorrectionScore],
        min_tier: QualityTier = QualityTier.MEDIUM,
    ) -> list[CorrectionScore]:
        """Filter scored corrections for training.

        Args:
            scored: List of scored corrections
            min_tier: Minimum quality tier to include

        Returns:
            Filtered list of corrections suitable for training
        """
        tier_order = {
            QualityTier.HIGH: 3,
            QualityTier.MEDIUM: 2,
            QualityTier.LOW: 1,
            QualityTier.REJECTED: 0,
        }

        min_order = tier_order[min_tier]

        filtered = [
            s for s in scored
            if tier_order[s.quality_tier] >= min_order
        ]

        logger.info(
            "Filtered corrections for training",
            total=len(scored),
            filtered=len(filtered),
            min_tier=min_tier.value,
            rejected=len(scored) - len(filtered),
        )

        return filtered

    def _score_signal(self, signal: Optional[FeedbackSignal]) -> float:
        """Score based on feedback signal strength."""
        if signal is None:
            return 0.5

        signal_scores = {
            FeedbackSignal.STRONG_POSITIVE: 0.9,
            FeedbackSignal.POSITIVE: 0.7,
            FeedbackSignal.NEUTRAL: 0.5,
            FeedbackSignal.NEGATIVE: 0.7,  # Negative signals are informative
            FeedbackSignal.STRONG_NEGATIVE: 0.9,  # Strong signals most informative
        }

        return signal_scores.get(signal, 0.5)

    def _score_confidence_delta(self, feedback: FormMatchingFeedback) -> float:
        """Score based on confidence delta.

        Overriding high-confidence predictions is more informative than
        correcting low-confidence ones.
        """
        if feedback.suggested_confidence is None:
            return 0.5

        # Higher original confidence = more informative correction
        if feedback.feedback_type in (
            FormMatchingFeedbackType.FORM_OVERRIDE_FROM_SUGGESTIONS,
            FormMatchingFeedbackType.FORM_OVERRIDE_MANUAL,
            FormMatchingFeedbackType.NO_FORM_MATCHED,
        ):
            # Override is more valuable when confidence was high
            return feedback.suggested_confidence

        elif feedback.feedback_type == FormMatchingFeedbackType.FORM_CONFIRMED:
            # Confirmation is more valuable when confidence was moderate
            # (high confidence confirmations are less surprising)
            return 1.0 - abs(feedback.suggested_confidence - 0.7)

        return 0.5

    def _get_user_trust(self, user_id: UUID) -> float:
        """Get user trust score."""
        if self._user_trust_provider:
            try:
                metrics = self._user_trust_provider(user_id)
                return metrics.trust_score
            except Exception as e:
                logger.warning(
                    "Failed to get user trust metrics",
                    user_id=str(user_id),
                    error=str(e),
                )

        # Default trust for unknown users
        return 0.5

    def _check_consistency(self, feedback: FormMatchingFeedback) -> float:
        """Check consistency with historical patterns."""
        if self._consistency_checker:
            try:
                return self._consistency_checker(feedback)
            except Exception as e:
                logger.warning(
                    "Failed to check consistency",
                    error=str(e),
                )

        # Default consistency for no pattern checking
        return 0.5

    def _is_outlier(self, feedback: FormMatchingFeedback) -> bool:
        """Check if correction is an outlier.

        Uses z-score based on running confidence statistics.
        """
        if feedback.suggested_confidence is None:
            return False

        if self._sample_count < 10:
            # Not enough data for outlier detection
            return False

        if self._confidence_std < 0.01:
            # Variance too low for meaningful outlier detection
            return False

        z_score = abs(feedback.suggested_confidence - self._confidence_mean) / self._confidence_std

        return z_score > OUTLIER_THRESHOLD

    def _get_tier(self, quality_score: float) -> QualityTier:
        """Determine quality tier from score."""
        if quality_score >= 0.7:
            return QualityTier.HIGH
        elif quality_score >= 0.5:
            return QualityTier.MEDIUM
        elif quality_score >= MINIMUM_QUALITY_SCORE:
            return QualityTier.LOW
        else:
            return QualityTier.REJECTED

    def _calculate_training_weight(
        self,
        quality_score: float,
        tier: QualityTier,
        feedback: FormMatchingFeedback,
    ) -> float:
        """Calculate weight for training sample.

        Higher weights for more reliable/informative corrections.
        """
        if tier == QualityTier.REJECTED:
            return 0.0

        # Base weight from quality score
        weight = quality_score

        # Boost for strong negative signals (most valuable for learning)
        if feedback.signal == FeedbackSignal.STRONG_NEGATIVE:
            weight *= 1.2

        # Reduce weight for neutral signals
        if feedback.signal == FeedbackSignal.NEUTRAL:
            weight *= 0.8

        # Apply tier scaling
        tier_multipliers = {
            QualityTier.HIGH: 1.0,
            QualityTier.MEDIUM: 0.7,
            QualityTier.LOW: 0.4,
            QualityTier.REJECTED: 0.0,
        }
        weight *= tier_multipliers[tier]

        # Clamp to valid range
        return max(0.0, min(1.0, weight))

    def _update_statistics(self, feedback: FormMatchingFeedback) -> None:
        """Update running statistics for outlier detection."""
        if feedback.suggested_confidence is None:
            return

        confidence = feedback.suggested_confidence
        self._sample_count += 1

        # Welford's online algorithm for mean and variance
        delta = confidence - self._confidence_mean
        self._confidence_mean += delta / self._sample_count

        if self._sample_count > 1:
            # Update standard deviation
            delta2 = confidence - self._confidence_mean
            m2 = (self._confidence_std ** 2) * (self._sample_count - 2)
            m2 += delta * delta2
            self._confidence_std = math.sqrt(m2 / (self._sample_count - 1))


@dataclass
class TrainingDataset:
    """A filtered dataset ready for model training."""

    corrections: list[CorrectionScore]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Statistics
    total_processed: int = 0
    total_rejected: int = 0
    high_quality_count: int = 0
    medium_quality_count: int = 0
    low_quality_count: int = 0

    # Weighted totals
    total_weight: float = 0.0
    positive_signal_weight: float = 0.0
    negative_signal_weight: float = 0.0

    def compute_stats(self) -> None:
        """Compute dataset statistics."""
        self.high_quality_count = sum(
            1 for c in self.corrections if c.quality_tier == QualityTier.HIGH
        )
        self.medium_quality_count = sum(
            1 for c in self.corrections if c.quality_tier == QualityTier.MEDIUM
        )
        self.low_quality_count = sum(
            1 for c in self.corrections if c.quality_tier == QualityTier.LOW
        )

        self.total_weight = sum(c.training_weight for c in self.corrections)

        for c in self.corrections:
            if c.feedback.signal in (FeedbackSignal.POSITIVE, FeedbackSignal.STRONG_POSITIVE):
                self.positive_signal_weight += c.training_weight
            elif c.feedback.signal in (FeedbackSignal.NEGATIVE, FeedbackSignal.STRONG_NEGATIVE):
                self.negative_signal_weight += c.training_weight

    def to_training_samples(self) -> list[dict]:
        """Convert to list of training samples.

        Returns dictionaries suitable for the training pipeline.
        """
        samples = []

        for c in self.corrections:
            fb = c.feedback

            sample = {
                "org_id": str(fb.org_id),
                "call_id": str(fb.call_id),
                "feedback_type": fb.feedback_type.value if fb.feedback_type else None,
                "signal": fb.signal.value if fb.signal else None,

                # Original prediction
                "suggested_form_id": str(fb.suggested_form_id) if fb.suggested_form_id else None,
                "suggested_confidence": fb.suggested_confidence,

                # Correction
                "selected_form_id": str(fb.selected_form_id) if fb.selected_form_id else None,

                # Context
                "industry": fb.industry,
                "meeting_type": fb.meeting_type,

                # Weights
                "training_weight": c.training_weight,
                "quality_score": c.quality_score,
                "quality_tier": c.quality_tier.value,
            }

            samples.append(sample)

        return samples


def create_training_dataset(
    feedback_items: list[FormMatchingFeedback],
    scorer: Optional[CorrectionScorer] = None,
    min_tier: QualityTier = QualityTier.MEDIUM,
) -> TrainingDataset:
    """Create a filtered training dataset from feedback.

    Args:
        feedback_items: Raw feedback events
        scorer: Optional custom scorer (uses default if not provided)
        min_tier: Minimum quality tier to include

    Returns:
        TrainingDataset with filtered, scored corrections
    """
    if scorer is None:
        scorer = CorrectionScorer()

    # Score all feedback
    scored = scorer.score_batch(feedback_items)

    # Filter for training
    filtered = scorer.filter_for_training(scored, min_tier)

    # Create dataset
    dataset = TrainingDataset(
        corrections=filtered,
        total_processed=len(feedback_items),
        total_rejected=len(feedback_items) - len(filtered),
    )
    dataset.compute_stats()

    logger.info(
        "Created training dataset",
        total_processed=dataset.total_processed,
        total_rejected=dataset.total_rejected,
        high_quality=dataset.high_quality_count,
        medium_quality=dataset.medium_quality_count,
        low_quality=dataset.low_quality_count,
        total_weight=dataset.total_weight,
    )

    return dataset
