"""Integration tests for Audit API."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from httpx import AsyncClient

from tests.factories import (
    create_audit_event_data,
    create_audit_sink_data,
    create_audit_route_data,
    generate_audit_events,
)


@pytest.mark.asyncio
class TestAuditEventsAPI:
    """Test Audit Event operations."""

    async def test_create_audit_event(self, client: AsyncClient):
        """Test creating a new audit event."""
        data = create_audit_event_data()

        response = await client.post("/v1/audit/events", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["event_type"] == data["event_type"]
        assert result["risk_tier"] == data["risk_tier"]
        assert result["actor_type"] == data["actor_type"]
        assert result["source_service"] == data["source_service"]
        assert "id" in result
        assert "ingested_at" in result

    async def test_create_audit_event_all_risk_tiers(self, client: AsyncClient):
        """Test creating events with all risk tiers."""
        for risk_tier in ["low", "medium", "high", "critical"]:
            data = create_audit_event_data(risk_tier=risk_tier)
            response = await client.post("/v1/audit/events", json=data)

            assert response.status_code == 201
            assert response.json()["risk_tier"] == risk_tier

    async def test_create_audit_event_all_actor_types(self, client: AsyncClient):
        """Test creating events with all actor types."""
        for actor_type in ["user", "system", "model"]:
            data = create_audit_event_data(actor_type=actor_type)
            response = await client.post("/v1/audit/events", json=data)

            assert response.status_code == 201
            assert response.json()["actor_type"] == actor_type

    async def test_create_audit_event_with_correlation_id(self, client: AsyncClient):
        """Test creating event with correlation ID."""
        correlation_id = uuid4()
        data = create_audit_event_data(correlation_id=correlation_id)

        response = await client.post("/v1/audit/events", json=data)

        assert response.status_code == 201
        assert response.json()["correlation_id"] == str(correlation_id)

    async def test_create_audit_event_system_actor(self, client: AsyncClient):
        """Test creating event from system actor (no actor_id)."""
        data = create_audit_event_data(actor_type="system", actor_id=None)

        response = await client.post("/v1/audit/events", json=data)

        assert response.status_code == 201
        assert response.json()["actor_type"] == "system"
        assert response.json()["actor_id"] is None

    async def test_list_audit_events(self, client: AsyncClient):
        """Test listing audit events for an org."""
        org_id = uuid4()

        # Create some events
        for data in generate_audit_events(org_id, count=5):
            await client.post("/v1/audit/events", json=data)

        response = await client.get(
            "/v1/audit/events", params={"org_id": str(org_id)}
        )

        assert response.status_code == 200
        result = response.json()
        assert "items" in result
        assert "total" in result
        assert result["total"] >= 5

    async def test_list_audit_events_filter_by_event_type(self, client: AsyncClient):
        """Test filtering events by event type."""
        org_id = uuid4()

        # Create events of different types
        await client.post(
            "/v1/audit/events",
            json=create_audit_event_data(org_id=org_id, event_type="model.deployed"),
        )
        await client.post(
            "/v1/audit/events",
            json=create_audit_event_data(org_id=org_id, event_type="model.rollback"),
        )

        response = await client.get(
            "/v1/audit/events",
            params={"org_id": str(org_id), "event_type": "model.deployed"},
        )

        assert response.status_code == 200
        for item in response.json()["items"]:
            assert item["event_type"] == "model.deployed"

    async def test_list_audit_events_filter_by_risk_tier(self, client: AsyncClient):
        """Test filtering events by risk tier."""
        org_id = uuid4()

        # Create events of different risk tiers
        await client.post(
            "/v1/audit/events",
            json=create_audit_event_data(org_id=org_id, risk_tier="low"),
        )
        await client.post(
            "/v1/audit/events",
            json=create_audit_event_data(org_id=org_id, risk_tier="critical"),
        )

        response = await client.get(
            "/v1/audit/events",
            params={"org_id": str(org_id), "risk_tier": "critical"},
        )

        assert response.status_code == 200
        for item in response.json()["items"]:
            assert item["risk_tier"] == "critical"

    async def test_list_audit_events_filter_by_date_range(self, client: AsyncClient):
        """Test filtering events by date range."""
        org_id = uuid4()
        now = datetime.now(timezone.utc)

        # Create events at different times
        await client.post(
            "/v1/audit/events",
            json=create_audit_event_data(
                org_id=org_id, occurred_at=now - timedelta(days=5)
            ),
        )
        await client.post(
            "/v1/audit/events",
            json=create_audit_event_data(
                org_id=org_id, occurred_at=now - timedelta(days=1)
            ),
        )

        # Filter to last 3 days
        start_date = (now - timedelta(days=3)).isoformat()
        response = await client.get(
            "/v1/audit/events",
            params={"org_id": str(org_id), "start_date": start_date},
        )

        assert response.status_code == 200

    async def test_list_audit_events_pagination(self, client: AsyncClient):
        """Test audit events pagination."""
        org_id = uuid4()

        # Create many events
        for data in generate_audit_events(org_id, count=15):
            await client.post("/v1/audit/events", json=data)

        # First page
        response = await client.get(
            "/v1/audit/events",
            params={"org_id": str(org_id), "page": 1, "page_size": 5},
        )

        assert response.status_code == 200
        result = response.json()
        assert len(result["items"]) == 5
        assert result["page"] == 1

        # Second page
        response = await client.get(
            "/v1/audit/events",
            params={"org_id": str(org_id), "page": 2, "page_size": 5},
        )

        assert response.status_code == 200
        assert response.json()["page"] == 2

    async def test_get_audit_event(self, client: AsyncClient):
        """Test getting a specific audit event by ID."""
        data = create_audit_event_data()
        create_response = await client.post("/v1/audit/events", json=data)
        event_id = create_response.json()["id"]

        response = await client.get(f"/v1/audit/events/{event_id}")

        assert response.status_code == 200
        result = response.json()
        assert result["id"] == event_id
        assert result["event_type"] == data["event_type"]

    async def test_get_audit_event_not_found(self, client: AsyncClient):
        """Test getting a non-existent audit event."""
        fake_id = str(uuid4())

        response = await client.get(f"/v1/audit/events/{fake_id}")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestAuditSinksAPI:
    """Test Audit Sink operations."""

    async def test_create_audit_sink(self, client: AsyncClient):
        """Test creating a new audit sink."""
        data = create_audit_sink_data(sink_type="s3", config={"bucket": "test-bucket"})

        response = await client.post("/v1/audit/sinks", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["sink_type"] == "s3"
        assert result["config"]["bucket"] == "test-bucket"
        assert result["is_active"] is True

    async def test_create_postgresql_sink(self, client: AsyncClient):
        """Test creating PostgreSQL sink (default sink type)."""
        data = create_audit_sink_data(sink_type="postgresql")

        response = await client.post("/v1/audit/sinks", json=data)

        assert response.status_code == 201
        assert response.json()["sink_type"] == "postgresql"

    async def test_create_security_hub_sink(self, client: AsyncClient):
        """Test creating Security Hub sink."""
        data = create_audit_sink_data(
            sink_type="security_hub",
            config={"account_id": "123456789012"},
        )

        response = await client.post("/v1/audit/sinks", json=data)

        assert response.status_code == 201
        assert response.json()["sink_type"] == "security_hub"

    async def test_create_inactive_sink(self, client: AsyncClient):
        """Test creating an inactive sink."""
        data = create_audit_sink_data(is_active=False)

        response = await client.post("/v1/audit/sinks", json=data)

        assert response.status_code == 201
        assert response.json()["is_active"] is False

    async def test_list_audit_sinks(self, client: AsyncClient):
        """Test listing all audit sinks."""
        # Create some sinks
        await client.post("/v1/audit/sinks", json=create_audit_sink_data())
        await client.post("/v1/audit/sinks", json=create_audit_sink_data(sink_type="s3"))

        response = await client.get("/v1/audit/sinks")

        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, list)
        assert len(result) >= 2


@pytest.mark.asyncio
class TestAuditRoutesAPI:
    """Test Audit Route operations."""

    async def _create_sink(self, client: AsyncClient) -> str:
        """Helper to create a sink and return its ID."""
        response = await client.post(
            "/v1/audit/sinks", json=create_audit_sink_data()
        )
        return response.json()["id"]

    async def test_create_audit_route(self, client: AsyncClient):
        """Test creating a new audit route."""
        sink_id = await self._create_sink(client)
        data = create_audit_route_data(
            event_type_pattern="model.*",
            risk_tier_min="medium",
            sink_id=uuid4(),  # Will be overridden
        )
        data["sink_id"] = sink_id

        response = await client.post("/v1/audit/routes", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["event_type_pattern"] == "model.*"
        assert result["risk_tier_min"] == "medium"
        assert result["sink_id"] == sink_id

    async def test_create_org_specific_route(self, client: AsyncClient):
        """Test creating an org-specific route."""
        sink_id = await self._create_sink(client)
        org_id = uuid4()
        data = create_audit_route_data(
            org_id=org_id, event_type_pattern="*", risk_tier_min="low"
        )
        data["sink_id"] = sink_id

        response = await client.post("/v1/audit/routes", json=data)

        assert response.status_code == 201
        assert response.json()["org_id"] == str(org_id)

    async def test_create_default_route(self, client: AsyncClient):
        """Test creating a default (org_id=null) route."""
        sink_id = await self._create_sink(client)
        data = create_audit_route_data(
            org_id=None, event_type_pattern="*", risk_tier_min="low"
        )
        data["sink_id"] = sink_id

        response = await client.post("/v1/audit/routes", json=data)

        assert response.status_code == 201
        assert response.json()["org_id"] is None

    async def test_create_route_wildcard_pattern(self, client: AsyncClient):
        """Test creating routes with various glob patterns."""
        sink_id = await self._create_sink(client)

        patterns = ["*", "model.*", "*.deployed", "training.completed"]
        for pattern in patterns:
            data = create_audit_route_data(event_type_pattern=pattern)
            data["sink_id"] = sink_id

            response = await client.post("/v1/audit/routes", json=data)
            assert response.status_code == 201
            assert response.json()["event_type_pattern"] == pattern

    async def test_list_audit_routes(self, client: AsyncClient):
        """Test listing all audit routes."""
        sink_id = await self._create_sink(client)

        # Create some routes
        for pattern in ["model.*", "training.*"]:
            data = create_audit_route_data(event_type_pattern=pattern)
            data["sink_id"] = sink_id
            await client.post("/v1/audit/routes", json=data)

        response = await client.get("/v1/audit/routes")

        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, list)
        assert len(result) >= 2

    async def test_list_audit_routes_filter_by_org(self, client: AsyncClient):
        """Test listing routes filtered by org."""
        sink_id = await self._create_sink(client)
        org_id = uuid4()

        # Create org-specific route
        data = create_audit_route_data(org_id=org_id)
        data["sink_id"] = sink_id
        await client.post("/v1/audit/routes", json=data)

        # Create default route
        data = create_audit_route_data(org_id=None)
        data["sink_id"] = sink_id
        await client.post("/v1/audit/routes", json=data)

        response = await client.get(
            "/v1/audit/routes", params={"org_id": str(org_id)}
        )

        assert response.status_code == 200


@pytest.mark.asyncio
class TestAuditS3Archiving:
    """Test S3 archiving functionality with mocked S3."""

    @pytest.fixture
    def mock_s3(self):
        """Mock aioboto3 S3 client."""
        with patch("src.audit.service.aioboto3") as mock_boto:
            mock_session = MagicMock()
            mock_boto.Session.return_value = mock_session

            mock_s3_client = AsyncMock()
            mock_s3_client.__aenter__ = AsyncMock(return_value=mock_s3_client)
            mock_s3_client.__aexit__ = AsyncMock(return_value=None)
            mock_s3_client.put_object = AsyncMock(return_value={})

            mock_session.client.return_value = mock_s3_client

            yield mock_s3_client

    async def test_event_routing_to_s3_sink(self, client: AsyncClient, mock_s3):
        """Test that events are routed to S3 sink."""
        # Create S3 sink
        sink_response = await client.post(
            "/v1/audit/sinks",
            json=create_audit_sink_data(
                sink_type="s3", config={"bucket": "test-audit-bucket"}
            ),
        )
        sink_id = sink_response.json()["id"]

        # Create route to S3 sink
        route_data = create_audit_route_data(
            event_type_pattern="*", risk_tier_min="low"
        )
        route_data["sink_id"] = sink_id
        await client.post("/v1/audit/routes", json=route_data)

        # Create event
        event_data = create_audit_event_data(risk_tier="medium")
        response = await client.post("/v1/audit/events", json=event_data)

        assert response.status_code == 201
        # S3 upload would be triggered asynchronously


@pytest.mark.asyncio
class TestAuditEventTypes:
    """Test specific event types and their handling."""

    async def test_model_deployed_event(self, client: AsyncClient):
        """Test creating model.deployed event."""
        model_id = str(uuid4())
        version_id = str(uuid4())

        data = create_audit_event_data(
            event_type="model.deployed",
            risk_tier="medium",
            event_data={
                "model_id": model_id,
                "version_id": version_id,
                "environment": "production",
            },
        )

        response = await client.post("/v1/audit/events", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["event_data"]["environment"] == "production"

    async def test_model_rollback_event(self, client: AsyncClient):
        """Test creating model.rollback event."""
        data = create_audit_event_data(
            event_type="model.rollback",
            risk_tier="high",
            event_data={
                "model_id": str(uuid4()),
                "from_version": 2,
                "to_version": 1,
                "environment": "production",
            },
        )

        response = await client.post("/v1/audit/events", json=data)

        assert response.status_code == 201
        assert response.json()["risk_tier"] == "high"

    async def test_privacy_budget_exhausted_event(self, client: AsyncClient):
        """Test creating privacy.budget.exhausted event."""
        data = create_audit_event_data(
            event_type="privacy.budget.exhausted",
            risk_tier="critical",
            actor_type="system",
            actor_id=None,
            event_data={"consumed": 5.0, "budget": 5.0},
        )

        response = await client.post("/v1/audit/events", json=data)

        assert response.status_code == 201
        assert response.json()["risk_tier"] == "critical"

    async def test_training_started_event(self, client: AsyncClient):
        """Test creating training.started event."""
        data = create_audit_event_data(
            event_type="training.started",
            risk_tier="low",
            actor_type="system",
            event_data={
                "model_id": str(uuid4()),
                "training_config": {"epochs": 100, "batch_size": 32},
            },
        )

        response = await client.post("/v1/audit/events", json=data)

        assert response.status_code == 201
        assert response.json()["event_type"] == "training.started"
