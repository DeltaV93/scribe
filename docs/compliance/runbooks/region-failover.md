# Region Failover Runbook

**Document ID:** RB-REGION-001
**Version:** 1.0
**Last Updated:** March 3, 2026
**Owner:** DevOps Lead

---

## Overview

This runbook covers procedures for failing over Scrybe services to a secondary AWS region during a complete regional outage.

## Architecture

| Component | Primary Region | Secondary Region | Replication |
|-----------|---------------|------------------|-------------|
| Next.js App | Railway (auto) | Railway (auto) | Built-in |
| ML Services (ECS) | us-west-2 | us-east-1 | Manual deploy |
| Primary Database | us-west-2 | us-east-1 | Cross-region replica |
| ML Services DB (RDS) | us-west-2 | us-east-1 | Manual snapshot |
| Redis | us-west-2 | us-east-1 | Recreate (ephemeral) |
| S3 Uploads | us-west-2 | us-east-1 | Cross-region replication |
| S3 Recordings | us-west-2 | us-east-1 | Cross-region replication |
| S3 Backups | us-west-2 | us-east-1 | Cross-region replication |

## Prerequisites

- Cross-region replication configured for S3 buckets
- Terraform configured for secondary region
- DNS management access (Cloudflare)
- Secondary region VPC and networking pre-provisioned

---

## Decision Criteria

Initiate region failover when:

1. AWS confirms regional outage (status.aws.amazon.com)
2. Primary region unavailable > 30 minutes
3. No ETA for recovery OR ETA > 2 hours
4. Business impact justifies failover complexity

**Do NOT failover for:**
- Single service outages (use service-specific recovery)
- Brief intermittent issues
- Issues that can be resolved with scaling

---

## Pre-Failover Checklist

Before initiating failover:

- [ ] Confirm regional outage on AWS Status page
- [ ] Notify leadership (CTO, CEO)
- [ ] Assemble incident response team
- [ ] Notify customers of potential service interruption
- [ ] Document start time of failover procedure

---

## Phase 1: Assessment (15 minutes)

### 1.1 Confirm Regional Outage

```bash
# Check AWS status
curl -s https://status.aws.amazon.com/data.json | jq '.archive[].current_status'

# Test primary region connectivity
aws ec2 describe-vpcs --region us-west-2

# Check primary RDS
aws rds describe-db-instances --region us-west-2 \
  --db-instance-identifier ml-services-prod
```

### 1.2 Verify Secondary Region Readiness

```bash
# Check secondary VPC
aws ec2 describe-vpcs --region us-east-1

# Check S3 replication status
aws s3api head-bucket --bucket scrybe-recordings-prod-replica --region us-east-1

# Check latest backup availability
aws rds describe-db-snapshots --region us-east-1 \
  --db-instance-identifier ml-services-prod \
  --query 'DBSnapshots[-1]'
```

---

## Phase 2: Database Failover (30-45 minutes)

### 2.1 Primary Application Database

If using managed service with cross-region replica:

```bash
# Promote read replica to primary
# (Specific commands depend on database provider - Supabase, Railway, etc.)
```

### 2.2 ML Services Database (RDS)

**Option A: Promote Cross-Region Read Replica (if configured)**

```bash
# Promote replica to standalone
aws rds promote-read-replica \
  --db-instance-identifier ml-services-prod-replica \
  --region us-east-1
```

**Option B: Restore from Cross-Region Snapshot**

```bash
# Find latest snapshot in secondary region
aws rds describe-db-snapshots --region us-east-1 \
  --db-instance-identifier ml-services-prod \
  --query 'DBSnapshots | sort_by(@, &SnapshotCreateTime) | [-1]'

# Restore in secondary region
aws rds restore-db-instance-from-db-snapshot \
  --region us-east-1 \
  --db-instance-identifier ml-services-prod-dr \
  --db-snapshot-identifier <SNAPSHOT_ID> \
  --db-instance-class db.t3.medium \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name ml-services-us-east-1

# Wait for availability
aws rds wait db-instance-available \
  --region us-east-1 \
  --db-instance-identifier ml-services-prod-dr
```

---

## Phase 3: Infrastructure Deployment (30-45 minutes)

### 3.1 Deploy Secondary Region Infrastructure

```bash
cd ml-services/terraform/environments/dr

# Initialize with secondary region backend
terraform init -backend-config=backend-us-east-1.tfvars

# Deploy infrastructure
terraform apply -var-file=us-east-1.tfvars
```

### 3.2 Deploy Redis in Secondary Region

```bash
# Redis is ephemeral - create fresh cluster
aws elasticache create-replication-group \
  --region us-east-1 \
  --replication-group-id ml-services-redis-dr \
  --replication-group-description "ML Services Redis (DR)" \
  --cache-node-type cache.t3.medium \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --security-group-ids sg-xxxxxxxx \
  --cache-subnet-group-name ml-services-us-east-1
```

### 3.3 Update Secrets in Secondary Region

```bash
# Create/update secrets in us-east-1
aws secretsmanager create-secret \
  --region us-east-1 \
  --name ml-services/dr \
  --secret-string '{
    "DATABASE_URL": "postgresql://...<dr-endpoint>...",
    "REDIS_URL": "redis://...<dr-redis>...",
    "ML_SERVICE_API_KEY": "...",
    ...
  }'
```

