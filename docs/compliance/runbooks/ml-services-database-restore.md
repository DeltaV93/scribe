# ML Services Database Restore Runbook

**Document ID:** RB-ML-DB-001
**Version:** 1.0
**Last Updated:** March 3, 2026
**Owner:** DevOps Lead

---

## Overview

This runbook covers restoration procedures for the ML Services PostgreSQL database running on AWS RDS.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Access to AWS Console (RDS, Secrets Manager)
- Terraform access for infrastructure changes
- SSH/Session Manager access to ECS tasks (for migrations)

## Scenario 1: Multi-AZ Automatic Failover

RDS Multi-AZ deployments automatically failover to the standby instance.

### Detection
- CloudWatch alarm: `RDSInstanceFailover`
- Application errors: Connection refused to database
- AWS Health Dashboard notification

### Recovery Steps

1. **Verify failover occurred:**
```bash
aws rds describe-events \
  --source-identifier ml-services-prod \
  --source-type db-instance \
  --duration 60
```

2. **Check new endpoint:**
```bash
aws rds describe-db-instances \
  --db-instance-identifier ml-services-prod \
  --query 'DBInstances[0].Endpoint'
```

3. **Verify ECS services reconnected:**
```bash
# Check API service health
curl https://ml.inkra.io/healthz
curl https://ml.inkra.io/readyz
```

4. **If services not reconnecting, force restart:**
```bash
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --force-new-deployment

aws ecs update-service --cluster ml-services-prod \
  --service ml-services-worker --force-new-deployment
```

### Expected Outcome
- Failover completes in 2-3 minutes
- Application automatically reconnects
- No data loss (synchronous replication)

---

## Scenario 2: Restore from Automated Backup

Use when database is corrupted or needs point-in-time recovery.

### Detection
- Data corruption reported by application
- Audit log discrepancies
- User-reported data issues

### Recovery Steps

1. **Identify target restore point:**
```bash
# List available restore window
aws rds describe-db-instances \
  --db-instance-identifier ml-services-prod \
  --query 'DBInstances[0].LatestRestorableTime'
```

2. **Create restored instance:**
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier ml-services-prod \
  --target-db-instance-identifier ml-services-prod-restored \
  --restore-time "2026-03-03T10:00:00Z" \
  --db-instance-class db.t3.medium \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name ml-services-prod
```

3. **Wait for instance to be available (10-30 minutes):**
```bash
aws rds wait db-instance-available \
  --db-instance-identifier ml-services-prod-restored
```

4. **Verify restored data:**
```bash
# Connect and run validation queries
psql -h ml-services-prod-restored.xxxxx.rds.amazonaws.com \
  -U mlservices -d ml_services \
  -c "SELECT COUNT(*) FROM models; SELECT COUNT(*) FROM audit_events;"
```

5. **Update application to use restored instance:**

Option A: DNS swap (recommended)
```bash
# Update Secrets Manager with new endpoint
aws secretsmanager update-secret \
  --secret-id ml-services/prod \
  --secret-string '{"DATABASE_URL": "postgresql://...new-endpoint..."}'

# Force ECS services to pick up new secret
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --force-new-deployment
```

Option B: Rename instances
```bash
# Rename original (if accessible)
aws rds modify-db-instance \
  --db-instance-identifier ml-services-prod \
  --new-db-instance-identifier ml-services-prod-old \
  --apply-immediately

# Rename restored to production name
aws rds modify-db-instance \
  --db-instance-identifier ml-services-prod-restored \
  --new-db-instance-identifier ml-services-prod \
  --apply-immediately
```

6. **Verify application health:**
```bash
curl https://ml.inkra.io/healthz
curl https://ml.inkra.io/readyz
```

7. **Clean up old instance after verification (24-48 hours):**
```bash
aws rds delete-db-instance \
  --db-instance-identifier ml-services-prod-old \
  --skip-final-snapshot
```

### Expected Outcome
- Restored instance available in 10-30 minutes
- Data restored to specified point in time
- Application reconnects with new endpoint

---

## Scenario 3: Restore from Manual Snapshot

Use for major version upgrades or disaster recovery testing.

### Recovery Steps

1. **List available snapshots:**
```bash
aws rds describe-db-snapshots \
  --db-instance-identifier ml-services-prod \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
  --output table
```

2. **Restore from snapshot:**
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ml-services-prod-restored \
  --db-snapshot-identifier ml-services-prod-snapshot-20260303 \
  --db-instance-class db.t3.medium \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name ml-services-prod
```

3. **Apply any pending migrations:**
```bash
# Run migration task
aws ecs run-task \
  --cluster ml-services-prod \
  --task-definition ml-services-api-prod \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["alembic","upgrade","head"]}]}'
```

4. **Follow steps 4-7 from Scenario 2**

---

## Scenario 4: Complete Database Rebuild

Use when database instance is completely unrecoverable.

### Recovery Steps

1. **Deploy new RDS instance via Terraform:**
```bash
cd ml-services/terraform
terraform plan -var-file=environments/prod/terraform.tfvars
terraform apply -var-file=environments/prod/terraform.tfvars
```

2. **Restore data from S3 backup (if available):**
```bash
# Download backup
aws s3 cp s3://scrybe-backups-prod/ml-services/latest.sql.gz .

# Decompress and restore
gunzip latest.sql.gz
psql -h <new-endpoint> -U mlservices -d ml_services < latest.sql
```

3. **Run migrations:**
```bash
# Ensure schema is current
alembic upgrade head
```

4. **Seed compliance frameworks:**
```bash
python scripts/seed_frameworks.py
```

5. **Update secrets and restart services**

---

## Validation Checklist

After any restore, verify:

- [ ] Database connectivity from ECS services
- [ ] `/healthz` returns `{"status":"ok"}`
- [ ] `/readyz` returns `{"status":"ok","db":"connected","redis":"connected"}`
- [ ] Model registry queries working
- [ ] Audit events can be created
- [ ] Org profile operations functional
- [ ] No Alembic migration errors

---

## Rollback Procedure

If restored database causes issues:

1. Stop ECS services to prevent further writes
2. Revert Secrets Manager to original endpoint
3. Restart ECS services
4. Delete failed restored instance

---

## Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | [PagerDuty] |
| AWS Support | Enterprise Support Portal |
| Database Admin | [On-call rotation] |
