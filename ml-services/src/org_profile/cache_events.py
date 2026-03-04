"""Cache invalidation events for org profile updates.

Emits events via Redis pub/sub for downstream services (PX-898 oracle layer)
to invalidate their caches when org profile data changes.
"""

import json
import logging
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

import redis.asyncio as redis

from src.common.config import settings

logger = logging.getLogger(__name__)


class ProfileEventType(str, Enum):
    """Types of profile change events."""

    PROFILE_UPDATED = "profile.updated"
    COMPLIANCE_CHANGED = "compliance.changed"
    MODEL_TIER_CHANGED = "model_tier.changed"
    SIGNALS_UPDATED = "signals.updated"
    MATCHING_RULES_UPDATED = "matching_rules.updated"
    INDUSTRY_CHANGED = "industry.changed"


# Redis pub/sub channel names
CHANNEL_ORG_PROFILE = "org_profile:invalidate"
CHANNEL_COMPLIANCE = "compliance:invalidate"


class ProfileCacheEventEmitter:
    """Emits cache invalidation events for org profile changes."""

    def __init__(self, redis_url: Optional[str] = None):
        self._redis_url = redis_url or settings.REDIS_URL
        self._redis: Optional[redis.Redis] = None

    async def _get_redis(self) -> redis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._redis

    async def close(self) -> None:
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def emit(
        self,
        org_id: UUID,
        event_type: ProfileEventType,
        changed_fields: list[str],
        old_values: Optional[dict[str, Any]] = None,
        new_values: Optional[dict[str, Any]] = None,
    ) -> bool:
        """
        Emit a cache invalidation event.

        Args:
            org_id: Organization ID
            event_type: Type of change event
            changed_fields: List of field names that changed
            old_values: Previous values (optional, for audit)
            new_values: New values (optional, for audit)

        Returns:
            True if event was published successfully
        """
        try:
            r = await self._get_redis()

            event_data = {
                "org_id": str(org_id),
                "event_type": event_type.value,
                "changed_fields": changed_fields,
                "timestamp": datetime.utcnow().isoformat(),
            }

            if old_values:
                event_data["old_values"] = _serialize_values(old_values)
            if new_values:
                event_data["new_values"] = _serialize_values(new_values)

            message = json.dumps(event_data)

            # Determine which channels to publish to
            channels = [CHANNEL_ORG_PROFILE]

            if event_type == ProfileEventType.COMPLIANCE_CHANGED:
                channels.append(CHANNEL_COMPLIANCE)

            # Publish to all relevant channels
            for channel in channels:
                await r.publish(channel, message)

            logger.info(
                "Profile cache event emitted",
                extra={
                    "org_id": str(org_id),
                    "event_type": event_type.value,
                    "changed_fields": changed_fields,
                    "channels": channels,
                },
            )

            return True

        except Exception as e:
            logger.error(
                "Failed to emit profile cache event",
                extra={
                    "org_id": str(org_id),
                    "event_type": event_type.value,
                    "error": str(e),
                },
                exc_info=True,
            )
            return False

    async def emit_profile_updated(
        self,
        org_id: UUID,
        changed_fields: list[str],
        old_values: Optional[dict[str, Any]] = None,
        new_values: Optional[dict[str, Any]] = None,
    ) -> bool:
        """Convenience method for profile.updated events."""
        # Determine the most specific event type based on changed fields
        event_type = ProfileEventType.PROFILE_UPDATED

        if "compliance_frameworks" in changed_fields:
            event_type = ProfileEventType.COMPLIANCE_CHANGED
        elif "model_tier" in changed_fields or "data_sharing_consent" in changed_fields:
            event_type = ProfileEventType.MODEL_TIER_CHANGED
        elif "custom_signals" in changed_fields:
            event_type = ProfileEventType.SIGNALS_UPDATED
        elif "matching_rules" in changed_fields:
            event_type = ProfileEventType.MATCHING_RULES_UPDATED
        elif "industry" in changed_fields or "secondary_industry" in changed_fields:
            event_type = ProfileEventType.INDUSTRY_CHANGED

        return await self.emit(
            org_id=org_id,
            event_type=event_type,
            changed_fields=changed_fields,
            old_values=old_values,
            new_values=new_values,
        )


def _serialize_values(values: dict[str, Any]) -> dict[str, Any]:
    """Serialize values for JSON, handling UUIDs and other types."""
    result = {}
    for key, value in values.items():
        if isinstance(value, UUID):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, Enum):
            result[key] = value.value
        else:
            result[key] = value
    return result


# Module-level singleton for easy access
_emitter: Optional[ProfileCacheEventEmitter] = None


def get_cache_event_emitter() -> ProfileCacheEventEmitter:
    """Get the singleton cache event emitter."""
    global _emitter
    if _emitter is None:
        _emitter = ProfileCacheEventEmitter()
    return _emitter


async def emit_profile_updated(
    org_id: UUID,
    changed_fields: list[str],
    old_values: Optional[dict[str, Any]] = None,
    new_values: Optional[dict[str, Any]] = None,
) -> bool:
    """
    Convenience function to emit profile update events.

    Use this in router handlers after updating org profile.
    """
    emitter = get_cache_event_emitter()
    return await emitter.emit_profile_updated(
        org_id=org_id,
        changed_fields=changed_fields,
        old_values=old_values,
        new_values=new_values,
    )
