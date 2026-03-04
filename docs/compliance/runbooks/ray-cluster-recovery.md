# Ray Cluster Recovery Runbook

**Document ID:** RB-RAY-001
**Version:** 1.0
**Last Updated:** March 3, 2026
**Owner:** DevOps Lead

---

## Overview

This runbook covers recovery procedures for the Ray cluster used for ML model training orchestration. Ray provides distributed computing for training jobs submitted through the ML Services API.

## Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| Ray Head Node | ECS Fargate | Cluster coordinator, job scheduling |
| Ray Worker Nodes | ECS Fargate | Execute training jobs |
| Job Submission Client | ML Services API | Submit jobs via `ray://` protocol |
| Job State | PostgreSQL | Persistent job records |
| Model Artifacts | S3 | Training outputs and checkpoints |

**Key Configuration:**
- RAY_ADDRESS: `ray://ray-head:10001` (internal ECS service discovery)
- Dashboard Port: `8265`
- Protocol: Ray Job Submission API

## Prerequisites

- AWS CLI configured with ECS permissions
- Access to AWS Console (ECS, CloudWatch)
- Access to ML Services API
- Database access for job state queries

---

## Scenario 1: Ray Head Node Failure

ECS automatically restarts failed tasks. The head node is stateless - job state is persisted in PostgreSQL.

### Detection

- CloudWatch alarm: `RayHeadNodeUnhealthy`
- ML Services API errors: `RayConnectionError: Cannot connect to Ray`
- Training jobs not progressing
- Ray dashboard unavailable

### Diagnosis

1. **Check Ray head service status:**
```bash
aws ecs describe-services \
  --cluster ml-services-prod \
  --services ray-head \
  --query 'services[0].{status:status,runningCount:runningCount,desiredCount:desiredCount}'
```

2. **Check head node task status:**
```bash
TASK_ARN=$(aws ecs list-tasks --cluster ml-services-prod \
  --service-name ray-head --desired-status RUNNING \
  --query 'taskArns[0]' --output text)

aws ecs describe-tasks --cluster ml-services-prod \
  --tasks $TASK_ARN \
  --query 'tasks[0].[lastStatus,healthStatus,stoppedReason]'
```

3. **Check CloudWatch logs:**
```bash
aws logs tail /ecs/ml-services-prod --filter-pattern "ray-head" --since 15m
```

### Recovery Steps

1. **If task not running, force new deployment:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ray-head --force-new-deployment
```

2. **Wait for service stabilization:**
```bash
aws ecs wait services-stable --cluster ml-services-prod \
  --services ray-head
```

3. **Verify head node is accepting connections:**
```bash
# From ML Services API container
curl http://ray-head:8265/api/version
```

4. **Verify ML Services can connect:**
```bash
curl https://ml.inkra.io/healthz
# Check ray_cluster status in response
```

### Expected Outcome
- Head node restarts within 2-3 minutes
- Worker nodes reconnect automatically
- Pending jobs resume execution
- Running jobs may need resubmission

---

## Scenario 2: Ray Worker Node Failures

Workers are stateless and auto-scale based on job demand.

### Detection

- Training jobs queued but not executing
- CloudWatch alarm: `RayWorkerCapacity`
- Jobs failing with resource unavailable errors

### Diagnosis

1. **Check worker service status:**
```bash
aws ecs describe-services \
  --cluster ml-services-prod \
  --services ray-worker \
  --query 'services[0].{runningCount:runningCount,desiredCount:desiredCount,pendingCount:pendingCount}'
```

2. **Check auto-scaling activity:**
```bash
aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id service/ml-services-prod/ray-worker
```

3. **Check for capacity issues:**
```bash
aws ecs describe-services \
  --cluster ml-services-prod \
  --services ray-worker \
  --query 'services[0].events[:5]'
```

### Recovery Steps

1. **Force new worker deployment:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ray-worker --force-new-deployment
```

2. **Scale up workers if needed:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ray-worker --desired-count 4
```

3. **If Fargate capacity issue, try different AZ:**
```bash
# Check which subnets are being used
aws ecs describe-services --cluster ml-services-prod \
  --services ray-worker \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets'
```

### Expected Outcome
- Workers restart within 2-3 minutes
- Queued jobs begin execution
- Auto-scaling resumes normal operation

---

## Scenario 3: Complete Cluster Corruption

Head and workers both in failed state.

### Detection

- All Ray services unhealthy
- No tasks running in Ray services
- ML Services completely unable to submit jobs

### Recovery Steps

1. **Stop all Ray services:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ray-worker --desired-count 0

aws ecs update-service --cluster ml-services-prod \
  --service ray-head --desired-count 0

# Wait for tasks to stop
aws ecs wait services-stable --cluster ml-services-prod \
  --services ray-head ray-worker
```

2. **Clear any corrupted state (if applicable):**
```bash
# Ray is stateless - no state to clear
# Job state is in PostgreSQL and persists
```

3. **Restart head node first:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ray-head --desired-count 1

aws ecs wait services-stable --cluster ml-services-prod \
  --services ray-head
```

4. **Verify head is healthy:**
```bash
# Check Ray dashboard
curl -s http://ray-head:8265/api/cluster_status | jq .
```

5. **Restart workers:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ray-worker --desired-count 2

aws ecs wait services-stable --cluster ml-services-prod \
  --services ray-worker
```

