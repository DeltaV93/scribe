# ML Services

Inkra's ML infrastructure service — Model Registry, Training Orchestration, Audit Routing, Feedback Collection, and Differential Privacy.

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Start local infrastructure
docker compose -f docker/docker-compose.yml up -d db redis

# Run migrations
alembic upgrade head

# Start development server
uvicorn src.main:app --reload

# Or run everything with Docker
docker compose -f docker/docker-compose.yml up
```

## Architecture

```
ml-services/
├── src/
│   ├── registry/       # PX-900: Model Registry Service
│   ├── org_profile/    # PX-889: Org Profile & Compliance
│   ├── audit/          # PX-898: Audit Event Routing
│   ├── training/       # PX-895: Training Orchestration (Phase 3)
│   ├── feedback/       # PX-899: Feedback Collection (Phase 4)
│   ├── privacy/        # PX-897: Differential Privacy (Phase 5)
│   └── common/         # Shared infrastructure
├── config/             # YAML configuration files
├── tests/              # Unit, integration, E2E tests
└── docker/             # Container configuration
```

## API Documentation

When running locally, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Type checking
mypy src

# Linting
ruff check src tests
ruff format src tests
```

## Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one version
alembic downgrade -1
```

## Environment Variables

See `.env.example` for required configuration.

## Linear Tickets

- PX-900: Model Registry Service
- PX-889: Org Profile Schema & Admin Configuration
- PX-898: Audit Event Schema & Routing Layer
- PX-895: Model Training Orchestration Framework
- PX-899: Feedback Collection Infrastructure
- PX-897: Differential Privacy & Data Synthesis Layer
- PX-896: Validation Dimensions Research
