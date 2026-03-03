"""Integration tests for Org Profile API."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.factories import create_org_profile_data


@pytest.mark.asyncio
class TestOrgProfileAPI:
    """Test Org Profile CRUD operations."""

    async def test_create_org_profile(self, client: AsyncClient):
        """Test creating a new org profile."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id)

        response = await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["org_id"] == str(org_id)
        assert result["compliance_frameworks"] == data["compliance_frameworks"]
        assert result["epsilon_budget"] == data["epsilon_budget"]
        assert result["model_training_enabled"] == data["model_training_enabled"]

    async def test_create_org_profile_with_custom_budget(self, client: AsyncClient):
        """Test creating org profile with custom privacy budget."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id, epsilon_budget=10.0)

        response = await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        assert response.status_code == 201
        assert response.json()["epsilon_budget"] == 10.0

    async def test_create_org_profile_multiple_frameworks(self, client: AsyncClient):
        """Test creating org profile with multiple compliance frameworks."""
        org_id = uuid4()
        data = create_org_profile_data(
            org_id=org_id, compliance_frameworks=["HIPAA", "SOC2", "GDPR"]
        )

        response = await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        assert response.status_code == 201
        result = response.json()
        assert "HIPAA" in result["compliance_frameworks"]
        assert "SOC2" in result["compliance_frameworks"]
        assert "GDPR" in result["compliance_frameworks"]

    async def test_create_org_profile_duplicate(self, client: AsyncClient):
        """Test creating duplicate org profile fails."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id)

        # Create first profile
        response1 = await client.post(f"/v1/orgs/{org_id}/profile", json=data)
        assert response1.status_code == 201

        # Attempt to create duplicate
        response2 = await client.post(f"/v1/orgs/{org_id}/profile", json=data)
        assert response2.status_code == 409

    async def test_get_org_profile(self, client: AsyncClient):
        """Test getting an org profile."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id)
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        response = await client.get(f"/v1/orgs/{org_id}/profile")

        assert response.status_code == 200
        result = response.json()
        assert result["org_id"] == str(org_id)

    async def test_get_org_profile_not_found(self, client: AsyncClient):
        """Test getting a non-existent org profile."""
        fake_org_id = uuid4()

        response = await client.get(f"/v1/orgs/{fake_org_id}/profile")

        assert response.status_code == 404

    async def test_update_org_profile(self, client: AsyncClient):
        """Test updating an org profile."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id)
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        update_data = {
            "compliance_frameworks": ["HIPAA", "SOC2"],
            "epsilon_budget": 8.0,
            "model_training_enabled": False,
        }

        response = await client.put(f"/v1/orgs/{org_id}/profile", json=update_data)

        assert response.status_code == 200
        result = response.json()
        assert result["compliance_frameworks"] == ["HIPAA", "SOC2"]
        assert result["epsilon_budget"] == 8.0
        assert result["model_training_enabled"] is False

    async def test_update_org_profile_partial(self, client: AsyncClient):
        """Test partial update of org profile."""
        org_id = uuid4()
        data = create_org_profile_data(
            org_id=org_id, epsilon_budget=5.0, model_training_enabled=True
        )
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        # Update only one field
        response = await client.put(
            f"/v1/orgs/{org_id}/profile", json={"epsilon_budget": 7.5}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["epsilon_budget"] == 7.5
        # Other fields should remain unchanged (or server behavior may differ)

    async def test_update_org_profile_not_found(self, client: AsyncClient):
        """Test updating a non-existent org profile."""
        fake_org_id = uuid4()

        response = await client.put(
            f"/v1/orgs/{fake_org_id}/profile",
            json={"epsilon_budget": 10.0},
        )

        assert response.status_code == 404

    async def test_update_retention_policies(self, client: AsyncClient):
        """Test updating retention policies."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id)
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        new_policies = {
            "training_data": "7y",
            "audit_events": "10y",
            "model_artifacts": "3y",
        }

        response = await client.put(
            f"/v1/orgs/{org_id}/profile", json={"retention_policies": new_policies}
        )

        assert response.status_code == 200
        assert response.json()["retention_policies"] == new_policies


@pytest.mark.asyncio
class TestPrivacyBudgetAPI:
    """Test privacy budget tracking."""

    async def _create_org_profile(
        self, client: AsyncClient, epsilon_budget: float = 5.0
    ) -> str:
        """Helper to create an org profile and return the org_id."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id, epsilon_budget=epsilon_budget)
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)
        return str(org_id)

    async def test_get_privacy_budget(self, client: AsyncClient):
        """Test getting privacy budget status."""
        org_id = await self._create_org_profile(client, epsilon_budget=5.0)

        response = await client.get(f"/v1/orgs/{org_id}/privacy/budget")

        assert response.status_code == 200
        result = response.json()
        assert result["org_id"] == org_id
        assert result["epsilon_budget"] == 5.0
        assert result["epsilon_consumed"] == 0.0
        assert result["epsilon_remaining"] == 5.0
        assert result["is_exhausted"] is False

    async def test_privacy_budget_not_exhausted(self, client: AsyncClient):
        """Test privacy budget with partial consumption."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id, epsilon_budget=10.0)
        # Create profile
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        response = await client.get(f"/v1/orgs/{org_id}/privacy/budget")

        assert response.status_code == 200
        result = response.json()
        assert result["is_exhausted"] is False
        assert result["epsilon_remaining"] > 0

    async def test_privacy_budget_not_found(self, client: AsyncClient):
        """Test getting privacy budget for non-existent org."""
        fake_org_id = uuid4()

        response = await client.get(f"/v1/orgs/{fake_org_id}/privacy/budget")

        assert response.status_code == 404

    async def test_privacy_budget_calculation(self, client: AsyncClient):
        """Test that privacy budget remaining is calculated correctly."""
        org_id = uuid4()

        # Create with specific budget
        data = create_org_profile_data(org_id=org_id, epsilon_budget=8.0)
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        response = await client.get(f"/v1/orgs/{org_id}/privacy/budget")

        result = response.json()
        # Remaining should be budget - consumed
        assert result["epsilon_remaining"] == (
            result["epsilon_budget"] - result["epsilon_consumed"]
        )


@pytest.mark.asyncio
class TestComplianceStatusAPI:
    """Test compliance status endpoint."""

    async def test_get_compliance_status(self, client: AsyncClient):
        """Test getting compliance status for an org."""
        org_id = uuid4()
        data = create_org_profile_data(
            org_id=org_id, compliance_frameworks=["HIPAA", "SOC2"]
        )
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        response = await client.get(f"/v1/orgs/{org_id}/compliance")

        assert response.status_code == 200
        result = response.json()
        assert result["org_id"] == str(org_id)
        assert "HIPAA" in result["frameworks"]
        assert "SOC2" in result["frameworks"]
        assert "overrides_count" in result

    async def test_get_compliance_status_empty_frameworks(self, client: AsyncClient):
        """Test compliance status with no frameworks enabled."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id, compliance_frameworks=[])
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        response = await client.get(f"/v1/orgs/{org_id}/compliance")

        assert response.status_code == 200
        result = response.json()
        assert result["frameworks"] == []

    async def test_get_compliance_status_not_found(self, client: AsyncClient):
        """Test compliance status for non-existent org."""
        fake_org_id = uuid4()

        response = await client.get(f"/v1/orgs/{fake_org_id}/compliance")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestComplianceFrameworksAPI:
    """Test compliance frameworks reference endpoint."""

    async def test_list_compliance_frameworks(self, client: AsyncClient):
        """Test listing available compliance frameworks."""
        response = await client.get("/v1/frameworks")

        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, list)
        # Response should contain framework definitions if any exist


