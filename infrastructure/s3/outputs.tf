# =============================================================================
# Scrybe S3 Outputs
# =============================================================================
# Output values for use in other Terraform configurations and application config
# =============================================================================

# -----------------------------------------------------------------------------
# Primary Bucket Information
# -----------------------------------------------------------------------------

output "uploads_bucket" {
  description = "User uploads bucket information"
  value = {
    name = aws_s3_bucket.uploads.id
    arn  = aws_s3_bucket.uploads.arn
    region = var.aws_region
  }
}

output "recordings_bucket" {
  description = "Call recordings bucket information"
  value = {
    name = aws_s3_bucket.recordings.id
    arn  = aws_s3_bucket.recordings.arn
    region = var.aws_region
  }
}

output "exports_bucket" {
  description = "Data exports bucket information"
  value = {
    name = aws_s3_bucket.exports.id
    arn  = aws_s3_bucket.exports.arn
    region = var.aws_region
  }
}

output "backups_bucket" {
  description = "Database backups bucket information"
  value = {
    name = aws_s3_bucket.backups.id
    arn  = aws_s3_bucket.backups.arn
    region = var.aws_region
  }
}

output "access_logs_bucket" {
  description = "S3 access logs bucket information"
  value = {
    name = aws_s3_bucket.access_logs.id
    arn  = aws_s3_bucket.access_logs.arn
    region = var.aws_region
  }
}

output "audit_logs_bucket" {
  description = "Compliance audit logs bucket information"
  value = {
    name = aws_s3_bucket.audit_logs.id
    arn  = aws_s3_bucket.audit_logs.arn
    region = var.aws_region
    object_lock_enabled = true
  }
}

# -----------------------------------------------------------------------------
# Replica Bucket Information
# -----------------------------------------------------------------------------

output "uploads_replica_bucket" {
  description = "User uploads replica bucket information"
  value = var.enable_cross_region_replication ? {
    name = aws_s3_bucket.uploads_replica[0].id
    arn  = aws_s3_bucket.uploads_replica[0].arn
    region = var.aws_region_secondary
  } : null
}

output "recordings_replica_bucket" {
  description = "Call recordings replica bucket information"
  value = var.enable_cross_region_replication ? {
    name = aws_s3_bucket.recordings_replica[0].id
    arn  = aws_s3_bucket.recordings_replica[0].arn
    region = var.aws_region_secondary
  } : null
}

output "backups_replica_bucket" {
  description = "Database backups replica bucket information"
  value = var.enable_cross_region_replication ? {
    name = aws_s3_bucket.backups_replica[0].id
    arn  = aws_s3_bucket.backups_replica[0].arn
    region = var.aws_region_secondary
  } : null
}

# -----------------------------------------------------------------------------
# Environment Variables for Application
# -----------------------------------------------------------------------------

output "app_environment_variables" {
  description = "Environment variables to set in the application"
  value = {
    # Primary buckets
    AWS_S3_BUCKET_UPLOADS    = aws_s3_bucket.uploads.id
    AWS_S3_BUCKET_RECORDINGS = aws_s3_bucket.recordings.id
    AWS_S3_BUCKET_EXPORTS    = aws_s3_bucket.exports.id
    AWS_S3_BUCKET_BACKUPS    = aws_s3_bucket.backups.id
    AWS_S3_BUCKET_AUDIT_LOGS = aws_s3_bucket.audit_logs.id
    AWS_S3_REGION            = var.aws_region

    # Replica buckets (for failover)
    AWS_S3_BUCKET_UPLOADS_REPLICA    = var.enable_cross_region_replication ? aws_s3_bucket.uploads_replica[0].id : ""
    AWS_S3_BUCKET_RECORDINGS_REPLICA = var.enable_cross_region_replication ? aws_s3_bucket.recordings_replica[0].id : ""
    AWS_S3_BUCKET_BACKUPS_REPLICA    = var.enable_cross_region_replication ? aws_s3_bucket.backups_replica[0].id : ""
    AWS_S3_REGION_SECONDARY          = var.enable_cross_region_replication ? var.aws_region_secondary : ""
  }
  sensitive = false
}

# -----------------------------------------------------------------------------
# Lifecycle Configuration Summary
# -----------------------------------------------------------------------------

output "lifecycle_configuration" {
  description = "Summary of lifecycle policies configured"
  value = {
    recordings = {
      glacier_after_days    = var.recordings_glacier_days
      delete_after_days     = var.recordings_retention_days
      description           = "Recordings transition to Glacier after ${var.recordings_glacier_days} days, deleted after ${var.recordings_retention_days} days"
    }
    exports = {
      delete_after_days     = var.exports_retention_days
      description           = "Exports are automatically deleted after ${var.exports_retention_days} days"
    }
    uploads = {
      version_cleanup_days  = var.uploads_version_retention_days
      description           = "Old versions cleaned up after ${var.uploads_version_retention_days} days"
    }
    access_logs = {
      delete_after_days     = var.access_logs_retention_days
      description           = "Access logs retained for ${var.access_logs_retention_days} days"
    }
    audit_logs = {
      object_lock_years     = var.audit_logs_retention_years
      description           = "Audit logs locked for ${var.audit_logs_retention_years} years (Object Lock)"
    }
  }
}

# -----------------------------------------------------------------------------
# Security Summary
# -----------------------------------------------------------------------------

output "security_configuration" {
  description = "Summary of security configurations"
  value = {
    public_access_blocked  = true
    encryption_algorithm   = "aws:kms"
    kms_key_arn           = var.kms_key_arn
    versioning_enabled    = true
    mfa_delete_enabled    = var.enable_mfa_delete
    cross_region_replication = var.enable_cross_region_replication
    access_logging_enabled = true
    object_lock_enabled   = "audit_logs bucket only"
    tls_required          = true
  }
}
