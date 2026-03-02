# ML Services Foundation Specification

> **Status**: Draft
> **Author**: Claude + Valerie
> **Created**: 2026-03-02
> **Linear Tickets**: PX-889, PX-895, PX-896, PX-897, PX-898, PX-899, PX-900

## Overview

This specification defines the ML Services infrastructure for Inkra — a Python FastAPI service that provides model registry, training orchestration, audit routing, feedback collection, and differential privacy capabilities. This service operates alongside the existing Next.js application, communicating via REST APIs.

### Why This Matters

Inkra's extraction models need:
- **Versioned model management** with rollback capability
- **Compliance-aware audit routing** (HIPAA, SOC2, GDPR)
- **Privacy-preserving retraining** from user corrections
- **Strict tenant isolation** for the global model

Without this foundation, we can't ship production-grade ML features that meet compliance requirements.

---

## Build Order & Dependencies

```mermaid
graph TD
    subgraph "Phase 1 (Parallel Start)"
        PX900[PX-900: Model Registry]
        PX889[PX-889: Org Profile]
        PX896[PX-896: Validation Research]
    end

    subgraph "Phase 2"
        PX898[PX-898: Audit Routing]
    end

    subgraph "Phase 3"
        PX895[PX-895: Training Orchestration]
    end

    subgraph "Phase 4"
        PX899[PX-899: Feedback Collection]
    end

    subgraph "Phase 5"
        PX897[PX-897: Differential Privacy]
    end

    PX900 --> PX898
    PX889 --> PX898
    PX898 --> PX895
    PX900 --> PX895
    PX896 -.->|informs| PX895
    PX895 --> PX899
    PX898 --> PX899
    PX895 --> PX897
    PX900 --> PX897
```

**This Quarter (Q1 2026)**: Phase 1 + Phase 2
**Next Quarter (Q2 2026)**: Phases 3-5

---

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Next.js App (Existing)"
        NextAPI[API Routes]
        NextAuth[Supabase Auth]
    end

    subgraph "ML Services (New - ECS/Fargate)"
        FastAPI[FastAPI App]
        Celery[Celery Workers]

        subgraph "Domains"
            Registry[Model Registry]
            OrgProfile[Org Profile]
            Audit[Audit Routing]
            Training[Training Orchestration]
            Feedback[Feedback Collection]
            Privacy[Differential Privacy]
        end
    end

    subgraph "Data Stores"
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis)]
        S3[(S3 Buckets)]
    end

    subgraph "Compute"
        Ray[Ray on EKS]
    end

    subgraph "Observability"
        Prometheus[Prometheus]
        Grafana[Grafana]
        SecurityHub[AWS Security Hub]
    end

    NextAPI -->|Service API Key| FastAPI
    FastAPI --> Registry
    FastAPI --> OrgProfile
    FastAPI --> Audit
    FastAPI --> Training
    FastAPI --> Feedback
    FastAPI --> Privacy

    Registry --> PostgreSQL
    Registry --> S3
    OrgProfile --> PostgreSQL
    Audit --> PostgreSQL
    Audit --> S3
    Audit --> SecurityHub
    Training --> Ray
    Training --> Celery
    Feedback --> PostgreSQL
    Privacy --> PostgreSQL

    Celery --> Redis
    FastAPI --> Prometheus
```

### Container Architecture

```mermaid
graph LR
    subgraph "ECS Cluster"
        subgraph "API Service"
            FastAPI1[FastAPI Container]
            FastAPI2[FastAPI Container]
        end

        subgraph "Worker Service"
            Celery1[Celery Worker]
            Celery2[Celery Worker]
            CeleryBeat[Celery Beat]
        end
    end

    ALB[Application Load Balancer] --> FastAPI1
    ALB --> FastAPI2

    FastAPI1 --> Redis
    FastAPI2 --> Redis
    Celery1 --> Redis
    Celery2 --> Redis
