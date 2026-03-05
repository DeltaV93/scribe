"""Audit API endpoints.

Implements PX-898: Risk-Tiered Audit Event Schema & Routing Layer.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.db import get_session
from src.audit.models import AuditEvent, AuditSink, AuditRoute, RiskTier
from src.audit.oracle import AuditOracle, OracleContext, get_audit_oracle
from src.audit.dual_logger import get_dual_audit_logger, AuditEventPayload
from src.audit.schemas import (
    AuditEventCreate,
    AuditEventCreateAutoTier,
    AuditEventResponse,
    AuditEventResponseWithRouting,
    AuditEventListResponse,
    AuditSinkCreate,
    AuditSinkResponse,
    AuditRouteCreate,
    AuditRouteResponse,
    AuditExportRequest,
    AuditExportResponse,
    AuditExportStatusResponse,
    AuditQueueStatus,
    ExportStatus,
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


# --- Auto Risk Tier Endpoints (PX-898) ---


@router.post(
    "/events/auto-tier",
    response_model=AuditEventResponseWithRouting,
    status_code=201,
)
async def create_audit_event_auto_tier(
    data: AuditEventCreateAutoTier,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> AuditEventResponseWithRouting:
    """
    Create an audit event with automatic risk tier detection.

    The oracle layer determines the appropriate risk tier based on:
    - Event type defaults
    - Org profile overrides
    - Model-specific risk tiers
    - Compliance framework requirements

    This endpoint also logs to both customer and internal streams.
    """
    oracle = get_audit_oracle(session)

    # Build oracle context
    context = OracleContext(
        event_type=data.event_type,
        org_id=data.org_id,
        model_id=data.model_id,
        model_version_id=data.model_version_id,
        actor_type=data.actor_type.value if data.actor_type else None,
    )

    # Get routing decision
    decision = await oracle.route_event(context)

    # Create event with determined risk tier
    occurred_at = data.occurred_at or datetime.now(timezone.utc)

    event_create = AuditEventCreate(
        org_id=data.org_id,
        event_type=data.event_type,
        risk_tier=decision.risk_tier,
        actor_id=data.actor_id,
        actor_type=data.actor_type,
        event_data=data.event_data,
        source_service=data.source_service,
        correlation_id=data.correlation_id,
        occurred_at=occurred_at,
        model_id=data.model_id,
        model_version_id=data.model_version_id,
    )

    # Emit event through service
    service = AuditService(session)
    event = await service.emit_event(event_create)

    # Log to dual streams in background
    dual_logger = get_dual_audit_logger()
    event_payload = AuditEventPayload(
        event_id=str(event.id),
        event_type=event.event_type,
        org_id=str(event.org_id),
        risk_tier=event.risk_tier.value if hasattr(event.risk_tier, "value") else event.risk_tier,
        occurred_at=event.occurred_at.isoformat(),
        source_service=event.source_service,
        actor_id=str(event.actor_id) if event.actor_id else None,
        actor_type=event.actor_type.value if hasattr(event.actor_type, "value") else event.actor_type,
        event_data=event.event_data,
        model_id=str(data.model_id) if data.model_id else None,
        model_version_id=str(data.model_version_id) if data.model_version_id else None,
        correlation_id=str(event.correlation_id) if event.correlation_id else None,
        internal_data={
            "routing_source": decision.source,
            "routing_reason": decision.reason,
        },
    )

    background_tasks.add_task(
        dual_logger.log_both,
        event_payload,
        decision.config,
    )

    # Build response with routing info
    response = AuditEventResponseWithRouting.model_validate(event)
    response.routing_source = decision.source
    response.routing_reason = decision.reason

    return response


# --- Export Endpoints (PX-898) ---


# In-memory export job storage (replace with Redis/DB for production)
_export_jobs: dict[UUID, dict] = {}


@router.post("/export", response_model=AuditExportResponse, status_code=202)
async def request_audit_export(
    data: AuditExportRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> AuditExportResponse:
    """
    Request an audit event export.

    Creates an async job that generates a CSV or JSON export of
    audit events matching the specified criteria.

    Returns immediately with a job ID to check status.
    """
    job_id = uuid4()
    created_at = datetime.now(timezone.utc)

    # Store job metadata
    _export_jobs[job_id] = {
        "job_id": job_id,
        "status": ExportStatus.PENDING,
        "created_at": created_at,
        "request": data.model_dump(),
        "completed_at": None,
        "download_url": None,
        "error_message": None,
        "event_count": None,
        "file_size_bytes": None,
    }

    # Queue export task
    background_tasks.add_task(
        _process_export_job,
        job_id,
        data,
        session,
    )

    return AuditExportResponse(
        job_id=job_id,
        status=ExportStatus.PENDING,
        status_url=f"/v1/audit/export/{job_id}",
        created_at=created_at,
    )


@router.get("/export/{job_id}", response_model=AuditExportStatusResponse)
async def get_export_status(job_id: UUID) -> AuditExportStatusResponse:
    """Get the status of an export job."""
    if job_id not in _export_jobs:
        raise HTTPException(status_code=404, detail="Export job not found")

    job = _export_jobs[job_id]
    return AuditExportStatusResponse(**job)


async def _process_export_job(
    job_id: UUID,
    request: AuditExportRequest,
    session: AsyncSession,
) -> None:
    """
    Background task to process an export job.

    Queries events, generates file, uploads to S3, updates job status.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        _export_jobs[job_id]["status"] = ExportStatus.PROCESSING

        # Build query
        query = select(AuditEvent).where(
            AuditEvent.org_id == request.org_id,
            AuditEvent.occurred_at >= request.start_date,
            AuditEvent.occurred_at <= request.end_date,
        )

        if request.event_types:
            query = query.where(AuditEvent.event_type.in_(request.event_types))

        if request.risk_tiers:
            tier_values = [t.value for t in request.risk_tiers]
            query = query.where(AuditEvent.risk_tier.in_(tier_values))

        query = query.order_by(AuditEvent.occurred_at.asc())

        # Execute query
        result = await session.execute(query)
        events = list(result.scalars().all())

        event_count = len(events)

        # Generate export file (simplified - would upload to S3 in production)
        if request.format.value == "json":
            import json
            content = json.dumps(
                [
                    {
                        "id": str(e.id),
                        "event_type": e.event_type,
                        "risk_tier": e.risk_tier.value if hasattr(e.risk_tier, "value") else e.risk_tier,
                        "occurred_at": e.occurred_at.isoformat(),
                        "actor_type": e.actor_type.value if hasattr(e.actor_type, "value") else e.actor_type,
                        "event_data": e.event_data,
                    }
                    for e in events
                ],
                indent=2,
            )
        else:
            # CSV format
            import csv
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["id", "event_type", "risk_tier", "occurred_at", "actor_type"])
            for e in events:
                writer.writerow([
                    str(e.id),
                    e.event_type,
                    e.risk_tier.value if hasattr(e.risk_tier, "value") else e.risk_tier,
                    e.occurred_at.isoformat(),
                    e.actor_type.value if hasattr(e.actor_type, "value") else e.actor_type,
                ])
            content = output.getvalue()

        file_size = len(content.encode("utf-8"))

        # In production, upload to S3 and generate presigned URL
        # For now, just mark as complete with placeholder URL
        download_url = f"/v1/audit/export/{job_id}/download"

        _export_jobs[job_id].update({
            "status": ExportStatus.COMPLETED,
            "completed_at": datetime.now(timezone.utc),
            "download_url": download_url,
            "event_count": event_count,
            "file_size_bytes": file_size,
        })

        logger.info(
            "Export job completed",
            extra={
                "job_id": str(job_id),
                "event_count": event_count,
                "file_size": file_size,
            },
        )

    except Exception as e:
        logger.error(
            "Export job failed",
            extra={"job_id": str(job_id), "error": str(e)},
            exc_info=True,
        )
        _export_jobs[job_id].update({
            "status": ExportStatus.FAILED,
            "completed_at": datetime.now(timezone.utc),
            "error_message": str(e),
        })


# --- Queue Status Endpoints ---


@router.get("/queue/status", response_model=AuditQueueStatus)
async def get_queue_status() -> AuditQueueStatus:
    """
    Get the status of audit event queues.

    Useful for monitoring queue health and backlog.
    """
    dual_logger = get_dual_audit_logger()
    lengths = await dual_logger.get_queue_lengths()

    return AuditQueueStatus(
        customer_queue_length=lengths.get("customer", 0),
        internal_queue_length=lengths.get("internal", 0),
        local_buffer_length=lengths.get("local_buffer", 0),
        healthy=lengths.get("customer", 0) >= 0 and lengths.get("internal", 0) >= 0,
    )


@router.post("/queue/flush", status_code=204)
async def flush_local_buffer() -> None:
    """
    Flush locally buffered events to Redis.

    Call this after Redis reconnection or periodically to ensure
    buffered events are delivered.
    """
    dual_logger = get_dual_audit_logger()
    await dual_logger.flush_buffer()
