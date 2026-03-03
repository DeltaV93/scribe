# Redis/ElastiCache Recovery Runbook

**Document ID:** RB-REDIS-001
**Version:** 1.0
**Last Updated:** March 3, 2026
**Owner:** DevOps Lead

---

## Overview

This runbook covers recovery procedures for AWS ElastiCache Redis used by ML Services for caching, job queues, and session management.

## Architecture

| Component | Purpose | Data Persistence |
|-----------|---------|------------------|
| Job Queues (Celery) | Background task processing | Jobs recoverable from DB |
| Rate Limiting | API request throttling | Ephemeral (auto-recovers) |
| Caching | Response caching | Ephemeral (auto-rebuilds) |
| Metrics | Prometheus counters | Ephemeral |

**Important:** Redis is treated as ephemeral. Critical state is persisted in PostgreSQL. Job queues can be rebuilt from database state.

## Prerequisites

- AWS CLI configured with ElastiCache permissions
- Access to AWS Console (ElastiCache, CloudWatch)
- Understanding of job queue recovery process

---

## Scenario 1: Single Node Failure (Multi-AZ)

ElastiCache automatically handles node replacement in Multi-AZ mode.

### Detection
- CloudWatch alarm: `ElastiCacheNodeFailure`
- Application connection errors
- Background job processing delays

### Recovery Steps

1. **Check cluster status:**
```bash
aws elasticache describe-replication-groups \
  --replication-group-id ml-services-redis-prod
```

2. **Verify failover occurred:**
```bash
aws elasticache describe-events \
  --source-type replication-group \
  --duration 60
```

3. **Verify application reconnection:**
```bash
curl https://ml.inkra.io/readyz
# Should show: {"status":"ok","db":"connected","redis":"connected"}
```

4. **If services not reconnecting, force restart:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --force-new-deployment

aws ecs update-service --cluster ml-services-prod \
  --service ml-services-worker --force-new-deployment
```

### Expected Outcome
- Automatic failover in 1-2 minutes
- Application reconnects with brief job processing delay
- No persistent data loss

---

## Scenario 2: Cluster-Wide Failure

Complete Redis cluster unavailable.

### Detection
- All Redis connection attempts failing
- ECS services failing health checks
- Job processing completely stopped

### Recovery Steps

1. **Assess cluster status:**
```bash
aws elasticache describe-replication-groups \
  --replication-group-id ml-services-redis-prod \
  --query 'ReplicationGroups[0].Status'
```

2. **If cluster recoverable, wait for AWS auto-recovery**

3. **If cluster unrecoverable, create new cluster:**

**Option A: Restore from snapshot**
```bash
# List available snapshots
aws elasticache describe-snapshots \
  --replication-group-id ml-services-redis-prod

# Restore from snapshot
aws elasticache create-replication-group \
  --replication-group-id ml-services-redis-prod-new \
  --replication-group-description "ML Services Redis (restored)" \
  --snapshot-name ml-services-redis-prod-snapshot-20260303 \
  --cache-node-type cache.t3.medium \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --security-group-ids sg-xxxxxxxxx \
  --cache-subnet-group-name ml-services-prod
```

**Option B: Create fresh cluster (data is ephemeral)**
```bash
cd ml-services/terraform
terraform apply -target=module.redis -var-file=environments/prod/terraform.tfvars
```

4. **Update endpoint in Secrets Manager:**
```bash
# Get new endpoint
NEW_ENDPOINT=$(aws elasticache describe-replication-groups \
  --replication-group-id ml-services-redis-prod-new \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
  --output text)

# Update secret
aws secretsmanager update-secret \
  --secret-id ml-services/prod \
  --secret-string "{\"REDIS_URL\": \"redis://${NEW_ENDPOINT}:6379/0\"}"
```

5. **Restart ECS services:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --force-new-deployment

aws ecs update-service --cluster ml-services-prod \
  --service ml-services-worker --force-new-deployment

aws ecs update-service --cluster ml-services-prod \
  --service ml-services-beat --force-new-deployment
```

6. **Re-queue pending jobs from database:**
```bash
# Run job recovery script
aws ecs run-task \
  --cluster ml-services-prod \
  --task-definition ml-services-api-prod \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["python","scripts/recover_jobs.py"]}]}'
```

