"""Model Registry business logic."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.registry.models import Model, ModelVersion, ModelDeployment, VersionStatus, DeploymentStatus
from src.registry.schemas import (
    ModelCreate,
    ModelUpdate,
    VersionCreate,
    VersionUpdate,
    DeploymentCreate,
)

logger = structlog.get_logger()


class ModelRegistryService:
    """Service for managing model registry operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # --- Model Operations ---

    async def list_models(
        self,
        org_id: Optional[UUID] = None,
        model_type: Optional[str] = None,
        include_global: bool = True,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[Model], int]:
        """List models with filtering and pagination."""
        query = select(Model)

        # Filter by org (include global models if requested)
        if org_id:
            if include_global:
                query = query.where((Model.org_id == org_id) | (Model.is_global == True))
            else:
                query = query.where(Model.org_id == org_id)
        elif not include_global:
            query = query.where(Model.is_global == False)

        # Filter by type
        if model_type:
            query = query.where(Model.model_type == model_type)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_query)).scalar() or 0

        # Paginate
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(Model.created_at.desc())

        result = await self.session.execute(query)
        models = list(result.scalars().all())

        return models, total

    async def get_model(self, model_id: UUID) -> Optional[Model]:
        """Get a model by ID."""
        result = await self.session.execute(
            select(Model)
            .where(Model.id == model_id)
            .options(selectinload(Model.versions))
        )
        return result.scalar_one_or_none()

    async def create_model(self, data: ModelCreate) -> Model:
        """Create a new model."""
        model = Model(
            name=data.name,
            model_type=data.model_type,
            description=data.description,
            is_global=data.is_global,
            org_id=data.org_id,
        )
        self.session.add(model)
        await self.session.flush()

        logger.info(
            "Model created",
            model_id=str(model.id),
            name=model.name,
            model_type=model.model_type,
        )

        return model

    async def update_model(self, model_id: UUID, data: ModelUpdate) -> Optional[Model]:
        """Update a model."""
        model = await self.get_model(model_id)
        if not model:
            return None

        if data.name is not None:
            model.name = data.name
        if data.description is not None:
            model.description = data.description

        await self.session.flush()

        logger.info("Model updated", model_id=str(model_id))

        return model

    # --- Version Operations ---

    async def list_versions(self, model_id: UUID) -> List[ModelVersion]:
        """List all versions of a model."""
        result = await self.session.execute(
            select(ModelVersion)
            .where(ModelVersion.model_id == model_id)
            .order_by(ModelVersion.version_number.desc())
        )
        return list(result.scalars().all())

    async def get_version(self, version_id: UUID) -> Optional[ModelVersion]:
        """Get a version by ID."""
        result = await self.session.execute(
            select(ModelVersion)
            .where(ModelVersion.id == version_id)
            .options(selectinload(ModelVersion.deployments))
        )
        return result.scalar_one_or_none()

    async def create_version(self, model_id: UUID, data: VersionCreate) -> ModelVersion:
        """Create a new version for a model."""
        # Get next version number
        result = await self.session.execute(
            select(func.max(ModelVersion.version_number))
            .where(ModelVersion.model_id == model_id)
        )
        max_version = result.scalar() or 0

        version = ModelVersion(
            model_id=model_id,
            version_number=max_version + 1,
            status=VersionStatus.TRAINING,
            config=data.config,
            artifact_s3_path=data.artifact_s3_path,
            parent_version_id=data.parent_version_id,
        )
        self.session.add(version)
        await self.session.flush()

        logger.info(
            "Version created",
            model_id=str(model_id),
            version_id=str(version.id),
            version_number=version.version_number,
        )

        return version

    async def update_version(self, version_id: UUID, data: VersionUpdate) -> Optional[ModelVersion]:
        """Update a version."""
        version = await self.get_version(version_id)
        if not version:
            return None

        if data.status is not None:
            version.status = data.status
        if data.artifact_s3_path is not None:
            version.artifact_s3_path = data.artifact_s3_path
        if data.config is not None:
            version.config = data.config
        if data.metrics is not None:
            version.metrics = data.metrics

        await self.session.flush()

        logger.info("Version updated", version_id=str(version_id), status=version.status)

        return version

    # --- Deployment Operations ---

    async def deploy_version(
        self, version_id: UUID, data: DeploymentCreate
    ) -> ModelDeployment:
        """Create a new deployment for a version."""
        # Update version status
        version = await self.get_version(version_id)
        if version:
            version.status = VersionStatus.DEPLOYED
            version.deployed_at = datetime.utcnow()

        deployment = ModelDeployment(
            version_id=version_id,
            environment=data.environment,
            deployment_status=DeploymentStatus.PENDING,
            traffic_percentage=data.traffic_percentage,
            started_at=datetime.utcnow(),
        )
        self.session.add(deployment)
        await self.session.flush()

        logger.info(
            "Deployment created",
            version_id=str(version_id),
            deployment_id=str(deployment.id),
            environment=data.environment,
        )

        return deployment

    async def rollback_to_version(
        self, model_id: UUID, target_version_number: int, environment: str
    ) -> Optional[ModelDeployment]:
        """Rollback to a specific version."""
        # Find the target version
        result = await self.session.execute(
            select(ModelVersion)
            .where(ModelVersion.model_id == model_id)
            .where(ModelVersion.version_number == target_version_number)
        )
        target_version = result.scalar_one_or_none()

        if not target_version:
            return None

        # Terminate current active deployments in this environment
        result = await self.session.execute(
            select(ModelDeployment)
            .join(ModelVersion)
            .where(ModelVersion.model_id == model_id)
            .where(ModelDeployment.environment == environment)
            .where(ModelDeployment.deployment_status == DeploymentStatus.ACTIVE)
        )
        active_deployments = result.scalars().all()

        for deployment in active_deployments:
            deployment.deployment_status = DeploymentStatus.TERMINATED
            deployment.ended_at = datetime.utcnow()

        # Create new deployment for target version
        deployment = await self.deploy_version(
            target_version.id,
            DeploymentCreate(environment=environment, traffic_percentage=100.0),
        )
        deployment.deployment_status = DeploymentStatus.ACTIVE

        logger.info(
            "Rollback completed",
            model_id=str(model_id),
            target_version=target_version_number,
            environment=environment,
        )

        return deployment
