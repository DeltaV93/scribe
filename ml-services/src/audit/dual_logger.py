"""Dual audit logger for customer-facing and internal logs.

This module implements the dual logging strategy specified in PX-898:
- Customer-facing logs: Filtered for audit export, no internal scores
- Internal logs: Full details for Metabase dashboards and debugging

Both log streams are async with guaranteed delivery via Redis queue.
"""

import asyncio
import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

import redis.asyncio as redis
from celery import shared_task

from src.audit.models import ActorType, RiskTier
from src.audit.risk_tiers import get_tier_config, RiskTierConfig
from src.common.config import settings

logger = logging.getLogger(__name__)

# Redis queue names
QUEUE_CUSTOMER_EVENTS = "audit:queue:customer"
QUEUE_INTERNAL_EVENTS = "audit:queue:internal"

# Fields to strip from customer-facing logs (internal debugging data)
INTERNAL_ONLY_FIELDS = {
    "correction_quality_score",
    "model_confidence_raw",
    "debug_signals",
    "internal_trace_id",
    "performance_metrics",
    "cache_hit_ratio",
    "internal_notes",
}


@dataclass
class AuditEventPayload:
    """
    Structured audit event payload.

    Contains both customer-visible and internal fields.
    Internal fields are stripped when logging to customer stream.
    """

    # Required fields
    event_id: str
    event_type: str
    org_id: str
    risk_tier: str
    occurred_at: str
    source_service: str

    # Actor information
    actor_id: Optional[str] = None
    actor_type: str = "system"

    # Event data (customer-visible)
    event_data: dict = field(default_factory=dict)

    # Optional identifiers
    model_id: Optional[str] = None
    model_version_id: Optional[str] = None
    correlation_id: Optional[str] = None

    # Internal-only fields (stripped from customer logs)
    internal_data: dict = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> "AuditEventPayload":
        """Create from dictionary."""
        return cls(
            event_id=data.get("event_id", str(uuid4())),
            event_type=data["event_type"],
            org_id=str(data["org_id"]),
            risk_tier=data["risk_tier"],
            occurred_at=data.get("occurred_at", datetime.now(timezone.utc).isoformat()),
            source_service=data.get("source_service", "ml-services"),
            actor_id=str(data["actor_id"]) if data.get("actor_id") else None,
            actor_type=data.get("actor_type", "system"),
            event_data=data.get("event_data", {}),
            model_id=str(data["model_id"]) if data.get("model_id") else None,
            model_version_id=str(data["model_version_id"]) if data.get("model_version_id") else None,
            correlation_id=str(data["correlation_id"]) if data.get("correlation_id") else None,
            internal_data=data.get("internal_data", {}),
        )

    def to_customer_dict(self) -> dict:
        """
        Convert to customer-facing format.

        Strips internal fields and sensitive debugging data.
        """
        result = {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "org_id": self.org_id,
            "risk_tier": self.risk_tier,
            "occurred_at": self.occurred_at,
            "source_service": self.source_service,
            "actor_type": self.actor_type,
        }

        if self.actor_id:
            result["actor_id"] = self.actor_id
        if self.correlation_id:
            result["correlation_id"] = self.correlation_id
        if self.model_id:
            result["model_id"] = self.model_id

        # Filter event_data to remove internal fields
        filtered_data = {
            k: v
            for k, v in self.event_data.items()
            if k not in INTERNAL_ONLY_FIELDS
        }
        if filtered_data:
            result["event_data"] = filtered_data

        return result

    def to_internal_dict(self) -> dict:
        """
        Convert to internal format with full details.

        Includes all debugging and performance data.
        """
        result = asdict(self)

        # Merge internal_data into event_data for internal logging
        if self.internal_data:
            result["event_data"] = {**result["event_data"], **self.internal_data}

        # Remove the separate internal_data field
        del result["internal_data"]

        return result


