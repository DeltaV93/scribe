# Training Job Recovery Runbook

**Document ID:** RB-TRAIN-001
**Version:** 1.0
**Last Updated:** March 3, 2026
**Owner:** DevOps Lead

---

## Overview

This runbook covers recovery procedures for ML training jobs managed by the ML Services Training Orchestration system. Training jobs are tracked in PostgreSQL and executed on the Ray cluster.

## Architecture

| Component | Purpose | Recovery Strategy |
|-----------|---------|-------------------|
| Training Jobs Table | Job metadata and state | PostgreSQL PITR |
| Ray Cluster | Job execution | Stateless - resubmit |
| Model Artifacts (S3) | Training outputs | Versioned, cross-region replicated |
| Job Checkpoints (S3) | Resume interrupted jobs | Versioned |
| Celery Monitor Task | Periodic status sync | Auto-restart with Celery Beat |

## Job States

| State | Description | Recovery Action |
|-------|-------------|-----------------|
| `pending` | Job created, not yet submitted | Resubmit to Ray |
| `running` | Job executing on Ray | Check Ray, resubmit if lost |
| `completed` | Job finished successfully | No action needed |
| `failed` | Job failed with error | Review, retry if retriable |
| `cancelled` | Job manually cancelled | No action needed |

## Prerequisites

- AWS CLI configured with appropriate permissions
- Access to ML Services API
- Access to PostgreSQL database
- Access to Ray cluster (dashboard or CLI)

---

## Scenario 1: Stale Running Jobs

Jobs stuck in `running` status but no longer executing on Ray.

### Detection

- Job status `running` but Ray job not found
- Job `updated_at` timestamp older than expected
- CloudWatch alarm: `StaleTrainingJobs`

### Diagnosis

1. **Find stale jobs (running > 2 hours without update):**
```sql
SELECT id, model_id, org_id, status, ray_job_id,
       started_at, updated_at,
       NOW() - updated_at AS stale_duration
FROM training_jobs
WHERE status = 'running'
AND updated_at < NOW() - INTERVAL '2 hours';
```

2. **Check if Ray job exists:**
```bash
# Via Ray dashboard API
curl http://ray-head:8265/api/jobs/{RAY_JOB_ID}

# Or via ML Services API
curl -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  https://ml.inkra.io/v1/training/jobs/{JOB_ID}/status
```

3. **Check Ray job status:**
```bash
curl http://ray-head:8265/api/jobs/ | jq '.[] | select(.submission_id | contains("inkra-training"))'
```

### Recovery Steps

1. **Mark lost jobs as failed in database:**
```sql
-- For jobs where Ray job no longer exists
UPDATE training_jobs
SET status = 'failed',
    error_message = 'Ray job lost during cluster recovery',
    completed_at = NOW(),
    updated_at = NOW()
WHERE status = 'running'
AND updated_at < NOW() - INTERVAL '2 hours'
AND ray_job_id IS NOT NULL;
```

2. **Resubmit failed jobs via API:**
```bash
# For each job that should be retried
curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  https://ml.inkra.io/v1/training/jobs/{JOB_ID}/retry
```

3. **Or resubmit via batch script:**
```bash
#!/bin/bash
# recover-stale-jobs.sh

# Get stale job IDs
STALE_JOBS=$(psql $DATABASE_URL -t -c "
  SELECT id FROM training_jobs
  WHERE status = 'running'
  AND updated_at < NOW() - INTERVAL '2 hours'
")

for JOB_ID in $STALE_JOBS; do
  echo "Recovering job: $JOB_ID"

  # Mark as failed first
  psql $DATABASE_URL -c "
    UPDATE training_jobs
    SET status = 'failed',
        error_message = 'Recovered: resubmitting',
        completed_at = NOW()
    WHERE id = '$JOB_ID'
  "

  # Resubmit
  curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
    "https://ml.inkra.io/v1/training/jobs/$JOB_ID/retry"
done
```

### Expected Outcome
- Stale jobs marked as failed
- Retriable jobs resubmitted
- New Ray jobs created for retries

---

## Scenario 2: Pending Jobs Not Starting

Jobs in `pending` status but not submitted to Ray.

### Detection

- Jobs with `pending` status and no `ray_job_id`
- Jobs pending for > 10 minutes
- No active Ray jobs for pending database jobs

### Diagnosis

1. **Find orphaned pending jobs:**
```sql
SELECT id, model_id, org_id, created_at,
       NOW() - created_at AS pending_duration
FROM training_jobs
WHERE status = 'pending'
AND ray_job_id IS NULL
AND created_at < NOW() - INTERVAL '10 minutes';
```

2. **Check Ray cluster connectivity:**
```bash
# From ML Services container
curl http://ray-head:8265/api/version
```

3. **Check ML Services worker logs:**
```bash
aws logs tail /ecs/ml-services-prod --filter-pattern "training" --since 30m
```

