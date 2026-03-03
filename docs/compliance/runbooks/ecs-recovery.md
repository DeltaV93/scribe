# ECS Recovery Runbook

**Document ID:** RB-ECS-001
**Version:** 1.0
**Last Updated:** March 3, 2026
**Owner:** DevOps Lead

---

## Overview

This runbook covers recovery procedures for ML Services running on AWS ECS Fargate.

## Services Covered

| Service | Purpose | Port | Health Check |
|---------|---------|------|--------------|
| ml-services-api | FastAPI REST API | 8000 | /healthz |
| ml-services-worker | Celery background jobs | N/A | Process running |
| ml-services-beat | Celery beat scheduler | N/A | Process running |

## Prerequisites

- AWS CLI configured with ECS permissions
- Access to AWS Console (ECS, CloudWatch, ECR)
- Access to GitHub Actions (for CI/CD)

---

## Scenario 1: Single Task Failure

ECS automatically replaces failed tasks. Manual intervention rarely needed.

### Detection
- CloudWatch alarm: `ECSTaskCount`
- ECS Console: Task stopped with error
- Application 5xx errors

### Diagnosis

1. **Check service events:**
```bash
aws ecs describe-services \
  --cluster ml-services-prod \
  --services ml-services-api \
  --query 'services[0].events[:5]'
```

2. **Check stopped task reason:**
```bash
# Get recent stopped tasks
TASK_ARN=$(aws ecs list-tasks --cluster ml-services-prod \
  --service-name ml-services-api --desired-status STOPPED \
  --query 'taskArns[0]' --output text)

aws ecs describe-tasks --cluster ml-services-prod \
  --tasks $TASK_ARN \
  --query 'tasks[0].[stoppedReason,containers[0].reason]'
```

3. **Check CloudWatch logs:**
```bash
aws logs tail /ecs/ml-services-prod --follow --since 10m
```

### Recovery Steps

Most failures auto-recover. If not:

1. **Force new deployment:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --force-new-deployment
```

2. **Verify recovery:**
```bash
aws ecs wait services-stable --cluster ml-services-prod \
  --services ml-services-api

curl https://ml.inkra.io/healthz
```

---

## Scenario 2: Service Not Starting (All Tasks Failing)

### Common Causes
- Container image issues
- Secrets not accessible
- Database connection failures
- Resource exhaustion

### Diagnosis

1. **Check task definition:**
```bash
aws ecs describe-task-definition \
  --task-definition ml-services-api-prod \
  --query 'taskDefinition.containerDefinitions[0].image'
```

2. **Verify image exists in ECR:**
```bash
aws ecr describe-images \
  --repository-name inkra-ml-services-prod \
  --image-ids imageTag=latest
```

3. **Check secrets:**
```bash
aws secretsmanager get-secret-value \
  --secret-id ml-services/prod \
  --query 'SecretString' | jq
```

4. **Check RDS connectivity:**
```bash
aws rds describe-db-instances \
  --db-instance-identifier ml-services-prod \
  --query 'DBInstances[0].DBInstanceStatus'
```

### Recovery Steps

**If image issue:**
```bash
# Rollback to previous image
PREV_REVISION=$(aws ecs describe-task-definition \
  --task-definition ml-services-api-prod \
  --query 'taskDefinition.revision' --output text)
PREV_REVISION=$((PREV_REVISION - 1))

aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api \
  --task-definition ml-services-api-prod:$PREV_REVISION
```

**If secrets issue:**
```bash
# Verify secret exists and is valid JSON
aws secretsmanager get-secret-value --secret-id ml-services/prod

# If missing, recreate from Terraform
cd ml-services/terraform
terraform apply -target=module.secrets
```

**If database issue:**
See [ML Services Database Restore Runbook](./ml-services-database-restore.md)

---

## Scenario 3: Rollback Deployment

After a bad deployment, rollback to the previous version.

### Recovery Steps

1. **Identify previous working revision:**
```bash
aws ecs list-task-definitions \
  --family-prefix ml-services-api-prod \
  --sort DESC \
  --query 'taskDefinitionArns[:5]'