### Expected Outcome
- New cluster available in 5-10 minutes
- Application reconnects after service restart
- Background jobs re-queued and processing

---

## Scenario 3: Connection Exhaustion

Too many connections causing Redis to reject new connections.

### Detection
- `REDIS_MAX_CLIENTS` errors in logs
- Intermittent connection failures
- Slow job processing

### Recovery Steps

1. **Check current connections:**
```bash
# Via ECS exec
aws ecs execute-command --cluster ml-services-prod \
  --task <TASK_ID> --container api \
  --command "redis-cli -h <redis-host> INFO clients" --interactive
```

2. **Scale up Redis if needed:**
```bash
aws elasticache modify-replication-group \
  --replication-group-id ml-services-redis-prod \
  --cache-node-type cache.t3.large \
  --apply-immediately
```

3. **Review application connection pooling settings**

4. **Restart services to reset connections:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --force-new-deployment
```

---

## Scenario 4: Memory Exhaustion

Redis running out of memory.

### Detection
- CloudWatch alarm: `ElastiCacheMemoryUsage > 90%`
- `OOM` errors in Redis logs
- Eviction warnings

### Recovery Steps

1. **Check memory usage:**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name DatabaseMemoryUsagePercentage \
  --dimensions Name=ReplicationGroupId,Value=ml-services-redis-prod \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

2. **Clear non-essential caches:**
```bash
# Via ECS exec - clear rate limit keys
aws ecs execute-command --cluster ml-services-prod \
  --task <TASK_ID> --container api \
  --command "redis-cli -h <redis-host> KEYS 'rate_limit:*' | xargs redis-cli DEL" --interactive
```

3. **Scale up node type:**
```bash
aws elasticache modify-replication-group \
  --replication-group-id ml-services-redis-prod \
  --cache-node-type cache.t3.large \
  --apply-immediately
```

4. **Review TTLs on cached data**

---

## Job Queue Recovery

When Redis fails, background jobs may be lost. Recovery process:

### 1. Identify Jobs to Re-queue

Jobs are tracked in PostgreSQL before being sent to Redis. Check for incomplete jobs:

```sql
-- Find training jobs that were in progress
SELECT * FROM training_jobs
WHERE status = 'running'
AND updated_at < NOW() - INTERVAL '1 hour';

-- Find pending audit events not yet archived
SELECT * FROM audit_events
WHERE s3_archive_path IS NULL
AND created_at < NOW() - INTERVAL '1 hour';
```

### 2. Re-queue Jobs

```python
# scripts/recover_jobs.py
from celery import Celery
from src.training.tasks import process_training_job
from src.audit.tasks import archive_to_s3

# Re-queue stale training jobs
stale_jobs = TrainingJob.query.filter(
    TrainingJob.status == 'running',
    TrainingJob.updated_at < datetime.utcnow() - timedelta(hours=1)
).all()

for job in stale_jobs:
    job.status = 'pending'
    process_training_job.delay(job.id)
```

### 3. Verify Processing

```bash
# Monitor worker logs
aws logs tail /ecs/ml-services-prod --follow --filter-pattern "worker"

# Check queue depth
redis-cli -h <redis-host> LLEN celery
```

---

## Validation Checklist

After any Redis recovery:

- [ ] Redis cluster status: `available`
- [ ] `/readyz` shows `redis: connected`
- [ ] Job queue processing (check Celery flower or logs)
- [ ] Rate limiting working (test API limits)
- [ ] No connection errors in application logs
- [ ] Metrics being collected

---

## Useful Commands

```bash
# Check cluster status
aws elasticache describe-replication-groups --replication-group-id ml-services-redis-prod

# List snapshots
aws elasticache describe-snapshots --replication-group-id ml-services-redis-prod

# Create manual snapshot
aws elasticache create-snapshot \
  --replication-group-id ml-services-redis-prod \
  --snapshot-name ml-services-redis-manual-$(date +%Y%m%d)

# View cluster events
aws elasticache describe-events --source-type replication-group --duration 1440

# Scale cluster
aws elasticache modify-replication-group \
  --replication-group-id ml-services-redis-prod \
  --cache-node-type cache.t3.large \
  --apply-immediately
```

---

## Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | [PagerDuty] |
| AWS Support | Enterprise Support Portal |
| On-Call Engineer | [PagerDuty rotation] |
