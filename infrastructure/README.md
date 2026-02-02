# Scrybe Infrastructure

HIPAA/SOC 2 compliant AWS infrastructure configuration using Terraform.

## Overview

This directory contains Terraform configurations for:

- **S3 Buckets**: Secure storage for uploads, recordings, exports, backups, and audit logs
- **Bucket Policies**: Security hardening with encryption, TLS, and access controls
- **Lifecycle Policies**: Automatic archival and retention management
- **Cross-Region Replication**: Disaster recovery for critical data

## Prerequisites

1. **Terraform**: Version >= 1.5.0
   ```bash
   brew install terraform  # macOS
   # or download from https://www.terraform.io/downloads
   ```

2. **AWS CLI**: Configured with appropriate credentials
   ```bash
   aws configure
   ```

3. **AWS Resources** (must be created first):
   - KMS key for S3 encryption
   - IAM role for application access
   - (Optional) KMS key in secondary region for replication

## Quick Start

```bash
# Navigate to infrastructure directory
cd infrastructure

# Copy and edit the example variables file
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize Terraform
terraform init

# Preview changes
terraform plan -var-file=terraform.tfvars

# Apply configuration
terraform apply -var-file=terraform.tfvars
```

## Directory Structure

```
infrastructure/
├── README.md                 # This file
├── providers.tf              # Terraform and AWS provider configuration
├── variables.tf              # Input variables
├── terraform.tfvars.example  # Example variable values
├── s3/
│   ├── main.tf              # S3 bucket definitions
│   ├── policies.tf          # Bucket policies
│   ├── replication.tf       # Cross-region replication
│   ├── outputs.tf           # Output values
│   └── policy-templates/    # JSON policy templates for manual use
│       ├── bucket-policy-template.json
│       ├── audit-logs-bucket-policy.json
│       ├── lifecycle-recordings.json
│       ├── lifecycle-exports.json
│       └── lifecycle-uploads.json
```

## Buckets Created

| Bucket | Purpose | Encryption | Retention |
|--------|---------|------------|-----------|
| `scrybe-uploads-{env}` | User documents | KMS | Versioned, 90-day version cleanup |
| `scrybe-recordings-{env}` | Call recordings | KMS | Glacier after 1 year, delete after 7 years |
| `scrybe-exports-{env}` | Data exports | KMS | Delete after 30 days |
| `scrybe-backups-{env}` | Database backups | KMS | Deep Archive after 90 days, 7-year retention |
| `scrybe-access-logs-{env}` | S3 access logs | KMS | 1-year retention |
| `scrybe-audit-logs-{env}` | Compliance logs | KMS + Object Lock | 7-year governance mode |

## Security Controls

All buckets are configured with:

- **Block Public Access**: All public access blocked
- **Encryption**: KMS encryption required on all uploads
- **TLS Required**: HTTP requests denied
- **Cross-Account Denied**: Only Scrybe account has access
- **Versioning**: Enabled on all buckets
- **Access Logging**: All access logged to dedicated bucket

## Environment-Specific Configuration

### Development

```hcl
environment = "dev"
enable_cross_region_replication = false
recordings_glacier_days = 30  # Shorter for cost savings
```

### Staging

```hcl
environment = "staging"
enable_cross_region_replication = false
```

### Production

```hcl
environment = "prod"
enable_cross_region_replication = true
enable_mfa_delete = true  # After manual setup
```

## Manual Policy Application

If not using Terraform, use the AWS CLI with the policy templates:

```bash
# Set your variables
export BUCKET_NAME="scrybe-uploads-prod"
export KMS_KEY_ARN="arn:aws:kms:us-west-2:123456789012:key/..."
export AWS_ACCOUNT_ID="123456789012"
export APP_IAM_ROLE_ARN="arn:aws:iam::123456789012:role/scrybe-app"

# Apply the bucket policy
envsubst < s3/policy-templates/bucket-policy-template.json | \
  aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///dev/stdin

# Apply lifecycle configuration
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration file://s3/policy-templates/lifecycle-uploads.json
```

## Outputs

After applying, Terraform outputs:

- Bucket names and ARNs for each bucket
- Environment variables to set in the application
- Lifecycle configuration summary
- Security configuration summary

Access outputs:

```bash
terraform output app_environment_variables
```

## Post-Deployment Steps

1. **Set Environment Variables**: Use the output from `terraform output app_environment_variables`

2. **Enable MFA Delete** (optional, production only):
   ```bash
   # Must be done by root account
   aws s3api put-bucket-versioning \
     --bucket scrybe-uploads-prod \
     --versioning-configuration Status=Enabled,MFADelete=Enabled \
     --mfa "arn:aws:iam::123456789012:mfa/root-account-mfa-device 123456"
   ```

3. **Verify Replication** (if enabled):
   ```bash
   aws s3api get-bucket-replication --bucket scrybe-uploads-prod
   ```

4. **Test Upload**:
   ```bash
   echo "test" | aws s3 cp - s3://scrybe-uploads-prod/test.txt \
     --sse aws:kms \
     --sse-kms-key-id $KMS_KEY_ARN
   ```

## Troubleshooting

### "Access Denied" on Upload

Ensure uploads include encryption headers:
```bash
aws s3 cp file.txt s3://bucket/ \
  --sse aws:kms \
  --sse-kms-key-id <kms-key-arn>
```

### Replication Not Working

1. Check IAM role permissions
2. Verify KMS key access in both regions
3. Ensure versioning is enabled on both buckets
4. Check replication metrics in S3 console

### Object Lock Errors

Object Lock can only be enabled at bucket creation. If you need Object Lock on an existing bucket:
1. Create a new bucket with Object Lock
2. Copy objects from old bucket
3. Delete old bucket (if empty)

## Related Documentation

- [S3 Security Hardening](../docs/technical/s3-security-hardening.md)
- [S3 Failover Runbook](../docs/compliance/runbooks/s3-failover.md)
- [Disaster Recovery Policy](../docs/compliance/policies/disaster-recovery-policy.md)
