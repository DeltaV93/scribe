"""Auto-retraining triggers (PX-887 Phase 3 / PX-895).

Implements event count threshold OR time interval triggers for
automated model retraining. Monitors feedback accumulation and
triggers training jobs when thresholds are reached.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional, Callable, Any
from uuid import UUID
import asyncio

import structlog

logger = structlog.get_logger()


class TriggerType(str, Enum):
    """Types of retraining triggers."""

    EVENT_COUNT = "event_count"  # N corrections accumulated
    TIME_INTERVAL = "time_interval"  # N hours since last training
    ACCURACY_DROP = "accuracy_drop"  # Accuracy below threshold
    MANUAL = "manual"  # Admin triggered


class TriggerStatus(str, Enum):
    """Status of a trigger evaluation."""

    NOT_MET = "not_met"
    THRESHOLD_REACHED = "threshold_reached"
    PENDING_COOLDOWN = "pending_cooldown"
    TRIGGERED = "triggered"


@dataclass
class TriggerConfig:
    """Configuration for retraining triggers."""

    # Model identifier
    model_id: UUID

    # Event count trigger
    event_count_threshold: int = 500  # Corrections before retraining
    min_event_count: int = 50  # Minimum for any training

    # Time interval trigger (whichever comes first)
    time_interval_hours: int = 168  # 7 days default

    # Accuracy trigger
    accuracy_threshold: float = 0.85  # Below this triggers retraining
    accuracy_window_hours: int = 24  # Window for accuracy calculation

    # Cooldown (prevent rapid retraining)
    cooldown_hours: int = 4  # Minimum time between training jobs

    # Per-org vs global
    per_org: bool = False  # If true, track per-org; else global per model

    # Quality filters
    min_quality_tier: str = "medium"  # Minimum correction quality


@dataclass
class TriggerState:
    """Current state of triggers for a model."""

    model_id: UUID
    org_id: Optional[UUID] = None

    # Event counts
    event_count: int = 0
    high_quality_count: int = 0
    last_event_at: Optional[datetime] = None

    # Training history
    last_training_at: Optional[datetime] = None
    last_training_job_id: Optional[UUID] = None
    training_count: int = 0

    # Current accuracy
    current_accuracy: Optional[float] = None
    accuracy_updated_at: Optional[datetime] = None

    # Timestamp
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class TriggerEvaluation:
    """Result of evaluating triggers."""

    should_trigger: bool
    trigger_type: Optional[TriggerType] = None
    trigger_status: TriggerStatus = TriggerStatus.NOT_MET

    # Details
    event_count: int = 0
    event_threshold: int = 0
    hours_since_training: Optional[float] = None
    time_threshold_hours: int = 0
    current_accuracy: Optional[float] = None
    accuracy_threshold: float = 0.0

    # Cooldown
    in_cooldown: bool = False
    cooldown_remaining_hours: Optional[float] = None

    # Reason
    reason: str = ""


class RetrainingTriggerManager:
    """Manages retraining triggers across models and organizations.

    Tracks feedback events, evaluates trigger conditions, and initiates
    training jobs when thresholds are reached.
    """

    def __init__(
        self,
        training_job_submitter: Optional[Callable[[UUID, Optional[UUID]], Any]] = None,
    ):
        """Initialize the trigger manager.

        Args:
            training_job_submitter: Callback to submit training jobs.
                Receives (model_id, org_id) and returns job_id or None.
        """
        self._training_job_submitter = training_job_submitter
        self._configs: dict[UUID, TriggerConfig] = {}
        self._states: dict[tuple[UUID, Optional[UUID]], TriggerState] = {}
        self._lock = asyncio.Lock()

    def register_model(self, config: TriggerConfig) -> None:
        """Register a model for trigger monitoring.

        Args:
            config: Trigger configuration for the model
        """
        self._configs[config.model_id] = config

        logger.info(
            "Model registered for retraining triggers",
            model_id=str(config.model_id),
            event_threshold=config.event_count_threshold,
            time_interval_hours=config.time_interval_hours,
            per_org=config.per_org,
        )

    def unregister_model(self, model_id: UUID) -> None:
        """Unregister a model from trigger monitoring."""
        self._configs.pop(model_id, None)

        # Clean up states
        keys_to_remove = [
            k for k in self._states if k[0] == model_id
        ]
        for key in keys_to_remove:
            self._states.pop(key, None)

        logger.info("Model unregistered from triggers", model_id=str(model_id))

    async def record_event(
        self,
        model_id: UUID,
        org_id: Optional[UUID] = None,
        is_high_quality: bool = False,
    ) -> TriggerEvaluation:
        """Record a feedback event and evaluate triggers.

        Args:
            model_id: Model that received feedback
            org_id: Organization (if per-org tracking)
            is_high_quality: Whether correction passed quality filters

        Returns:
            TriggerEvaluation with current status
        """
        async with self._lock:
            config = self._configs.get(model_id)
            if not config:
                return TriggerEvaluation(
                    should_trigger=False,
                    reason="Model not registered for triggers",
                )

            # Get or create state
            state_key = (model_id, org_id if config.per_org else None)
            state = self._states.get(state_key)
            if not state:
                state = TriggerState(model_id=model_id, org_id=org_id)
                self._states[state_key] = state

            # Update counts
            state.event_count += 1
            if is_high_quality:
                state.high_quality_count += 1
            state.last_event_at = datetime.now(timezone.utc)
            state.updated_at = datetime.now(timezone.utc)

            # Evaluate triggers
            evaluation = self._evaluate_triggers(config, state)

            if evaluation.should_trigger and not evaluation.in_cooldown:
                # Submit training job
                job_id = await self._submit_training(config, state)
                if job_id:
                    state.last_training_at = datetime.now(timezone.utc)
                    state.last_training_job_id = job_id
                    state.training_count += 1
                    state.event_count = 0
                    state.high_quality_count = 0
                    evaluation.trigger_status = TriggerStatus.TRIGGERED
                    evaluation.reason = f"Training job {job_id} submitted"

            return evaluation

    async def update_accuracy(
        self,
        model_id: UUID,
        org_id: Optional[UUID],
        accuracy: float,
    ) -> TriggerEvaluation:
        """Update current accuracy for a model.

        Args:
            model_id: Model identifier
            org_id: Organization (if per-org tracking)
            accuracy: Current accuracy metric (0.0 to 1.0)

        Returns:
            TriggerEvaluation if accuracy drop triggers retraining
        """
        async with self._lock:
            config = self._configs.get(model_id)
            if not config:
                return TriggerEvaluation(
                    should_trigger=False,
                    reason="Model not registered for triggers",
                )

            state_key = (model_id, org_id if config.per_org else None)
            state = self._states.get(state_key)
            if not state:
                state = TriggerState(model_id=model_id, org_id=org_id)
                self._states[state_key] = state

            state.current_accuracy = accuracy
            state.accuracy_updated_at = datetime.now(timezone.utc)
            state.updated_at = datetime.now(timezone.utc)

            # Check if accuracy drop triggers retraining
            evaluation = self._evaluate_triggers(config, state)

            if evaluation.should_trigger and not evaluation.in_cooldown:
                if evaluation.trigger_type == TriggerType.ACCURACY_DROP:
                    job_id = await self._submit_training(config, state)
                    if job_id:
                        state.last_training_at = datetime.now(timezone.utc)
                        state.last_training_job_id = job_id
                        state.training_count += 1
                        evaluation.trigger_status = TriggerStatus.TRIGGERED
                        evaluation.reason = f"Accuracy drop triggered training job {job_id}"

            return evaluation

    def evaluate(
        self,
        model_id: UUID,
        org_id: Optional[UUID] = None,
    ) -> TriggerEvaluation:
        """Evaluate current trigger status without recording an event.

        Args:
            model_id: Model identifier
            org_id: Organization (if per-org tracking)

        Returns:
            Current TriggerEvaluation
        """
        config = self._configs.get(model_id)
        if not config:
            return TriggerEvaluation(
                should_trigger=False,
                reason="Model not registered for triggers",
            )

        state_key = (model_id, org_id if config.per_org else None)
        state = self._states.get(state_key)
        if not state:
            return TriggerEvaluation(
                should_trigger=False,
                event_threshold=config.event_count_threshold,
                time_threshold_hours=config.time_interval_hours,
                accuracy_threshold=config.accuracy_threshold,
                reason="No events recorded yet",
            )

        return self._evaluate_triggers(config, state)

    def get_state(
        self,
        model_id: UUID,
        org_id: Optional[UUID] = None,
    ) -> Optional[TriggerState]:
        """Get current trigger state for a model.

        Args:
            model_id: Model identifier
            org_id: Organization (if per-org tracking)

        Returns:
            TriggerState or None if not tracked
        """
        config = self._configs.get(model_id)
        if not config:
            return None

        state_key = (model_id, org_id if config.per_org else None)
        return self._states.get(state_key)

    def reset_state(
        self,
        model_id: UUID,
        org_id: Optional[UUID] = None,
    ) -> None:
        """Reset trigger state (e.g., after manual training).

        Args:
            model_id: Model identifier
            org_id: Organization (if per-org tracking)
        """
        config = self._configs.get(model_id)
        if not config:
            return

        state_key = (model_id, org_id if config.per_org else None)
        state = self._states.get(state_key)
        if state:
            state.event_count = 0
            state.high_quality_count = 0
            state.last_training_at = datetime.now(timezone.utc)
            state.updated_at = datetime.now(timezone.utc)

            logger.info(
                "Trigger state reset",
                model_id=str(model_id),
                org_id=str(org_id) if org_id else None,
            )

    def _evaluate_triggers(
        self,
        config: TriggerConfig,
        state: TriggerState,
    ) -> TriggerEvaluation:
        """Evaluate all trigger conditions.

        Returns evaluation for the first trigger that fires (by priority):
        1. Accuracy drop (highest priority)
        2. Event count threshold
        3. Time interval
        """
        now = datetime.now(timezone.utc)

        # Check cooldown
        in_cooldown = False
        cooldown_remaining = None
        if state.last_training_at:
            cooldown_end = state.last_training_at + timedelta(hours=config.cooldown_hours)
            if now < cooldown_end:
                in_cooldown = True
                cooldown_remaining = (cooldown_end - now).total_seconds() / 3600

        # Calculate hours since last training
        hours_since_training = None
        if state.last_training_at:
            hours_since_training = (now - state.last_training_at).total_seconds() / 3600

        # Base evaluation
        evaluation = TriggerEvaluation(
            should_trigger=False,
            event_count=state.event_count,
            event_threshold=config.event_count_threshold,
            hours_since_training=hours_since_training,
            time_threshold_hours=config.time_interval_hours,
            current_accuracy=state.current_accuracy,
            accuracy_threshold=config.accuracy_threshold,
            in_cooldown=in_cooldown,
            cooldown_remaining_hours=cooldown_remaining,
        )

        # Check minimum event count
        if state.event_count < config.min_event_count:
            evaluation.reason = f"Below minimum event count ({state.event_count}/{config.min_event_count})"
            return evaluation

        # 1. Check accuracy drop (highest priority)
        if state.current_accuracy is not None:
            if state.current_accuracy < config.accuracy_threshold:
                evaluation.should_trigger = True
                evaluation.trigger_type = TriggerType.ACCURACY_DROP
                evaluation.trigger_status = (
                    TriggerStatus.PENDING_COOLDOWN if in_cooldown
                    else TriggerStatus.THRESHOLD_REACHED
                )
                evaluation.reason = (
                    f"Accuracy {state.current_accuracy:.2%} below threshold "
                    f"{config.accuracy_threshold:.2%}"
                )
                return evaluation

        # 2. Check event count threshold
        if state.event_count >= config.event_count_threshold:
            evaluation.should_trigger = True
            evaluation.trigger_type = TriggerType.EVENT_COUNT
            evaluation.trigger_status = (
                TriggerStatus.PENDING_COOLDOWN if in_cooldown
                else TriggerStatus.THRESHOLD_REACHED
            )
            evaluation.reason = (
                f"Event count {state.event_count} reached threshold "
                f"{config.event_count_threshold}"
            )
            return evaluation

        # 3. Check time interval
        if hours_since_training is not None:
            if hours_since_training >= config.time_interval_hours:
                evaluation.should_trigger = True
                evaluation.trigger_type = TriggerType.TIME_INTERVAL
                evaluation.trigger_status = (
                    TriggerStatus.PENDING_COOLDOWN if in_cooldown
                    else TriggerStatus.THRESHOLD_REACHED
                )
                evaluation.reason = (
                    f"Time since training {hours_since_training:.1f}h exceeded "
                    f"interval {config.time_interval_hours}h"
                )
                return evaluation

        # No triggers met
        evaluation.reason = "No trigger thresholds reached"
        return evaluation

    async def _submit_training(
        self,
        config: TriggerConfig,
        state: TriggerState,
    ) -> Optional[UUID]:
        """Submit a training job via callback."""
        if not self._training_job_submitter:
            logger.warning(
                "No training job submitter configured",
                model_id=str(config.model_id),
            )
            return None

        try:
            org_id = state.org_id if config.per_org else None
            job_id = await self._training_job_submitter(config.model_id, org_id)

            logger.info(
                "Training job submitted by trigger",
                model_id=str(config.model_id),
                org_id=str(org_id) if org_id else None,
                job_id=str(job_id) if job_id else None,
                event_count=state.event_count,
            )

            return job_id

        except Exception as e:
            logger.error(
                "Failed to submit training job",
                model_id=str(config.model_id),
                error=str(e),
            )
            return None


# Default trigger configurations for different model types
DEFAULT_FORM_MATCHING_CONFIG = TriggerConfig(
    model_id=UUID("00000000-0000-0000-0000-000000000001"),  # Placeholder
    event_count_threshold=500,
    min_event_count=50,
    time_interval_hours=168,  # 7 days
    accuracy_threshold=0.85,
    cooldown_hours=4,
    per_org=False,
    min_quality_tier="medium",
)

DEFAULT_ORG_SPECIFIC_CONFIG = TriggerConfig(
    model_id=UUID("00000000-0000-0000-0000-000000000002"),  # Placeholder
    event_count_threshold=100,  # Lower for org-specific
    min_event_count=20,
    time_interval_hours=336,  # 14 days
    accuracy_threshold=0.80,
    cooldown_hours=8,
    per_org=True,
    min_quality_tier="high",  # Higher bar for org-specific
)


# Global manager instance
_trigger_manager: Optional[RetrainingTriggerManager] = None


def get_trigger_manager() -> RetrainingTriggerManager:
    """Get the global trigger manager instance."""
    global _trigger_manager
    if _trigger_manager is None:
        _trigger_manager = RetrainingTriggerManager()
    return _trigger_manager
