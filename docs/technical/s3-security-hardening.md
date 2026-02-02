# S3 Security Hardening - Technical Documentation

**Status:** Implemented
**Linear Issue:** PX-673
**Date:** February 1, 2026

## Overview

This document describes the S3 security hardening implementation for Scrybe, providing HIPAA and SOC 2 compliant storage for sensitive data including user uploads, call recordings, data exports, and database backups.

## Architecture

### Bucket Structure

| Bucket | Purpose | Retention | Storage Class |
|--------|---------|-----------|---------------|
| `scrybe-uploads-{env}` | User documents, files | Indefinite (versioned) | Standard |
| `scrybe-recordings-{env}` | Call recordings | 7 years | Standard -> Glacier (1 year) |
| `scrybe-exports-{env}` | Data exports | 30 days | Standard |
| `scrybe-backups-{env}` | Database backups | 7 years | Standard -> Glacier IR -> Deep Archive |
| `scrybe-access-logs-{env}` | S3 access logs | 1 year | Standard |
| `scrybe-audit-logs-{env}` | Compliance audit logs | 7 years (Object Lock) | Standard |

### Security Controls

```
+------------------+      +------------------+
|   Application    |      |    AWS KMS       |
|                  |      |                  |
|  - Presigned URLs|      |  - Master Key    |
|  - Short expiry  |      |  - Key rotation  |
|  - Auth required |      |  - Audit trail   |
+--------+---------+      +--------+---------+
         |                         |
         v                         v
+------------------+------------------+
|                 S3                  |
|                                     |
|  +-------------------------------+  |
|  | Security Controls:            |  |
|  | - Block all public access     |  |
|  | - Require TLS (HTTPS only)    |  |
|  | - Require KMS encryption      |  |
|  | - Deny cross-account access   |  |
|  | - Versioning enabled          |  |
|  | - Access logging              |  |
|  +-------------------------------+  |
+-------------------------------------+
```

## Security Requirements

### 1. Block All Public Access

All buckets have public access blocked at both the bucket and account level:

```hcl
resource "aws_s3_bucket_public_access_block" "example" {
  bucket = aws_s3_bucket.example.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

### 2. Enforce Encryption on Upload

Bucket policies deny any unencrypted uploads:

```json
{
  "Sid": "DenyUnencryptedUploads",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::bucket-name/*",
  "Condition": {
    "StringNotEquals": {
      "s3:x-amz-server-side-encryption": "aws:kms"
    }
  }
}
```

### 3. Require TLS for All Requests

HTTP requests are denied; only HTTPS is allowed:

```json
{
  "Sid": "DenyInsecureTransport",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:*",
  "Resource": ["arn:aws:s3:::bucket-name", "arn:aws:s3:::bucket-name/*"],
  "Condition": {
    "Bool": {
      "aws:SecureTransport": "false"
    }
  }
}
```

### 4. Deny Cross-Account Access

Access is restricted to the Scrybe AWS account only:

```json
{
  "Sid": "DenyCrossAccountAccess",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:*",
  "Resource": ["arn:aws:s3:::bucket-name", "arn:aws:s3:::bucket-name/*"],
  "Condition": {
    "StringNotEquals": {
      "aws:PrincipalAccount": "123456789012"
    }
  }
}
```

## Access Logging

S3 access logs are enabled on all buckets and stored in a dedicated logging bucket:

- **Log Retention:** 1 year minimum
- **Log Format:** Standard S3 access log format
- **Target Bucket:** `scrybe-access-logs-{env}`

### Log Analysis

Access logs can be analyzed using:
- AWS Athena for SQL queries
- CloudWatch Logs Insights
- Third-party SIEM integration

## Lifecycle Policies

### Call Recordings

```json
{
  "Rules": [
    {
      "ID": "archive-old-recordings",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 2555
      }
    }
  ]
}
```

### Data Exports

```json
{
  "Rules": [
    {
      "ID": "delete-old-exports",
      "Status": "Enabled",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

### User Uploads (Version Cleanup)

```json
{
  "Rules": [
    {
      "ID": "cleanup-old-versions",
      "Status": "Enabled",
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 90
      }
    }
  ]
}
```

## Versioning and Replication

### Versioning

All buckets have versioning enabled to:
- Protect against accidental deletion
- Enable point-in-time recovery
- Support compliance requirements

### Cross-Region Replication

Critical data is replicated to a secondary region for disaster recovery:

| Source Bucket | Replica Bucket | Destination Region |
|--------------|----------------|-------------------|
| `scrybe-uploads-prod` | `scrybe-uploads-prod-replica` | us-east-1 |
| `scrybe-recordings-prod` | `scrybe-recordings-prod-replica` | us-east-1 |
| `scrybe-backups-prod` | `scrybe-backups-prod-replica` | us-east-1 |

### MFA Delete (Optional)

For production buckets, MFA Delete can be enabled to require MFA authentication for:
- Deleting object versions
- Changing versioning state

**Note:** MFA Delete must be enabled by the root account and requires the AWS CLI.

## Object Lock (Compliance Bucket)

The audit logs bucket uses Object Lock in Governance mode:

```hcl
resource "aws_s3_bucket_object_lock_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    default_retention {
      mode  = "GOVERNANCE"
      years = 7
    }
  }
}
```

This ensures audit logs cannot be deleted or modified for 7 years.

## Application Integration

### Secure Upload Module

Use the `secure-s3` module for all S3 operations:

```typescript
import {
  secureUpload,
  secureDownload,
  getSecureDownloadUrl,
  S3BucketType,
} from "@/lib/storage/secure-s3";

// Upload with enforced encryption
const result = await secureUpload(
  S3BucketType.UPLOADS,
  key,
  buffer,
  { contentType: "application/pdf" }
);

// Generate short-lived download URL (max 4 hours)
const url = await getSecureDownloadUrl(
  S3BucketType.RECORDINGS,
  recordingKey,
  { expiresIn: 3600 }  // 1 hour
);
```

### Presigned URL Limits

| Bucket Type | Max URL Expiry | Default Expiry |
|-------------|---------------|----------------|
| Uploads | 1 hour | 1 hour |
| Recordings | 1 hour | 1 hour |
| Exports | 4 hours | 4 hours |
| Backups | 30 minutes | 30 minutes |
| Audit Logs | 30 minutes | 30 minutes |

## Environment Variables

Required environment variables for S3 operations:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-west-2

# KMS Key
AWS_KMS_KEY_ARN=arn:aws:kms:us-west-2:123456789012:key/abc-123

# Buckets
AWS_S3_BUCKET_UPLOADS=scrybe-uploads-prod
AWS_S3_BUCKET_RECORDINGS=scrybe-recordings-prod
AWS_S3_BUCKET_EXPORTS=scrybe-exports-prod
AWS_S3_BUCKET_BACKUPS=scrybe-backups-prod
AWS_S3_BUCKET_AUDIT_LOGS=scrybe-audit-logs-prod

# Replica Buckets (for failover)
AWS_S3_BUCKET_UPLOADS_REPLICA=scrybe-uploads-prod-replica
AWS_S3_BUCKET_RECORDINGS_REPLICA=scrybe-recordings-prod-replica
AWS_S3_REGION_SECONDARY=us-east-1
```

## Terraform Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.5.0 installed
3. KMS key created for S3 encryption
4. IAM role created for application access

### Deployment Steps

```bash
# Navigate to infrastructure directory
cd infrastructure

# Initialize Terraform
terraform init

# Create a tfvars file
cat > terraform.tfvars <<EOF
environment = "prod"
aws_region = "us-west-2"
aws_region_secondary = "us-east-1"
kms_key_arn = "arn:aws:kms:us-west-2:123456789012:key/abc-123"
kms_key_arn_secondary = "arn:aws:kms:us-east-1:123456789012:key/def-456"
app_iam_role_arn = "arn:aws:iam::123456789012:role/scrybe-app-role"
enable_cross_region_replication = true
EOF

# Plan the deployment
terraform plan -var-file=terraform.tfvars

# Apply the configuration
terraform apply -var-file=terraform.tfvars
```

### Manual Policy Application (AWS CLI)

If not using Terraform, apply policies manually:

```bash
# Set variables
BUCKET_NAME="scrybe-uploads-prod"
KMS_KEY_ARN="arn:aws:kms:us-west-2:123456789012:key/abc-123"
AWS_ACCOUNT_ID="123456789012"
APP_IAM_ROLE_ARN="arn:aws:iam::123456789012:role/scrybe-app-role"

# Apply bucket policy
envsubst < infrastructure/s3/policy-templates/bucket-policy-template.json | \
  aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///dev/stdin

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket $BUCKET_NAME \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable default encryption
aws s3api put-bucket-encryption \
  --bucket $BUCKET_NAME \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "aws:kms",
          "KMSMasterKeyID": "'$KMS_KEY_ARN'"
        },
        "BucketKeyEnabled": true
      }
    ]
  }'

# Apply lifecycle configuration
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration file://infrastructure/s3/policy-templates/lifecycle-uploads.json
```

## Monitoring and Alerting

### CloudWatch Metrics

Monitor these S3 metrics:
- `4xxErrors` - Client errors (access denied, etc.)
- `5xxErrors` - Server errors
- `NumberOfObjects` - Storage growth
- `BucketSizeBytes` - Storage costs

### CloudTrail Events

Enable CloudTrail for S3 data events to track:
- Object-level API activity
- Who accessed what data and when
- Failed access attempts

### Security Hub Findings

AWS Security Hub checks for:
- Public access settings
- Encryption configuration
- Logging enabled
- Versioning enabled

## HIPAA Compliance Mapping

| HIPAA Requirement | Implementation |
|------------------|----------------|
| §164.312(a)(2)(iv) Encryption | AES-256 with KMS |
| §164.312(b) Audit Controls | Access logging, CloudTrail |
| §164.312(c)(1) Integrity | Versioning, Object Lock |
| §164.312(e)(1) Transmission Security | TLS required (HTTPS only) |
| §164.310(d)(2)(iv) Data Backup | Cross-region replication |

## SOC 2 Control Mapping

| SOC 2 Control | Implementation |
|---------------|----------------|
| CC6.1 Logical Access | IAM roles, bucket policies |
| CC6.7 Data Encryption | KMS encryption at rest |
| CC7.2 System Monitoring | Access logging, CloudTrail |
| A1.2 Data Recovery | Versioning, cross-region replication |

## Troubleshooting

### Access Denied Errors

1. Check IAM role permissions
2. Verify bucket policy allows the role
3. Ensure encryption headers are included in requests
4. Check for conditional access denials

### Replication Issues

1. Verify replication IAM role permissions
2. Check KMS key access in both regions
3. Ensure versioning is enabled on both buckets
4. Review replication metrics in S3 console

### Object Lock Issues

1. Object Lock can only be set at bucket creation
2. Governance mode allows privileged users to override
3. Compliance mode cannot be overridden by anyone

## Related Documents

- [S3 Failover Runbook](../compliance/runbooks/s3-failover.md)
- [PHI Encryption Technical Design](./phi-encryption.md)
- [Disaster Recovery Policy](../compliance/policies/disaster-recovery-policy.md)
