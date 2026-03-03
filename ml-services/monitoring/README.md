# ML Services Monitoring

This directory contains monitoring configuration for the ML Services platform.

## Directory Structure

```
monitoring/
├── grafana/
│   ├── dashboards/
│   │   └── ml-services.json    # Main Grafana dashboard
│   └── provisioning/
│       ├── dashboards/
│       │   └── dashboards.yml  # Dashboard provisioning config
│       └── datasources/
│           └── prometheus.yml  # Prometheus datasource config
└── prometheus/
    └── alerts.yml              # Prometheus alert rules
```

## Local Development

The monitoring stack is included in `docker/docker-compose.yml`:

```bash
cd ml-services/docker
docker-compose up -d prometheus grafana
```

Access:
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## Grafana Dashboard Panels

The `ml-services.json` dashboard includes:

### Service Health
- Request rate (requests/sec)
- Error rate (4xx, 5xx)
- Latency percentiles (p50, p95, p99)
- Active connections

### Model Registry
- Total models count
- Models by type (pie chart)
- Version deployments over time
- Deployment success/failure rate

### Training Jobs
- Active training jobs
- Training job duration histogram
- Jobs by status (pending, running, completed, failed)
- CPU/Memory utilization

### Privacy Budget
- Epsilon consumed vs budget per org
- Budget consumption rate
- Orgs approaching budget exhaustion

### Audit Events
- Events by risk tier
- Events by type
- Event ingestion rate
- S3 archive success rate

### Feedback
- Feedback submission rate
- Feedback by type
- Average rating trends

### Infrastructure
- Redis memory usage
- Redis connection count
- Database connections
- ECS task count

## Prometheus Alert Rules

Alert categories in `alerts.yml`:

### Critical Alerts
- `ServiceDown` - No response from service
- `HighErrorRate` - 5xx error rate > 1%
- `HealthCheckFailing` - Health endpoint failures
- `ECSNoTasks` - No API/Worker tasks running
- `PrivacyBudgetExhausted` - Org exhausted privacy budget
- `HighRiskAuditEvent` - Critical risk events detected

### Warning Alerts
- `HighLatency` - p99 latency > 2s
- `DeploymentFailureRate` - Model deployment failures > 10%
- `TrainingJobStuck` - Jobs running > 1 hour
- `PrivacyBudgetNearExhaustion` - Budget > 80% consumed
- `RedisHighMemory` - Redis memory > 80%
- `DatabaseConnectionPoolExhausted` - DB connections > 80%
- `CeleryQueueBacklog` - Queue length > 100

## AWS CloudWatch Alarms

Terraform module at `terraform/modules/monitoring/` creates:

### ECS Alarms
- CPU > 80% (5 min)
- Memory > 80% (5 min)
- Task count below desired
- No running tasks

### RDS Alarms
- CPU > 80%
- Free storage < 10GB
- Connections > 80% of max
- Read/Write latency > 100ms

### ElastiCache Alarms
- Memory > 80%
- CPU > 80%
- Evictions occurring
- High connection count

### ALB Alarms
- Response time > 1s
- Unhealthy hosts
- 5xx error count threshold

### Application Alarms
- 5xx error rate > 1%
- p99 latency > 2s
- Health check failures

## Notification Configuration

### Email Alerts

Set in Terraform:
```hcl
module "monitoring" {
  alarm_email = "oncall@inkra.io"
}
```

### Slack Integration

Enable Slack notifications:
```hcl
module "monitoring" {
  enable_slack_integration = true
  slack_webhook_url        = "https://hooks.slack.com/services/..."
}
```

## Metrics Exposed by ML Services

The API exposes Prometheus metrics at `/metrics`:

```
# HTTP metrics
http_requests_total{method, endpoint, status}
http_request_duration_seconds{method, endpoint}
http_connections_active

# Model Registry
ml_registry_models_total
ml_registry_models_by_type{model_type}
ml_registry_deployments_total{status}

# Training
ml_training_jobs_active
ml_training_jobs_by_status{status}
ml_training_job_duration_seconds_bucket

# Privacy
privacy_epsilon_consumed{org_id}
privacy_epsilon_budget{org_id}

# Audit
audit_events_total{event_type, risk_tier}
audit_s3_archive_total
audit_s3_archive_success_total

# Feedback
feedback_submissions_total{feedback_type}
feedback_rating_value

# Infrastructure
redis_memory_used_bytes
redis_connected_clients
db_connections_active
db_connections_idle
ecs_task_count{service}
```

## Adding Custom Metrics

To add new metrics to the dashboard:

1. Ensure the metric is exposed by the application
2. Edit `ml-services.json` or use Grafana UI
3. Export and save back to this repo

For Prometheus alerts:

1. Add rules to `alerts.yml`
2. Restart Prometheus or call `/-/reload`
