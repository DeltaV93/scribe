"""Integration tests for Model Registry API."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestModelRegistryAPI:
    """Test Model Registry endpoints."""

    async def test_create_model(self, client: AsyncClient, sample_model_data: dict):
        """Test creating a new model."""
        response = await client.post("/v1/models", json=sample_model_data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == sample_model_data["name"]
        assert data["model_type"] == sample_model_data["model_type"]
        assert "id" in data

    async def test_list_models(self, client: AsyncClient, sample_model_data: dict):
        """Test listing models."""
        # Create a model first
        await client.post("/v1/models", json=sample_model_data)

        response = await client.get("/v1/models")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1

    async def test_get_model(self, client: AsyncClient, sample_model_data: dict):
        """Test getting a specific model."""
        # Create a model first
        create_response = await client.post("/v1/models", json=sample_model_data)
        model_id = create_response.json()["id"]

        response = await client.get(f"/v1/models/{model_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == model_id

    async def test_get_nonexistent_model(self, client: AsyncClient):
        """Test getting a model that doesn't exist."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(f"/v1/models/{fake_id}")

        assert response.status_code == 404

    async def test_create_version(self, client: AsyncClient, sample_model_data: dict):
        """Test creating a model version."""
        # Create a model first
        create_response = await client.post("/v1/models", json=sample_model_data)
        model_id = create_response.json()["id"]

        version_data = {"config": {"learning_rate": 0.001}}
        response = await client.post(
            f"/v1/models/{model_id}/versions", json=version_data
        )

        assert response.status_code == 201
        data = response.json()
        assert data["version_number"] == 1
        assert data["status"] == "training"

    async def test_sequential_versioning(
        self, client: AsyncClient, sample_model_data: dict
    ):
        """Test that versions are numbered sequentially."""
        # Create a model
        create_response = await client.post("/v1/models", json=sample_model_data)
        model_id = create_response.json()["id"]

        # Create multiple versions
        for expected_version in [1, 2, 3]:
            response = await client.post(f"/v1/models/{model_id}/versions", json={})
            assert response.status_code == 201
            assert response.json()["version_number"] == expected_version