```

2. **Update service to use previous revision:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api \
  --task-definition ml-services-api-prod:<PREVIOUS_REVISION>
```

3. **Wait for deployment:**
```bash
aws ecs wait services-stable --cluster ml-services-prod \
  --services ml-services-api
```

4. **Repeat for worker and beat services:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-worker \
  --task-definition ml-services-worker-prod:<PREVIOUS_REVISION>

aws ecs update-service --cluster ml-services-prod \
  --service ml-services-beat \
  --task-definition ml-services-beat-prod:<PREVIOUS_REVISION>
```

5. **Verify rollback:**
```bash
curl https://ml.inkra.io/healthz
curl https://ml.inkra.io/readyz
```

---

## Scenario 4: Complete Service Recreation

If ECS service is deleted or corrupted.

### Recovery Steps

1. **Recreate via Terraform:**
```bash
cd ml-services/terraform

# Import existing resources if needed
terraform import module.ecs.aws_ecs_cluster.main ml-services-prod

# Apply configuration
terraform apply -var-file=environments/prod/terraform.tfvars
```

2. **Verify services created:**
```bash
aws ecs list-services --cluster ml-services-prod
```

3. **Wait for tasks to start:**
```bash
aws ecs wait services-stable --cluster ml-services-prod \
  --services ml-services-api ml-services-worker ml-services-beat
```

---

## Scenario 5: Cluster-Wide Failure

If the entire ECS cluster is unavailable.

### Recovery Steps

1. **Check cluster status:**
```bash
aws ecs describe-clusters --clusters ml-services-prod
```

2. **If cluster missing, recreate:**
```bash
cd ml-services/terraform
terraform apply -var-file=environments/prod/terraform.tfvars
```

3. **If capacity issue, check Fargate availability:**
- Check AWS Service Health Dashboard
- Try deploying to different availability zones

4. **Emergency: Deploy to different region**
See [Region Failover Runbook](./region-failover.md)

---

## Scenario 6: ALB/Health Check Issues

### Detection
- 502/503 errors from ALB
- Health check failures
- Target group unhealthy targets

### Diagnosis

1. **Check target group health:**
```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...:targetgroup/ml-services-api-prod/xxx
```

2. **Check ALB access logs:**
```bash
aws s3 ls s3://scrybe-access-logs-prod/alb/
```

### Recovery Steps

1. **If health check misconfigured:**
```bash
# Verify health check endpoint works
aws ecs execute-command --cluster ml-services-prod \
  --task <TASK_ID> --container api \
  --command "curl localhost:8000/healthz" --interactive
```

2. **If targets not registering:**
```bash
# Force new deployment
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --force-new-deployment
```

---

## Validation Checklist

After any ECS recovery:

- [ ] All services running desired task count
- [ ] Health checks passing (ALB targets healthy)
- [ ] `/healthz` returns 200
- [ ] `/readyz` returns 200 with db and redis connected
- [ ] API endpoints responding correctly
- [ ] Worker processing jobs (check CloudWatch logs)
- [ ] No error spikes in Sentry

---

## Useful Commands

```bash
# List all tasks
aws ecs list-tasks --cluster ml-services-prod

# Describe running tasks
aws ecs describe-tasks --cluster ml-services-prod \
  --tasks $(aws ecs list-tasks --cluster ml-services-prod --query 'taskArns' --output text)

# View real-time logs
aws logs tail /ecs/ml-services-prod --follow

# Execute command in running container
aws ecs execute-command --cluster ml-services-prod \
  --task <TASK_ID> --container api \
  --command "/bin/sh" --interactive

# Scale service
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --desired-count 4
```

---

## Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | [PagerDuty] |
| AWS Support | Enterprise Support Portal |
| On-Call Engineer | [PagerDuty rotation] |
