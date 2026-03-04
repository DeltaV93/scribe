"""Org Profile Pydantic schemas."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from src.org_profile.enums import Industry, CompanyType, ModelTier


# === Nested Schemas for Complex Fields ===


class CustomSignals(BaseModel):
    """Custom detection signals configuration."""

    keywords: List[str] = Field(
        default_factory=list,
        description="Keywords to detect in conversations",
    )
    patterns: List[str] = Field(
        default_factory=list,
        description="Regex patterns for structured data (e.g., case numbers, MRNs)",
    )
    weights: dict[str, float] = Field(
        default_factory=dict,
        description="Weight multipliers for specific keywords",
    )


class MatchingRules(BaseModel):
    """Form matching rule configuration."""

    overrides: List[dict] = Field(
        default_factory=list,
        description="Rule overrides for form matching",
    )
    weights: dict[str, float] = Field(
        default_factory=dict,
        description="Weight adjustments for matching rules",
    )
    disabled_rules: List[str] = Field(
        default_factory=list,
        description="Rule IDs to disable",
    )


class RiskOverrides(BaseModel):
    """Per-model risk tier overrides."""

    model_config = ConfigDict(extra="allow")

    # Dynamic keys: model_id -> risk_tier


# === Create/Update/Response Schemas ===


class OrgProfileCreate(BaseModel):
    """Schema for creating an org profile."""

    org_id: UUID

    # Industry & classification
    industry: Optional[str] = Field(
        None, description="Primary industry (nonprofit, healthcare, tech, etc.)"
    )
    secondary_industry: Optional[str] = Field(
        None, description="Secondary industry for hybrid orgs"
    )
    company_type: Optional[str] = Field(
        None, description="Company type (startup, enterprise, nonprofit, government)"
    )
    team_roles: List[str] = Field(
        default_factory=list, description="Team roles in this org"
    )

    # Model configuration
    model_tier: str = Field(
        default="shared", description="Model tier: shared or private"
    )
    data_sharing_consent: bool = Field(
        default=False, description="Consent for global model training"
    )

    # Custom signals & matching
    custom_signals: dict = Field(
        default_factory=dict,
        description="Custom detection signals {keywords, patterns, weights}",
    )
    matching_rules: dict = Field(
        default_factory=dict,
        description="Form matching rule config {overrides, weights, disabled_rules}",
    )
    risk_overrides: dict = Field(
        default_factory=dict,
        description="Per-model risk tier overrides {model_id: risk_tier}",
    )

    # Compliance & privacy (existing)
    compliance_frameworks: List[str] = Field(default_factory=list)
    retention_policies: dict = Field(default_factory=dict)
    privacy_settings: dict = Field(default_factory=dict)
    epsilon_budget: float = Field(default=5.0, ge=0.0)
    model_training_enabled: bool = True
    audit_routing_config: dict = Field(default_factory=dict)


class OrgProfileUpdate(BaseModel):
    """Schema for updating an org profile."""

    # Industry & classification
    industry: Optional[str] = None
    secondary_industry: Optional[str] = None
    company_type: Optional[str] = None
    team_roles: Optional[List[str]] = None

    # Model configuration
    model_tier: Optional[str] = None
    data_sharing_consent: Optional[bool] = None

    # Custom signals & matching
    custom_signals: Optional[dict] = None
    matching_rules: Optional[dict] = None
    risk_overrides: Optional[dict] = None

    # Compliance & privacy (existing)
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

    # Industry & classification (new)
    industry: Optional[str]
    secondary_industry: Optional[str]
    company_type: Optional[str]
    team_roles: List[str]

    # Model configuration (new)
    model_tier: str
    data_sharing_consent: bool

    # Custom signals & matching (new)
    custom_signals: dict
    matching_rules: dict
    risk_overrides: dict

    # Compliance & privacy (existing)
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


# === Industry Defaults Schemas ===


class IndustryCustomSignals(BaseModel):
    """Custom signals for an industry default."""

    keywords: List[str] = Field(default_factory=list)
    patterns: List[str] = Field(default_factory=list)
    weights: dict[str, float] = Field(default_factory=dict)


class IndustryDefaultResponse(BaseModel):
    """Schema for industry default configuration."""

    id: str
    name: str
    description: str
    suggested_compliance: List[str]
    team_roles: List[str]
    custom_signals: IndustryCustomSignals
    meeting_signals: List[str]


class IndustryListResponse(BaseModel):
    """Schema for listing available industries."""

    industries: List[IndustryDefaultResponse]
    total: int
