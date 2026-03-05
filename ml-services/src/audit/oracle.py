"""Audit Oracle Layer with caching for risk tier routing.

The AuditOracle is the central routing intelligence for audit events.
It queries model registry + org profile at routing time to determine
the appropriate risk tier for each event.

Cache invalidation is handled via Redis pub/sub subscription to
org_profile:invalidate channel (PX-889 integration).
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.audit.models import RiskTier
from src.audit.risk_tiers import (
    compare_tiers,
    get_default_risk_tier,
    get_tier_config,
    get_highest_tier,
    RiskTierConfig,
)
from src.common.config import settings
from src.org_profile.cache_events import CHANNEL_ORG_PROFILE
from src.org_profile.models import OrgProfile
from src.registry.models import Model, ModelVersion

logger = logging.getLogger(__name__)

# Cache TTL in seconds (5 minutes)
CACHE_TTL_SECONDS = 300

# Redis key prefixes
CACHE_PREFIX_MODEL = "audit_oracle:model:"
CACHE_PREFIX_ORG = "audit_oracle:org:"


@dataclass
class OracleContext:
    """Context for audit event routing decisions."""

    event_type: str
    org_id: Optional[UUID] = None
    model_id: Optional[UUID] = None
    model_version_id: Optional[UUID] = None
    actor_type: Optional[str] = None
    extra: dict = field(default_factory=dict)


@dataclass
class RoutingDecision:
    """Result of an oracle routing decision."""

    risk_tier: RiskTier
    config: RiskTierConfig
    source: str  # "default", "org_override", "model_override", "compliance"
    reason: str


class AuditOracle:
    """
    Central routing intelligence for audit events.

    Determines risk tier based on:
    1. Event type defaults
    2. Org profile overrides
    3. Model-specific risk tiers
    4. Compliance framework requirements
    """

    def __init__(
        self,
        session: AsyncSession,
        redis_url: Optional[str] = None,
    ):
        self.session = session
        self._redis_url = redis_url or settings.REDIS_URL
        self._redis: Optional[redis.Redis] = None
        self._pubsub: Optional[redis.client.PubSub] = None
        self._subscriber_task: Optional[asyncio.Task] = None
        self._local_cache: dict[str, tuple[Any, datetime]] = {}

    async def _get_redis(self) -> redis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._redis

    async def start_cache_subscriber(self) -> None:
        """
        Start the Redis pub/sub subscriber for cache invalidation.

        This should be called on application startup.
        """
        if self._subscriber_task is not None:
            return

        r = await self._get_redis()
        self._pubsub = r.pubsub()
        await self._pubsub.subscribe(CHANNEL_ORG_PROFILE)

        self._subscriber_task = asyncio.create_task(
            self._handle_cache_events(),
            name="audit_oracle_cache_subscriber",
        )

        logger.info(
            "Audit oracle cache subscriber started",
            extra={"channel": CHANNEL_ORG_PROFILE},
        )

    async def stop_cache_subscriber(self) -> None:
        """Stop the Redis pub/sub subscriber."""
        if self._subscriber_task is not None:
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass
            self._subscriber_task = None

        if self._pubsub is not None:
            await self._pubsub.unsubscribe(CHANNEL_ORG_PROFILE)
            await self._pubsub.close()
            self._pubsub = None

        logger.info("Audit oracle cache subscriber stopped")

    async def _handle_cache_events(self) -> None:
        """Process incoming cache invalidation events."""
        try:
            async for message in self._pubsub.listen():
                if message["type"] != "message":
                    continue

                try:
                    data = json.loads(message["data"])
                    org_id = data.get("org_id")
                    event_type = data.get("event_type")

                    logger.debug(
                        "Cache invalidation received",
                        extra={
                            "org_id": org_id,
                            "event_type": event_type,
                        },
                    )

                    # Invalidate org cache
                    if org_id:
                        await self._invalidate_org_cache(UUID(org_id))

                except json.JSONDecodeError:
                    logger.warning(
                        "Invalid cache event message",
                        extra={"data": message["data"]},
                    )
                except Exception as e:
                    logger.error(
                        "Error processing cache event",
                        extra={"error": str(e)},
                        exc_info=True,
                    )

        except asyncio.CancelledError:
            logger.debug("Cache subscriber cancelled")
            raise
        except Exception as e:
            logger.error(
                "Cache subscriber error",
                extra={"error": str(e)},
                exc_info=True,
            )

    async def _invalidate_org_cache(self, org_id: UUID) -> None:
        """
        Invalidate all cached data for an org.

        Clears both Redis and local cache entries.
        """
        try:
            r = await self._get_redis()
            cache_key = f"{CACHE_PREFIX_ORG}{org_id}"
            await r.delete(cache_key)

            # Clear local cache
            self._local_cache.pop(cache_key, None)

            logger.info(
                "Org cache invalidated",
                extra={"org_id": str(org_id)},
            )

        except Exception as e:
            logger.error(
                "Failed to invalidate org cache",
                extra={"org_id": str(org_id), "error": str(e)},
            )

    async def _invalidate_model_cache(self, model_id: UUID) -> None:
        """Invalidate cached data for a model."""
        try:
            r = await self._get_redis()
            cache_key = f"{CACHE_PREFIX_MODEL}{model_id}"
            await r.delete(cache_key)
            self._local_cache.pop(cache_key, None)

            logger.info(
                "Model cache invalidated",
                extra={"model_id": str(model_id)},
            )

        except Exception as e:
            logger.error(
                "Failed to invalidate model cache",
                extra={"model_id": str(model_id), "error": str(e)},
            )

    async def get_model_risk_tier(self, model_id: UUID) -> Optional[RiskTier]:
        """
        Get the risk tier for a specific model.

        Uses caching with Redis fallback to database.

        Args:
            model_id: The model ID

        Returns:
            Risk tier if the model has one configured, None otherwise
        """
        cache_key = f"{CACHE_PREFIX_MODEL}{model_id}"

        # Check local cache first
        if cache_key in self._local_cache:
            cached, cached_at = self._local_cache[cache_key]
            age = (datetime.now(timezone.utc) - cached_at).total_seconds()
            if age < CACHE_TTL_SECONDS:
                return cached

        # Check Redis cache
        try:
            r = await self._get_redis()
            cached_value = await r.get(cache_key)

            if cached_value is not None:
                tier = RiskTier(cached_value) if cached_value != "null" else None
                self._local_cache[cache_key] = (tier, datetime.now(timezone.utc))
                return tier

        except Exception as e:
            logger.warning(
                "Redis cache read failed",
                extra={"key": cache_key, "error": str(e)},
            )

        # Query database
        result = await self.session.execute(
            select(Model).where(Model.id == model_id)
        )
        model = result.scalar_one_or_none()

        if model is None:
            return None

        # Check if model has a risk tier in its config
        # (This would come from model metadata or a dedicated field)
        tier: Optional[RiskTier] = None

        # Cache the result
        try:
            r = await self._get_redis()
            await r.setex(
                cache_key,
                CACHE_TTL_SECONDS,
                tier.value if tier else "null",
            )
            self._local_cache[cache_key] = (tier, datetime.now(timezone.utc))

        except Exception as e:
            logger.warning(
                "Redis cache write failed",
                extra={"key": cache_key, "error": str(e)},
            )

        return tier

    async def get_org_risk_overrides(
        self, org_id: UUID
    ) -> dict[str, RiskTier]:
        """
        Get org-specific risk tier overrides.

        Returns a mapping of event_type or model_id to risk tier.

        Args:
            org_id: The organization ID

        Returns:
            Dict of overrides (empty if none configured)
        """
        cache_key = f"{CACHE_PREFIX_ORG}{org_id}"

        # Check local cache first
        if cache_key in self._local_cache:
            cached, cached_at = self._local_cache[cache_key]
            age = (datetime.now(timezone.utc) - cached_at).total_seconds()
            if age < CACHE_TTL_SECONDS:
                return cached

        # Check Redis cache
        try:
            r = await self._get_redis()
            cached_value = await r.get(cache_key)

            if cached_value is not None:
                overrides = {
                    k: RiskTier(v)
                    for k, v in json.loads(cached_value).items()
                }
                self._local_cache[cache_key] = (
                    overrides,
                    datetime.now(timezone.utc),
                )
                return overrides

        except Exception as e:
            logger.warning(
                "Redis cache read failed",
                extra={"key": cache_key, "error": str(e)},
            )

        # Query database for org profile
        result = await self.session.execute(
            select(OrgProfile).where(OrgProfile.org_id == org_id)
        )
        profile = result.scalar_one_or_none()

        overrides: dict[str, RiskTier] = {}

        if profile is not None:
            # Get risk overrides from org profile
            raw_overrides = profile.risk_overrides or {}
            for key, value in raw_overrides.items():
                try:
                    overrides[key] = RiskTier(value)
                except ValueError:
                    logger.warning(
                        "Invalid risk tier in org override",
                        extra={"org_id": str(org_id), "key": key, "value": value},
                    )

        # Cache the result
        try:
            r = await self._get_redis()
            cache_value = {k: v.value for k, v in overrides.items()}
            await r.setex(
                cache_key,
                CACHE_TTL_SECONDS,
                json.dumps(cache_value),
            )
            self._local_cache[cache_key] = (
                overrides,
                datetime.now(timezone.utc),
            )

        except Exception as e:
            logger.warning(
                "Redis cache write failed",
                extra={"key": cache_key, "error": str(e)},
            )

        return overrides

    async def get_org_compliance_requirements(
        self, org_id: UUID
    ) -> list[str]:
        """
        Get compliance frameworks for an org.

        Compliance frameworks may require elevated risk tiers for
        certain event types.

        Args:
            org_id: The organization ID

        Returns:
            List of compliance framework names
        """
        result = await self.session.execute(
            select(OrgProfile).where(OrgProfile.org_id == org_id)
        )
        profile = result.scalar_one_or_none()

        if profile is None:
            return []

        return profile.compliance_frameworks or []

    def _apply_compliance_rules(
        self,
        event_type: str,
        base_tier: RiskTier,
        frameworks: list[str],
    ) -> tuple[RiskTier, Optional[str]]:
        """
        Apply compliance-specific rules to elevate risk tier if needed.

        Args:
            event_type: The event type
            base_tier: The base risk tier
            frameworks: List of active compliance frameworks

        Returns:
            Tuple of (adjusted tier, reason if elevated)
        """
        elevated_tier = base_tier
        reason = None

        # HIPAA requires elevated logging for PHI access
        if "HIPAA" in frameworks:
            if "phi" in event_type.lower() or event_type.startswith("data."):
                if base_tier == RiskTier.LOW:
                    elevated_tier = RiskTier.MEDIUM
                    reason = "HIPAA compliance"
                elif base_tier == RiskTier.MEDIUM:
                    elevated_tier = RiskTier.HIGH
                    reason = "HIPAA compliance"

        # SOC2 requires elevated logging for access control
        if "SOC2" in frameworks:
            if event_type.startswith("auth.") or event_type.startswith("user."):
                if base_tier == RiskTier.LOW:
                    elevated_tier = RiskTier.MEDIUM
                    reason = "SOC2 compliance"

        return elevated_tier, reason

    async def route_event(self, context: OracleContext) -> RoutingDecision:
        """
        Determine the risk tier for an audit event.

        The routing decision considers:
        1. Default event type risk tier
        2. Org-specific overrides
        3. Model-specific risk tiers
        4. Compliance framework requirements

        The highest applicable tier is used.

        Args:
            context: Event context including type, org, model info

        Returns:
            RoutingDecision with tier and reasoning
        """
        tiers_to_consider: list[tuple[RiskTier, str, str]] = []

        # 1. Start with default for event type
        default_tier = get_default_risk_tier(context.event_type)
        tiers_to_consider.append((default_tier, "default", "Event type default"))

        # 2. Check org-specific overrides
        if context.org_id:
            overrides = await self.get_org_risk_overrides(context.org_id)

            # Check for event type override
            if context.event_type in overrides:
                tier = overrides[context.event_type]
                tiers_to_consider.append((
                    tier,
                    "org_override",
                    f"Org override for {context.event_type}",
                ))

            # Check for model-specific override in org profile
            if context.model_id and str(context.model_id) in overrides:
                tier = overrides[str(context.model_id)]
                tiers_to_consider.append((
                    tier,
                    "org_override",
                    f"Org override for model {context.model_id}",
                ))

        # 3. Check model-specific risk tier
        if context.model_id:
            model_tier = await self.get_model_risk_tier(context.model_id)
            if model_tier:
                tiers_to_consider.append((
                    model_tier,
                    "model_override",
                    f"Model risk tier for {context.model_id}",
                ))

        # 4. Apply compliance rules
        if context.org_id:
            frameworks = await self.get_org_compliance_requirements(context.org_id)
            if frameworks:
                base_tier = get_highest_tier([t[0] for t in tiers_to_consider])
                compliance_tier, reason = self._apply_compliance_rules(
                    context.event_type,
                    base_tier,
                    frameworks,
                )
                if reason:
                    tiers_to_consider.append((
                        compliance_tier,
                        "compliance",
                        reason,
                    ))

        # Select highest tier
        final_tier = RiskTier.LOW
        final_source = "default"
        final_reason = "No applicable rules"

        for tier, source, reason in tiers_to_consider:
            # Use compare_tiers for proper ordering
            comparison = compare_tiers(tier, final_tier)
            if comparison > 0 or (comparison == 0 and source != "default"):
                final_tier = tier
                final_source = source
                final_reason = reason

        config = get_tier_config(final_tier)

        return RoutingDecision(
            risk_tier=final_tier,
            config=config,
            source=final_source,
            reason=final_reason,
        )

    async def close(self) -> None:
        """Clean up resources."""
        await self.stop_cache_subscriber()

        if self._redis is not None:
            await self._redis.close()
            self._redis = None

        self._local_cache.clear()


# Module-level singleton
_oracle: Optional[AuditOracle] = None


def get_audit_oracle(session: AsyncSession) -> AuditOracle:
    """
    Get the audit oracle instance.

    Note: Each call creates a new instance with the provided session.
    For shared caching, the Redis cache is used.
    """
    return AuditOracle(session)