### Recovery Steps

1. **If Ray is unavailable, see [Ray Cluster Recovery](./ray-cluster-recovery.md)**

2. **Resubmit pending jobs:**
```bash
# Via Celery task
celery -A src.common.celery_app call src.training.tasks.resubmit_pending_jobs

# Or via API
curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  https://ml.inkra.io/v1/training/jobs/resubmit-pending
```

3. **Manual resubmission:**
```sql
-- Get pending job details
SELECT id, model_id, config FROM training_jobs
WHERE status = 'pending' AND ray_job_id IS NULL;

-- Re-create job via API with same config
```

### Expected Outcome
- Pending jobs submitted to Ray
- Jobs transition to `running` status
- Ray job IDs populated in database

---

## Scenario 3: Failed Jobs - Retriable Errors

Jobs that failed due to transient errors.

### Detection

- Jobs with `failed` status
- Error messages indicating transient issues (network, resource)
- Jobs failed within last 24 hours

### Retriable Error Patterns

| Error Pattern | Retriable | Notes |
|--------------|-----------|-------|
| `RayConnectionError` | Yes | Ray cluster issue |
| `ResourceUnavailable` | Yes | Scale cluster first |
| `TimeoutError` | Yes | Increase timeout or resources |
| `OOM` / Memory | Maybe | Need more memory |
| `ValidationError` | No | Fix job config |
| `DataNotFound` | No | Fix data path |

### Recovery Steps

1. **Find retriable failed jobs:**
```sql
SELECT id, model_id, error_message, completed_at
FROM training_jobs
WHERE status = 'failed'
AND completed_at > NOW() - INTERVAL '24 hours'
AND (
  error_message LIKE '%RayConnectionError%'
  OR error_message LIKE '%ResourceUnavailable%'
  OR error_message LIKE '%TimeoutError%'
  OR error_message LIKE '%cluster recovery%'
);
```

2. **Retry individual job:**
```bash
curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  https://ml.inkra.io/v1/training/jobs/{JOB_ID}/retry
```

3. **Bulk retry retriable jobs:**
```bash
#!/bin/bash
# retry-failed-jobs.sh

psql $DATABASE_URL -t -c "
  SELECT id FROM training_jobs
  WHERE status = 'failed'
  AND completed_at > NOW() - INTERVAL '24 hours'
  AND (
    error_message LIKE '%RayConnectionError%'
    OR error_message LIKE '%ResourceUnavailable%'
    OR error_message LIKE '%TimeoutError%'
  )
" | while read JOB_ID; do
  echo "Retrying job: $JOB_ID"
  curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
    "https://ml.inkra.io/v1/training/jobs/$JOB_ID/retry"
  sleep 1
done
```

### Expected Outcome
- Retriable jobs resubmitted
- New job records created (original preserved)
- Progress continues from checkpoint if available

---

## Scenario 4: Job Checkpoint Recovery

Resume training from S3 checkpoint after interruption.

### Prerequisites

- Job must have saved checkpoints to S3
- Checkpoint data must be accessible

### Recovery Steps

1. **Check for existing checkpoints:**
```bash
# List checkpoints for job
aws s3 ls s3://inkra-ml-models/checkpoints/{JOB_ID}/ --recursive
```

2. **Find latest checkpoint:**
```bash
LATEST_CHECKPOINT=$(aws s3 ls s3://inkra-ml-models/checkpoints/{JOB_ID}/ \
  --recursive | sort | tail -1 | awk '{print $4}')
echo "Latest checkpoint: $LATEST_CHECKPOINT"
```

3. **Submit new job with checkpoint resume:**
```bash
curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  https://ml.inkra.io/v1/training/jobs \
  -d '{
    "model_id": "{MODEL_ID}",
    "config": {
      "resume_from_checkpoint": "s3://inkra-ml-models/checkpoints/{JOB_ID}/{CHECKPOINT}",
      "hyperparameters": {...}
    }
  }'
```

### Expected Outcome
- New job starts from checkpoint
- Training continues from last saved state
- Reduced time to completion

---

## Scenario 5: Complete Training System Recovery

Full recovery after database restore or cluster failure.

### Recovery Steps

1. **Verify database is restored:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM training_jobs;"
```

2. **Check job state consistency:**
```sql
-- Jobs by status
SELECT status, COUNT(*)
FROM training_jobs
GROUP BY status;

-- Recent active jobs
SELECT id, status, ray_job_id, started_at
FROM training_jobs
WHERE status IN ('pending', 'running')
ORDER BY created_at DESC
LIMIT 20;
```

3. **Reset orphaned running jobs:**
```sql
-- Jobs marked running but Ray cluster was rebuilt
UPDATE training_jobs
SET status = 'pending',
    ray_job_id = NULL,
    started_at = NULL,
    updated_at = NOW()
