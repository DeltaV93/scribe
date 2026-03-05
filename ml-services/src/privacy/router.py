"""Privacy API endpoints (PX-897).

Implements the privacy endpoints from the spec:
- GET /v1/privacy/budget/{org_id} - get remaining budget
- POST /v1/privacy/query - execute DP query
- GET /v1/privacy/groups/{org_id} - list grouping keys with sizes
- POST /v1/privacy/synthesis/trigger - trigger synthesis (internal)
- GET /v1/privacy/ledger/{org_id} - get budget consumption history

References:
- Spec: docs/specs/PX-887-897-898-ml-foundation-spec.md (Section 4.3)
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.db import get_session
from src.common.exceptions import PrivacyBudgetExhausted
from src.privacy.dp_engine import DifferentialPrivacyEngine, QueryType, check_opendp_available
from src.privacy.budget_tracker import PrivacyBudgetTracker
from src.privacy.grouping import GroupingKey, GroupingService, MINIMUM_CORRECTIONS_THRESHOLD
from src.privacy.schemas import (
    PrivacyBudgetResponse,
    BudgetConsumptionRequest,
    BudgetConsumptionResponse,
    DPQueryRequest,
    DPQueryResponse,
    GroupingKeyResponse,
    GroupStatsResponse,
    GroupListResponse,
    PrivacyLedgerEntryResponse,
    PrivacyLedgerListResponse,
)

logger = structlog.get_logger()

router = APIRouter(prefix="/privacy", tags=["privacy"])


def _add_cache_headers(response: Response, max_age: int = 30) -> None:
    """Add cache headers to response."""
    response.headers["Cache-Control"] = f"private, max-age={max_age}"


# === Budget Endpoints ===


@router.get("/budget/{org_id}", response_model=PrivacyBudgetResponse)
async def get_privacy_budget(
    org_id: UUID,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> PrivacyBudgetResponse:
    """Get remaining privacy budget for an organization.

    Returns current budget status including:
    - Total budget and consumed epsilon
    - Remaining budget
    - Consumption rate over last 30 days
    - Projected exhaustion date
    - Exhaustion/near-exhaustion flags

    Args:
        org_id: Organization ID to query.
        response: FastAPI response for headers.
        session: Database session.

    Returns:
        PrivacyBudgetResponse with budget status.

    Raises:
        HTTPException: 404 if org profile not found.
    """
    tracker = PrivacyBudgetTracker(session)

    try:
        status = await tracker.get_remaining_budget(org_id)
        consumption_rate = await tracker.calculate_consumption_rate(org_id)
        exhaustion_date = await tracker.project_exhaustion_date(org_id)

        result = PrivacyBudgetResponse(
            org_id=org_id,
            epsilon_budget=status.epsilon_budget,
            epsilon_consumed=status.epsilon_consumed,
            epsilon_remaining=status.epsilon_remaining,
            consumption_rate_30d=consumption_rate,
            projected_exhaustion_date=exhaustion_date,
            is_exhausted=status.is_exhausted,
            is_near_exhaustion=status.is_near_exhaustion,
        )

        # Short cache for budget status
        _add_cache_headers(response, max_age=30)

        logger.info(
            "budget_retrieved",
            org_id=str(org_id),
            remaining=status.epsilon_remaining,
            is_exhausted=status.is_exhausted,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/budget/{org_id}/consume", response_model=BudgetConsumptionResponse)
async def consume_budget(
    org_id: UUID,
    request: BudgetConsumptionRequest,
    session: AsyncSession = Depends(get_session),
) -> BudgetConsumptionResponse:
    """Consume privacy budget for an operation.

    This endpoint atomically consumes budget and records in the ledger.
    Use this when performing operations that require privacy budget.

    Args:
        org_id: Organization ID.
        request: Consumption request details.
        session: Database session.

    Returns:
        BudgetConsumptionResponse with result.

    Raises:
        HTTPException: 403 if budget exhausted, 404 if org not found.
    """
    tracker = PrivacyBudgetTracker(session)

    try:
        result = await tracker.consume_budget(
            org_id=org_id,
            epsilon_amount=request.epsilon_amount,
            operation_type=request.operation_type,
            model_id=request.model_id,
            model_version_id=request.model_version_id,
            extra_data=request.extra_data,
        )

        logger.info(
            "budget_consumed",
            org_id=str(org_id),
            epsilon=request.epsilon_amount,
            operation=request.operation_type,
            remaining=result.epsilon_remaining,
        )

        return BudgetConsumptionResponse(
            success=result.success,
            epsilon_consumed=result.epsilon_consumed,
            epsilon_remaining=result.epsilon_remaining,
            ledger_id=result.ledger_id,
        )

    except PrivacyBudgetExhausted as e:
        raise HTTPException(status_code=403, detail=e.message)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# === DP Query Endpoints ===


@router.post("/query", response_model=DPQueryResponse)
async def execute_dp_query(
    request: DPQueryRequest,
    session: AsyncSession = Depends(get_session),
) -> DPQueryResponse:
    """Execute a differentially private query on data.

    Supports query types:
    - count: Count with Laplace noise
    - sum: Sum with bounded sensitivity
    - mean: Mean with bounded data
    - histogram: Histogram with DP noise per bin

    Automatically consumes privacy budget from the organization.

    Args:
        request: Query request with data and parameters.
        session: Database session.

    Returns:
        DPQueryResponse with noisy result and metadata.

    Raises:
        HTTPException: 400 if invalid params, 403 if budget exhausted.
    """
    if not check_opendp_available():
        raise HTTPException(
            status_code=503,
            detail="OpenDP not available. Install with: pip install 'ml-services[privacy]'",
        )

    # Validate query type
    try:
        query_type = QueryType(request.query_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid query_type: {request.query_type}. Must be one of: count, sum, mean, histogram",
        )

    # Use provided epsilon or compute required
    dp_engine = DifferentialPrivacyEngine()
    epsilon = request.epsilon or dp_engine.compute_required_epsilon(
        query_type=query_type,
        sensitivity=request.sensitivity,
    )

    # Check budget
    tracker = PrivacyBudgetTracker(session)
    try:
        can_proceed = await tracker.check_can_consume(request.org_id, epsilon)
        if not can_proceed:
            status = await tracker.get_remaining_budget(request.org_id)
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient privacy budget. Required: {epsilon}, Remaining: {status.epsilon_remaining}",
            )

        # Execute query
        result = dp_engine.apply_dp(
            data=request.data,
            epsilon=epsilon,
            sensitivity=request.sensitivity,
            query_type=query_type,
            bounds=request.bounds,
        )

        # Consume budget
        consumption = await tracker.consume_budget(
            org_id=request.org_id,
            epsilon_amount=result.epsilon_consumed,
            operation_type=f"dp_query_{query_type.value}",
        )

        logger.info(
            "dp_query_executed",
            org_id=str(request.org_id),
            query_type=query_type.value,
            epsilon_consumed=result.epsilon_consumed,
            remaining=consumption.epsilon_remaining,
        )

        return DPQueryResponse(
            value=result.value,
            epsilon_consumed=result.epsilon_consumed,
            noise_scale=result.noise_scale,
            query_type=result.query_type.value,
            sensitivity=result.sensitivity,
            remaining_budget=consumption.epsilon_remaining,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# === Grouping Endpoints ===


@router.get("/groups/{org_id}", response_model=GroupListResponse)
async def list_grouping_keys(
    org_id: UUID,
    response: Response,
    form_id: Optional[UUID] = Query(None, description="Filter by form ID"),
    include_below_threshold: bool = Query(
        False, description="Include groups below minimum threshold"
    ),
    session: AsyncSession = Depends(get_session),
) -> GroupListResponse:
    """List grouping keys with sizes for an organization.

    Returns groups that corrections can be aggregated into,
    along with counts and whether they meet the minimum threshold.

    Args:
        org_id: Organization ID to query.
        form_id: Optional form ID to filter groups.
        include_below_threshold: Whether to include groups below threshold.
        session: Database session.

    Returns:
        GroupListResponse with list of groups.
    """
    # In production, would fetch actual corrections from database
    # For now, return empty list structure
    groups: list[GroupStatsResponse] = []
    groups_meeting_threshold = 0

    # Example structure for when corrections exist:
    # grouping_service = GroupingService()
    # corrections = await fetch_corrections(session, org_id, form_id)
    # viable_groups = grouping_service.find_viable_groupings(corrections)
    # for key, stats in viable_groups.items():
    #     if stats.meets_threshold or include_below_threshold:
    #         groups.append(...)

    _add_cache_headers(response, max_age=60)

    logger.debug(
        "groups_listed",
        org_id=str(org_id),
        form_id=str(form_id) if form_id else None,
        total_groups=len(groups),
    )

    return GroupListResponse(
        org_id=org_id,
        groups=groups,
        total_groups=len(groups),
        groups_meeting_threshold=groups_meeting_threshold,
    )


# === Ledger Endpoints ===


@router.get("/ledger/{org_id}", response_model=PrivacyLedgerListResponse)
async def get_privacy_ledger(
    org_id: UUID,
    response: Response,
    since: Optional[datetime] = Query(None, description="Filter entries after this date"),
    limit: int = Query(100, ge=1, le=500, description="Maximum entries to return"),
    session: AsyncSession = Depends(get_session),
) -> PrivacyLedgerListResponse:
    """Get privacy budget consumption history.

    Returns the immutable ledger of budget consumption for auditing.

    Args:
        org_id: Organization ID to query.
        since: Optional start date filter.
        limit: Maximum entries to return.
        session: Database session.

    Returns:
        PrivacyLedgerListResponse with ledger entries.
    """
    tracker = PrivacyBudgetTracker(session)

    try:
        entries = await tracker.get_consumption_history(
            org_id=org_id,
            since=since,
            limit=limit,
        )

        total_epsilon = sum(e.epsilon_consumed for e in entries)

        _add_cache_headers(response, max_age=30)

        logger.debug(
            "ledger_retrieved",
            org_id=str(org_id),
            entry_count=len(entries),
            total_epsilon=total_epsilon,
        )

        return PrivacyLedgerListResponse(
            entries=[PrivacyLedgerEntryResponse.model_validate(e) for e in entries],
            total_epsilon=total_epsilon,
            entry_count=len(entries),
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# === Health Check ===


@router.get("/health")
async def privacy_health_check() -> dict:
    """Check privacy service health.

    Returns:
        Health status including OpenDP availability.
    """
    return {
        "status": "healthy",
        "opendp_available": check_opendp_available(),
        "minimum_corrections_threshold": MINIMUM_CORRECTIONS_THRESHOLD,
    }