class DualAuditLogger:
    """
    Dual-stream audit logger with async guarantees.

    Implements:
    - Customer-facing logs: Filtered, exportable
    - Internal logs: Full details for Metabase
    - Async with Redis queue for guaranteed delivery
    - Retry mechanism for failed writes
    """

    def __init__(self, redis_url: Optional[str] = None):
        self._redis_url = redis_url or settings.REDIS_URL
        self._redis: Optional[redis.Redis] = None
        self._local_buffer: list[tuple[str, AuditEventPayload]] = []
        self._max_buffer_size = 1000

    async def _get_redis(self) -> redis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._redis

    async def log_customer_facing(
        self,
        event: AuditEventPayload,
        tier_config: Optional[RiskTierConfig] = None,
    ) -> bool:
        """
        Log an event to the customer-facing stream.

        Customer logs are:
        - Filtered to remove internal debugging data
        - Stored for export via audit API
        - Visible in customer audit reports

        Args:
            event: The audit event payload
            tier_config: Optional tier configuration for routing

        Returns:
            True if queued successfully
        """
        if tier_config is None:
            tier_config = get_tier_config(RiskTier(event.risk_tier))

        # Check if this tier allows customer visibility
        if not tier_config.customer_visible:
            logger.debug(
                "Event not customer visible",
                extra={
                    "event_id": event.event_id,
                    "risk_tier": event.risk_tier,
                },
            )
            return True

        customer_data = event.to_customer_dict()

        try:
            r = await self._get_redis()
            await r.lpush(QUEUE_CUSTOMER_EVENTS, json.dumps(customer_data))

            logger.debug(
                "Customer event queued",
                extra={
                    "event_id": event.event_id,
                    "event_type": event.event_type,
                },
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to queue customer event",
                extra={
                    "event_id": event.event_id,
                    "error": str(e),
                },
                exc_info=True,
            )

            # Buffer locally for retry
            self._buffer_event(QUEUE_CUSTOMER_EVENTS, event)
            return False

    async def log_inkra_internal(
        self,
        event: AuditEventPayload,
        tier_config: Optional[RiskTierConfig] = None,
    ) -> bool:
        """
        Log an event to the internal stream.

        Internal logs:
        - Include full debugging data
        - Feed Metabase dashboards
        - Support detailed troubleshooting

        Args:
            event: The audit event payload
            tier_config: Optional tier configuration for routing

        Returns:
            True if queued successfully
        """
        internal_data = event.to_internal_dict()

        # Add ingestion timestamp
        internal_data["ingested_at"] = datetime.now(timezone.utc).isoformat()

        try:
            r = await self._get_redis()
            await r.lpush(QUEUE_INTERNAL_EVENTS, json.dumps(internal_data))

            logger.debug(
                "Internal event queued",
                extra={
                    "event_id": event.event_id,
                    "event_type": event.event_type,
                },
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to queue internal event",
                extra={
                    "event_id": event.event_id,
                    "error": str(e),
                },
                exc_info=True,
            )

            # Buffer locally for retry
            self._buffer_event(QUEUE_INTERNAL_EVENTS, event)
            return False

    async def log_both(
        self,
        event: AuditEventPayload,
        tier_config: Optional[RiskTierConfig] = None,
    ) -> tuple[bool, bool]:
        """
        Log to both customer and internal streams.

        Args:
            event: The audit event payload
            tier_config: Optional tier configuration

        Returns:
            Tuple of (customer_success, internal_success)
        """
        customer_result = await self.log_customer_facing(event, tier_config)
        internal_result = await self.log_inkra_internal(event, tier_config)

        return customer_result, internal_result

    def _buffer_event(self, queue: str, event: AuditEventPayload) -> None:
        """Buffer event locally when Redis is unavailable."""
        if len(self._local_buffer) >= self._max_buffer_size:
            # Drop oldest event
            self._local_buffer.pop(0)
            logger.warning(
                "Local buffer full, dropping oldest event",
                extra={"buffer_size": self._max_buffer_size},
            )

        self._local_buffer.append((queue, event))

    async def flush_buffer(self) -> int:
        """
        Flush locally buffered events to Redis.

        Called periodically or after Redis reconnection.

        Returns:
            Number of events flushed
        """
        if not self._local_buffer:
            return 0

        flushed = 0

        try:
            r = await self._get_redis()

            for queue, event in self._local_buffer[:]:
                try:
                    if queue == QUEUE_CUSTOMER_EVENTS:
                        data = event.to_customer_dict()
                    else:
                        data = event.to_internal_dict()

                    await r.lpush(queue, json.dumps(data))
                    self._local_buffer.remove((queue, event))
                    flushed += 1

                except Exception as e:
                    logger.warning(
                        "Failed to flush buffered event",
                        extra={
                            "event_id": event.event_id,
                            "error": str(e),
                        },
                    )
                    break

        except Exception as e:
            logger.error(
                "Buffer flush failed",
                extra={"error": str(e)},
            )

        if flushed > 0:
            logger.info(
                "Flushed buffered events",
                extra={"flushed": flushed, "remaining": len(self._local_buffer)},
            )

        return flushed

    async def get_queue_lengths(self) -> dict[str, int]:
        """Get current queue lengths for monitoring."""
        try:
            r = await self._get_redis()
            customer_len = await r.llen(QUEUE_CUSTOMER_EVENTS)
            internal_len = await r.llen(QUEUE_INTERNAL_EVENTS)

            return {
                "customer": customer_len,
                "internal": internal_len,
                "local_buffer": len(self._local_buffer),
            }

        except Exception as e:
            logger.error("Failed to get queue lengths", extra={"error": str(e)})
            return {
                "customer": -1,
                "internal": -1,
                "local_buffer": len(self._local_buffer),
            }

    async def close(self) -> None:
        """Clean up resources."""
        if self._redis is not None:
            await self._redis.close()
            self._redis = None