WHERE status = 'running'
AND ray_job_id IS NOT NULL;
```

4. **Trigger Celery monitor task to resubmit:**
```bash
# Force immediate monitoring
celery -A src.common.celery_app call src.training.tasks.monitor_all_active_jobs

# Or resubmit pending jobs
celery -A src.common.celery_app call src.training.tasks.resubmit_pending_jobs
```

5. **Verify jobs are executing:**
```bash
# Check Ray for new jobs
curl http://ray-head:8265/api/jobs/ | jq 'length'

# Check database for status updates
psql $DATABASE_URL -c "
  SELECT id, status, ray_job_id
  FROM training_jobs
  WHERE status IN ('pending', 'running')
  ORDER BY updated_at DESC
  LIMIT 10;
"
```

### Expected Outcome
- All orphaned jobs reset to pending
- Celery worker resubmits to Ray
- Training resumes normally

---

## Scenario 6: Job Data Export for Analysis

Export failed job data for debugging.

### Export Steps

1. **Export job metadata:**
```sql
\copy (
  SELECT id, model_id, org_id, status, config, metrics,
         started_at, completed_at, error_message, ray_job_id
  FROM training_jobs
  WHERE status = 'failed'
  AND completed_at > NOW() - INTERVAL '7 days'
) TO '/tmp/failed_jobs.csv' WITH CSV HEADER;
```

2. **Get job logs from Ray (if still available):**
```bash
for JOB_ID in $(cat job_ids.txt); do
  curl "http://ray-head:8265/api/jobs/inkra-training-$JOB_ID/logs" \
    > "logs_$JOB_ID.txt"
done
```

3. **Export from CloudWatch:**
```bash
aws logs filter-log-events \
  --log-group-name /ecs/ml-services-prod \
  --filter-pattern "job_id={JOB_ID}" \
  --start-time $(date -d "7 days ago" +%s000) \
  --output json > job_logs.json
```

---

## Monitoring and Alerting

### Celery Beat Schedule

The following tasks run automatically:

| Task | Schedule | Purpose |
|------|----------|---------|
| `monitor_all_active_jobs` | Every 5 minutes | Sync job status from Ray |
| `cleanup_completed_jobs` | Daily | Archive old job data |
| `check_model_drift` | Hourly | Detect model degradation |

### Key Metrics

```bash
# Count jobs by status
psql $DATABASE_URL -c "
  SELECT status, COUNT(*)
  FROM training_jobs
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY status;
"

# Average job duration
psql $DATABASE_URL -c "
  SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) as avg_minutes
  FROM training_jobs
  WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '7 days';
"

# Failed job rate
psql $DATABASE_URL -c "
  SELECT
    ROUND(100.0 * SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) / COUNT(*), 2) as fail_rate
  FROM training_jobs
  WHERE completed_at > NOW() - INTERVAL '24 hours';
"
```

---

## Validation Checklist

After any job recovery:

- [ ] No jobs stuck in `pending` for > 10 minutes
- [ ] No jobs stuck in `running` for > 2 hours without Ray job
- [ ] All running jobs have valid Ray job IDs
- [ ] Celery Beat scheduler running
- [ ] Monitor task executing every 5 minutes
- [ ] No spike in failed jobs
- [ ] ML Services API responding correctly

---

## Useful Commands

```bash
# List all active jobs
curl -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  "https://ml.inkra.io/v1/training/jobs?status=running"

# Get job details
curl -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  "https://ml.inkra.io/v1/training/jobs/{JOB_ID}"

# Get job logs
curl -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  "https://ml.inkra.io/v1/training/jobs/{JOB_ID}/logs"

# Cancel job
curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  "https://ml.inkra.io/v1/training/jobs/{JOB_ID}/cancel"

# Retry failed job
curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  "https://ml.inkra.io/v1/training/jobs/{JOB_ID}/retry"

# Trigger Celery task manually
celery -A src.common.celery_app call src.training.tasks.monitor_all_active_jobs

# Database direct query
psql $DATABASE_URL -c "SELECT * FROM training_jobs WHERE id = '{JOB_ID}';"
```

---

## Rollback Procedure

If job recovery causes issues:

1. Stop Celery workers to prevent further submissions
2. Revert any database changes
3. Fix underlying issue
4. Restart Celery workers
5. Monitor job processing

```bash
# Stop workers
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-worker --desired-count 0

# After fix, restart
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-worker --desired-count 2
```

---

## Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | [PagerDuty] |
| ML Platform Engineer | [PagerDuty rotation] |
| On-Call Engineer | [PagerDuty rotation] |

---

## Related Documents

- [Ray Cluster Recovery Runbook](./ray-cluster-recovery.md)
- [ML Services Database Restore](./ml-services-database-restore.md)
- [Redis Recovery Runbook](./redis-recovery.md)
- [Disaster Recovery Policy](../policies/disaster-recovery-policy.md)
