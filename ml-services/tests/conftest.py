"""Pytest configuration and fixtures."""

import asyncio
import os
from typing import AsyncGenerator
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

from src.common.db.base import Base
from src.common.db.session import get_session
from src.main import app

# Set test API key environment variable before importing settings
os.environ.setdefault("SERVICE_API_KEY", "test-key")


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def postgres_container():
    """Start PostgreSQL container for integration tests."""
    with PostgresContainer("postgres:16-alpine") as postgres:
        yield postgres


@pytest.fixture(scope="session")
def redis_container():
    """Start Redis container for integration tests."""
    with RedisContainer("redis:7-alpine") as redis:
        yield redis


@pytest_asyncio.fixture
async def db_session(postgres_container) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session with fresh tables for each test."""
    db_url = postgres_container.get_connection_url().replace(
        "postgresql://", "postgresql+asyncpg://"
    )

    engine = create_async_engine(db_url, echo=False)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session
        # Rollback any uncommitted changes
        await session.rollback()

    # Cleanup tables after test
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client with authenticated API key."""

    async def override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"X-Service-API-Key": "test-key"},
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def sample_org_id():
    """Generate sample org ID."""
    return uuid4()


@pytest.fixture
def sample_model_data():
    """Sample model creation data."""
    return {
        "name": "test-extraction-model",
        "model_type": "extraction",
        "description": "Test extraction model",
        "is_global": False,
    }


@pytest.fixture
def sample_org_profile_data(sample_org_id):
    """Sample org profile creation data."""
    return {
        "org_id": str(sample_org_id),
        "compliance_frameworks": ["HIPAA"],
        "retention_policies": {"training_data": "6y"},
        "privacy_settings": {"anonymization": True},
        "epsilon_budget": 5.0,
        "model_training_enabled": True,
        "audit_routing_config": {},
    }


@pytest.fixture
def sample_audit_event_data(sample_org_id):
    """Sample audit event creation data."""
    from datetime import datetime, timezone

    return {
        "org_id": str(sample_org_id),
        "event_type": "model.deployed",
        "risk_tier": "medium",
        "actor_id": str(uuid4()),
        "actor_type": "user",
        "event_data": {"model_id": str(uuid4())},
        "source_service": "test-service",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
