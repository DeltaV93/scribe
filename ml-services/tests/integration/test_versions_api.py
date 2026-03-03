"""Integration tests for Model Registry Versions API."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.factories import create_model_data, create_version_data, create_deployment_data


@pytest.mark.asyncio
class TestVersionsAPI:
    """Test Model Version CRUD operations."""

    async def _create_model(self, client: AsyncClient) -> str:
        """Helper to create a model and return its ID."""
        response = await client.post("/v1/models", json=create_model_data())
        assert response.status_code == 201
        return response.json()["id"]

    async def test_create_version(self, client: AsyncClient):
        """Test creating a new model version."""
        model_id = await self._create_model(client)

        response = await client.post(
            f"/v1/models/{model_id}/versions",
            json=create_version_data(config={"learning_rate": 0.001}),
        )

        assert response.status_code == 201
        result = response.json()
        assert result["version_number"] == 1
        assert result["status"] == "training"
        assert result["config"]["learning_rate"] == 0.001
        assert result["model_id"] == model_id

    async def test_create_version_empty_data(self, client: AsyncClient):
        """Test creating a version with empty/default data."""
        model_id = await self._create_model(client)

        response = await client.post(f"/v1/models/{model_id}/versions", json={})

        assert response.status_code == 201
        result = response.json()
        assert result["version_number"] == 1
        assert result["status"] == "training"

    async def test_create_multiple_versions(self, client: AsyncClient):
        """Test creating multiple versions with sequential numbering."""
        model_id = await self._create_model(client)

        for expected_version in [1, 2, 3, 4, 5]:
            response = await client.post(f"/v1/models/{model_id}/versions", json={})
            assert response.status_code == 201
            assert response.json()["version_number"] == expected_version

    async def test_create_version_with_artifact_path(self, client: AsyncClient):
        """Test creating a version with S3 artifact path."""
        model_id = await self._create_model(client)
        artifact_path = "s3://ml-artifacts/models/test/v1/model.pkl"

        response = await client.post(
            f"/v1/models/{model_id}/versions",
            json=create_version_data(artifact_s3_path=artifact_path),
        )

        assert response.status_code == 201
        assert response.json()["artifact_s3_path"] == artifact_path

    async def test_create_version_model_not_found(self, client: AsyncClient):
        """Test creating a version for non-existent model."""
        fake_id = str(uuid4())

        response = await client.post(f"/v1/models/{fake_id}/versions", json={})

        assert response.status_code == 404

    async def test_list_versions(self, client: AsyncClient):
        """Test listing versions for a model."""
        model_id = await self._create_model(client)

        # Create some versions
        for _ in range(3):
            await client.post(f"/v1/models/{model_id}/versions", json={})

        response = await client.get(f"/v1/models/{model_id}/versions")

        assert response.status_code == 200
        result = response.json()
        assert "items" in result
        assert "total" in result
        assert result["total"] == 3
        assert len(result["items"]) == 3

    async def test_list_versions_empty(self, client: AsyncClient):
        """Test listing versions when none exist."""
        model_id = await self._create_model(client)

        response = await client.get(f"/v1/models/{model_id}/versions")

        assert response.status_code == 200
        result = response.json()
        assert result["total"] == 0
        assert len(result["items"]) == 0

    async def test_get_version(self, client: AsyncClient):
        """Test getting a specific version by number."""
        model_id = await self._create_model(client)

        # Create a version
        await client.post(
            f"/v1/models/{model_id}/versions",
            json=create_version_data(config={"epochs": 100}),
        )

        response = await client.get(f"/v1/models/{model_id}/versions/1")

        assert response.status_code == 200
        result = response.json()
        assert result["version_number"] == 1
        assert result["config"]["epochs"] == 100

    async def test_get_version_not_found(self, client: AsyncClient):
        """Test getting a version that doesn't exist."""
        model_id = await self._create_model(client)

        response = await client.get(f"/v1/models/{model_id}/versions/999")

        assert response.status_code == 404

    async def test_update_version_status(self, client: AsyncClient):
        """Test updating version status."""
        model_id = await self._create_model(client)
        await client.post(f"/v1/models/{model_id}/versions", json={})

        response = await client.patch(
            f"/v1/models/{model_id}/versions/1", json={"status": "ready"}
        )

        assert response.status_code == 200
        assert response.json()["status"] == "ready"

    async def test_update_version_metrics(self, client: AsyncClient):
        """Test updating version metrics."""
        model_id = await self._create_model(client)
        await client.post(f"/v1/models/{model_id}/versions", json={})

        metrics = {
            "accuracy": 0.95,
            "f1_score": 0.92,
            "precision": 0.93,
            "recall": 0.91,
        }

        response = await client.patch(
            f"/v1/models/{model_id}/versions/1", json={"metrics": metrics}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["metrics"]["accuracy"] == 0.95
        assert result["metrics"]["f1_score"] == 0.92


@pytest.mark.asyncio
class TestDeploymentAPI:
    """Test deployment flow for model versions."""

    async def _create_ready_version(self, client: AsyncClient) -> tuple[str, int]:
        """Helper to create a model with a ready version."""
        # Create model
        model_response = await client.post("/v1/models", json=create_model_data())
        model_id = model_response.json()["id"]

        # Create version
        await client.post(f"/v1/models/{model_id}/versions", json={})

        # Update to ready status
        await client.patch(f"/v1/models/{model_id}/versions/1", json={"status": "ready"})

        return model_id, 1

    async def test_deploy_version_to_staging(self, client: AsyncClient):
        """Test deploying a version to staging."""
        model_id, version_num = await self._create_ready_version(client)

        response = await client.post(
            f"/v1/models/{model_id}/versions/{version_num}/deploy",
            json=create_deployment_data(environment="staging"),
        )

        assert response.status_code == 201
        result = response.json()
        assert result["environment"] == "staging"
        assert result["deployment_status"] in ["pending", "active"]
        assert result["traffic_percentage"] == 100.0

    async def test_deploy_version_to_production(self, client: AsyncClient):
        """Test deploying a version to production."""
        model_id, version_num = await self._create_ready_version(client)

        response = await client.post(
            f"/v1/models/{model_id}/versions/{version_num}/deploy",
            json=create_deployment_data(environment="production"),
        )

        assert response.status_code == 201
        assert response.json()["environment"] == "production"

    async def test_deploy_version_with_traffic_percentage(self, client: AsyncClient):
        """Test deploying with specific traffic percentage (canary)."""
        model_id, version_num = await self._create_ready_version(client)

        response = await client.post(
            f"/v1/models/{model_id}/versions/{version_num}/deploy",
            json=create_deployment_data(environment="staging", traffic_percentage=25.0),
        )

        assert response.status_code == 201
        assert response.json()["traffic_percentage"] == 25.0

    async def test_deploy_version_not_found(self, client: AsyncClient):
        """Test deploying a non-existent version."""
        model_response = await client.post("/v1/models", json=create_model_data())
        model_id = model_response.json()["id"]

        response = await client.post(
            f"/v1/models/{model_id}/versions/999/deploy",
            json=create_deployment_data(),
        )

        assert response.status_code == 404

    async def test_deploy_invalid_environment(self, client: AsyncClient):
        """Test deploying to an invalid environment."""
        model_id, version_num = await self._create_ready_version(client)

        response = await client.post(
            f"/v1/models/{model_id}/versions/{version_num}/deploy",
            json={"environment": "invalid"},
        )

        assert response.status_code == 422


@pytest.mark.asyncio
class TestRollbackAPI:
    """Test rollback flow for model versions."""

    async def _setup_deployed_versions(
        self, client: AsyncClient
    ) -> tuple[str, int, int]:
        """Helper to create model with multiple deployed versions."""
        # Create model
        model_response = await client.post("/v1/models", json=create_model_data())
        model_id = model_response.json()["id"]

        # Create and deploy v1
        await client.post(f"/v1/models/{model_id}/versions", json={})
        await client.patch(f"/v1/models/{model_id}/versions/1", json={"status": "ready"})
        await client.post(
            f"/v1/models/{model_id}/versions/1/deploy",
            json=create_deployment_data(environment="production"),
        )

        # Create and deploy v2
        await client.post(f"/v1/models/{model_id}/versions", json={})
        await client.patch(f"/v1/models/{model_id}/versions/2", json={"status": "ready"})
        await client.post(
            f"/v1/models/{model_id}/versions/2/deploy",
            json=create_deployment_data(environment="production"),
        )

        return model_id, 1, 2

    async def test_rollback_to_previous_version(self, client: AsyncClient):
        """Test rolling back to a previous version."""
        model_id, v1, v2 = await self._setup_deployed_versions(client)

        response = await client.post(
            f"/v1/models/{model_id}/versions/{v1}/rollback",
            params={"environment": "production"},
        )

        assert response.status_code == 200
        result = response.json()
        assert result["environment"] == "production"

    async def test_rollback_staging_environment(self, client: AsyncClient):
        """Test rolling back in staging environment."""
        # Create model with version deployed to staging
        model_response = await client.post("/v1/models", json=create_model_data())
        model_id = model_response.json()["id"]

        # Create and deploy v1 to staging
        await client.post(f"/v1/models/{model_id}/versions", json={})
        await client.patch(f"/v1/models/{model_id}/versions/1", json={"status": "ready"})
        await client.post(
            f"/v1/models/{model_id}/versions/1/deploy",
            json=create_deployment_data(environment="staging"),
        )

        response = await client.post(
            f"/v1/models/{model_id}/versions/1/rollback",
            params={"environment": "staging"},
        )

        assert response.status_code == 200
        assert response.json()["environment"] == "staging"

    async def test_rollback_version_not_found(self, client: AsyncClient):
        """Test rolling back to non-existent version."""
        model_response = await client.post("/v1/models", json=create_model_data())
        model_id = model_response.json()["id"]

        response = await client.post(
            f"/v1/models/{model_id}/versions/999/rollback",
            params={"environment": "production"},
        )

        assert response.status_code == 404

    async def test_rollback_invalid_environment(self, client: AsyncClient):
        """Test rolling back with invalid environment."""
        model_id, v1, v2 = await self._setup_deployed_versions(client)

        response = await client.post(
            f"/v1/models/{model_id}/versions/{v1}/rollback",
            params={"environment": "invalid"},
        )

        assert response.status_code == 422


@pytest.mark.asyncio
class TestVersionLifecycle:
    """Test complete version lifecycle from training to deployment."""

    async def test_complete_version_lifecycle(self, client: AsyncClient):
        """Test a complete version lifecycle: training -> validating -> ready -> deployed."""
        # Create model
        model_response = await client.post("/v1/models", json=create_model_data())
        model_id = model_response.json()["id"]

        # Create version (starts in training)
        version_response = await client.post(
            f"/v1/models/{model_id}/versions",
            json=create_version_data(config={"epochs": 50}),
        )
        assert version_response.json()["status"] == "training"

        # Transition to validating
        response = await client.patch(
            f"/v1/models/{model_id}/versions/1", json={"status": "validating"}
        )
        assert response.json()["status"] == "validating"

        # Add metrics
        response = await client.patch(
            f"/v1/models/{model_id}/versions/1",
            json={
                "status": "ready",
                "metrics": {"accuracy": 0.95},
                "artifact_s3_path": "s3://bucket/model.pkl",
            },
        )
        assert response.json()["status"] == "ready"

        # Deploy to staging
        deploy_response = await client.post(
            f"/v1/models/{model_id}/versions/1/deploy",
            json=create_deployment_data(environment="staging"),
        )
        assert deploy_response.status_code == 201

        # Deploy to production
        prod_response = await client.post(
            f"/v1/models/{model_id}/versions/1/deploy",
            json=create_deployment_data(environment="production"),
        )
        assert prod_response.status_code == 201
