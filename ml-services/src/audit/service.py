"""Audit service for event routing and sinks."""

import fnmatch
from datetime import datetime
from typing import List
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.audit.models import AuditEvent, AuditRoute, AuditSink, RiskTier, SinkType
from src.audit.schemas import AuditEventCreate

logger = structlog.get_logger()

# Risk tier ordering for comparison
RISK_TIER_ORDER = {
    RiskTier.LOW: 0,
    RiskTier.MEDIUM: 1,
    RiskTier.HIGH: 2,
    RiskTier.CRITICAL: 3,
}


class AuditService:
    """Service for audit event routing and persistence."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def emit_event(self, data: AuditEventCreate) -> AuditEvent:
        """Emit an audit event and route to appropriate sinks."""
        # Create event
        event = AuditEvent(
            org_id=data.org_id,
            event_type=data.event_type,
            risk_tier=data.risk_tier,
            actor_id=data.actor_id,
            actor_type=data.actor_type,
            event_data=data.event_data,
            source_service=data.source_service,
            correlation_id=data.correlation_id,
            occurred_at=data.occurred_at,
            ingested_at=datetime.utcnow(),
        )
        self.session.add(event)
        await self.session.flush()

        logger.info(
            "Audit event created",
            event_id=str(event.id),
            event_type=event.event_type,
            risk_tier=event.risk_tier,
            org_id=str(event.org_id),
        )

        # Route to sinks
        await self._route_to_sinks(event)

        return event

    async def _route_to_sinks(self, event: AuditEvent) -> None:
        """Route event to matching sinks based on routing rules."""
        # Get applicable routes (org-specific and default)
        result = await self.session.execute(
            select(AuditRoute)
            .where(
                (AuditRoute.org_id == event.org_id) | (AuditRoute.org_id.is_(None))
            )
            .options()
        )
        routes = list(result.scalars().all())

        # Find matching routes
        matched_sinks: set[UUID] = set()

        for route in routes:
            if self._matches_route(event, route):
                matched_sinks.add(route.sink_id)

        if not matched_sinks:
            logger.debug(
                "No routes matched for event",
                event_id=str(event.id),
                event_type=event.event_type,
            )
            return

        # Get sink configs
        result = await self.session.execute(
            select(AuditSink)
            .where(AuditSink.id.in_(matched_sinks))
            .where(AuditSink.is_active == True)
        )
        sinks = list(result.scalars().all())

        # Send to each sink
        for sink in sinks:
            await self._send_to_sink(event, sink)

    def _matches_route(self, event: AuditEvent, route: AuditRoute) -> bool:
        """Check if an event matches a routing rule."""
        # Check event type pattern (glob match)
        if not fnmatch.fnmatch(event.event_type, route.event_type_pattern):
            return False

        # Check risk tier minimum
        event_tier = RISK_TIER_ORDER.get(event.risk_tier, 0)
        min_tier = RISK_TIER_ORDER.get(route.risk_tier_min, 0)

        if event_tier < min_tier:
            return False

        return True

    async def _send_to_sink(self, event: AuditEvent, sink: AuditSink) -> None:
        """Send event to a specific sink."""
        try:
            if sink.sink_type == SinkType.S3:
                await self._send_to_s3(event, sink)
            elif sink.sink_type == SinkType.SECURITY_HUB:
                await self._send_to_security_hub(event, sink)
            # PostgreSQL is already handled by the event creation
            elif sink.sink_type == SinkType.POSTGRESQL:
                pass

            logger.info(
                "Event sent to sink",
                event_id=str(event.id),
                sink_id=str(sink.id),
                sink_type=sink.sink_type,
            )
        except Exception as e:
            logger.error(
                "Failed to send event to sink",
                event_id=str(event.id),
                sink_id=str(sink.id),
                sink_type=sink.sink_type,
                error=str(e),
            )

    async def _send_to_s3(self, event: AuditEvent, sink: AuditSink) -> None:
        """Archive event to S3."""
        # TODO: Implement S3 archiving
        # import aioboto3
        # session = aioboto3.Session()
        # async with session.client('s3') as s3:
        #     await s3.put_object(...)
        pass

    async def _send_to_security_hub(self, event: AuditEvent, sink: AuditSink) -> None:
        """Send event to AWS Security Hub."""
        # TODO: Implement Security Hub integration
        # import aioboto3
        # session = aioboto3.Session()
        # async with session.client('securityhub') as hub:
        #     await hub.batch_import_findings(...)
        pass


# Convenience functions for common event types


async def emit_model_deployed(
    session: AsyncSession,
    org_id: UUID,
    model_id: UUID,
    version_id: UUID,
    environment: str,
    actor_id: UUID,
) -> AuditEvent:
    """Emit a model.deployed event."""
    service = AuditService(session)
    return await service.emit_event(
        AuditEventCreate(
            org_id=org_id,
            event_type="model.deployed",
            risk_tier=RiskTier.MEDIUM,
            actor_id=actor_id,
            actor_type="user",
            event_data={
                "model_id": str(model_id),
                "version_id": str(version_id),
                "environment": environment,
            },
            source_service="ml-services",
            occurred_at=datetime.utcnow(),
        )
    )


async def emit_privacy_budget_exhausted(
    session: AsyncSession,
    org_id: UUID,
    consumed: float,
    budget: float,
) -> AuditEvent:
    """Emit a privacy.budget.exhausted event."""
    service = AuditService(session)
    return await service.emit_event(
        AuditEventCreate(
            org_id=org_id,
            event_type="privacy.budget.exhausted",
            risk_tier=RiskTier.CRITICAL,
            actor_id=None,
            actor_type="system",
            event_data={
                "consumed": consumed,
                "budget": budget,
            },
            source_service="ml-services",
            occurred_at=datetime.utcnow(),
        )
    )
