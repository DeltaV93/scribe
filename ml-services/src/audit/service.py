"""Audit service for event routing and sinks."""

import fnmatch
import json
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

import aioboto3
import structlog
from botocore.exceptions import ClientError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.audit.models import AuditEvent, AuditRoute, AuditSink, RiskTier, SinkType
from src.audit.schemas import AuditEventCreate
from src.common.config import settings

logger = structlog.get_logger()

# Risk tier ordering for comparison
RISK_TIER_ORDER = {
    RiskTier.LOW: 0,
    RiskTier.MEDIUM: 1,
    RiskTier.HIGH: 2,
    RiskTier.CRITICAL: 3,
}

# Security Hub severity mapping
RISK_TO_SEVERITY = {
    RiskTier.LOW: {"Label": "LOW", "Normalized": 20},
    RiskTier.MEDIUM: {"Label": "MEDIUM", "Normalized": 50},
    RiskTier.HIGH: {"Label": "HIGH", "Normalized": 70},
    RiskTier.CRITICAL: {"Label": "CRITICAL", "Normalized": 90},
}


class AuditService:
    """Service for audit event routing and persistence."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._boto_session: Optional[aioboto3.Session] = None

    @property
    def boto_session(self) -> aioboto3.Session:
        """Lazy-load boto3 session."""
        if self._boto_session is None:
            self._boto_session = aioboto3.Session(region_name=settings.AWS_REGION)
        return self._boto_session

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
            ingested_at=datetime.now(timezone.utc),
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
        """Archive event to S3 with date-partitioned path."""
        bucket = sink.config.get("bucket", settings.AWS_S3_BUCKET_AUDIT)
        prefix = sink.config.get("prefix", "audit-events")

        # Partition by org_id/year/month/day for efficient querying
        occurred = event.occurred_at
        s3_key = (
            f"{prefix}/"
            f"org_id={event.org_id}/"
            f"year={occurred.year}/"
            f"month={occurred.month:02d}/"
            f"day={occurred.day:02d}/"
            f"{event.id}.json"
        )

        # Serialize event to JSON
        event_json = json.dumps(
            {
                "id": str(event.id),
                "org_id": str(event.org_id),
                "event_type": event.event_type,
                "risk_tier": event.risk_tier.value if hasattr(event.risk_tier, "value") else event.risk_tier,
                "actor_id": str(event.actor_id) if event.actor_id else None,
                "actor_type": event.actor_type.value if hasattr(event.actor_type, "value") else event.actor_type,
                "event_data": event.event_data,
                "source_service": event.source_service,
                "correlation_id": str(event.correlation_id) if event.correlation_id else None,
                "occurred_at": event.occurred_at.isoformat(),
                "ingested_at": event.ingested_at.isoformat(),
            },
            default=str,
        )

        try:
            async with self.boto_session.client("s3") as s3:
                await s3.put_object(
                    Bucket=bucket,
                    Key=s3_key,
                    Body=event_json.encode("utf-8"),
                    ContentType="application/json",
                    # Add metadata for easier S3 inventory queries
                    Metadata={
                        "event-type": event.event_type,
                        "risk-tier": str(event.risk_tier),
                        "org-id": str(event.org_id),
                    },
                )

            # Update event with archive path
            event.s3_archive_path = f"s3://{bucket}/{s3_key}"

            logger.debug(
                "Event archived to S3",
                event_id=str(event.id),
                s3_path=event.s3_archive_path,
            )

        except ClientError as e:
            logger.error(
                "S3 upload failed",
                event_id=str(event.id),
                bucket=bucket,
                key=s3_key,
                error=str(e),
            )
            raise

    async def _send_to_security_hub(self, event: AuditEvent, sink: AuditSink) -> None:
        """Send event to AWS Security Hub as a finding."""
        # Get AWS account ID from config or derive from caller identity
        account_id = sink.config.get("account_id", settings.AWS_ACCOUNT_ID)
        product_arn = sink.config.get(
            "product_arn",
            f"arn:aws:securityhub:{settings.AWS_REGION}:{account_id}:product/{account_id}/default",
        )

        # Map risk tier to Security Hub severity
        severity = RISK_TO_SEVERITY.get(
            event.risk_tier, {"Label": "INFORMATIONAL", "Normalized": 0}
        )

        # Build finding
        finding = {
            "SchemaVersion": "2018-10-08",
            "Id": f"inkra-ml-services/{event.id}",
            "ProductArn": product_arn,
            "GeneratorId": "inkra-ml-services-audit",
            "AwsAccountId": account_id,
            "Types": [self._get_finding_type(event.event_type)],
            "CreatedAt": event.occurred_at.isoformat(),
            "UpdatedAt": event.ingested_at.isoformat(),
            "Severity": severity,
            "Title": f"ML Services: {event.event_type}",
            "Description": self._get_finding_description(event),
            "Resources": [
                {
                    "Type": "Other",
                    "Id": f"org/{event.org_id}",
                    "Partition": "aws",
                    "Region": settings.AWS_REGION,
                    "Details": {
                        "Other": {
                            "org_id": str(event.org_id),
                            "source_service": event.source_service,
                            "correlation_id": str(event.correlation_id) if event.correlation_id else "none",
                        }
                    },
                }
            ],
            "RecordState": "ACTIVE",
            "ProductFields": {
                "inkra/event_type": event.event_type,
                "inkra/risk_tier": str(event.risk_tier),
                "inkra/actor_type": str(event.actor_type),
                "inkra/actor_id": str(event.actor_id) if event.actor_id else "system",
            },
        }

        try:
            async with self.boto_session.client("securityhub") as hub:
                response = await hub.batch_import_findings(Findings=[finding])

                if response.get("FailedCount", 0) > 0:
                    failed = response.get("FailedFindings", [])
                    logger.warning(
                        "Some findings failed to import",
                        event_id=str(event.id),
                        failed=failed,
                    )
                else:
                    logger.debug(
                        "Finding imported to Security Hub",
                        event_id=str(event.id),
                        finding_id=finding["Id"],
                    )

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            # Don't fail if Security Hub isn't enabled
            if error_code == "InvalidAccessException":
                logger.warning(
                    "Security Hub not enabled or accessible",
                    event_id=str(event.id),
                    error=str(e),
                )
            else:
                logger.error(
                    "Security Hub import failed",
                    event_id=str(event.id),
                    error=str(e),
                )
                raise

    def _get_finding_type(self, event_type: str) -> str:
        """Map event type to Security Hub finding type."""
        type_mapping = {
            "model.deployed": "Software and Configuration Checks/ML Model Deployment",
            "model.rollback": "Software and Configuration Checks/ML Model Rollback",
            "training.failed": "Software and Configuration Checks/ML Training Failure",
            "privacy.budget.exhausted": "Sensitive Data Identifications/Privacy Budget Exhausted",
            "privacy.budget.warning": "Sensitive Data Identifications/Privacy Budget Warning",
            "inference.phi_accessed": "Sensitive Data Identifications/PHI Access",
        }
        return type_mapping.get(event_type, "Software and Configuration Checks/ML Services Event")

    def _get_finding_description(self, event: AuditEvent) -> str:
        """Generate human-readable description for Security Hub finding."""
        descriptions = {
            "model.deployed": f"Model deployed to {event.event_data.get('environment', 'unknown')} environment",
            "model.rollback": f"Model rolled back in {event.event_data.get('environment', 'unknown')} environment",
            "privacy.budget.exhausted": (
                f"Privacy budget exhausted. "
                f"Consumed: {event.event_data.get('consumed', 0)}, "
                f"Budget: {event.event_data.get('budget', 0)}"
            ),
            "training.failed": f"Training job failed: {event.event_data.get('error', 'Unknown error')}",
        }
        return descriptions.get(
            event.event_type,
            f"ML Services audit event: {event.event_type}. Data: {json.dumps(event.event_data)}",
        )


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
            occurred_at=datetime.now(timezone.utc),
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
            occurred_at=datetime.now(timezone.utc),
        )
    )


async def emit_model_rollback(
    session: AsyncSession,
    org_id: UUID,
    model_id: UUID,
    from_version: int,
    to_version: int,
    environment: str,
    actor_id: UUID,
) -> AuditEvent:
    """Emit a model.rollback event."""
    service = AuditService(session)
    return await service.emit_event(
        AuditEventCreate(
            org_id=org_id,
            event_type="model.rollback",
            risk_tier=RiskTier.HIGH,
            actor_id=actor_id,
            actor_type="user",
            event_data={
                "model_id": str(model_id),
                "from_version": from_version,
                "to_version": to_version,
                "environment": environment,
            },
            source_service="ml-services",
            occurred_at=datetime.now(timezone.utc),
        )
    )
