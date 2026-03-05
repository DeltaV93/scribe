"""Pydantic schemas for Privacy API."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from src.privacy.grouping import ActionType, MeetingType, Industry


# === Budget Schemas ===


class PrivacyBudgetResponse(BaseModel):
    """Response schema for privacy budget status."""

    org_id: UUID
    epsilon_budget: float
    epsilon_consumed: float
    epsilon_remaining: float
    consumption_rate_30d: float = Field(
        default=0.0,
        description="Average daily epsilon consumption over last 30 days",
    )
    projected_exhaustion_date: Optional[datetime] = Field(
        default=None,
        description="Projected date when budget will be exhausted",
    )
    is_exhausted: bool
    is_near_exhaustion: bool = Field(
        default=False,
        description="True if consumption >= 80%",
    )


class BudgetConsumptionRequest(BaseModel):
    """Request to consume privacy budget."""

    epsilon_amount: float = Field(..., gt=0, description="Amount of epsilon to consume")
    operation_type: str = Field(..., description="Type of operation consuming budget")
    model_id: Optional[UUID] = None
    model_version_id: Optional[UUID] = None
    extra_data: Optional[Dict[str, Any]] = None


class BudgetConsumptionResponse(BaseModel):
    """Response from budget consumption."""

    success: bool
    epsilon_consumed: float
    epsilon_remaining: float
    ledger_id: Optional[UUID] = None
    error_message: Optional[str] = None


# === DP Query Schemas ===


class DPQueryRequest(BaseModel):
    """Request to execute a DP query."""

    org_id: UUID = Field(..., description="Organization ID for budget tracking")
    data: List[float] = Field(..., description="Data to query")
    query_type: str = Field(
        default="count",
        description="Type of query: count, sum, mean, histogram",
    )
    epsilon: Optional[float] = Field(
        default=None,
        gt=0,
        le=1.0,
        description="Privacy budget for this query",
    )
    sensitivity: float = Field(
        default=1.0,
        gt=0,
        description="Query sensitivity",
    )
    bounds: Optional[tuple[float, float]] = Field(
        default=None,
        description="Optional bounds for bounded queries",
    )


class DPQueryResponse(BaseModel):
    """Response from a DP query."""

    value: Any
    epsilon_consumed: float
    noise_scale: float
    query_type: str
    sensitivity: float
    remaining_budget: float


# === Grouping Schemas ===


class GroupingKeyResponse(BaseModel):
    """Response schema for a grouping key."""

    key_string: str
    form_id: Optional[UUID] = None
    action_type: Optional[str] = None
    meeting_type: Optional[str] = None
    industry: Optional[str] = None
    specificity: int = Field(description="Number of dimensions specified")


class GroupStatsResponse(BaseModel):
    """Response schema for group statistics."""

    grouping_key: GroupingKeyResponse
    correction_count: int
    org_count: int
    meets_threshold: bool
    threshold: int = 50


class GroupListResponse(BaseModel):
    """Response for listing grouping keys with sizes."""

    org_id: UUID
    groups: List[GroupStatsResponse]
    total_groups: int
    groups_meeting_threshold: int


# === Synthesis Schemas ===


class SynthesisRequest(BaseModel):
    """Request to trigger synthesis."""

    org_id: UUID
    form_id: Optional[UUID] = None
    correction_ids: Optional[List[UUID]] = None


class SynthesizedCorrectionResponse(BaseModel):
    """Response schema for a synthesized correction."""

    id: UUID
    grouping_key: str
    synthesized_data: Dict[str, Any]
    noise_applied: float
    epsilon_consumed: float
    source_correction_count: int
    source_org_count: int
    created_at: datetime


class SynthesisBatchResponse(BaseModel):
    """Response schema for a synthesis batch."""

    id: UUID
    grouping_key: str
    corrections: List[SynthesizedCorrectionResponse]
    total_epsilon_consumed: float
    correction_count: int
    org_count: int
    status: str
    created_at: datetime
    synthesized_at: Optional[datetime] = None


class SynthesisBatchListResponse(BaseModel):
    """Response for listing synthesis batches."""

    batches: List[SynthesisBatchResponse]
    total: int
    page: int
    page_size: int


# === Validation Schemas ===


class ValidationErrorResponse(BaseModel):
    """Response for validation errors."""

    is_valid: bool
    errors: List[str]
    warnings: List[str] = Field(default_factory=list)


# === Ledger Schemas ===


class PrivacyLedgerEntryResponse(BaseModel):
    """Response schema for a privacy ledger entry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    epsilon_consumed: float
    operation_type: str
    model_id: Optional[UUID]
    model_version_id: Optional[UUID]
    recorded_at: datetime
    extra_data: Optional[Dict[str, Any]]


class PrivacyLedgerListResponse(BaseModel):
    """Response for listing ledger entries."""

    entries: List[PrivacyLedgerEntryResponse]
    total_epsilon: float
    entry_count: int