### 3.4 Deploy ECS Services

```bash
# Get latest image from ECR (images replicate to us-east-1)
ECR_IMAGE=$(aws ecr describe-images \
  --region us-east-1 \
  --repository-name inkra-ml-services-prod \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | [-1].imageTags[0]' \
  --output text)

# Update task definitions with DR endpoints and deploy
# (Use Terraform or AWS CLI)
```

---

## Phase 4: S3 Failover (15 minutes)

### 4.1 Update Application to Use Replica Buckets

Update environment variables:

```bash
# Primary → Replica bucket mapping
AWS_S3_BUCKET_UPLOADS=scrybe-uploads-prod-replica
AWS_S3_BUCKET_RECORDINGS=scrybe-recordings-prod-replica
AWS_S3_BUCKET_BACKUPS=scrybe-backups-prod-replica
AWS_REGION=us-east-1
```

### 4.2 Verify Replication Completeness

```bash
# Check replication metrics
aws s3api head-bucket --bucket scrybe-recordings-prod-replica

# Compare object counts (may have slight delay)
aws s3 ls s3://scrybe-recordings-prod --summarize | grep "Total Objects"
aws s3 ls s3://scrybe-recordings-prod-replica --summarize | grep "Total Objects"
```

---

## Phase 5: DNS Cutover (5-10 minutes)

### 5.1 Update DNS Records

**ML Services API:**
```bash
# Update Cloudflare DNS
# ml.inkra.io → DR ALB endpoint

curl -X PATCH "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records/<RECORD_ID>" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{
    "content": "<DR-ALB-DNS-NAME>",
    "ttl": 60
  }'
```

### 5.2 Verify DNS Propagation

```bash
# Check DNS resolution
dig ml.inkra.io +short

# Verify endpoint responding
curl https://ml.inkra.io/healthz
```

---

## Phase 6: Validation (15 minutes)

### 6.1 Application Health Checks

```bash
# ML Services
curl https://ml.inkra.io/healthz
curl https://ml.inkra.io/readyz

# Test API functionality
curl -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  https://ml.inkra.io/v1/models
```

### 6.2 Database Connectivity

```bash
# Verify migrations current
aws ecs run-task \
  --region us-east-1 \
  --cluster ml-services-dr \
  --task-definition ml-services-api-dr \
  --overrides '{"containerOverrides":[{"name":"api","command":["alembic","current"]}]}'
```

### 6.3 Background Job Processing

```bash
# Monitor worker logs
aws logs tail /ecs/ml-services-dr --region us-east-1 --follow

# Submit test job
curl -X POST -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  https://ml.inkra.io/v1/audit/events \
  -d '{"org_id": "test", "event_type": "dr_test", ...}'
```

---

## Phase 7: Customer Communication

### 7.1 Update Status Page

```
Status: Degraded → Operational
Message: "Services have been restored. We experienced a regional outage
affecting [X]. All services are now operating normally from our disaster
recovery infrastructure."
```

### 7.2 Send Customer Notification

- Email to affected organizations
- In-app notification
- Support ticket updates

---

## Post-Failover

### Immediate (24 hours)
- [ ] Enhanced monitoring on DR infrastructure
- [ ] Document any data loss (RPO breach)
- [ ] Track any functionality gaps
- [ ] Communicate restoration timeline

### Short-term (1-7 days)
- [ ] Plan failback procedure
- [ ] Analyze failover performance
- [ ] Update runbook with lessons learned
- [ ] Replenish snapshots/backups

### Failback Planning
When primary region recovers:
1. Sync data from DR to primary
2. Test primary region services
3. Schedule maintenance window for failback
4. Execute reverse DNS cutover
5. Decommission DR infrastructure (or keep warm)

---

## Rollback Procedure

If failover causes additional issues:

1. Stop DR deployments
2. Revert DNS to primary (if recovered)
3. Communicate status to customers
4. Investigate failover failure

---

## Reference: Secondary Region Resources

| Resource | ID/Name | Notes |
|----------|---------|-------|
| VPC | vpc-dr-xxxxxxxx | Pre-provisioned |
| Private Subnets | subnet-dr-xxx, subnet-dr-yyy | |
| Security Group (ECS) | sg-dr-ecs | |
| Security Group (RDS) | sg-dr-rds | |
| Security Group (Redis) | sg-dr-redis | |
| DB Subnet Group | ml-services-us-east-1 | |
| Cache Subnet Group | ml-services-us-east-1 | |
| ECR Repository | inkra-ml-services-prod | Same as primary (replicated) |

---

## Contacts

| Role | Contact | Notes |
|------|---------|-------|
| DevOps Lead | [PagerDuty] | Primary coordinator |
| Security Lead | [Phone] | For breach assessment |
| CTO | [Phone] | Failover approval |
| AWS TAM | [Enterprise Support] | AWS coordination |
| Cloudflare | [Dashboard] | DNS management |

---

## Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Assessment | 15 min | 15 min |
| Database Failover | 30-45 min | 45-60 min |
| Infrastructure | 30-45 min | 75-105 min |
| S3 Failover | 15 min | 90-120 min |
| DNS Cutover | 5-10 min | 95-130 min |
| Validation | 15 min | 110-145 min |

**Total RTO: ~2-2.5 hours** (within 4-hour maximum)