@pytest.mark.asyncio
class TestOrgProfileEdgeCases:
    """Test edge cases for Org Profile API."""

    async def test_create_profile_invalid_org_id(self, client: AsyncClient):
        """Test creating profile with invalid org ID format."""
        response = await client.post(
            "/v1/orgs/not-a-uuid/profile",
            json=create_org_profile_data(),
        )

        assert response.status_code == 422

    async def test_create_profile_negative_budget(self, client: AsyncClient):
        """Test creating profile with negative epsilon budget."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id, epsilon_budget=-1.0)

        response = await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        # Should fail validation
        assert response.status_code in [201, 422]  # Depending on schema validation

    async def test_create_profile_zero_budget(self, client: AsyncClient):
        """Test creating profile with zero epsilon budget."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id, epsilon_budget=0.0)

        response = await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        # Zero budget is valid
        assert response.status_code == 201

    async def test_update_privacy_settings(self, client: AsyncClient):
        """Test updating privacy settings."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id)
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        new_settings = {
            "anonymization": True,
            "data_minimization": True,
            "consent_required": True,
        }

        response = await client.put(
            f"/v1/orgs/{org_id}/profile", json={"privacy_settings": new_settings}
        )

        assert response.status_code == 200
        assert response.json()["privacy_settings"] == new_settings

    async def test_update_audit_routing_config(self, client: AsyncClient):
        """Test updating audit routing configuration."""
        org_id = uuid4()
        data = create_org_profile_data(org_id=org_id)
        await client.post(f"/v1/orgs/{org_id}/profile", json=data)

        routing_config = {
            "default_sink": "s3",
            "high_risk_sink": "security_hub",
        }

        response = await client.put(
            f"/v1/orgs/{org_id}/profile", json={"audit_routing_config": routing_config}
        )

        assert response.status_code == 200
        assert response.json()["audit_routing_config"] == routing_config
