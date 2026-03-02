"""Org Profile API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
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
)
from src.org_profile.exceptions import PrivacyBudgetExhausted

router = APIRouter()


# --- Org Profile Endpoints ---


@router.get("/orgs/{org_id}/profile", response_model=OrgProfileResponse)
async def get_org_profile(
    org_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> OrgProfileResponse:
    """Get org profile by org ID."""
    result = await session.execute(
        select(OrgProfile).where(OrgProfile.org_id == org_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Org profile not found")

    return OrgProfileResponse.model_validate(profile)


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

    if data.compliance_frameworks is not None:
        profile.compliance_frameworks = data.compliance_frameworks
    if data.retention_policies is not None:
        profile.retention_policies = data.retention_policies
    if data.privacy_settings is not None:
        profile.privacy_settings = data.privacy_settings
    if data.epsilon_budget is not None:
        profile.epsilon_budget = data.epsilon_budget
    if data.model_training_enabled is not None:
        profile.model_training_enabled = data.model_training_enabled
    if data.audit_routing_config is not None:
        profile.audit_routing_config = data.audit_routing_config

    await session.flush()

    return OrgProfileResponse.model_validate(profile)


# --- Privacy Budget Endpoints ---


@router.get("/orgs/{org_id}/privacy/budget", response_model=PrivacyBudgetResponse)
async def get_privacy_budget(
    org_id: UUID,
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

    return PrivacyBudgetResponse(
        org_id=org_id,
        epsilon_budget=profile.epsilon_budget,
        epsilon_consumed=profile.epsilon_consumed,
        epsilon_remaining=max(0.0, remaining),
        budget_reset_at=profile.budget_reset_at,
        is_exhausted=remaining <= 0,
    )


# --- Compliance Endpoints ---


@router.get("/orgs/{org_id}/compliance", response_model=ComplianceStatusResponse)
async def get_compliance_status(
    org_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> ComplianceStatusResponse:
    """Get compliance status for an org."""
    result = await session.execute(
        select(OrgProfile).where(OrgProfile.org_id == org_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Org profile not found")

    return ComplianceStatusResponse(
        org_id=org_id,
        frameworks=profile.compliance_frameworks,
        overrides_count=len(profile.compliance_overrides) if profile.compliance_overrides else 0,
        last_audit_at=None,  # TODO: Get from audit events
    )


@router.get("/frameworks", response_model=list[ComplianceFrameworkResponse])
async def list_compliance_frameworks(
    session: AsyncSession = Depends(get_session),
) -> list[ComplianceFrameworkResponse]:
    """List available compliance frameworks."""
    result = await session.execute(select(ComplianceFramework))
    frameworks = result.scalars().all()
    return [ComplianceFrameworkResponse.model_validate(f) for f in frameworks]
