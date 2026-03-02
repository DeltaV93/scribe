"""Org Profile Pydantic schemas."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class OrgProfileCreate(BaseModel):
    """Schema for creating an org profile."""

    org_id: UUID
    compliance_frameworks: List[str] = Field(default_factory=list)
    retention_policies: dict = Field(default_factory=dict)
    privacy_settings: dict = Field(default_factory=dict)
    epsilon_budget: float = Field(default=5.0, ge=0.0)
    model_training_enabled: bool = True
    audit_routing_config: dict = Field(default_factory=dict)


class OrgProfileUpdate(BaseModel):
    """Schema for updating an org profile."""

    compliance_frameworks: Optional[List[str]] = None
    retention_policies: Optional[dict] = None
    privacy_settings: Optional[dict] = None
    epsilon_budget: Optional[float] = Field(None, ge=0.0)
    model_training_enabled: Optional[bool] = None
    audit_routing_config: Optional[dict] = None


class OrgProfileResponse(BaseModel):
    """Schema for org profile response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    compliance_frameworks: List[str]
    retention_policies: dict
    privacy_settings: dict
    epsilon_budget: float
    epsilon_consumed: float
    budget_reset_at: Optional[datetime]
    model_training_enabled: bool
    audit_routing_config: dict
    created_at: datetime
    updated_at: datetime


class PrivacyBudgetResponse(BaseModel):
    """Schema for privacy budget status."""

    org_id: UUID
    epsilon_budget: float
    epsilon_consumed: float
    epsilon_remaining: float
    budget_reset_at: Optional[datetime]
    is_exhausted: bool


class ComplianceStatusResponse(BaseModel):
    """Schema for compliance status."""

    org_id: UUID
    frameworks: List[str]
    overrides_count: int
    last_audit_at: Optional[datetime]


class ComplianceFrameworkResponse(BaseModel):
    """Schema for compliance framework reference."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    default_retention: dict
    required_audit_events: List[str]
    data_handling_rules: dict
