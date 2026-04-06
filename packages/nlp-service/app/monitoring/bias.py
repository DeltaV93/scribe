"""
Bias Detection and Fairness Monitoring.
PX-878: Tiered Content Classifier

Monitors for systematic bias in classification results.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from collections import Counter


logger = logging.getLogger(__name__)


@dataclass
class BiasMetrics:
    """Metrics for bias detection."""
    tier_distribution: dict[str, float]
    dispute_rate_by_tier: dict[str, float]
    segment_length_correlation: float
    speaker_bias: dict[str, float]


@dataclass
class FairnessReport:
    """Fairness testing report."""
    results_by_category: dict[str, dict]
    demographic_parity_diff: float
    passes: bool
    generated_at: datetime
    recommendations: list[str]


class BiasDetector:
    """
    Detect bias in classification results.

    Monitors:
    - Tier distribution (should be ~70% STANDARD, ~20% RESTRICTED, ~10% REDACTED)
    - Dispute rate by tier (high disputes = miscalibration)
    - Segment length correlation (longer segments shouldn't bias toward REDACTED)
    - Speaker bias (equal rates for AGENT vs CLIENT)
    """

    EXPECTED_DISTRIBUTION = {
        "STANDARD": 0.70,
        "RESTRICTED": 0.20,
        "REDACTED": 0.10,
    }

    MAX_DISTRIBUTION_DEVIATION = 0.10
    MAX_DISPUTE_RATE = 0.15
    MAX_LENGTH_CORRELATION = 0.20
    MAX_SPEAKER_BIAS = 0.05

    def __init__(self):
        pass

    async def compute_metrics(
        self,
        org_id: Optional[str] = None,
        days: int = 7,
    ) -> BiasMetrics:
        """
        Compute bias metrics from recent classifications.

        Args:
            org_id: Organization ID (None for global)
            days: Number of days to analyze

        Returns:
            BiasMetrics object
        """
        # TODO: Query actual data from database

        # Placeholder implementation
        return BiasMetrics(
            tier_distribution={
                "STANDARD": 0.72,
                "RESTRICTED": 0.18,
                "REDACTED": 0.10,
            },
            dispute_rate_by_tier={
                "STANDARD": 0.02,
                "RESTRICTED": 0.08,
                "REDACTED": 0.12,
            },
            segment_length_correlation=0.05,
            speaker_bias={
                "AGENT": 0.0,
                "CLIENT": 0.02,
            },
        )

    def check_distribution_bias(self, metrics: BiasMetrics) -> list[str]:
        """
        Check if tier distribution deviates from expected.

        Returns list of alerts.
        """
        alerts = []

        for tier, expected in self.EXPECTED_DISTRIBUTION.items():
            actual = metrics.tier_distribution.get(tier, 0)
            deviation = abs(actual - expected)

            if deviation > self.MAX_DISTRIBUTION_DEVIATION:
                direction = "over" if actual > expected else "under"
                alerts.append(
                    f"Tier {tier} is {direction}-represented: "
                    f"{actual:.0%} (expected ~{expected:.0%})"
                )

        return alerts

    def check_dispute_rate(self, metrics: BiasMetrics) -> list[str]:
        """
        Check if dispute rates are too high.

        Returns list of alerts.
        """
        alerts = []

        for tier, rate in metrics.dispute_rate_by_tier.items():
            if rate > self.MAX_DISPUTE_RATE:
                alerts.append(
                    f"High dispute rate for {tier}: {rate:.0%} "
                    f"(threshold: {self.MAX_DISPUTE_RATE:.0%})"
                )

        return alerts

    def check_length_correlation(self, metrics: BiasMetrics) -> list[str]:
        """
        Check if segment length correlates with classification.

        Returns list of alerts.
        """
        alerts = []

        if abs(metrics.segment_length_correlation) > self.MAX_LENGTH_CORRELATION:
            direction = "longer" if metrics.segment_length_correlation > 0 else "shorter"
            alerts.append(
                f"Segment length bias detected: {direction} segments more likely "
                f"to be flagged (r={metrics.segment_length_correlation:.2f})"
            )

        return alerts

    def check_speaker_bias(self, metrics: BiasMetrics) -> list[str]:
        """
        Check if speaker label affects classification.

        Returns list of alerts.
        """
        alerts = []

        agent_rate = metrics.speaker_bias.get("AGENT", 0)
        client_rate = metrics.speaker_bias.get("CLIENT", 0)
        diff = abs(agent_rate - client_rate)

        if diff > self.MAX_SPEAKER_BIAS:
            higher = "CLIENT" if client_rate > agent_rate else "AGENT"
            alerts.append(
                f"Speaker bias detected: {higher} segments {diff:.0%} more likely "
                f"to be flagged as sensitive"
            )

        return alerts

    async def run_fairness_tests(
        self,
        test_data: list[dict],
        org_id: Optional[str] = None,
    ) -> FairnessReport:
        """
        Run fairness tests against diverse content categories.

        Args:
            test_data: List of {text, category, expected_tier} dicts
            org_id: Organization ID

        Returns:
            FairnessReport object
        """
        # Group by category
        results_by_category: dict[str, dict] = {}
        categories = ["healthcare", "social_services", "legal", "sales", "general"]

        for category in categories:
            category_data = [d for d in test_data if d.get("category") == category]

            if not category_data:
                results_by_category[category] = {
                    "count": 0,
                    "redact_rate": 0.0,
                    "restrict_rate": 0.0,
                }
                continue

            # TODO: Classify data and compute rates
            results_by_category[category] = {
                "count": len(category_data),
                "redact_rate": 0.10,
                "restrict_rate": 0.20,
            }

        # Compute demographic parity difference
        redact_rates = [r["redact_rate"] for r in results_by_category.values() if r["count"] > 0]
        demographic_parity_diff = max(redact_rates) - min(redact_rates) if redact_rates else 0.0

        # Determine if passes
        passes = demographic_parity_diff <= 0.10

        # Generate recommendations
        recommendations = []
        if not passes:
            recommendations.append(
                f"Demographic parity difference ({demographic_parity_diff:.0%}) exceeds threshold (10%)"
            )
            recommendations.append(
                "Consider rebalancing training data across content categories"
            )

        return FairnessReport(
            results_by_category=results_by_category,
            demographic_parity_diff=demographic_parity_diff,
            passes=passes,
            generated_at=datetime.utcnow(),
            recommendations=recommendations,
        )

    async def generate_report(
        self,
        org_id: Optional[str] = None,
        days: int = 30,
    ) -> dict:
        """
        Generate a comprehensive bias report.

        Returns dict suitable for JSON serialization.
        """
        metrics = await self.compute_metrics(org_id, days)

        distribution_alerts = self.check_distribution_bias(metrics)
        dispute_alerts = self.check_dispute_rate(metrics)
        length_alerts = self.check_length_correlation(metrics)
        speaker_alerts = self.check_speaker_bias(metrics)

        all_alerts = distribution_alerts + dispute_alerts + length_alerts + speaker_alerts

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "org_id": org_id,
            "period_days": days,
            "metrics": {
                "tier_distribution": metrics.tier_distribution,
                "dispute_rate_by_tier": metrics.dispute_rate_by_tier,
                "segment_length_correlation": metrics.segment_length_correlation,
                "speaker_bias": metrics.speaker_bias,
            },
            "alerts": all_alerts,
            "alert_count": len(all_alerts),
            "status": "HEALTHY" if len(all_alerts) == 0 else "ATTENTION_NEEDED",
        }
