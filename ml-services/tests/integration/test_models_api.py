"""Integration tests for Model Registry Models API."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.factories import create_model_data, generate_models


@pytest.mark.asyncio
class TestModelsAPI:
    """Test Model CRUD operations."""

    async def test_create_model(self, client: AsyncClient):
        """Test creating a new model."""
        data = create_model_data(name="test-extraction-model", model_type="extraction")

        response = await client.post("/v1/models", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["name"] == data["name"]
        assert result["model_type"] == data["model_type"]
        assert result["description"] == data["description"]
        assert "id" in result
        assert "created_at" in result

    async def test_create_model_all_types(self, client: AsyncClient):
        """Test creating models of all supported types."""
        for model_type in ["llm", "extraction", "classification"]:
            data = create_model_data(model_type=model_type)
            response = await client.post("/v1/models", json=data)

            assert response.status_code == 201
            assert response.json()["model_type"] == model_type

    async def test_create_global_model(self, client: AsyncClient):
        """Test creating a global model."""
        data = create_model_data(is_global=True)

        response = await client.post("/v1/models", json=data)

        assert response.status_code == 201
        assert response.json()["is_global"] is True

    async def test_create_org_specific_model(self, client: AsyncClient):
        """Test creating an org-specific model."""
        org_id = uuid4()
        data = create_model_data(org_id=org_id)

        response = await client.post("/v1/models", json=data)

        assert response.status_code == 201
        assert response.json()["org_id"] == str(org_id)

    async def test_list_models(self, client: AsyncClient):
        """Test listing models."""
        # Create some models first
        for data in generate_models(3):
            await client.post("/v1/models", json=data)

        response = await client.get("/v1/models")

        assert response.status_code == 200
        result = response.json()
        assert "items" in result
        assert "total" in result
        assert "page" in result
        assert "page_size" in result
        assert len(result["items"]) >= 3

    async def test_list_models_filter_by_type(self, client: AsyncClient):
        """Test filtering models by type."""
        # Create models of different types
        await client.post("/v1/models", json=create_model_data(model_type="extraction"))
        await client.post("/v1/models", json=create_model_data(model_type="llm"))

        response = await client.get("/v1/models", params={"model_type": "extraction"})

        assert response.status_code == 200
        result = response.json()
        for item in result["items"]:
            assert item["model_type"] == "extraction"

    async def test_list_models_filter_global(self, client: AsyncClient):
        """Test filtering models to include/exclude global models."""
        # Create global and non-global models
        await client.post("/v1/models", json=create_model_data(is_global=True))
        await client.post("/v1/models", json=create_model_data(is_global=False))

        # With include_global=True (default)
        response = await client.get("/v1/models", params={"include_global": True})
        assert response.status_code == 200

        # With include_global=False
        response = await client.get("/v1/models", params={"include_global": False})
        assert response.status_code == 200

    async def test_list_models_pagination(self, client: AsyncClient):
        """Test model listing pagination."""
        # Create multiple models
        for data in generate_models(10):
            await client.post("/v1/models", json=data)

        # First page
        response = await client.get("/v1/models", params={"page": 1, "page_size": 5})
        assert response.status_code == 200
        result = response.json()
        assert result["page"] == 1
        assert result["page_size"] == 5
        assert len(result["items"]) == 5

        # Second page
        response = await client.get("/v1/models", params={"page": 2, "page_size": 5})
        assert response.status_code == 200
        result = response.json()
        assert result["page"] == 2

    async def test_list_models_pagination_limits(self, client: AsyncClient):
        """Test pagination limit constraints."""
        # Page size over limit should be capped or return error
        response = await client.get("/v1/models", params={"page_size": 200})
        # Expecting either 422 (validation error) or capped results
        assert response.status_code in [200, 422]

    async def test_get_model(self, client: AsyncClient):
        """Test getting a specific model by ID."""
        # Create a model
        create_response = await client.post(
            "/v1/models", json=create_model_data(name="get-test-model")
        )
        model_id = create_response.json()["id"]

        # Get the model
        response = await client.get(f"/v1/models/{model_id}")

        assert response.status_code == 200
        result = response.json()
        assert result["id"] == model_id
        assert result["name"] == "get-test-model"

    async def test_get_model_not_found(self, client: AsyncClient):
        """Test getting a model that doesn't exist."""
        fake_id = str(uuid4())

        response = await client.get(f"/v1/models/{fake_id}")

        assert response.status_code == 404

    async def test_get_model_invalid_uuid(self, client: AsyncClient):
        """Test getting a model with invalid UUID format."""
        response = await client.get("/v1/models/not-a-uuid")

        assert response.status_code == 422

    async def test_update_model(self, client: AsyncClient):
        """Test updating a model."""
        # Create a model
        create_response = await client.post(
            "/v1/models", json=create_model_data(name="original-name")
        )
        model_id = create_response.json()["id"]

        # Update the model
        response = await client.patch(
            f"/v1/models/{model_id}",
            json={"name": "updated-name", "description": "New description"},
        )

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "updated-name"
        assert result["description"] == "New description"

    async def test_update_model_partial(self, client: AsyncClient):
        """Test partial update of a model."""
        # Create a model
        create_response = await client.post(
            "/v1/models",
            json=create_model_data(name="partial-test", description="Original desc"),
        )
        model_id = create_response.json()["id"]

        # Update only description
        response = await client.patch(
            f"/v1/models/{model_id}", json={"description": "Updated desc"}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "partial-test"  # Unchanged
        assert result["description"] == "Updated desc"

    async def test_update_model_not_found(self, client: AsyncClient):
        """Test updating a model that doesn't exist."""
        fake_id = str(uuid4())

        response = await client.patch(
            f"/v1/models/{fake_id}", json={"name": "new-name"}
        )

        assert response.status_code == 404

    async def test_create_model_missing_required_fields(self, client: AsyncClient):
        """Test creating a model without required fields."""
        # Missing name
        response = await client.post(
            "/v1/models", json={"model_type": "extraction"}
        )
        assert response.status_code == 422

        # Missing model_type
        response = await client.post("/v1/models", json={"name": "test-model"})
        assert response.status_code == 422

    async def test_create_model_invalid_type(self, client: AsyncClient):
        """Test creating a model with invalid type."""
        response = await client.post(
            "/v1/models",
            json={"name": "test", "model_type": "invalid_type"},
        )

        assert response.status_code == 422


@pytest.mark.asyncio
class TestModelsAPIEdgeCases:
    """Test edge cases and error conditions for Models API."""

    async def test_create_model_with_empty_name(self, client: AsyncClient):
        """Test creating a model with empty name."""
        response = await client.post(
            "/v1/models", json={"name": "", "model_type": "extraction"}
        )

        # Should fail validation
        assert response.status_code == 422

    async def test_create_model_with_very_long_name(self, client: AsyncClient):
        """Test creating a model with a very long name."""
        long_name = "a" * 300  # Exceeds typical 255 char limit

        response = await client.post(
            "/v1/models",
            json={"name": long_name, "model_type": "extraction"},
        )

        # Should fail validation or truncate
        assert response.status_code in [201, 422]

    async def test_list_models_empty(self, client: AsyncClient):
        """Test listing models when none exist (in isolation)."""
        # This assumes a fresh database per test or isolated scope
        response = await client.get("/v1/models")

        assert response.status_code == 200
        result = response.json()
        assert "items" in result
        assert "total" in result
