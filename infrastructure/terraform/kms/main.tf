/**
 * AWS KMS Configuration for Scrybe PHI Encryption
 *
 * This Terraform configuration creates and manages AWS KMS keys for
 * encrypting Protected Health Information (PHI) in compliance with
 * HIPAA and SOC 2 requirements.
 *
 * Key Features:
 * - Separate keys for dev/staging/production environments
 * - Automatic annual key rotation (AWS-managed)
 * - CloudTrail logging for all key operations
 * - IAM policies following principle of least privilege
 * - Key aliases for easy management
 */

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Recommended: Configure remote state for production
  # backend "s3" {
  #   bucket         = "scrybe-terraform-state"
  #   key            = "kms/terraform.tfstate"
  #   region         = "us-west-2"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Scrybe"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "HIPAA,SOC2"
    }
  }
}

# ============================================
# VARIABLES
# ============================================

variable "aws_region" {
  description = "AWS region for KMS keys"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment (development, staging, production)"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "application_role_arn" {
  description = "ARN of the IAM role used by the Scrybe application"
  type        = string
}

variable "admin_role_arns" {
  description = "ARNs of IAM roles for key administrators"
  type        = list(string)
  default     = []
}

variable "emergency_access_role_arn" {
  description = "ARN of emergency access IAM role (break-glass)"
  type        = string
  default     = ""
}

variable "deletion_window_days" {
  description = "Waiting period before key deletion (7-30 days)"
  type        = number
  default     = 30

  validation {
    condition     = var.deletion_window_days >= 7 && var.deletion_window_days <= 30
    error_message = "Deletion window must be between 7 and 30 days."
  }
}

# ============================================
# DATA SOURCES
# ============================================

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "kms_key_policy" {
  # Root account has full access (required by AWS)
  statement {
    sid    = "EnableIAMUserPermissions"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  # Key administrators can manage the key but NOT use it for crypto
  statement {
    sid    = "AllowKeyAdministration"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = var.admin_role_arns
    }
    actions = [
      "kms:Create*",
      "kms:Describe*",
      "kms:Enable*",
      "kms:List*",
      "kms:Put*",
      "kms:Update*",
      "kms:Revoke*",
      "kms:Disable*",
      "kms:Get*",
      "kms:Delete*",
      "kms:TagResource",
      "kms:UntagResource",
      "kms:ScheduleKeyDeletion",
      "kms:CancelKeyDeletion",
    ]
    resources = ["*"]
  }

  # Application role can use key for encryption/decryption only
  statement {
    sid    = "AllowApplicationCryptoOperations"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [var.application_role_arn]
    }
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:DescribeKey",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ec2.${var.aws_region}.amazonaws.com", "lambda.${var.aws_region}.amazonaws.com"]
    }
  }

  # Direct application access (for ECS/Fargate without ViaService)
  statement {
    sid    = "AllowDirectApplicationAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [var.application_role_arn]
    }
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:DescribeKey",
    ]
    resources = ["*"]
  }

  # Emergency access (break-glass) - requires MFA
  dynamic "statement" {
    for_each = var.emergency_access_role_arn != "" ? [1] : []
    content {
      sid    = "EmergencyAccess"
      effect = "Allow"
      principals {
        type        = "AWS"
        identifiers = [var.emergency_access_role_arn]
      }
      actions = [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:DescribeKey",
      ]
      resources = ["*"]
      condition {
        test     = "Bool"
        variable = "aws:MultiFactorAuthPresent"
        values   = ["true"]
      }
    }
  }

  # CloudTrail logging permissions
  statement {
    sid    = "AllowCloudTrailLogging"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions = [
      "kms:GenerateDataKey*",
      "kms:DescribeKey",
    ]
    resources = ["*"]
    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:aws:cloudtrail:arn"
      values   = ["arn:aws:cloudtrail:*:${data.aws_caller_identity.current.account_id}:trail/*"]
    }
  }
}

# ============================================
# KMS KEY
# ============================================

resource "aws_kms_key" "phi_master_key" {
  description             = "Scrybe PHI Master Encryption Key - ${var.environment}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = true # Automatic annual rotation

  # Key policy with principle of least privilege
  policy = data.aws_iam_policy_document.kms_key_policy.json

  tags = {
    Name        = "scrybe-phi-master-key-${var.environment}"
    Purpose     = "PHI Encryption"
    DataClass   = "PHI"
    Environment = var.environment
  }
}

# Primary alias
resource "aws_kms_alias" "phi_master_key" {
  name          = "alias/scrybe-phi-master-key-${var.environment}"
  target_key_id = aws_kms_key.phi_master_key.key_id
}

# Shorthand alias
resource "aws_kms_alias" "phi_master_key_short" {
  name          = "alias/scrybe-phi-${var.environment}"
  target_key_id = aws_kms_key.phi_master_key.key_id
}

