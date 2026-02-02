# Scrybe AWS KMS Infrastructure

This Terraform configuration provisions AWS KMS keys and related resources for Scrybe's PHI encryption infrastructure.

## Overview

Creates:
- AWS KMS Customer Master Key (CMK) for PHI encryption
- Key aliases for easy reference
- IAM key policies with least-privilege access
- CloudTrail logging for all key operations
- CloudWatch alarms for security events
- S3 bucket for audit log storage (7-year retention)

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0.0
3. **IAM Role ARNs** for application and admin access

## Quick Start

```bash
# Initialize Terraform
terraform init

# Plan deployment (staging)
terraform plan -var-file=environments/staging.tfvars

# Apply (staging)
terraform apply -var-file=environments/staging.tfvars

# Plan deployment (production)
terraform plan -var-file=environments/production.tfvars

# Apply (production)
terraform apply -var-file=environments/production.tfvars
```

## Configuration

### Environment Variables

Create a `.tfvars` file or use the provided examples in `environments/`:

| Variable | Description | Required |
|----------|-------------|----------|
| `environment` | dev/staging/production | Yes |
| `aws_region` | AWS region for resources | Yes |
| `application_role_arn` | IAM role ARN for the Scrybe app | Yes |
| `admin_role_arns` | List of admin IAM role ARNs | Yes |
| `emergency_access_role_arn` | Break-glass access role | No |
| `deletion_window_days` | Key deletion wait (7-30) | No (default: 30) |

### Example Configuration

```hcl
# environments/production.tfvars
environment = "production"
aws_region  = "us-west-2"

application_role_arn = "arn:aws:iam::123456789012:role/scrybe-production-app"

admin_role_arns = [
  "arn:aws:iam::123456789012:role/scrybe-admin",
  "arn:aws:iam::123456789012:role/security-team",
]

emergency_access_role_arn = "arn:aws:iam::123456789012:role/scrybe-emergency"
deletion_window_days = 30
```

## Outputs

After applying, Terraform outputs:

```bash
kms_key_id          # KMS Key ID
kms_key_arn         # KMS Key ARN (use for AWS_KMS_KEY_ID)
kms_key_alias       # Primary key alias
cloudtrail_arn      # CloudTrail for audit logging
audit_logs_bucket   # S3 bucket for logs
environment_config  # .env snippet for application
```

Copy the `environment_config` output to your application's `.env`:

```bash
# Example output
AWS_KMS_KEY_ID=abc123-def456-...
AWS_KMS_KEY_ARN=arn:aws:kms:us-west-2:123456789012:key/abc123-...
AWS_KMS_KEY_ALIAS=alias/scrybe-phi-master-key-production
AWS_KMS_REGION=us-west-2
```

## Key Policy Details

### Application Role Permissions
- `kms:Encrypt`
- `kms:Decrypt`
- `kms:ReEncrypt*`
- `kms:GenerateDataKey*`
- `kms:DescribeKey`

### Admin Role Permissions
- All `kms:Create*`, `kms:Describe*`, `kms:List*`, etc.
- **Cannot** perform crypto operations

### Emergency Access
- Full access when MFA is present
- All operations logged to CloudTrail

## Security Features

1. **Automatic Key Rotation**: AWS rotates key material annually
2. **Deletion Protection**: 7-30 day waiting period
3. **Audit Logging**: All API calls logged to CloudTrail
4. **Encryption**: Audit logs encrypted with the same CMK
5. **Retention**: 7-year log retention (HIPAA requirement)

## CloudWatch Alarms

| Alarm | Trigger |
|-------|---------|
| Key Disabled | Any `DisableKey` call |
| Key Deletion Scheduled | Any `ScheduleKeyDeletion` call |

Configure SNS topics for these alarms in production.

## State Management

For production, configure remote state:

```hcl
# Uncomment in main.tf
backend "s3" {
  bucket         = "scrybe-terraform-state"
  key            = "kms/terraform.tfstate"
  region         = "us-west-2"
  encrypt        = true
  dynamodb_table = "terraform-locks"
}
```

## Disaster Recovery

1. **Key Deletion**: 30-day window allows cancellation
2. **Cross-Region**: Consider multi-region keys for DR
3. **Backups**: Key material is managed by AWS

## Compliance

This configuration supports:
- **HIPAA** - Encryption, audit logging, access controls
- **SOC 2** - Change management, monitoring, access controls

## Troubleshooting

### "Access Denied" Errors

1. Verify IAM role ARN is correct
2. Check the role has necessary permissions
3. Ensure region matches

### "Key Not Found"

1. Verify key was created successfully
2. Check you're using the correct region
3. Try using the key ARN instead of ID

### Terraform State Issues

```bash
# Re-initialize if state is corrupted
terraform init -reconfigure
```

## Related Documentation

- [AWS KMS Key Management](../../docs/technical/aws-kms-key-management.md)
- [PHI Encryption](../../docs/technical/phi-encryption.md)
- [HIPAA Compliance](../../docs/HIPAA_SPEC.md)
