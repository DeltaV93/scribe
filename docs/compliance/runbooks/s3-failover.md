# S3 Failover Runbook

**Runbook ID:** RB-S3-001
**Last Updated:** February 1, 2026
**Owner:** DevOps Team

---

## Overview

This runbook provides step-by-step instructions for handling S3 bucket failures, including cross-region failover and data recovery.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Access to AWS Console
- Knowledge of bucket names and configurations
- VPN access (if required)

## S3 Buckets

| Bucket | Purpose | Region | Replication Target |
|--------|---------|--------|-------------------|
| `scrybe-uploads-prod` | User uploads, documents | us-west-2 | `scrybe-uploads-prod-replica` (us-east-1) |
| `scrybe-recordings-prod` | Call recordings | us-west-2 | `scrybe-recordings-prod-replica` (us-east-1) |
| `scrybe-exports-prod` | Data exports | us-west-2 | `scrybe-exports-prod-replica` (us-east-1) |
| `scrybe-backups` | Database backups | us-west-2 | `scrybe-backups-replica` (us-east-1) |

## Scenarios

1. [Object Recovery (Accidental Deletion)](#scenario-1-object-recovery)
2. [Bucket Corruption](#scenario-2-bucket-corruption)
3. [Region Failover](#scenario-3-region-failover)
4. [Ransomware/Malicious Deletion](#scenario-4-ransomware-recovery)

---

## Scenario 1: Object Recovery

**Use When:** Single file or small number of files accidentally deleted

**Estimated Time:** 5-15 minutes

### Steps

#### 1. Check Versioning Status

```bash
aws s3api get-bucket-versioning --bucket scrybe-uploads-prod
```

#### 2. List Deleted Objects (Delete Markers)

```bash
aws s3api list-object-versions \
  --bucket scrybe-uploads-prod \
  --prefix "path/to/deleted/file" \
  --query 'DeleteMarkers[?IsLatest==`true`]'
```

#### 3. Restore Previous Version

```bash
# Get the version ID of the last good version
aws s3api list-object-versions \
  --bucket scrybe-uploads-prod \
  --prefix "path/to/file.pdf" \
  --query 'Versions[0].VersionId' \
  --output text

# Copy the previous version to restore
aws s3api copy-object \
  --bucket scrybe-uploads-prod \
  --copy-source "scrybe-uploads-prod/path/to/file.pdf?versionId=VERSION_ID" \
  --key "path/to/file.pdf"
```

#### 4. Delete the Delete Marker (Alternative)

```bash
aws s3api delete-object \
  --bucket scrybe-uploads-prod \
  --key "path/to/file.pdf" \
  --version-id "DELETE_MARKER_VERSION_ID"
```

#### 5. Verify Recovery

```bash
aws s3api head-object \
  --bucket scrybe-uploads-prod \
  --key "path/to/file.pdf"
```

---

## Scenario 2: Bucket Corruption

**Use When:** Multiple files corrupted, bucket policies changed maliciously

**Estimated Time:** 30-60 minutes

### Steps

#### 1. Assess Scope

```bash
# List recent modifications
aws s3api list-object-versions \
  --bucket scrybe-uploads-prod \
  --query 'Versions[?LastModified>=`2026-02-01T00:00:00`]' \
  --max-items 100
```

#### 2. Check Bucket Policy

```bash
# Get current policy
aws s3api get-bucket-policy --bucket scrybe-uploads-prod

# Compare with known good policy (stored in git)
```

#### 3. Restore Bucket Policy (if changed)

```bash
aws s3api put-bucket-policy \
  --bucket scrybe-uploads-prod \
  --policy file://s3-policies/scrybe-uploads-prod-policy.json
```

#### 4. Bulk Restore from Versions

For mass restoration, create a script:

```bash
#!/bin/bash
# restore-s3-objects.sh

BUCKET="scrybe-uploads-prod"
PREFIX="uploads/"
RESTORE_DATE="2026-02-01T00:00:00"

aws s3api list-object-versions \
  --bucket $BUCKET \
  --prefix $PREFIX \
  --query "Versions[?LastModified<='$RESTORE_DATE'] | sort_by(@, &LastModified) | [-1]" \
  --output json | jq -r '.Key + " " + .VersionId' | while read key version; do
    aws s3api copy-object \
      --bucket $BUCKET \
      --copy-source "$BUCKET/$key?versionId=$version" \
      --key "$key"
done
```

#### 5. Verify Data Integrity

```bash
# Spot check critical files
aws s3api head-object --bucket scrybe-uploads-prod --key "critical/file.pdf"
```

---

## Scenario 3: Region Failover

**Use When:** AWS region outage, primary bucket unavailable

**Estimated Time:** 15-30 minutes

### Steps

#### 1. Confirm Region Outage

- Check [AWS Status Page](https://status.aws.amazon.com/)
- Verify with direct API calls:
```bash
aws s3 ls s3://scrybe-uploads-prod --region us-west-2
```

#### 2. Verify Replication Status

Check that replica is current:

```bash
# Check last replicated object
aws s3api list-objects-v2 \
  --bucket scrybe-uploads-prod-replica \
  --query 'sort_by(Contents, &LastModified)[-1]'
```

#### 3. Update Application Configuration

Update environment variables to use replica buckets:

```bash
# Development/Railway
railway variables set S3_BUCKET_UPLOADS=scrybe-uploads-prod-replica
railway variables set S3_BUCKET_RECORDINGS=scrybe-recordings-prod-replica
railway variables set S3_REGION=us-east-1

# Or update .env / secrets manager
aws ssm put-parameter \
  --name "/scrybe/prod/S3_BUCKET_UPLOADS" \
  --value "scrybe-uploads-prod-replica" \
  --type SecureString \
  --overwrite
```

#### 4. Update Application Code (if needed)

If hardcoded region:
```typescript
// Update src/lib/s3/client.ts if necessary
const S3_CONFIG = {
  region: process.env.S3_REGION || 'us-east-1', // Failover region
  bucket: process.env.S3_BUCKET_UPLOADS || 'scrybe-uploads-prod-replica'
}
```

#### 5. Restart Application

```bash
# Railway
railway up --detach

# Or trigger deployment
git commit --allow-empty -m "Trigger deployment for S3 failover"
git push
```

#### 6. Verify Functionality

- Test file upload
- Test file download
- Test recording playback
- Monitor error rates

#### 7. Post-Failover Actions

- Notify customers if there was data lag
- Monitor primary region for recovery
- Plan fail-back procedure

---

## Scenario 4: Ransomware Recovery

**Use When:** Malicious encryption or deletion of files

**Estimated Time:** 2-4 hours

### Steps

#### 1. Isolate the Bucket

Immediately restrict access:

```bash
# Block all public access
aws s3api put-public-access-block \
  --bucket scrybe-uploads-prod \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Revoke all IAM user access temporarily
# (Update bucket policy to deny all except recovery role)
```

#### 2. Preserve Evidence

```bash
# Create inventory for forensics
aws s3api list-object-versions \
  --bucket scrybe-uploads-prod \
  --output json > s3-inventory-$(date +%Y%m%d).json

# Check CloudTrail for access logs
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=scrybe-uploads-prod \
  --start-time $(date -d "7 days ago" +%Y-%m-%dT%H:%M:%SZ)
```

#### 3. Create Clean Bucket

```bash
aws s3 mb s3://scrybe-uploads-prod-clean --region us-west-2

# Copy bucket configuration
aws s3api get-bucket-encryption --bucket scrybe-uploads-prod > encryption.json
aws s3api put-bucket-encryption --bucket scrybe-uploads-prod-clean --cli-input-json file://encryption.json
```

#### 4. Restore from Pre-Attack Versions

```bash
# Identify attack time from CloudTrail
# Restore all objects from before that time

./scripts/bulk-restore-s3.sh \
  --source scrybe-uploads-prod \
  --dest scrybe-uploads-prod-clean \
  --before "2026-02-01T00:00:00Z"
```

#### 5. Rotate All Credentials

```bash
# Rotate IAM access keys
aws iam create-access-key --user-name scrybe-app
aws iam delete-access-key --user-name scrybe-app --access-key-id OLD_KEY

# Rotate any presigned URL signing keys
```

#### 6. Update Application to Use Clean Bucket

```bash
railway variables set S3_BUCKET_UPLOADS=scrybe-uploads-prod-clean
```

#### 7. Document and Report

- Complete incident report
- Notify affected parties per breach policy
- Engage forensics if needed

---

## Post-Recovery Checklist

After any S3 recovery:

- [ ] Verify file accessibility
- [ ] Check presigned URLs work
- [ ] Confirm upload functionality
- [ ] Verify download functionality
- [ ] Check replication is working
- [ ] Review and update bucket policies
- [ ] Rotate any potentially compromised credentials
- [ ] Update incident documentation

---

## Prevention Measures

Ensure these are configured:

- [ ] Versioning enabled on all buckets
- [ ] Cross-region replication active
- [ ] Object Lock for critical data (optional)
- [ ] MFA Delete enabled for versioned buckets
- [ ] CloudTrail logging for S3 data events
- [ ] Lifecycle policies for version cleanup

---

## Contacts

| Role | Name | Phone | Escalation |
|------|------|-------|------------|
| Primary On-Call | _______ | _______ | PagerDuty |
| DevOps Lead | _______ | _______ | Slack → Phone |
| AWS Account Owner | _______ | _______ | Phone |

---

## Related Documents

- [Disaster Recovery Policy](../policies/disaster-recovery-policy.md)
- [Database Restore Runbook](./database-restore.md)
- [Incident Response Runbook](./incident-response.md)
