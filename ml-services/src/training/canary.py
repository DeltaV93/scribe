"""Canary Deployment (PX-887 Phase 3 / PX-895).

Implements staged rollout for new model versions:
- Deploy to ~5% of traffic initially
- Ramp to 50%, then 100%
- Automatic rollback if accuracy drops

Monitors real-time metrics and adjusts traffic allocation
based on performance.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional, Callable, Any
from uuid import UUID
import asyncio

import structlog

logger = structlog.get_logger()


class CanaryStage(str, Enum):
    """Stages of canary deployment."""

    PENDING = "pending"  # Not yet started
    CANARY_5 = "canary_5"  # 5% traffic
    CANARY_25 = "canary_25"  # 25% traffic
    CANARY_50 = "canary_50"  # 50% traffic
    CANARY_75 = "canary_75"  # 75% traffic
    FULL_ROLLOUT = "full_rollout"  # 100% traffic
    ROLLED_BACK = "rolled_back"  # Reverted to previous version
    COMPLETED = "completed"  # Successfully deployed


class HealthStatus(str, Enum):
    """Health status of canary deployment."""

    HEALTHY = "healthy"  # Metrics within thresholds
    DEGRADED = "degraded"  # Some metrics borderline
    UNHEALTHY = "unhealthy"  # Metrics below thresholds


@dataclass
class CanaryMetrics:
    """Real-time metrics for canary monitoring."""

    # Accuracy metrics
    predictions: int = 0
    correct_predictions: int = 0
    accuracy: float = 0.0

    # Latency metrics (ms)
    total_latency: float = 0.0
    p50_latency: float = 0.0
    p99_latency: float = 0.0
    latency_samples: list[float] = field(default_factory=list)

    # Error metrics
    errors: int = 0
    error_rate: float = 0.0

    # Comparison to baseline
    baseline_accuracy: Optional[float] = None
    accuracy_delta: Optional[float] = None

    def update(
        self,
        correct: bool,
        latency_ms: float,
        is_error: bool = False,
    ) -> None:
        """Update metrics with a new prediction."""
        self.predictions += 1
        if correct:
            self.correct_predictions += 1
        if is_error:
            self.errors += 1

        self.total_latency += latency_ms
        self.latency_samples.append(latency_ms)

        # Keep only recent samples for percentile calculation
        if len(self.latency_samples) > 1000:
            self.latency_samples = self.latency_samples[-1000:]

        # Recalculate
        self.accuracy = self.correct_predictions / self.predictions if self.predictions > 0 else 0.0
        self.error_rate = self.errors / self.predictions if self.predictions > 0 else 0.0

        if self.latency_samples:
            sorted_latencies = sorted(self.latency_samples)
            n = len(sorted_latencies)
            self.p50_latency = sorted_latencies[n // 2]
            self.p99_latency = sorted_latencies[min(int(n * 0.99), n - 1)]

        if self.baseline_accuracy is not None:
            self.accuracy_delta = self.accuracy - self.baseline_accuracy


@dataclass
class CanaryThresholds:
    """Thresholds for canary health checks."""

    # Accuracy must not drop more than this percentage
    max_accuracy_drop: float = 0.05  # 5%

    # Maximum error rate
    max_error_rate: float = 0.05  # 5%

    # Maximum p99 latency increase (ms)
    max_latency_increase: float = 200.0

    # Minimum predictions before health check is valid
    min_predictions: int = 100


@dataclass
class CanaryConfig:
    """Configuration for canary deployment."""

    deployment_id: UUID
    model_id: UUID
    new_version_id: UUID
    previous_version_id: Optional[UUID] = None

    # Timing
    stage_duration_minutes: int = 30  # Time per stage before promotion
    max_duration_hours: int = 24  # Maximum total deployment time

    # Stages (traffic percentages)
    stages: list[int] = field(default_factory=lambda: [5, 25, 50, 75, 100])

    # Thresholds
    thresholds: CanaryThresholds = field(default_factory=CanaryThresholds)

    # Auto-promotion/rollback
    auto_promote: bool = True  # Auto-promote if healthy
    auto_rollback: bool = True  # Auto-rollback if unhealthy

    # Notifications
    notify_on_rollback: bool = True
    notify_on_completion: bool = True


@dataclass
class CanaryState:
    """Current state of a canary deployment."""

    config: CanaryConfig
    stage: CanaryStage = CanaryStage.PENDING
    traffic_percentage: int = 0

    # Timing
    started_at: Optional[datetime] = None
    stage_started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Metrics
    canary_metrics: CanaryMetrics = field(default_factory=CanaryMetrics)
    baseline_metrics: CanaryMetrics = field(default_factory=CanaryMetrics)

    # Health
    health_status: HealthStatus = HealthStatus.HEALTHY
    health_checks: int = 0
    failed_health_checks: int = 0
    consecutive_failures: int = 0

    # Rollback info
    rollback_reason: Optional[str] = None

    def get_stage_index(self) -> int:
        """Get current stage index (0-based)."""
        stage_map = {
            CanaryStage.PENDING: -1,
            CanaryStage.CANARY_5: 0,
            CanaryStage.CANARY_25: 1,
            CanaryStage.CANARY_50: 2,
            CanaryStage.CANARY_75: 3,
            CanaryStage.FULL_ROLLOUT: 4,
            CanaryStage.ROLLED_BACK: -1,
            CanaryStage.COMPLETED: 4,
        }
        return stage_map.get(self.stage, -1)


class CanaryDeploymentManager:
    """Manages canary deployments with automated promotion and rollback.

    Monitors metrics, performs health checks, and adjusts traffic
    based on performance.
    """

    def __init__(
        self,
        version_promoter: Optional[Callable[[UUID, UUID], Any]] = None,
        version_rollbacker: Optional[Callable[[UUID, UUID], Any]] = None,
        notifier: Optional[Callable[[str, dict], Any]] = None,
    ):
        """Initialize the canary manager.

        Args:
            version_promoter: Callback to promote a version to production
            version_rollbacker: Callback to rollback to previous version
            notifier: Callback to send notifications
        """
        self._version_promoter = version_promoter
        self._version_rollbacker = version_rollbacker
        self._notifier = notifier

        self._deployments: dict[UUID, CanaryState] = {}
        self._model_deployments: dict[UUID, UUID] = {}  # model_id -> active deployment
        self._monitoring_tasks: dict[UUID, asyncio.Task] = {}

    async def start_deployment(self, config: CanaryConfig) -> CanaryState:
        """Start a new canary deployment.

        Args:
            config: Canary deployment configuration

        Returns:
            CanaryState for the deployment
        """
        # Check for existing deployment
        if config.model_id in self._model_deployments:
            existing_id = self._model_deployments[config.model_id]
            existing = self._deployments.get(existing_id)
            if existing and existing.stage not in (
                CanaryStage.COMPLETED,
                CanaryStage.ROLLED_BACK,
            ):
                raise ValueError(
                    f"Model {config.model_id} already has active deployment {existing_id}"
                )

        # Create state
        state = CanaryState(config=config)
        self._deployments[config.deployment_id] = state
        self._model_deployments[config.model_id] = config.deployment_id

        # Start deployment
        await self._advance_stage(state)

        # Start monitoring task
        task = asyncio.create_task(self._monitor_deployment(config.deployment_id))
        self._monitoring_tasks[config.deployment_id] = task

        logger.info(
            "Canary deployment started",
            deployment_id=str(config.deployment_id),
            model_id=str(config.model_id),
            new_version_id=str(config.new_version_id),
        )

        return state

    async def record_prediction(
        self,
        deployment_id: UUID,
        is_canary: bool,
        correct: bool,
        latency_ms: float,
        is_error: bool = False,
    ) -> None:
        """Record a prediction outcome.

        Args:
            deployment_id: Deployment identifier
            is_canary: Whether this was from the canary version
            correct: Whether prediction was correct
            latency_ms: Prediction latency in milliseconds
            is_error: Whether an error occurred
        """
        state = self._deployments.get(deployment_id)
        if not state:
            return

        if is_canary:
            state.canary_metrics.update(correct, latency_ms, is_error)
        else:
            state.baseline_metrics.update(correct, latency_ms, is_error)

    async def manual_promote(self, deployment_id: UUID) -> CanaryState:
        """Manually promote to next stage.

        Args:
            deployment_id: Deployment to promote

        Returns:
            Updated CanaryState
        """
        state = self._deployments.get(deployment_id)
        if not state:
            raise ValueError(f"Deployment {deployment_id} not found")

        if state.stage in (CanaryStage.COMPLETED, CanaryStage.ROLLED_BACK):
            raise ValueError(f"Deployment already finished")

        await self._advance_stage(state)

        return state

    async def manual_rollback(
        self,
        deployment_id: UUID,
        reason: str = "Manual rollback",
    ) -> CanaryState:
        """Manually rollback deployment.

        Args:
            deployment_id: Deployment to rollback
            reason: Reason for rollback

        Returns:
            Updated CanaryState
        """
        state = self._deployments.get(deployment_id)
        if not state:
            raise ValueError(f"Deployment {deployment_id} not found")

        if state.stage in (CanaryStage.COMPLETED, CanaryStage.ROLLED_BACK):
            raise ValueError(f"Deployment already finished")

        await self._rollback(state, reason)

        return state

    def get_deployment(self, deployment_id: UUID) -> Optional[CanaryState]:
        """Get deployment state."""
        return self._deployments.get(deployment_id)

    def get_active_deployment(self, model_id: UUID) -> Optional[CanaryState]:
        """Get active deployment for a model."""
        deployment_id = self._model_deployments.get(model_id)
        if not deployment_id:
            return None
        return self._deployments.get(deployment_id)

    def should_use_canary(
        self,
        model_id: UUID,
        request_hash: int,
    ) -> tuple[bool, Optional[UUID]]:
        """Determine if a request should use the canary version.

        Args:
            model_id: Model being requested
            request_hash: Hash of request for consistent bucketing

        Returns:
            Tuple of (should_use_canary, deployment_id)
        """
        state = self.get_active_deployment(model_id)
        if not state or state.stage in (
            CanaryStage.PENDING,
            CanaryStage.COMPLETED,
            CanaryStage.ROLLED_BACK,
        ):
            return False, None

        # Use hash for consistent bucketing
        bucket = request_hash % 100
        use_canary = bucket < state.traffic_percentage

        return use_canary, state.config.deployment_id

    def list_deployments(
        self,
        model_id: Optional[UUID] = None,
        active_only: bool = False,
    ) -> list[CanaryState]:
        """List canary deployments."""
        deployments = list(self._deployments.values())

        if model_id:
            deployments = [d for d in deployments if d.config.model_id == model_id]

        if active_only:
            deployments = [
                d for d in deployments
                if d.stage not in (CanaryStage.COMPLETED, CanaryStage.ROLLED_BACK)
            ]

        return deployments

    async def _advance_stage(self, state: CanaryState) -> None:
        """Advance deployment to next stage."""
        now = datetime.now(timezone.utc)
        stages = state.config.stages
        current_index = state.get_stage_index()

        if current_index == -1:
            # Starting deployment
            state.started_at = now
            state.stage_started_at = now
            state.traffic_percentage = stages[0]
            state.stage = self._get_stage_enum(stages[0])
        elif current_index < len(stages) - 1:
            # Move to next stage
            state.stage_started_at = now
            state.traffic_percentage = stages[current_index + 1]
            state.stage = self._get_stage_enum(stages[current_index + 1])

            # Reset consecutive failures on promotion
            state.consecutive_failures = 0
        else:
            # Full rollout complete
            state.stage = CanaryStage.COMPLETED
            state.completed_at = now

            # Promote version
            if self._version_promoter:
                try:
                    await self._version_promoter(
                        state.config.model_id,
                        state.config.new_version_id,
                    )
                except Exception as e:
                    logger.error(
                        "Failed to promote version",
                        deployment_id=str(state.config.deployment_id),
                        error=str(e),
                    )

            # Notify
            if state.config.notify_on_completion and self._notifier:
                await self._notify(
                    "canary_completed",
                    {
                        "deployment_id": str(state.config.deployment_id),
                        "model_id": str(state.config.model_id),
                        "version_id": str(state.config.new_version_id),
                        "final_accuracy": state.canary_metrics.accuracy,
                    },
                )

        logger.info(
            "Canary stage advanced",
            deployment_id=str(state.config.deployment_id),
            stage=state.stage.value,
            traffic_percentage=state.traffic_percentage,
        )

    async def _rollback(self, state: CanaryState, reason: str) -> None:
        """Rollback deployment to previous version."""
        state.stage = CanaryStage.ROLLED_BACK
        state.completed_at = datetime.now(timezone.utc)
        state.rollback_reason = reason
        state.traffic_percentage = 0

        # Rollback version
        if self._version_rollbacker and state.config.previous_version_id:
            try:
                await self._version_rollbacker(
                    state.config.model_id,
                    state.config.previous_version_id,
                )
            except Exception as e:
                logger.error(
                    "Failed to rollback version",
                    deployment_id=str(state.config.deployment_id),
                    error=str(e),
                )

        # Notify
        if state.config.notify_on_rollback and self._notifier:
            await self._notify(
                "canary_rolled_back",
                {
                    "deployment_id": str(state.config.deployment_id),
                    "model_id": str(state.config.model_id),
                    "version_id": str(state.config.new_version_id),
                    "reason": reason,
                    "accuracy": state.canary_metrics.accuracy,
                    "baseline_accuracy": state.baseline_metrics.accuracy,
                },
            )

        # Cancel monitoring task
        task = self._monitoring_tasks.pop(state.config.deployment_id, None)
        if task:
            task.cancel()

        logger.warning(
            "Canary deployment rolled back",
            deployment_id=str(state.config.deployment_id),
            reason=reason,
        )

    async def _monitor_deployment(self, deployment_id: UUID) -> None:
        """Background task to monitor deployment health."""
        try:
            while True:
                await asyncio.sleep(60)  # Check every minute

                state = self._deployments.get(deployment_id)
                if not state or state.stage in (
                    CanaryStage.COMPLETED,
                    CanaryStage.ROLLED_BACK,
                ):
                    break

                # Perform health check
                await self._health_check(state)

                # Check if ready for promotion
                if state.config.auto_promote and state.health_status == HealthStatus.HEALTHY:
                    now = datetime.now(timezone.utc)
                    if state.stage_started_at:
                        stage_duration = (now - state.stage_started_at).total_seconds() / 60
                        if stage_duration >= state.config.stage_duration_minutes:
                            await self._advance_stage(state)

                # Check max duration
                if state.started_at:
                    total_duration = (datetime.now(timezone.utc) - state.started_at).total_seconds() / 3600
                    if total_duration >= state.config.max_duration_hours:
                        if state.health_status == HealthStatus.HEALTHY:
                            # Force completion
                            state.stage = CanaryStage.FULL_ROLLOUT
                            await self._advance_stage(state)
                        else:
                            await self._rollback(state, "Max duration exceeded with unhealthy status")

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(
                "Error in canary monitoring",
                deployment_id=str(deployment_id),
                error=str(e),
            )

    async def _health_check(self, state: CanaryState) -> HealthStatus:
        """Perform health check on canary deployment."""
        state.health_checks += 1
        thresholds = state.config.thresholds

        # Need minimum predictions for valid check
        if state.canary_metrics.predictions < thresholds.min_predictions:
            return HealthStatus.HEALTHY  # Not enough data yet

        # Set baseline for comparison
        if state.baseline_metrics.accuracy > 0:
            state.canary_metrics.baseline_accuracy = state.baseline_metrics.accuracy

        # Check accuracy drop
        if state.canary_metrics.baseline_accuracy is not None:
            accuracy_drop = state.canary_metrics.baseline_accuracy - state.canary_metrics.accuracy
            if accuracy_drop > thresholds.max_accuracy_drop:
                state.health_status = HealthStatus.UNHEALTHY
                state.failed_health_checks += 1
                state.consecutive_failures += 1

                if state.config.auto_rollback and state.consecutive_failures >= 3:
                    await self._rollback(
                        state,
                        f"Accuracy drop {accuracy_drop:.2%} exceeds threshold {thresholds.max_accuracy_drop:.2%}",
                    )

                return HealthStatus.UNHEALTHY

        # Check error rate
        if state.canary_metrics.error_rate > thresholds.max_error_rate:
            state.health_status = HealthStatus.UNHEALTHY
            state.failed_health_checks += 1
            state.consecutive_failures += 1

            if state.config.auto_rollback and state.consecutive_failures >= 3:
                await self._rollback(
                    state,
                    f"Error rate {state.canary_metrics.error_rate:.2%} exceeds threshold {thresholds.max_error_rate:.2%}",
                )

            return HealthStatus.UNHEALTHY

        # Check latency
        if state.baseline_metrics.p99_latency > 0:
            latency_increase = state.canary_metrics.p99_latency - state.baseline_metrics.p99_latency
            if latency_increase > thresholds.max_latency_increase:
                state.health_status = HealthStatus.DEGRADED
                return HealthStatus.DEGRADED

        # Healthy
        state.health_status = HealthStatus.HEALTHY
        state.consecutive_failures = 0

        return HealthStatus.HEALTHY

    def _get_stage_enum(self, percentage: int) -> CanaryStage:
        """Get stage enum from percentage."""
        stage_map = {
            5: CanaryStage.CANARY_5,
            25: CanaryStage.CANARY_25,
            50: CanaryStage.CANARY_50,
            75: CanaryStage.CANARY_75,
            100: CanaryStage.FULL_ROLLOUT,
        }
        return stage_map.get(percentage, CanaryStage.CANARY_5)

    async def _notify(self, event_type: str, data: dict) -> None:
        """Send notification via callback."""
        if self._notifier:
            try:
                await self._notifier(event_type, data)
            except Exception as e:
                logger.error(
                    "Failed to send notification",
                    event_type=event_type,
                    error=str(e),
                )


# Global manager instance
_canary_manager: Optional[CanaryDeploymentManager] = None


def get_canary_manager() -> CanaryDeploymentManager:
    """Get the global canary deployment manager instance."""
    global _canary_manager
    if _canary_manager is None:
        _canary_manager = CanaryDeploymentManager()
    return _canary_manager