# ============================================
# CLOUDTRAIL FOR KMS AUDIT LOGGING
# ============================================

resource "aws_s3_bucket" "kms_audit_logs" {
  bucket = "scrybe-kms-audit-logs-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name    = "KMS Audit Logs"
    Purpose = "CloudTrail logs for KMS key operations"
  }
}

resource "aws_s3_bucket_versioning" "kms_audit_logs" {
  bucket = aws_s3_bucket.kms_audit_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "kms_audit_logs" {
  bucket = aws_s3_bucket.kms_audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.phi_master_key.arn
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "kms_audit_logs" {
  bucket = aws_s3_bucket.kms_audit_logs.id

  rule {
    id     = "archive-old-logs"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    # HIPAA requires 6 years retention minimum
    expiration {
      days = 2555 # 7 years
    }
  }
}

resource "aws_s3_bucket_public_access_block" "kms_audit_logs" {
  bucket = aws_s3_bucket.kms_audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "kms_audit_logs_bucket_policy" {
  statement {
    sid    = "AWSCloudTrailAclCheck"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions   = ["s3:GetBucketAcl"]
    resources = [aws_s3_bucket.kms_audit_logs.arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudtrail:${var.aws_region}:${data.aws_caller_identity.current.account_id}:trail/scrybe-kms-audit-${var.environment}"]
    }
  }

  statement {
    sid    = "AWSCloudTrailWrite"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.kms_audit_logs.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudtrail:${var.aws_region}:${data.aws_caller_identity.current.account_id}:trail/scrybe-kms-audit-${var.environment}"]
    }
  }
}

resource "aws_s3_bucket_policy" "kms_audit_logs" {
  bucket = aws_s3_bucket.kms_audit_logs.id
  policy = data.aws_iam_policy_document.kms_audit_logs_bucket_policy.json
}

resource "aws_cloudtrail" "kms_audit" {
  name                          = "scrybe-kms-audit-${var.environment}"
  s3_bucket_name                = aws_s3_bucket.kms_audit_logs.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_logging                = true

  # Log all KMS API calls
  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::KMS::Key"
      values = [aws_kms_key.phi_master_key.arn]
    }
  }

  tags = {
    Name    = "KMS Audit Trail"
    Purpose = "HIPAA/SOC2 compliance logging"
  }

  depends_on = [aws_s3_bucket_policy.kms_audit_logs]
}

# ============================================
# CLOUDWATCH ALARMS FOR KEY OPERATIONS
# ============================================

resource "aws_cloudwatch_log_group" "kms_operations" {
  name              = "/aws/kms/scrybe-${var.environment}"
  retention_in_days = 2555 # 7 years for HIPAA

  tags = {
    Name = "KMS Operations Log Group"
  }
}

resource "aws_cloudwatch_metric_alarm" "kms_key_disabled" {
  alarm_name          = "scrybe-kms-key-disabled-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "DisableKey"
  namespace           = "AWS/KMS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alert when KMS key is disabled"
  treat_missing_data  = "notBreaching"

  dimensions = {
    KeyId = aws_kms_key.phi_master_key.key_id
  }

  tags = {
    Name = "KMS Key Disabled Alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "kms_key_deletion_scheduled" {
  alarm_name          = "scrybe-kms-key-deletion-scheduled-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ScheduleKeyDeletion"
  namespace           = "AWS/KMS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "CRITICAL: KMS key deletion has been scheduled"
  treat_missing_data  = "notBreaching"

  dimensions = {
    KeyId = aws_kms_key.phi_master_key.key_id
  }

  tags = {
    Name = "KMS Key Deletion Scheduled Alarm"
  }
}

# ============================================
# OUTPUTS
# ============================================

output "kms_key_id" {
  description = "KMS Key ID"
  value       = aws_kms_key.phi_master_key.key_id
}

output "kms_key_arn" {
  description = "KMS Key ARN"
  value       = aws_kms_key.phi_master_key.arn
}

output "kms_key_alias" {
  description = "KMS Key Alias"
  value       = aws_kms_alias.phi_master_key.name
}

output "cloudtrail_arn" {
  description = "CloudTrail ARN for KMS audit logging"
  value       = aws_cloudtrail.kms_audit.arn
}

output "audit_logs_bucket" {
  description = "S3 bucket for KMS audit logs"
  value       = aws_s3_bucket.kms_audit_logs.id
}

output "environment_config" {
  description = "Environment configuration for .env file"
  value = <<-EOT
    # AWS KMS Configuration - ${var.environment}
    AWS_KMS_KEY_ID=${aws_kms_key.phi_master_key.key_id}
    AWS_KMS_KEY_ARN=${aws_kms_key.phi_master_key.arn}
    AWS_KMS_KEY_ALIAS=${aws_kms_alias.phi_master_key.name}
    AWS_KMS_REGION=${var.aws_region}
  EOT
  sensitive = true
}
