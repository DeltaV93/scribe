# Database Restore Runbook

**Runbook ID:** RB-DB-001
**Last Updated:** February 1, 2026
**Owner:** DevOps Team

---

## Overview

This runbook provides step-by-step instructions for restoring the PostgreSQL database from backup in various failure scenarios.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Access to Supabase dashboard or database admin credentials
- Railway CLI (if using Railway hosting)
- Prisma CLI installed
- VPN access (if required)

## Scenarios

1. [Point-in-Time Recovery](#scenario-1-point-in-time-recovery)
2. [Restore from Daily Snapshot](#scenario-2-restore-from-daily-snapshot)
3. [Complete Database Recreation](#scenario-3-complete-database-recreation)
4. [Failover to Read Replica](#scenario-4-failover-to-read-replica)

---

## Scenario 1: Point-in-Time Recovery

**Use When:** Data corruption, accidental deletion within last 7 days

**Estimated Time:** 30-60 minutes

### Steps

#### 1. Assess the Situation

```bash
# Check current database status
psql $DATABASE_URL -c "SELECT now(), pg_is_in_recovery();"

# Identify the target recovery time
# Look at audit logs or application logs to find when corruption occurred
```

#### 2. Notify Stakeholders

- Post in #incidents Slack channel
- Update status page (if extended outage expected)
- Notify on-call team lead

#### 3. Initiate Point-in-Time Recovery

**For Supabase:**
1. Go to Supabase Dashboard → Project → Settings → Database
2. Select "Point-in-Time Recovery"
3. Choose target timestamp (before corruption)
4. Confirm recovery

**For Railway/Direct PostgreSQL:**
```bash
# List available recovery points
aws rds describe-db-cluster-snapshots \
  --db-cluster-identifier scrybe-prod

# Restore to point in time
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier scrybe-prod \
  --db-cluster-identifier scrybe-prod-restored \
  --restore-to-time "2026-02-01T10:00:00Z" \
  --restore-type full-copy
```

#### 4. Verify Data Integrity

```bash
# Connect to restored database
psql $RESTORED_DATABASE_URL

# Check key tables
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "FormSubmission";
SELECT COUNT(*) FROM "AuditLog";

# Verify recent data exists
SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 10;
```

#### 5. Switch Application to Restored Database

```bash
# Update environment variable
# In Railway/Vercel dashboard, update DATABASE_URL

# Or via CLI
railway variables set DATABASE_URL=$RESTORED_DATABASE_URL
```

#### 6. Regenerate Prisma Client

```bash
npm run db:generate
```

#### 7. Verify Application

- Test login functionality
- Verify PHI decryption works
- Check audit logging
- Monitor error rates

#### 8. Document and Close

- Update incident ticket
- Complete post-incident report
- Archive old database after confirmation

---

## Scenario 2: Restore from Daily Snapshot

**Use When:** Severe corruption, need to restore from known good snapshot

**Estimated Time:** 1-2 hours

### Steps

#### 1. List Available Snapshots

```bash
# Supabase
# Go to Dashboard → Project → Backups

# AWS RDS
aws rds describe-db-snapshots \
  --db-instance-identifier scrybe-prod \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]' \
  --output table
```

#### 2. Create New Instance from Snapshot

**Supabase:**
1. Dashboard → Project → Settings → Backups
2. Select snapshot
3. Click "Restore"
4. Wait for restoration

**AWS RDS:**
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier scrybe-prod-restored \
  --db-snapshot-identifier scrybe-prod-snapshot-20260201 \
  --db-instance-class db.t3.medium
```

#### 3. Wait for Instance to be Available

```bash
# Check status
aws rds describe-db-instances \
  --db-instance-identifier scrybe-prod-restored \
  --query 'DBInstances[0].DBInstanceStatus'
```

#### 4. Update Security Groups

Ensure the restored instance has the same security group rules:

```bash
aws rds modify-db-instance \
  --db-instance-identifier scrybe-prod-restored \
  --vpc-security-group-ids sg-xxxxxx
```

#### 5. Update Connection String

```bash
# Get new endpoint
aws rds describe-db-instances \
  --db-instance-identifier scrybe-prod-restored \
  --query 'DBInstances[0].Endpoint.Address'

# Update application configuration
```

#### 6. Apply Any Missing Migrations

```bash
# Check migration status
npx prisma migrate status

# Apply if needed (carefully - this is rare)
npx prisma migrate deploy
```

#### 7. Data Loss Assessment

Calculate data loss:
```sql
-- Compare counts
SELECT 'Users' as table_name, COUNT(*) FROM "User"
UNION ALL
SELECT 'Submissions', COUNT(*) FROM "FormSubmission"
UNION ALL
SELECT 'Audit Logs', COUNT(*) FROM "AuditLog";
```

#### 8. Notify Affected Users

If data loss occurred, notify affected customers per breach notification policy.

---

## Scenario 3: Complete Database Recreation

**Use When:** Catastrophic failure, need to rebuild from scratch

**Estimated Time:** 2-4 hours

### Steps

#### 1. Create New Database Instance

```bash
# Supabase - create new project
# Railway - create new PostgreSQL database

# Or AWS RDS
aws rds create-db-instance \
  --db-instance-identifier scrybe-prod-new \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15 \
  --master-username scrybe_admin \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 100 \
  --storage-encrypted \
  --kms-key-id $KMS_KEY_ID
```

#### 2. Restore Schema

```bash
# Push schema
npx prisma db push

# Or apply migrations
npx prisma migrate deploy
```

#### 3. Restore Data from S3 Backup

```bash
# Download latest backup
aws s3 cp s3://scrybe-backups/db/latest.sql.gz ./

# Decompress
gunzip latest.sql.gz

# Restore
psql $NEW_DATABASE_URL < latest.sql
```

#### 4. Regenerate Encryption Keys (if needed)

If encryption keys were compromised:

```bash
# Generate new DEKs for each organization
# This will require re-encryption of all PHI data
```

#### 5. Verify Restoration

```sql
-- Check all tables exist
\dt

-- Verify row counts match expectations
SELECT schemaname, tablename, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

#### 6. Update Application Configuration

- Update DATABASE_URL
- Restart application
- Verify connectivity

---

## Scenario 4: Failover to Read Replica

**Use When:** Primary failure with healthy replica

**Estimated Time:** 10-30 minutes

### Steps

#### 1. Verify Replica Status

```bash
# Check replication lag
psql $REPLICA_URL -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;"
```

#### 2. Promote Replica

**AWS RDS:**
```bash
aws rds promote-read-replica \
  --db-instance-identifier scrybe-prod-replica
```

**Supabase:**
Contact Supabase support for managed failover.

#### 3. Wait for Promotion

```bash
aws rds wait db-instance-available \
  --db-instance-identifier scrybe-prod-replica
```

#### 4. Update DNS/Connection String

```bash
# Update DATABASE_URL to point to former replica
# Now acting as primary
```

#### 5. Create New Replica

After recovery, create a new replica for future failover:

```bash
aws rds create-db-instance-read-replica \
  --db-instance-identifier scrybe-prod-replica-new \
  --source-db-instance-identifier scrybe-prod-replica
```

---

## Rollback Procedure

If restoration causes issues:

1. Keep old/original database running in parallel
2. Switch back to original DATABASE_URL
3. Restart application
4. Investigate issues with restored database

---

## Verification Checklist

After any restoration:

- [ ] Database is accessible
- [ ] Application connects successfully
- [ ] User login works
- [ ] PHI data can be decrypted
- [ ] Audit logging is functioning
- [ ] All API endpoints respond
- [ ] No error spikes in monitoring
- [ ] Replication is healthy (if applicable)

---

## Contacts

| Role | Name | Phone | Escalation |
|------|------|-------|------------|
| Primary On-Call | _______ | _______ | PagerDuty |
| DevOps Lead | _______ | _______ | Slack → Phone |
| Database Admin | _______ | _______ | Phone |

---

## Related Documents

- [Disaster Recovery Policy](../policies/disaster-recovery-policy.md)
- [Incident Response Runbook](./incident-response.md)
- [S3 Failover Runbook](./s3-failover.md)
