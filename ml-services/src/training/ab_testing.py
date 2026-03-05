"""A/B Testing Framework (PX-887 Phase 3 / PX-895).

Routes traffic between model versions for A/B testing matching
algorithm improvements. Tracks metrics per variant and provides
statistical significance testing.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional, Callable, Any
from uuid import UUID
import hashlib
import random
import math

import structlog

logger = structlog.get_logger()


class ExperimentStatus(str, Enum):
    """Status of an A/B experiment."""

    DRAFT = "draft"  # Not yet started
    RUNNING = "running"  # Actively routing traffic
    PAUSED = "paused"  # Temporarily stopped
    COMPLETED = "completed"  # Finished, results available
    CANCELLED = "cancelled"  # Stopped early without results


class VariantType(str, Enum):
    """Types of variants in an experiment."""

    CONTROL = "control"  # Baseline version
    TREATMENT = "treatment"  # New version being tested


@dataclass
class Variant:
    """A variant in an A/B experiment."""

    name: str
    variant_type: VariantType
    model_version_id: Optional[UUID] = None
    config_overrides: dict = field(default_factory=dict)

    # Traffic allocation (0.0 to 1.0)
    traffic_percentage: float = 0.5

    # Metrics
    impressions: int = 0
    conversions: int = 0  # e.g., correct predictions
    total_confidence: float = 0.0

    @property
    def conversion_rate(self) -> float:
        """Calculate conversion rate."""
        if self.impressions == 0:
            return 0.0
        return self.conversions / self.impressions

    @property
    def avg_confidence(self) -> float:
        """Calculate average confidence."""
        if self.impressions == 0:
            return 0.0
        return self.total_confidence / self.impressions


@dataclass
class ExperimentConfig:
    """Configuration for an A/B experiment."""

    experiment_id: UUID
    name: str
    description: str = ""

    # Model being tested
    model_id: UUID = field(default_factory=UUID)

    # Variants
    control: Variant = field(default_factory=lambda: Variant("control", VariantType.CONTROL))
    treatment: Variant = field(default_factory=lambda: Variant("treatment", VariantType.TREATMENT))

    # Targeting
    org_ids: Optional[list[UUID]] = None  # None = all orgs
    industries: Optional[list[str]] = None  # None = all industries

    # Duration
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    max_impressions: Optional[int] = None

    # Statistical settings
    min_sample_size: int = 100  # Per variant
    confidence_level: float = 0.95  # For significance testing

    # Automatic decisions
    auto_winner: bool = False  # Auto-promote winning variant
    early_stopping: bool = True  # Stop early if clear winner


@dataclass
class ExperimentState:
    """Current state of an A/B experiment."""

    config: ExperimentConfig
    status: ExperimentStatus = ExperimentStatus.DRAFT

    # Tracking
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    total_impressions: int = 0

    # Results
    winner: Optional[str] = None
    statistical_significance: Optional[float] = None
    lift: Optional[float] = None  # Improvement percentage

    def is_active(self) -> bool:
        """Check if experiment is currently active."""
        if self.status != ExperimentStatus.RUNNING:
            return False

        now = datetime.now(timezone.utc)

        if self.config.start_at and now < self.config.start_at:
            return False

        if self.config.end_at and now > self.config.end_at:
            return False

        if self.config.max_impressions and self.total_impressions >= self.config.max_impressions:
            return False

        return True


@dataclass
class AssignmentResult:
    """Result of variant assignment for a request."""

    experiment_id: UUID
    variant_name: str
    variant_type: VariantType
    model_version_id: Optional[UUID]
    config_overrides: dict = field(default_factory=dict)

    # Assignment metadata
    assignment_key: str = ""  # Hash key used for assignment
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class ABTestingManager:
    """Manages A/B experiments and variant assignment.

    Uses consistent hashing for sticky assignment - the same
    (org_id, user_id, call_id) tuple always gets the same variant.
    """

    def __init__(self):
        self._experiments: dict[UUID, ExperimentState] = {}
        self._model_experiments: dict[UUID, list[UUID]] = {}  # model_id -> experiment_ids

    def create_experiment(self, config: ExperimentConfig) -> ExperimentState:
        """Create a new A/B experiment.

        Args:
            config: Experiment configuration

        Returns:
            ExperimentState for the new experiment
        """
        state = ExperimentState(config=config, status=ExperimentStatus.DRAFT)

        self._experiments[config.experiment_id] = state

        # Index by model
        if config.model_id not in self._model_experiments:
            self._model_experiments[config.model_id] = []
        self._model_experiments[config.model_id].append(config.experiment_id)

        logger.info(
            "A/B experiment created",
            experiment_id=str(config.experiment_id),
            name=config.name,
            model_id=str(config.model_id),
        )

        return state

    def start_experiment(self, experiment_id: UUID) -> ExperimentState:
        """Start an experiment.

        Args:
            experiment_id: Experiment to start

        Returns:
            Updated ExperimentState
        """
        state = self._experiments.get(experiment_id)
        if not state:
            raise ValueError(f"Experiment {experiment_id} not found")

        if state.status != ExperimentStatus.DRAFT:
            raise ValueError(f"Can only start experiments in DRAFT status")

        state.status = ExperimentStatus.RUNNING
        state.started_at = datetime.now(timezone.utc)

        logger.info(
            "A/B experiment started",
            experiment_id=str(experiment_id),
            name=state.config.name,
        )

        return state

    def pause_experiment(self, experiment_id: UUID) -> ExperimentState:
        """Pause a running experiment."""
        state = self._experiments.get(experiment_id)
        if not state:
            raise ValueError(f"Experiment {experiment_id} not found")

        if state.status != ExperimentStatus.RUNNING:
            raise ValueError(f"Can only pause RUNNING experiments")

        state.status = ExperimentStatus.PAUSED

        logger.info("A/B experiment paused", experiment_id=str(experiment_id))

        return state

    def resume_experiment(self, experiment_id: UUID) -> ExperimentState:
        """Resume a paused experiment."""
        state = self._experiments.get(experiment_id)
        if not state:
            raise ValueError(f"Experiment {experiment_id} not found")

        if state.status != ExperimentStatus.PAUSED:
            raise ValueError(f"Can only resume PAUSED experiments")

        state.status = ExperimentStatus.RUNNING

        logger.info("A/B experiment resumed", experiment_id=str(experiment_id))

        return state

    def complete_experiment(
        self,
        experiment_id: UUID,
        winner: Optional[str] = None,
    ) -> ExperimentState:
        """Complete an experiment.

        Args:
            experiment_id: Experiment to complete
            winner: Optional declared winner

        Returns:
            Updated ExperimentState with results
        """
        state = self._experiments.get(experiment_id)
        if not state:
            raise ValueError(f"Experiment {experiment_id} not found")

        state.status = ExperimentStatus.COMPLETED
        state.ended_at = datetime.now(timezone.utc)

        # Calculate final statistics
        self._calculate_results(state)

        if winner:
            state.winner = winner

        logger.info(
            "A/B experiment completed",
            experiment_id=str(experiment_id),
            winner=state.winner,
            significance=state.statistical_significance,
            lift=state.lift,
        )

        return state

    def cancel_experiment(self, experiment_id: UUID) -> ExperimentState:
        """Cancel an experiment."""
        state = self._experiments.get(experiment_id)
        if not state:
            raise ValueError(f"Experiment {experiment_id} not found")

        state.status = ExperimentStatus.CANCELLED
        state.ended_at = datetime.now(timezone.utc)

        logger.info("A/B experiment cancelled", experiment_id=str(experiment_id))

        return state

    def assign_variant(
        self,
        model_id: UUID,
        org_id: UUID,
        user_id: Optional[UUID] = None,
        call_id: Optional[UUID] = None,
        industry: Optional[str] = None,
    ) -> Optional[AssignmentResult]:
        """Assign a variant for a request.

        Uses consistent hashing to ensure the same entity always
        gets the same variant within an experiment.

        Args:
            model_id: Model being used
            org_id: Organization making request
            user_id: Optional user identifier
            call_id: Optional call identifier
            industry: Optional industry for targeting

        Returns:
            AssignmentResult if an active experiment exists, None otherwise
        """
        # Find active experiment for this model
        experiment_ids = self._model_experiments.get(model_id, [])

        for exp_id in experiment_ids:
            state = self._experiments.get(exp_id)
            if not state or not state.is_active():
                continue

            # Check targeting
            if not self._matches_targeting(state.config, org_id, industry):
                continue

            # Assign variant using consistent hash
            assignment = self._assign_to_variant(state, org_id, user_id, call_id)

            return assignment

        return None

    def record_outcome(
        self,
        experiment_id: UUID,
        variant_name: str,
        success: bool,
        confidence: Optional[float] = None,
    ) -> None:
        """Record the outcome of a variant impression.

        Args:
            experiment_id: Experiment identifier
            variant_name: Variant that was used
            success: Whether prediction was correct
            confidence: Optional confidence score
        """
        state = self._experiments.get(experiment_id)
        if not state:
            return

        # Update variant metrics
        variant = (
            state.config.control if variant_name == state.config.control.name
            else state.config.treatment
        )

        variant.impressions += 1
        if success:
            variant.conversions += 1
        if confidence is not None:
            variant.total_confidence += confidence

        state.total_impressions += 1

        # Check for early stopping
        if state.config.early_stopping:
            self._check_early_stopping(state)

    def get_experiment(self, experiment_id: UUID) -> Optional[ExperimentState]:
        """Get experiment state."""
        return self._experiments.get(experiment_id)

    def list_experiments(
        self,
        model_id: Optional[UUID] = None,
        status: Optional[ExperimentStatus] = None,
    ) -> list[ExperimentState]:
        """List experiments with optional filtering."""
        experiments = list(self._experiments.values())

        if model_id:
            experiments = [e for e in experiments if e.config.model_id == model_id]

        if status:
            experiments = [e for e in experiments if e.status == status]

        return experiments

    def get_results(self, experiment_id: UUID) -> dict:
        """Get detailed results for an experiment."""
        state = self._experiments.get(experiment_id)
        if not state:
            raise ValueError(f"Experiment {experiment_id} not found")

        # Calculate current statistics
        self._calculate_results(state)

        control = state.config.control
        treatment = state.config.treatment

        return {
            "experiment_id": str(experiment_id),
            "name": state.config.name,
            "status": state.status.value,
            "started_at": state.started_at.isoformat() if state.started_at else None,
            "ended_at": state.ended_at.isoformat() if state.ended_at else None,
            "total_impressions": state.total_impressions,
            "control": {
                "name": control.name,
                "impressions": control.impressions,
                "conversions": control.conversions,
                "conversion_rate": control.conversion_rate,
                "avg_confidence": control.avg_confidence,
            },
            "treatment": {
                "name": treatment.name,
                "impressions": treatment.impressions,
                "conversions": treatment.conversions,
                "conversion_rate": treatment.conversion_rate,
                "avg_confidence": treatment.avg_confidence,
            },
            "winner": state.winner,
            "statistical_significance": state.statistical_significance,
            "lift": state.lift,
            "has_sufficient_data": self._has_sufficient_data(state),
        }

    def _matches_targeting(
        self,
        config: ExperimentConfig,
        org_id: UUID,
        industry: Optional[str],
    ) -> bool:
        """Check if request matches experiment targeting."""
        if config.org_ids and org_id not in config.org_ids:
            return False

        if config.industries and industry and industry not in config.industries:
            return False

        return True

    def _assign_to_variant(
        self,
        state: ExperimentState,
        org_id: UUID,
        user_id: Optional[UUID],
        call_id: Optional[UUID],
    ) -> AssignmentResult:
        """Assign request to a variant using consistent hashing."""
        # Build hash key
        key_parts = [
            str(state.config.experiment_id),
            str(org_id),
        ]
        if user_id:
            key_parts.append(str(user_id))
        if call_id:
            key_parts.append(str(call_id))

        hash_key = ":".join(key_parts)
        hash_bytes = hashlib.md5(hash_key.encode()).digest()
        hash_value = int.from_bytes(hash_bytes[:4], "big") / (2**32)

        # Assign based on traffic split
        if hash_value < state.config.control.traffic_percentage:
            variant = state.config.control
        else:
            variant = state.config.treatment

        return AssignmentResult(
            experiment_id=state.config.experiment_id,
            variant_name=variant.name,
            variant_type=variant.variant_type,
            model_version_id=variant.model_version_id,
            config_overrides=variant.config_overrides,
            assignment_key=hash_key,
        )

    def _calculate_results(self, state: ExperimentState) -> None:
        """Calculate statistical results for an experiment."""
        control = state.config.control
        treatment = state.config.treatment

        if control.impressions == 0 or treatment.impressions == 0:
            return

        # Calculate lift
        if control.conversion_rate > 0:
            state.lift = (
                (treatment.conversion_rate - control.conversion_rate)
                / control.conversion_rate
                * 100
            )
        else:
            state.lift = None

        # Calculate statistical significance using z-test
        p1 = control.conversion_rate
        p2 = treatment.conversion_rate
        n1 = control.impressions
        n2 = treatment.impressions

        # Pooled proportion
        p_pooled = (control.conversions + treatment.conversions) / (n1 + n2)

        if p_pooled == 0 or p_pooled == 1:
            state.statistical_significance = None
            return

        # Standard error
        se = math.sqrt(p_pooled * (1 - p_pooled) * (1/n1 + 1/n2))

        if se == 0:
            state.statistical_significance = None
            return

        # Z-score
        z = abs(p2 - p1) / se

        # Approximate p-value using normal distribution
        # For z > 3.5, significance is essentially 1.0
        if z > 3.5:
            state.statistical_significance = 0.999
        else:
            # Use error function approximation
            state.statistical_significance = 1 - 2 * (1 - self._norm_cdf(z))

        # Determine winner
        if state.statistical_significance and state.statistical_significance >= state.config.confidence_level:
            if treatment.conversion_rate > control.conversion_rate:
                state.winner = treatment.name
            else:
                state.winner = control.name

    def _norm_cdf(self, x: float) -> float:
        """Approximate normal CDF using error function."""
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    def _has_sufficient_data(self, state: ExperimentState) -> bool:
        """Check if experiment has sufficient data for conclusions."""
        min_samples = state.config.min_sample_size
        return (
            state.config.control.impressions >= min_samples and
            state.config.treatment.impressions >= min_samples
        )

    def _check_early_stopping(self, state: ExperimentState) -> None:
        """Check if experiment should stop early."""
        if not self._has_sufficient_data(state):
            return

        self._calculate_results(state)

        # Stop if highly significant
        if (
            state.statistical_significance and
            state.statistical_significance >= 0.99 and
            state.winner
        ):
            logger.info(
                "Early stopping A/B experiment",
                experiment_id=str(state.config.experiment_id),
                winner=state.winner,
                significance=state.statistical_significance,
            )

            state.status = ExperimentStatus.COMPLETED
            state.ended_at = datetime.now(timezone.utc)

            if state.config.auto_winner:
                # TODO: Integrate with model promotion logic
                pass


# Global manager instance
_ab_testing_manager: Optional[ABTestingManager] = None


def get_ab_testing_manager() -> ABTestingManager:
    """Get the global A/B testing manager instance."""
    global _ab_testing_manager
    if _ab_testing_manager is None:
        _ab_testing_manager = ABTestingManager()
    return _ab_testing_manager