6. **Recover interrupted jobs (see Training Job Recovery runbook):**
```bash
# Run job recovery task
curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  https://ml.inkra.io/v1/training/jobs/recover-stale
```

### Expected Outcome
- Cluster fully operational in 5-10 minutes
- Interrupted jobs re-queued from database state
- No data loss (jobs tracked in PostgreSQL)

---

## Scenario 4: Terraform Recreation

Complete infrastructure rebuild of Ray cluster.

### Recovery Steps

1. **Destroy existing Ray resources (if corrupted):**
```bash
cd ml-services/terraform
terraform destroy -target=module.ray -var-file=environments/prod/terraform.tfvars
```

2. **Recreate Ray infrastructure:**
```bash
terraform apply -target=module.ray -var-file=environments/prod/terraform.tfvars
```

3. **Update service discovery (if needed):**
```bash
# Verify Ray head is discoverable
aws servicediscovery list-instances \
  --service-id <RAY_SERVICE_ID>
```

4. **Update ML Services configuration:**
```bash
# If RAY_ADDRESS changed, update secrets
aws secretsmanager update-secret \
  --secret-id ml-services/prod \
  --secret-string '{"RAY_ADDRESS": "ray://new-ray-head:10001", ...}'

# Force ML Services restart to pick up new address
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --force-new-deployment
```

5. **Recover jobs from database state:**
See [Training Job Recovery Runbook](./training-job-recovery.md)

---

## Scenario 5: Ray Version Upgrade

Upgrade Ray to a new version.

### Recovery Steps

1. **Build new container image with updated Ray:**
```bash
# Update requirements.txt with new Ray version
# Build and push new image
docker build -f ml-services/docker/Dockerfile.ray -t ray-cluster:new-version .
aws ecr get-login-password | docker login --username AWS --password-stdin <ECR_URL>
docker push <ECR_URL>/ray-cluster:new-version
```

2. **Drain existing jobs:**
```bash
# Stop accepting new jobs
# Wait for running jobs to complete
```

3. **Update task definitions:**
```bash
cd ml-services/terraform
terraform apply -var="ray_image_tag=new-version" -var-file=environments/prod/terraform.tfvars
```

4. **Verify compatibility:**
```bash
# Submit test job
curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  https://ml.inkra.io/v1/training/jobs \
  -d '{"model_id": "test-model", "config": {"type": "test"}}'
```

---

## Monitoring Ray Cluster Health

### Key Metrics

```bash
# Cluster status
curl http://ray-head:8265/api/cluster_status

# Node info
curl http://ray-head:8265/api/nodes

# Job list
curl http://ray-head:8265/api/jobs/
```

### CloudWatch Alarms

| Alarm | Threshold | Action |
|-------|-----------|--------|
| RayHeadNodeUnhealthy | Health check fails 3x | PagerDuty alert |
| RayWorkerCapacity | Running < Desired for 5 min | Scale investigation |
| RayJobQueueDepth | > 50 pending jobs | Scale workers |
| RayMemoryUsage | > 85% | Scale or optimize |

---

## Validation Checklist

After any Ray cluster recovery:

- [ ] Ray head node running and healthy
- [ ] Ray worker nodes running and connected
- [ ] Ray dashboard accessible (if exposed)
- [ ] ML Services API can connect to Ray
- [ ] `/healthz` shows `ray_cluster: connected`
- [ ] Test job submission successful
- [ ] Existing pending jobs re-queued
- [ ] No error spikes in CloudWatch

---

## Useful Commands

```bash
# Check cluster status
curl http://ray-head:8265/api/cluster_status | jq .

# List all jobs
curl http://ray-head:8265/api/jobs/ | jq .

# Get job status
curl http://ray-head:8265/api/jobs/{JOB_ID} | jq .

# Get job logs
curl http://ray-head:8265/api/jobs/{JOB_ID}/logs

# Stop a job
curl -X POST http://ray-head:8265/api/jobs/{JOB_ID}/stop

# Check nodes
curl http://ray-head:8265/api/nodes | jq .

# ECS service status
aws ecs describe-services --cluster ml-services-prod \
  --services ray-head ray-worker

# Force task restart
aws ecs update-service --cluster ml-services-prod \
  --service ray-head --force-new-deployment
```

---

## Rollback Procedure

If Ray upgrade causes issues:

1. Identify previous working image tag
2. Update task definition to use previous image
3. Force new deployment
4. Verify cluster health
5. Re-queue any failed jobs

```bash
# Rollback to previous image
aws ecs update-service --cluster ml-services-prod \
  --service ray-head \
  --task-definition ray-head-prod:<PREVIOUS_REVISION>

aws ecs update-service --cluster ml-services-prod \
  --service ray-worker \
  --task-definition ray-worker-prod:<PREVIOUS_REVISION>
```

---

## Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | [PagerDuty] |
| ML Platform Engineer | [PagerDuty rotation] |
| AWS Support | Enterprise Support Portal |

---

## Related Documents

- [Training Job Recovery Runbook](./training-job-recovery.md)
- [ECS Recovery Runbook](./ecs-recovery.md)
- [ML Services Database Restore](./ml-services-database-restore.md)
- [Disaster Recovery Policy](../policies/disaster-recovery-policy.md)
