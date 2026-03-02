"""Audit API endpoints."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.db import get_session
from src.audit.models import AuditEvent, AuditSink, AuditRoute, RiskTier
from src.audit.schemas import (
    AuditEventCreate,
    AuditEventResponse,
    AuditEventListResponse,
    AuditSinkCreate,
    AuditSinkResponse,
    AuditRouteCreate,
    AuditRouteResponse,
)
from src.audit.service import AuditService

router = APIRouter(prefix="/audit")


def get_service(session: AsyncSession = Depends(get_session)) -> AuditService:
    """Dependency to get audit service."""
    return AuditService(session)


# --- Event Endpoints ---


@router.post("/events", response_model=AuditEventResponse, status_code=201)
async def create_audit_event(
    data: AuditEventCreate,
    service: AuditService = Depends(get_service),
) -> AuditEventResponse:
    """Create and route an audit event."""
    event = await service.emit_event(data)
    return AuditEventResponse.model_validate(event)


@router.get("/events", response_model=AuditEventListResponse)
async def list_audit_events(
    org_id: UUID,
    event_type: Optional[str] = Query(None),
    risk_tier: Optional[RiskTier] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> AuditEventListResponse:
    """List audit events with filtering."""
    query = select(AuditEvent).where(AuditEvent.org_id == org_id)

    if event_type:
        query = query.where(AuditEvent.event_type == event_type)
    if risk_tier:
        query = query.where(AuditEvent.risk_tier == risk_tier)
    if start_date:
        query = query.where(AuditEvent.occurred_at >= start_date)
    if end_date:
        query = query.where(AuditEvent.occurred_at <= end_date)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(AuditEvent.occurred_at.desc())

    result = await session.execute(query)
    events = list(result.scalars().all())

    return AuditEventListResponse(
        items=[AuditEventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/events/{event_id}", response_model=AuditEventResponse)
async def get_audit_event(
    event_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> AuditEventResponse:
    """Get audit event by ID."""
    result = await session.execute(
        select(AuditEvent).where(AuditEvent.id == event_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Audit event not found")

    return AuditEventResponse.model_validate(event)


# --- Sink Endpoints ---


@router.get("/sinks", response_model=list[AuditSinkResponse])
async def list_audit_sinks(
    session: AsyncSession = Depends(get_session),
) -> list[AuditSinkResponse]:
    """List all audit sinks."""
    result = await session.execute(select(AuditSink))
    sinks = result.scalars().all()
    return [AuditSinkResponse.model_validate(s) for s in sinks]


@router.post("/sinks", response_model=AuditSinkResponse, status_code=201)
async def create_audit_sink(
    data: AuditSinkCreate,
    session: AsyncSession = Depends(get_session),
) -> AuditSinkResponse:
    """Create an audit sink."""
    sink = AuditSink(
        sink_type=data.sink_type,
        config=data.config,
        is_active=data.is_active,
    )
    session.add(sink)
    await session.flush()
    return AuditSinkResponse.model_validate(sink)


# --- Route Endpoints ---


@router.get("/routes", response_model=list[AuditRouteResponse])
async def list_audit_routes(
    org_id: Optional[UUID] = Query(None),
    session: AsyncSession = Depends(get_session),
) -> list[AuditRouteResponse]:
    """List audit routes, optionally filtered by org."""
    query = select(AuditRoute)
    if org_id:
        query = query.where((AuditRoute.org_id == org_id) | (AuditRoute.org_id.is_(None)))
    result = await session.execute(query)
    routes = result.scalars().all()
    return [AuditRouteResponse.model_validate(r) for r in routes]


@router.post("/routes", response_model=AuditRouteResponse, status_code=201)
async def create_audit_route(
    data: AuditRouteCreate,
    session: AsyncSession = Depends(get_session),
) -> AuditRouteResponse:
    """Create an audit route."""
    route = AuditRoute(
        org_id=data.org_id,
        event_type_pattern=data.event_type_pattern,
        risk_tier_min=data.risk_tier_min,
        sink_id=data.sink_id,
    )
    session.add(route)
    await session.flush()
    return AuditRouteResponse.model_validate(route)
