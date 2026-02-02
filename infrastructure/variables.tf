# =============================================================================
# Scrybe Infrastructure - Variables
# =============================================================================
# Common variables used across all Terraform configurations
# =============================================================================

# -----------------------------------------------------------------------------
# General Settings
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "scrybe"
}

variable "aws_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-west-2"
}

variable "aws_region_secondary" {
  description = "Secondary AWS region for cross-region replication"
  type        = string
  default     = "us-east-1"
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "common_tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default = {
    Project     = "Scrybe"
    ManagedBy   = "Terraform"
    Compliance  = "HIPAA-SOC2"
  }
}

# -----------------------------------------------------------------------------
# KMS Settings
# -----------------------------------------------------------------------------

variable "kms_key_arn" {
  description = "ARN of the KMS key for S3 encryption"
  type        = string
}

variable "kms_key_arn_secondary" {
  description = "ARN of the KMS key in secondary region for replication"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# S3 Lifecycle Settings
# -----------------------------------------------------------------------------

variable "recordings_glacier_days" {
  description = "Days before transitioning call recordings to Glacier"
  type        = number
  default     = 365  # 1 year
}

variable "recordings_retention_days" {
  description = "Total retention period for recordings in days"
  type        = number
  default     = 2555  # 7 years
}

variable "exports_retention_days" {
  description = "Retention period for data exports in days"
  type        = number
  default     = 30
}

variable "uploads_version_retention_days" {
  description = "Days to retain old versions of uploads"
  type        = number
  default     = 90
}

variable "access_logs_retention_days" {
  description = "Days to retain S3 access logs"
  type        = number
  default     = 365  # 1 year minimum for compliance
}

variable "audit_logs_retention_years" {
  description = "Years to retain audit logs (Object Lock)"
  type        = number
  default     = 7
}

# -----------------------------------------------------------------------------
# IAM Settings
# -----------------------------------------------------------------------------

variable "app_iam_role_arn" {
  description = "ARN of the IAM role used by the application"
  type        = string
}

variable "backup_iam_role_arn" {
  description = "ARN of the IAM role used for backups (optional)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# MFA Delete Settings
# -----------------------------------------------------------------------------

variable "enable_mfa_delete" {
  description = "Enable MFA Delete for versioned buckets (requires manual setup)"
  type        = bool
  default     = false
}

variable "mfa_device_serial" {
  description = "Serial number of the MFA device for MFA Delete"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Cross-Region Replication
# -----------------------------------------------------------------------------

variable "enable_cross_region_replication" {
  description = "Enable cross-region replication for critical buckets"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Notification Settings
# -----------------------------------------------------------------------------

variable "sns_topic_arn" {
  description = "SNS topic ARN for S3 event notifications"
  type        = string
  default     = ""
}