```

---

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Framework** | FastAPI | Async-native, Pydantic integration, OpenAPI docs |
| **Python** | 3.11 | Latest stable, good library support |
| **Validation** | Pydantic v2 | Performance, FastAPI native |
| **ORM** | SQLAlchemy 2.0 | Async support, mature ecosystem |
| **Migrations** | Alembic | SQLAlchemy native, rollback support |
| **Job Queue** | Celery + Redis | Battle-tested, complex workflows |
| **Training** | Ray on EKS | Distributed compute, ML-native |
| **Database** | PostgreSQL | Separate instance from Next.js app |
| **Cache/Queue** | Redis | Job broker, caching, rate limiting |
| **Storage** | S3 | Model artifacts, audit archives |
| **Observability** | Prometheus + Grafana | K8s-native, ML dashboards |
| **SIEM** | AWS Security Hub | Native AWS, compliance reporting |
| **Secrets** | AWS Secrets Manager | ECS integration, managed rotation |

---

## Domain Specifications

### PX-900: Model Registry Service

**Purpose**: Track model versions, metadata, and deployment state.

#### Data Model

```mermaid
erDiagram
    Model {
        uuid id PK
        string name
        string model_type "llm|extraction|classification"
        string description
        boolean is_global
        uuid org_id FK "null for global models"
        timestamp created_at
        timestamp updated_at
    }

    ModelVersion {
        uuid id PK
        uuid model_id FK
        int version_number
        string status "training|validating|ready|deployed|deprecated"
        string artifact_s3_path
        json config
        json metrics
        uuid parent_version_id FK "nullable, for lineage"
        timestamp created_at
        timestamp deployed_at
    }

    ModelDeployment {
        uuid id PK
        uuid version_id FK
        string environment "staging|production"
        string deployment_status "pending|active|draining|terminated"
        float traffic_percentage
        timestamp started_at
        timestamp ended_at
    }

    Model ||--o{ ModelVersion : "has versions"
    ModelVersion ||--o{ ModelDeployment : "deployed as"
```

#### API Endpoints

| Endpoint | Method | Description | Latency SLA |
|----------|--------|-------------|-------------|
| `/v1/models` | GET | List models (filterable by type, org) | <50ms |
| `/v1/models` | POST | Register new model | <100ms |
| `/v1/models/{id}` | GET | Get model details | <50ms |
| `/v1/models/{id}/versions` | GET | List versions | <50ms |
| `/v1/models/{id}/versions` | POST | Create new version | <200ms |
| `/v1/models/{id}/versions/{v}` | GET | Get version details + metrics | <50ms |
| `/v1/models/{id}/versions/{v}/deploy` | POST | Trigger deployment | async |
| `/v1/models/{id}/versions/{v}/rollback` | POST | Rollback to version | async |

#### Versioning Strategy

- **Simple sequential**: v1, v2, v3...
- **Rollback**: Mark current as deprecated, promote previous
- **Canary**: Gradual traffic shift via `traffic_percentage`
- **Auto-rollback**: On metric degradation, revert automatically

---

### PX-889: Org Profile Schema & Admin Configuration

**Purpose**: Store compliance requirements and configuration per organization.

#### Data Model

```mermaid
erDiagram
    OrgProfile {
        uuid id PK
        uuid org_id FK "unique, references main app"
        json compliance_frameworks "['HIPAA', 'SOC2', 'GDPR']"
        json retention_policies
        json privacy_settings
        float epsilon_budget "differential privacy budget"
        float epsilon_consumed
        timestamp budget_reset_at
        boolean model_training_enabled
        json audit_routing_config
        timestamp created_at
        timestamp updated_at
    }

    ComplianceFramework {
        uuid id PK
        string name "HIPAA|SOC2|GDPR|FERPA|CUSTOM"
        json default_retention "e.g., 6 years for HIPAA"
        json required_audit_events
        json data_handling_rules
    }

    OrgComplianceOverride {
        uuid id PK
        uuid org_profile_id FK
        string framework_name
        json overrides "org-specific rule modifications"
    }

    OrgProfile ||--o{ OrgComplianceOverride : "customizes"
```

#### API Endpoints

| Endpoint | Method | Description | Latency SLA |
|----------|--------|-------------|-------------|
| `/v1/orgs/{org_id}/profile` | GET | Get org profile | <100ms |
| `/v1/orgs/{org_id}/profile` | PUT | Update org profile | <200ms |
| `/v1/orgs/{org_id}/compliance` | GET | Get compliance status | <100ms |
| `/v1/orgs/{org_id}/privacy/budget` | GET | Get ε budget status | <50ms |
| `/v1/frameworks` | GET | List available frameworks | <50ms |

#### Privacy Budget Enforcement

```python
# Hard block when budget exhausted
if org_profile.epsilon_consumed >= org_profile.epsilon_budget:
    raise PrivacyBudgetExhausted(
        org_id=org_id,
        consumed=org_profile.epsilon_consumed,
        budget=org_profile.epsilon_budget,
        resets_at=org_profile.budget_reset_at
    )
```

---

### PX-898: Audit Event Schema & Routing Layer

**Purpose**: Capture ML-related audit events and route to appropriate sinks based on org compliance requirements.

#### Data Model

```mermaid
erDiagram
    AuditEvent {
        uuid id PK
        uuid org_id FK
        string event_type
        string risk_tier "low|medium|high|critical"
        uuid actor_id
        string actor_type "user|system|model"
        json event_data
        string source_service
        uuid correlation_id
        timestamp occurred_at
        timestamp ingested_at
    }

    AuditSink {
        uuid id PK
        string sink_type "postgresql|s3|security_hub"
        json config
        boolean is_active
    }

    AuditRoute {
        uuid id PK
        uuid org_id FK "null for default routes"
        string event_type_pattern "glob pattern"
        string risk_tier_min
        uuid sink_id FK
    }

    AuditEvent }o--|| AuditRoute : "routed by"
    AuditRoute }o--|| AuditSink : "sends to"
```

#### Event Types

| Event Type | Risk Tier | Description |
|------------|-----------|-------------|
| `model.version.created` | low | New model version registered |
| `model.deployed` | medium | Model promoted to production |
| `model.rollback` | high | Emergency rollback triggered |
| `training.started` | low | Training job initiated |
| `training.completed` | low | Training job finished |
| `training.failed` | medium | Training job failed |
| `feedback.submitted` | low | User correction submitted |
| `feedback.applied` | medium | Correction applied to training data |
| `privacy.budget.warning` | medium | ε budget at 80% |
| `privacy.budget.exhausted` | critical | ε budget depleted, training blocked |
| `inference.phi_accessed` | medium | Model accessed PHI data |

#### Routing Flow

```mermaid
sequenceDiagram
    participant Service
    participant AuditRouter
    participant PostgreSQL
    participant S3
    participant SecurityHub

    Service->>AuditRouter: emit_event(event)
    AuditRouter->>AuditRouter: determine_routes(event, org_id)

    par PostgreSQL (always)
        AuditRouter->>PostgreSQL: INSERT audit_event
    and S3 (if high/critical OR org policy)
        AuditRouter->>S3: archive_event(event)
    and Security Hub (if critical OR compliance requires)
        AuditRouter->>SecurityHub: send_finding(event)
    end

    AuditRouter-->>Service: ack
```

---

### PX-895: Model Training Orchestration Framework

**Purpose**: Manage training jobs, validation gates, and deployment pipelines.

> **Detailed spec in Linear**: PX-895
> **Depends on**: PX-900 (registry), PX-898 (audit)

#### High-Level Flow

```mermaid
stateDiagram-v2
    [*] --> Triggered: feedback threshold OR drift detected
    Triggered --> DataPrep: Celery job
    DataPrep --> Training: Ray job submitted
    Training --> Validation: metrics computed

    Validation --> ValidationFailed: below thresholds
    Validation --> Canary: passes gates
    ValidationFailed --> [*]: alert, no deploy

    Canary --> Monitoring: 5% traffic
    Monitoring --> RollbackTriggered: degradation detected
    Monitoring --> Promotion: metrics stable
    RollbackTriggered --> [*]: auto-rollback, alert
    Promotion --> [*]: 100% traffic
```

#### Validation Gates (from PX-896 Research)

Configured in `config/validation_dimensions.yaml`:

```yaml
validation_gates:
  accuracy:
    enabled: true
    metrics:
      - name: f1_score
        threshold: 0.85
        comparison: gte
      - name: precision
        threshold: 0.80
        comparison: gte

  calibration:
    enabled: true
    metrics:
      - name: expected_calibration_error
        threshold: 0.05
        comparison: lte

  drift:
    enabled: true
    metrics:
      - name: psi  # Population Stability Index
        threshold: 0.1
        comparison: lte
      - name: feature_drift_score
        threshold: 0.15
        comparison: lte

  fairness:  # For sensitivity classifier only
    enabled_for: ["sensitivity_classifier"]
    metrics:
      - name: demographic_parity_diff
        threshold: 0.1
        comparison: lte
```

---

### PX-899: Feedback Collection Infrastructure

**Purpose**: Collect user corrections, score quality, and feed into training pipeline.

> **Detailed spec in Linear**: PX-899
> **Depends on**: PX-895 (training), PX-898 (audit)

#### Feedback Types

| Type | Description | Example |
|------|-------------|---------|
| `field_correction` | User fixes extracted value | "Date of Birth" corrected from "1990" to "1990-05-15" |
| `classification_override` | User changes model label | Sensitivity changed from "low" to "high" |
| `quality_rating` | Thumbs up/down, 1-5 stars | User rates extraction as 4/5 |

#### Quality Scoring (Phased)

| Phase | Scoring Method |
|-------|----------------|
| MVP | Confidence-weighted corrections |
| Phase 3 | Cross-correction consensus detection |
| Phase 4 | Longitudinal user trust scoring |

---

### PX-897: Differential Privacy & Data Synthesis Layer

**Purpose**: Ensure global model training preserves privacy with strict ε-budgets.

> **Detailed spec in Linear**: PX-897
> **Depends on**: PX-895 (training), PX-900 (registry)

#### Privacy Flow

```mermaid
sequenceDiagram
    participant Training
    participant PrivacyLayer
    participant OrgProfile
    participant SyntheticGen

    Training->>PrivacyLayer: request_training_data(org_id, model_id)
    PrivacyLayer->>OrgProfile: check_budget(org_id)

    alt Budget Available
        PrivacyLayer->>PrivacyLayer: apply_dp_noise(data, epsilon_cost)
        PrivacyLayer->>OrgProfile: consume_budget(epsilon_cost)
        PrivacyLayer-->>Training: privatized_data
    else Budget Exhausted
        PrivacyLayer->>SyntheticGen: generate_synthetic(data_profile)
        SyntheticGen-->>PrivacyLayer: synthetic_data
        PrivacyLayer-->>Training: synthetic_data (no budget cost)
    end
```

---

## Database Schema

### Full ERD

```mermaid
erDiagram
    %% Model Registry
    Model ||--o{ ModelVersion : "has"
    ModelVersion ||--o{ ModelDeployment : "deployed as"
    ModelVersion ||--o{ ValidationResult : "validated by"

    %% Org Profile
    OrgProfile ||--o{ OrgComplianceOverride : "customizes"
    OrgProfile ||--o{ PrivacyLedger : "tracks"

    %% Training
    TrainingJob ||--|| ModelVersion : "produces"
    TrainingJob ||--o{ TrainingMetric : "records"

    %% Feedback
    Feedback ||--o{ FeedbackApplication : "applied to"
    FeedbackApplication }o--|| TrainingJob : "included in"

    %% Audit
    AuditEvent }o--|| AuditRoute : "routed by"
    AuditRoute }o--|| AuditSink : "sends to"
```

---

## API Authentication & Security

### Service-to-Service Auth

```python
# Next.js app includes header
headers = {
    "X-Service-API-Key": os.environ["ML_SERVICE_API_KEY"],
    "X-Request-ID": str(uuid4()),
    "X-Org-ID": org_id  # From authenticated user context
}
```

### Key Rotation

- Keys stored in AWS Secrets Manager
- Manual rotation (no auto-rotation initially)
- Rotation process:
  1. Generate new key in Secrets Manager
  2. Deploy ml-services with both keys valid
  3. Update Next.js app with new key
  4. Remove old key from ml-services

### Rate Limiting

Per-endpoint limits stored in Redis:

| Endpoint Category | Limit |
|-------------------|-------|
| Health checks | Unlimited |
| Registry reads | 1000/min per org |
| Registry writes | 100/min per org |
| Training triggers | 10/min per org |
| Audit writes | 10000/min per org |

---

## Observability

### Health Endpoints

| Endpoint | Purpose | Checks |
|----------|---------|--------|
| `/healthz` | Liveness | Process responding |
| `/readyz` | Readiness | DB connected, Redis connected |
| `/livez` | Detailed liveness | Component-level status |

### Metrics (Prometheus)

```python
# Key metrics to expose
ml_model_inference_duration_seconds = Histogram(...)
ml_training_job_duration_seconds = Histogram(...)
ml_feedback_submitted_total = Counter(...)
ml_privacy_budget_remaining = Gauge(...)
ml_audit_events_total = Counter(...)
```

### Dashboards (Grafana)

1. **Model Performance**: Inference latency, error rates, version traffic
2. **Training Pipeline**: Job status, duration, validation pass rates
3. **Privacy Budget**: Per-org consumption, projections
4. **Audit Volume**: Events by type, routing success rates

---

## Deployment

### ECS Task Definitions

**API Service**:
- CPU: 512
- Memory: 1024
- Desired count: 2
- Health check: `/healthz`
- ALB target group

**Worker Service**:
- CPU: 1024
- Memory: 2048
- Desired count: 2
- No health check (Celery manages)

### CI/CD Pipeline

```mermaid
graph LR
    Push[Git Push] --> Test[pytest]
    Test --> Build[Docker Build]
    Build --> ECR[Push to ECR]
    ECR --> Deploy[ECS Deploy]
    Deploy --> Migrate[Run Alembic]
    Migrate --> Health[Health Check]
```

### Zero-Downtime Migrations

1. **Add column** (nullable or with default)
2. **Deploy new code** (handles both schemas)
3. **Backfill data** if needed
4. **Add constraints** (NOT NULL, etc.)
5. **Deploy cleanup code** (remove old handling)

---

## Error Handling

### Circuit Breaker Pattern

```python
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30)
async def call_next_app(endpoint: str, data: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{NEXT_APP_URL}{endpoint}",
            json=data,
            timeout=5.0
        )
        response.raise_for_status()
        return response.json()
```

### Error Response Format

```json
{
  "error": {
    "code": "PRIVACY_BUDGET_EXHAUSTED",
    "message": "Organization privacy budget exhausted",
    "details": {
      "org_id": "uuid",
      "consumed": 5.0,
      "budget": 5.0,
      "resets_at": "2026-04-01T00:00:00Z"
    }
  },
  "request_id": "uuid"
}
```

---

## Testing Strategy

### Test Pyramid

| Level | Tool | What |
|-------|------|------|
| Unit | pytest + mocks | Business logic, utilities |
| Integration | pytest + testcontainers | DB operations, Redis, S3 |
| E2E | pytest + staging | Full API flows |

### Test Coverage Requirements

- Minimum 80% line coverage
- 100% coverage on privacy/audit code paths
- All API endpoints have integration tests

---

## Decisions Made

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Separate PostgreSQL | ML metadata shouldn't couple with app schema | Shared DB with schema prefix |
| Celery over ARQ | Complex workflows, mature ecosystem | ARQ simpler but less features |
| S3 versioning | Native, no extra tooling | DVC adds complexity |
| Hard block on ε exhaust | Privacy is non-negotiable | Grace period risks compliance |
| YAML configs | Version controlled, no UI needed | DB configs add complexity |
| Domain-driven structure | Clear boundaries, scalable | Layer-based harder to navigate |

---

## Deferred Items

| Item | Reason | When |
|------|--------|------|
| GraphQL API | REST sufficient for MVP | If query complexity grows |
| Auto key rotation | Manual is fine at low scale | When key count grows |
| Multi-region | Single region sufficient | Enterprise requirements |
| Custom compliance UI | YAML configs work | Customer demand |
| Model A/B testing UI | API-only for now | Product prioritizes |

---

## Open Questions

1. **Ray cluster sizing**: What's the expected training job concurrency?
2. **S3 bucket structure**: Single bucket with prefixes or multiple buckets?
3. **Synthetic data quality**: What validation ensures synthetic data is useful?

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Registry query latency | p99 < 50ms | Prometheus histogram |
| Training job success rate | > 95% | Celery task metrics |
| Audit event delivery | 100% (no loss) | Event count reconciliation |
| Privacy budget accuracy | ε tracking within 0.01 | Ledger audit |

---

## References

- **Linear Tickets**: PX-889, PX-895, PX-896, PX-897, PX-898, PX-899, PX-900
- **Existing Audit System**: `src/lib/audit/service.ts`
- **Prisma Schema**: `prisma/schema.prisma` (Organization model)