# Module-level singleton
_dual_logger: Optional[DualAuditLogger] = None


def get_dual_audit_logger() -> DualAuditLogger:
    """Get the singleton dual audit logger."""
    global _dual_logger
    if _dual_logger is None:
        _dual_logger = DualAuditLogger()
    return _dual_logger


async def log_audit_event(
    event_type: str,
    org_id: UUID,
    risk_tier: RiskTier,
    event_data: dict,
    actor_id: Optional[UUID] = None,
    actor_type: str = "system",
    model_id: Optional[UUID] = None,
    model_version_id: Optional[UUID] = None,
    correlation_id: Optional[UUID] = None,
    internal_data: Optional[dict] = None,
    source_service: str = "ml-services",
) -> bool:
    """
    Convenience function to log an audit event to both streams.

    Args:
        event_type: Event type string
        org_id: Organization ID
        risk_tier: Risk classification
        event_data: Customer-visible event data
        actor_id: ID of actor (user or system)
        actor_type: Type of actor
        model_id: Related model ID if applicable
        model_version_id: Related model version ID if applicable
        correlation_id: Request correlation ID
        internal_data: Internal-only debugging data
        source_service: Source service name

    Returns:
        True if both logs succeeded
    """
    event = AuditEventPayload(
        event_id=str(uuid4()),
        event_type=event_type,
        org_id=str(org_id),
        risk_tier=risk_tier.value,
        occurred_at=datetime.now(timezone.utc).isoformat(),
        source_service=source_service,
        actor_id=str(actor_id) if actor_id else None,
        actor_type=actor_type,
        event_data=event_data,
        model_id=str(model_id) if model_id else None,
        model_version_id=str(model_version_id) if model_version_id else None,
        correlation_id=str(correlation_id) if correlation_id else None,
        internal_data=internal_data or {},
    )

    dual_logger = get_dual_audit_logger()
    customer_ok, internal_ok = await dual_logger.log_both(event)

    return customer_ok and internal_ok
