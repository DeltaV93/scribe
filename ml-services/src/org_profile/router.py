"""Org Profile API endpoints."""

import hashlib
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.db import get_session
from src.org_profile.models import OrgProfile, ComplianceFramework
from src.org_profile.schemas import (
    OrgProfileCreate,
    OrgProfileUpdate,
    OrgProfileResponse,
    PrivacyBudgetResponse,
    ComplianceStatusResponse,
    ComplianceFrameworkResponse,
    IndustryDefaultResponse,
    IndustryListResponse,
    IndustryCustomSignals,
)
from src.org_profile.exceptions import PrivacyBudgetExhausted
from src.org_profile.cache_events import emit_profile_updated
from src.org_profile.industry_defaults import (
    list_industries as list_industry_defaults,
    get_industry as get_industry_default,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _compute_etag(data: dict[str, Any]) -> str:
    """Compute ETag hash from response data."""
    import json

    content = json.dumps(data, sort_keys=True, default=str)
    return hashlib.md5(content.encode()).hexdigest()


def _add_cache_headers(response: Response, etag: str, max_age: int = 60) -> None:
    """Add Cache-Control and ETag headers to response."""
    response.headers["ETag"] = f'"{etag}"'
    response.headers["Cache-Control"] = f"private, max-age={max_age}"


# --- Industry Endpoints ---


@router.get("/industries", response_model=IndustryListResponse)
async def list_industries(response: Response) -> IndustryListResponse:
    """List available industry configurations with default signals and roles."""
    industries = list_industry_defaults()

    result = IndustryListResponse(
        industries=[
            IndustryDefaultResponse(
                id=ind.id,
                name=ind.name,
                description=ind.description,
                suggested_compliance=ind.suggested_compliance,
                team_roles=ind.team_roles,
                custom_signals=IndustryCustomSignals(
                    keywords=ind.custom_signals.keywords,
                    patterns=ind.custom_signals.patterns,
                    weights=ind.custom_signals.weights,
                ),
                meeting_signals=ind.meeting_signals,
            )
            for ind in industries
        ],
        total=len(industries),
    )

    # Add cache headers (industries rarely change)
    etag = _compute_etag(result.model_dump())
    _add_cache_headers(response, etag, max_age=3600)

    return result


@router.get("/industries/{industry_id}", response_model=IndustryDefaultResponse)
async def get_industry(industry_id: str, response: Response) -> IndustryDefaultResponse:
    """Get a specific industry configuration."""
    industry = get_industry_default(industry_id)

    if not industry:
        raise HTTPException(status_code=404, detail=f"Industry '{industry_id}' not found")

    result = IndustryDefaultResponse(
        id=industry.id,
        name=industry.name,
        description=industry.description,
        suggested_compliance=industry.suggested_compliance,
        team_roles=industry.team_roles,
        custom_signals=IndustryCustomSignals(
            keywords=industry.custom_signals.keywords,
            patterns=industry.custom_signals.patterns,
            weights=industry.custom_signals.weights,
        ),
        meeting_signals=industry.meeting_signals,
    )

    # Add cache headers
    etag = _compute_etag(result.model_dump())
    _add_cache_headers(response, etag, max_age=3600)

    return result


# --- Org Profile Endpoints ---


@router.get("/orgs/{org_id}/profile", response_model=OrgProfileResponse)
async def get_org_profile(
    org_id: UUID,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> OrgProfileResponse:
    """Get org profile by org ID."""
    result = await session.execute(
        select(OrgProfile).where(OrgProfile.org_id == org_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Org profile not found")

    profile_response = OrgProfileResponse.model_validate(profile)

    # Add cache headers (short TTL since profiles can change)
    etag = _compute_etag(profile_response.model_dump())
    _add_cache_headers(response, etag, max_age=60)

    return profile_response


@router.post("/orgs/{org_id}/profile", response_model=OrgProfileResponse, status_code=201)
async def create_org_profile(
    org_id: UUID,
    data: OrgProfileCreate,
    session: AsyncSession = Depends(get_session),
) -> OrgProfileResponse:
    """Create org profile for an organization."""
    # Check if already exists
    result = await session.execute(
        select(OrgProfile).where(OrgProfile.org_id == org_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Org profile already exists")

    profile = OrgProfile(
        org_id=org_id,
        # New fields
        industry=data.industry,
        secondary_industry=data.secondary_industry,
        company_type=data.company_type,
        team_roles=data.team_roles,
        model_tier=data.model_tier,
        data_sharing_consent=data.data_sharing_consent,
        custom_signals=data.custom_signals,
        matching_rules=data.matching_rules,
        risk_overrides=data.risk_overrides,
        # Existing fields
        compliance_frameworks=data.compliance_frameworks,
        retention_policies=data.retention_policies,
        privacy_settings=data.privacy_settings,
        epsilon_budget=data.epsilon_budget,
        model_training_enabled=data.model_training_enabled,
        audit_routing_config=data.audit_routing_config,
    )
    session.add(profile)
    await session.flush()

    return OrgProfileResponse.model_validate(profile)


@router.put("/orgs/{org_id}/profile", response_model=OrgProfileResponse)
async def update_org_profile(
    org_id: UUID,
    data: OrgProfileUpdate,
    session: AsyncSession = Depends(get_session),
) -> OrgProfileResponse:
    """Update org profile."""
    result = await session.execute(
        select(OrgProfile).where(OrgProfile.org_id == org_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Org profile not found")

    # Track changed fields for cache invalidation
    changed_fields: list[str] = []
    old_values: dict[str, Any] = {}
    new_values: dict[str, Any] = {}

    # New fields (PX-889)
    if data.industry is not None:
        old_values["industry"] = profile.industry
        profile.industry = data.industry
        new_values["industry"] = data.industry
        changed_fields.append("industry")

    if data.secondary_industry is not None:
        old_values["secondary_industry"] = profile.secondary_industry
        profile.secondary_industry = data.secondary_industry
        new_values["secondary_industry"] = data.secondary_industry
        changed_fields.append("secondary_industry")

    if data.company_type is not None:
        old_values["company_type"] = profile.company_type
        profile.company_type = data.company_type
        new_values["company_type"] = data.company_type
        changed_fields.append("company_type")

    if data.team_roles is not None:
        old_values["team_roles"] = profile.team_roles
        profile.team_roles = data.team_roles
        new_values["team_roles"] = data.team_roles
        changed_fields.append("team_roles")

    if data.model_tier is not None:
        old_values["model_tier"] = profile.model_tier
        profile.model_tier = data.model_tier
        new_values["model_tier"] = data.model_tier
        changed_fields.append("model_tier")

    if data.data_sharing_consent is not None:
        old_values["data_sharing_consent"] = profile.data_sharing_consent
        profile.data_sharing_consent = data.data_sharing_consent
        new_values["data_sharing_consent"] = data.data_sharing_consent
        changed_fields.append("data_sharing_consent")

    if data.custom_signals is not None:
        old_values["custom_signals"] = profile.custom_signals
        profile.custom_signals = data.custom_signals
        new_values["custom_signals"] = data.custom_signals
        changed_fields.append("custom_signals")

    if data.matching_rules is not None:
        old_values["matching_rules"] = profile.matching_rules
        profile.matching_rules = data.matching_rules
        new_values["matching_rules"] = data.matching_rules
        changed_fields.append("matching_rules")

    if data.risk_overrides is not None:
        old_values["risk_overrides"] = profile.risk_overrides
        profile.risk_overrides = data.risk_overrides
        new_values["risk_overrides"] = data.risk_overrides
        changed_fields.append("risk_overrides")

    # Existing fields
    if data.compliance_frameworks is not None:
        old_values["compliance_frameworks"] = profile.compliance_frameworks
        profile.compliance_frameworks = data.compliance_frameworks
        new_values["compliance_frameworks"] = data.compliance_frameworks
        changed_fields.append("compliance_frameworks")

    if data.retention_policies is not None:
        old_values["retention_policies"] = profile.retention_policies
        profile.retention_policies = data.retention_policies
        new_values["retention_policies"] = data.retention_policies
        changed_fields.append("retention_policies")

    if data.privacy_settings is not None:
        old_values["privacy_settings"] = profile.privacy_settings
        profile.privacy_settings = data.privacy_settings
        new_values["privacy_settings"] = data.privacy_settings
        changed_fields.append("privacy_settings")

    if data.epsilon_budget is not None:
        old_values["epsilon_budget"] = profile.epsilon_budget
        profile.epsilon_budget = data.epsilon_budget
        new_values["epsilon_budget"] = data.epsilon_budget
        changed_fields.append("epsilon_budget")

    if data.model_training_enabled is not None:
        old_values["model_training_enabled"] = profile.model_training_enabled
        profile.model_training_enabled = data.model_training_enabled
        new_values["model_training_enabled"] = data.model_training_enabled
        changed_fields.append("model_training_enabled")

    if data.audit_routing_config is not None:
        old_values["audit_routing_config"] = profile.audit_routing_config
        profile.audit_routing_config = data.audit_routing_config
        new_values["audit_routing_config"] = data.audit_routing_config
        changed_fields.append("audit_routing_config")

    await session.flush()

    # Emit cache invalidation event if any fields changed
    if changed_fields:
        try:
            await emit_profile_updated(
                org_id=org_id,
                changed_fields=changed_fields,
                old_values=old_values,
                new_values=new_values,
            )
        except Exception as e:
            # Log but don't fail the request if cache event fails
            logger.warning(
                f"Failed to emit profile cache event for org {org_id}: {e}"
            )

    return OrgProfileResponse.model_validate(profile)


# --- Privacy Budget Endpoints ---


@router.get("/orgs/{org_id}/privacy/budget", response_model=PrivacyBudgetResponse)
async def get_privacy_budget(
    org_id: UUID,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> PrivacyBudgetResponse:
    """Get privacy budget status for an org."""
    result = await session.execute(
        select(OrgProfile).where(OrgProfile.org_id == org_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Org profile not found")

    remaining = profile.epsilon_budget - profile.epsilon_consumed

    budget_response = PrivacyBudgetResponse(
        org_id=org_id,
        epsilon_budget=profile.epsilon_budget,
        epsilon_consumed=profile.epsilon_consumed,
        epsilon_remaining=max(0.0, remaining),
        budget_reset_at=profile.budget_reset_at,
        is_exhausted=remaining <= 0,
    )

    # Add cache headers
    etag = _compute_etag(budget_response.model_dump())
    _add_cache_headers(response, etag, max_age=30)

    return budget_response


# --- Compliance Endpoints ---


@router.get("/orgs/{org_id}/compliance", response_model=ComplianceStatusResponse)
async def get_compliance_status(
    org_id: UUID,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> ComplianceStatusResponse:
    """Get compliance status for an org."""
    result = await session.execute(
        select(OrgProfile).where(OrgProfile.org_id == org_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Org profile not found")

    compliance_response = ComplianceStatusResponse(
        org_id=org_id,
        frameworks=profile.compliance_frameworks,
        overrides_count=len(profile.compliance_overrides) if profile.compliance_overrides else 0,
        last_audit_at=None,  # TODO: Get from audit events
    )

    # Add cache headers
    etag = _compute_etag(compliance_response.model_dump())
    _add_cache_headers(response, etag, max_age=60)

    return compliance_response


@router.get("/frameworks", response_model=list[ComplianceFrameworkResponse])
async def list_compliance_frameworks(
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> list[ComplianceFrameworkResponse]:
    """List available compliance frameworks."""
    result = await session.execute(select(ComplianceFramework))
    frameworks = result.scalars().all()
    framework_list = [ComplianceFrameworkResponse.model_validate(f) for f in frameworks]

    # Add cache headers (frameworks rarely change)
    etag = _compute_etag([f.model_dump() for f in framework_list])
    _add_cache_headers(response, etag, max_age=3600)

    return framework_list
