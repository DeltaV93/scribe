"""Privacy Budget Tracker for managing epsilon consumption.

Tracks per-organization differential privacy budget consumption with:
- Atomic budget consumption using database transactions
- Budget exhaustion alerts and handling
- Ledger recording for audit trail
- Budget reset scheduling

References:
- Spec: docs/specs/PX-887-897-898-ml-foundation-spec.md (US-897-1)
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.exceptions import PrivacyBudgetExhausted
from src.org_profile.models import OrgProfile, PrivacyLedger

logger = structlog.get_logger()


@dataclass
class BudgetStatus:
    """Current privacy budget status for an organization."""

    org_id: UUID
    epsilon_budget: float
    epsilon_consumed: float
    epsilon_remaining: float
    budget_reset_at: Optional[datetime]
    is_exhausted: bool
    consumption_percentage: float

    @property
    def is_near_exhaustion(self) -> bool:
        """Check if budget is at or above 80% consumed (alert threshold)."""
        return self.consumption_percentage >= 80.0


@dataclass
class ConsumptionResult:
    """Result of a budget consumption attempt."""

    success: bool
    epsilon_consumed: float
    epsilon_remaining: float
    ledger_id: Optional[UUID] = None
    error_message: Optional[str] = None


class PrivacyBudgetTracker:
    """Tracks and manages privacy budget consumption per organization.

    Implements atomic budget consumption with:
    - Optimistic locking via database transactions
    - Immutable ledger recording for audit trail
    - Alert thresholds at 80% consumption
    - Budget exhaustion handling

    Example:
        tracker = PrivacyBudgetTracker(session)

        # Check if operation is allowed
        if await tracker.check_can_consume(org_id, 0.1):
            result = await tracker.consume_budget(org_id, 0.1, "dp_query")
    """

    # Alert threshold - warn when 80% consumed
    ALERT_THRESHOLD_PERCENTAGE: float = 80.0

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the budget tracker.

        Args:
            session: SQLAlchemy async session for database operations.
        """
        self.session = session
        self._logger = logger.bind(component="privacy_budget_tracker")

    async def get_remaining_budget(self, org_id: UUID) -> BudgetStatus:
        """Get remaining privacy budget for an organization.

        Args:
            org_id: Organization ID to check.

        Returns:
            BudgetStatus with current budget information.

        Raises:
            ValueError: If org profile not found.
        """
        profile = await self._get_org_profile(org_id)

        remaining = max(0.0, profile.epsilon_budget - profile.epsilon_consumed)
        is_exhausted = remaining <= 0
        consumption_pct = (
            (profile.epsilon_consumed / profile.epsilon_budget * 100)
            if profile.epsilon_budget > 0
            else 100.0
        )

        status = BudgetStatus(
            org_id=org_id,
            epsilon_budget=profile.epsilon_budget,
            epsilon_consumed=profile.epsilon_consumed,
            epsilon_remaining=remaining,
            budget_reset_at=profile.budget_reset_at,
            is_exhausted=is_exhausted,
            consumption_percentage=min(100.0, consumption_pct),
        )

        self._logger.debug(
            "budget_status_retrieved",
            org_id=str(org_id),
            remaining=remaining,
            consumed=profile.epsilon_consumed,
            is_exhausted=is_exhausted,
        )

        return status

    async def check_can_consume(self, org_id: UUID, required_epsilon: float) -> bool:
        """Check if an organization can consume the required epsilon.

        Args:
            org_id: Organization ID to check.
            required_epsilon: Amount of epsilon needed for the operation.

        Returns:
            True if the organization has sufficient budget, False otherwise.
        """
        if required_epsilon <= 0:
            return True

        status = await self.get_remaining_budget(org_id)
        can_consume = status.epsilon_remaining >= required_epsilon

        self._logger.debug(
            "budget_check",
            org_id=str(org_id),
            required_epsilon=required_epsilon,
            remaining=status.epsilon_remaining,
            can_consume=can_consume,
        )

        return can_consume

    async def consume_budget(
        self,
        org_id: UUID,
        epsilon_amount: float,
        operation_type: str,
        model_id: Optional[UUID] = None,
        model_version_id: Optional[UUID] = None,
        extra_data: Optional[dict] = None,
    ) -> ConsumptionResult:
        """Atomically consume privacy budget for an organization.

        This method:
        1. Checks if sufficient budget exists
        2. Updates the org profile with new consumption
        3. Records the consumption in the immutable ledger

        Args:
            org_id: Organization ID to consume budget from.
            epsilon_amount: Amount of epsilon to consume.
            operation_type: Type of operation consuming budget (e.g., "dp_query", "synthesis").
            model_id: Optional model ID associated with this consumption.
            model_version_id: Optional model version ID.
            extra_data: Optional additional metadata for the ledger.

        Returns:
            ConsumptionResult indicating success/failure and remaining budget.

        Raises:
            PrivacyBudgetExhausted: If budget is exhausted (can be caught by caller).
        """
        if epsilon_amount <= 0:
            return ConsumptionResult(
                success=True,
                epsilon_consumed=0.0,
                epsilon_remaining=(await self.get_remaining_budget(org_id)).epsilon_remaining,
            )

        self._logger.info(
            "consuming_budget",
            org_id=str(org_id),
            epsilon_amount=epsilon_amount,
            operation_type=operation_type,
        )

        # Get current profile
        profile = await self._get_org_profile(org_id)
        remaining = profile.epsilon_budget - profile.epsilon_consumed

        # Check if sufficient budget
        if remaining < epsilon_amount:
            self._logger.warning(
                "budget_exhausted",
                org_id=str(org_id),
                required=epsilon_amount,
                remaining=remaining,
            )
            raise PrivacyBudgetExhausted(
                org_id=org_id,
                consumed=profile.epsilon_consumed,
                budget=profile.epsilon_budget,
                resets_at=profile.budget_reset_at.isoformat() if profile.budget_reset_at else None,
            )

        # Atomic update - consume budget
        new_consumed = profile.epsilon_consumed + epsilon_amount
        await self.session.execute(
            update(OrgProfile)
            .where(OrgProfile.id == profile.id)
            .values(epsilon_consumed=new_consumed)
        )

        # Record in immutable ledger
        ledger_entry = PrivacyLedger(
            org_profile_id=profile.id,
            epsilon_consumed=epsilon_amount,
            operation_type=operation_type,
            model_id=model_id,
            model_version_id=model_version_id,
            recorded_at=datetime.utcnow(),
            extra_data=extra_data,
        )
        self.session.add(ledger_entry)
        await self.session.flush()

        new_remaining = profile.epsilon_budget - new_consumed

        # Check for alert threshold
        new_pct = (new_consumed / profile.epsilon_budget * 100) if profile.epsilon_budget > 0 else 100
        if new_pct >= self.ALERT_THRESHOLD_PERCENTAGE:
            self._logger.warning(
                "budget_near_exhaustion",
                org_id=str(org_id),
                consumption_percentage=new_pct,
                remaining=new_remaining,
            )

        self._logger.info(
            "budget_consumed",
            org_id=str(org_id),
            epsilon_consumed=epsilon_amount,
            total_consumed=new_consumed,
            remaining=new_remaining,
            ledger_id=str(ledger_entry.id),
        )

        return ConsumptionResult(
            success=True,
            epsilon_consumed=epsilon_amount,
            epsilon_remaining=new_remaining,
            ledger_id=ledger_entry.id,
        )

    async def reset_budget(
        self,
        org_id: UUID,
        new_budget: Optional[float] = None,
        next_reset_at: Optional[datetime] = None,
    ) -> BudgetStatus:
        """Reset privacy budget for an organization.

        Args:
            org_id: Organization ID to reset.
            new_budget: Optional new budget amount (keeps existing if not provided).
            next_reset_at: Optional next reset timestamp.

        Returns:
            Updated BudgetStatus after reset.
        """
        profile = await self._get_org_profile(org_id)

        update_values: dict = {"epsilon_consumed": 0.0}
        if new_budget is not None:
            update_values["epsilon_budget"] = new_budget
        if next_reset_at is not None:
            update_values["budget_reset_at"] = next_reset_at

        await self.session.execute(
            update(OrgProfile)
            .where(OrgProfile.id == profile.id)
            .values(**update_values)
        )
        await self.session.flush()

        self._logger.info(
            "budget_reset",
            org_id=str(org_id),
            new_budget=new_budget or profile.epsilon_budget,
            next_reset_at=str(next_reset_at) if next_reset_at else None,
        )

        return await self.get_remaining_budget(org_id)

    async def get_consumption_history(
        self,
        org_id: UUID,
        since: Optional[datetime] = None,
        limit: int = 100,
    ) -> list[PrivacyLedger]:
        """Get consumption history from the privacy ledger.

        Args:
            org_id: Organization ID to query.
            since: Optional start datetime to filter from.
            limit: Maximum number of records to return.

        Returns:
            List of PrivacyLedger entries.
        """
        profile = await self._get_org_profile(org_id)

        query = (
            select(PrivacyLedger)
            .where(PrivacyLedger.org_profile_id == profile.id)
            .order_by(PrivacyLedger.recorded_at.desc())
            .limit(limit)
        )

        if since:
            query = query.where(PrivacyLedger.recorded_at >= since)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def calculate_consumption_rate(
        self,
        org_id: UUID,
        window_days: int = 30,
    ) -> float:
        """Calculate the epsilon consumption rate over a time window.

        Args:
            org_id: Organization ID to analyze.
            window_days: Number of days to analyze.

        Returns:
            Average daily epsilon consumption rate.
        """
        since = datetime.utcnow() - timedelta(days=window_days)
        history = await self.get_consumption_history(org_id, since=since, limit=1000)

        if not history:
            return 0.0

        total_consumed = sum(entry.epsilon_consumed for entry in history)
        return total_consumed / window_days

    async def project_exhaustion_date(self, org_id: UUID) -> Optional[datetime]:
        """Project when privacy budget will be exhausted.

        Args:
            org_id: Organization ID to project.

        Returns:
            Projected exhaustion date, or None if rate is zero.
        """
        status = await self.get_remaining_budget(org_id)
        if status.is_exhausted:
            return datetime.utcnow()

        rate = await self.calculate_consumption_rate(org_id)
        if rate <= 0:
            return None

        days_remaining = status.epsilon_remaining / rate
        return datetime.utcnow() + timedelta(days=days_remaining)

    async def _get_org_profile(self, org_id: UUID) -> OrgProfile:
        """Get org profile by org_id.

        Args:
            org_id: Organization ID.

        Returns:
            OrgProfile instance.

        Raises:
            ValueError: If profile not found.
        """
        result = await self.session.execute(
            select(OrgProfile).where(OrgProfile.org_id == org_id)
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise ValueError(f"Organization profile not found for org_id: {org_id}")

        return profile
