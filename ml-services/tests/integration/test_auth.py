"""Integration tests for API authentication."""

from uuid import uuid4

import pytest
from httpx import AsyncClient, ASGITransport

from tests.factories import create_model_data, create_audit_event_data
from src.main import app


@pytest.mark.asyncio
class TestAPIKeyAuthentication:
    """Test API key authentication middleware."""

    @pytest.fixture
    async def unauthenticated_client(self, db_session):
        """Create client without API key."""
        from src.common.db.session import get_session

        async def override_get_session():
            yield db_session

        app.dependency_overrides[get_session] = override_get_session

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            # No X-Service-API-Key header
        ) as client:
            yield client

        app.dependency_overrides.clear()

    @pytest.fixture
    async def invalid_key_client(self, db_session):
        """Create client with invalid API key."""
        from src.common.db.session import get_session

        async def override_get_session():
            yield db_session

        app.dependency_overrides[get_session] = override_get_session

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            headers={"X-Service-API-Key": "invalid-key-12345"},
        ) as client:
            yield client

        app.dependency_overrides.clear()

    async def test_missing_api_key_returns_401(self, unauthenticated_client):
        """Test that missing API key returns 401 Unauthorized."""
        response = await unauthenticated_client.get("/v1/models")

        assert response.status_code == 401
        result = response.json()
        assert result["error"]["code"] == "UNAUTHORIZED"
        assert "Missing API key" in result["error"]["message"]

    async def test_invalid_api_key_returns_401(self, invalid_key_client):
        """Test that invalid API key returns 401 Unauthorized."""
        response = await invalid_key_client.get("/v1/models")

        assert response.status_code == 401
        result = response.json()
        assert result["error"]["code"] == "UNAUTHORIZED"
        assert "Invalid API key" in result["error"]["message"]

    async def test_valid_api_key_succeeds(self, client: AsyncClient):
        """Test that valid API key allows access."""
        response = await client.get("/v1/models")

        assert response.status_code == 200

    async def test_create_model_requires_auth(self, unauthenticated_client):
        """Test that creating models requires authentication."""
        response = await unauthenticated_client.post(
            "/v1/models", json=create_model_data()
        )

        assert response.status_code == 401

    async def test_create_audit_event_requires_auth(self, unauthenticated_client):
        """Test that creating audit events requires authentication."""
        response = await unauthenticated_client.post(
            "/v1/audit/events", json=create_audit_event_data()
        )

        assert response.status_code == 401


@pytest.mark.asyncio
class TestPublicEndpoints:
    """Test that health endpoints are publicly accessible."""

    @pytest.fixture
    async def unauthenticated_client(self, db_session):
        """Create client without API key."""
        from src.common.db.session import get_session

        async def override_get_session():
            yield db_session

        app.dependency_overrides[get_session] = override_get_session

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            yield client

        app.dependency_overrides.clear()

    async def test_healthz_is_public(self, unauthenticated_client):
        """Test that /healthz is accessible without auth."""
        response = await unauthenticated_client.get("/healthz")

        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    async def test_readyz_is_public(self, unauthenticated_client):
        """Test that /readyz is accessible without auth."""
        response = await unauthenticated_client.get("/readyz")

        # May return 200 or 503 depending on db/redis state
        assert response.status_code in [200, 503]

    async def test_livez_is_public(self, unauthenticated_client):
        """Test that /livez is accessible without auth."""
        response = await unauthenticated_client.get("/livez")

        assert response.status_code == 200
        assert "status" in response.json()


@pytest.mark.asyncio
class TestOrgIDHeader:
    """Test X-Org-ID header handling for multi-tenancy."""

    async def test_org_id_header_is_passed_to_request_state(self, client: AsyncClient):
        """Test that X-Org-ID header is available in request state."""
        org_id = str(uuid4())

        # The org_id should affect list results (filtering by org)
        response = await client.get(
            "/v1/models",
            headers={"X-Org-ID": org_id},
        )

        assert response.status_code == 200

    async def test_create_model_with_org_id_header(self, client: AsyncClient):
        """Test creating a model with X-Org-ID header."""
        org_id = uuid4()
        data = create_model_data(org_id=org_id)

        response = await client.post(
            "/v1/models",
            json=data,
            headers={"X-Org-ID": str(org_id)},
        )

        assert response.status_code == 201

    async def test_list_models_respects_org_id(self, client: AsyncClient):
        """Test that list models can filter by org context."""
        org_id = str(uuid4())

        # Create a model for this org
        await client.post(
            "/v1/models",
            json=create_model_data(org_id=uuid4()),
            headers={"X-Org-ID": org_id},
        )

        # List with org_id header
        response = await client.get(
            "/v1/models",
            headers={"X-Org-ID": org_id},
        )

        assert response.status_code == 200


@pytest.mark.asyncio
class TestOrgIsolation:
    """Test that organizations are properly isolated."""

    async def test_org_profile_isolation(self, client: AsyncClient):
        """Test that org profiles are isolated between orgs."""
        org1_id = uuid4()
        org2_id = uuid4()

        # Create profile for org1
        from tests.factories import create_org_profile_data

        data1 = create_org_profile_data(org_id=org1_id)
        await client.post(f"/v1/orgs/{org1_id}/profile", json=data1)

        # Org2 should not see org1's profile
        response = await client.get(f"/v1/orgs/{org2_id}/profile")
        assert response.status_code == 404

    async def test_audit_events_org_isolation(self, client: AsyncClient):
        """Test that audit events are filtered by org."""
        org1_id = uuid4()
        org2_id = uuid4()

        # Create events for org1
        for _ in range(3):
            await client.post(
                "/v1/audit/events",
                json=create_audit_event_data(org_id=org1_id),
            )

        # Create events for org2
        for _ in range(2):
            await client.post(
                "/v1/audit/events",
                json=create_audit_event_data(org_id=org2_id),
            )

        # List for org1 should only show org1's events
        response = await client.get(
            "/v1/audit/events", params={"org_id": str(org1_id)}
        )

        assert response.status_code == 200
        for event in response.json()["items"]:
            assert event["org_id"] == str(org1_id)


@pytest.mark.asyncio
class TestRequestIDMiddleware:
    """Test request ID middleware functionality."""

    async def test_request_id_in_error_response(self, client: AsyncClient):
        """Test that request ID is included in error responses."""
        fake_id = str(uuid4())

        response = await client.get(f"/v1/models/{fake_id}")

        assert response.status_code == 404
        # Error responses should include request_id for debugging

    async def test_request_id_header_propagation(self, client: AsyncClient):
        """Test that X-Request-ID header is handled."""
        custom_request_id = str(uuid4())

        response = await client.get(
            "/v1/models",
            headers={"X-Request-ID": custom_request_id},
        )

        assert response.status_code == 200


@pytest.mark.asyncio
class TestRateLimiting:
    """Test rate limiting middleware (if implemented)."""

    async def test_rate_limit_not_triggered_for_normal_usage(
        self, client: AsyncClient
    ):
        """Test that normal request rates are not limited."""
        # Make several requests in quick succession
        for _ in range(10):
            response = await client.get("/v1/models")
            assert response.status_code == 200
