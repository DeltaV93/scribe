# =============================================================================
# Scrybe S3 Buckets - Main Configuration
# =============================================================================
# HIPAA/SOC 2 compliant S3 bucket configuration for Scrybe
#
# Buckets:
# - scrybe-uploads-{env}        : User uploads and documents
# - scrybe-recordings-{env}     : Call recordings
# - scrybe-exports-{env}        : Data exports
# - scrybe-backups-{env}        : Database backups
# - scrybe-access-logs-{env}    : S3 access logs
# - scrybe-audit-logs-{env}     : Compliance audit logs (Object Lock enabled)
# =============================================================================

locals {
  bucket_prefix = "${var.project_name}-${var.environment}"
  account_id    = data.aws_caller_identity.current.account_id
}

# -----------------------------------------------------------------------------
# Access Logs Bucket (must be created first for logging destination)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "access_logs" {
  bucket = "${local.bucket_prefix}-access-logs"

  tags = {
    Name        = "S3 Access Logs"
    Description = "Storage for S3 access logs from all buckets"
    DataType    = "access-logs"
  }
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    expiration {
      days = var.access_logs_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Grant S3 logging service permission to write
resource "aws_s3_bucket_policy" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "S3ServerAccessLogsPolicy"
        Effect    = "Allow"
        Principal = {
          Service = "logging.s3.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.access_logs.arn}/*"
        Condition = {
          ArnLike = {
            "aws:SourceArn" = "arn:aws:s3:::${local.bucket_prefix}-*"
          }
          StringEquals = {
            "aws:SourceAccount" = local.account_id
          }
        }
      },
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.access_logs.arn,
          "${aws_s3_bucket.access_logs.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Audit Logs Bucket (Object Lock for compliance)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "audit_logs" {
  bucket              = "${local.bucket_prefix}-audit-logs"
  object_lock_enabled = true

  tags = {
    Name        = "Audit Logs"
    Description = "Immutable storage for compliance audit logs"
    DataType    = "audit-logs"
    Compliance  = "HIPAA-SOC2"
    ObjectLock  = "Governance"
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_object_lock_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    default_retention {
      mode  = "GOVERNANCE"
      years = var.audit_logs_retention_years
    }
  }
}

resource "aws_s3_bucket_logging" "audit_logs" {
  bucket        = aws_s3_bucket.audit_logs.id
  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "audit-logs/"
}

# -----------------------------------------------------------------------------
# Uploads Bucket (User documents)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "uploads" {
  bucket = "${local.bucket_prefix}-uploads"

  tags = {
    Name        = "User Uploads"
    Description = "Storage for user-uploaded documents and files"
    DataType    = "phi-documents"
    Compliance  = "HIPAA-SOC2"
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status     = "Enabled"
    mfa_delete = var.enable_mfa_delete ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_logging" "uploads" {
  bucket        = aws_s3_bucket.uploads.id
  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "uploads/"
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = var.uploads_version_retention_days
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  rule {
    id     = "cleanup-delete-markers"
    status = "Enabled"

    expiration {
      expired_object_delete_marker = true
    }
  }
}

# -----------------------------------------------------------------------------
# Recordings Bucket (Call recordings)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "recordings" {
  bucket = "${local.bucket_prefix}-recordings"

  tags = {
    Name        = "Call Recordings"
    Description = "Storage for call recordings with PHI"
    DataType    = "phi-audio"
    Compliance  = "HIPAA-SOC2"
  }
}

resource "aws_s3_bucket_public_access_block" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  versioning_configuration {
    status     = "Enabled"
    mfa_delete = var.enable_mfa_delete ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_logging" "recordings" {
  bucket        = aws_s3_bucket.recordings.id
  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "recordings/"
}

resource "aws_s3_bucket_lifecycle_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    id     = "archive-old-recordings"
    status = "Enabled"

    transition {
      days          = var.recordings_glacier_days
      storage_class = "GLACIER"
    }

    expiration {
      days = var.recordings_retention_days
    }
  }

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = var.recordings_retention_days
    }
  }
}

# -----------------------------------------------------------------------------
# Exports Bucket (Data exports)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "exports" {
  bucket = "${local.bucket_prefix}-exports"

  tags = {
    Name        = "Data Exports"
    Description = "Temporary storage for data exports"
    DataType    = "phi-exports"
    Compliance  = "HIPAA-SOC2"
  }
}

resource "aws_s3_bucket_public_access_block" "exports" {
  bucket = aws_s3_bucket.exports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "exports" {
  bucket = aws_s3_bucket.exports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_logging" "exports" {
  bucket        = aws_s3_bucket.exports.id
  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "exports/"
}

resource "aws_s3_bucket_lifecycle_configuration" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    id     = "delete-old-exports"
    status = "Enabled"

    expiration {
      days = var.exports_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# -----------------------------------------------------------------------------
# Backups Bucket (Database backups)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "backups" {
  bucket = "${local.bucket_prefix}-backups"

  tags = {
    Name        = "Database Backups"
    Description = "Storage for encrypted database backups"
    DataType    = "database-backups"
    Compliance  = "HIPAA-SOC2"
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status     = "Enabled"
    mfa_delete = var.enable_mfa_delete ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_logging" "backups" {
  bucket        = aws_s3_bucket.backups.id
  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "backups/"
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "transition-old-backups"
    status = "Enabled"

    # Move to Glacier Deep Archive after 30 days
    transition {
      days          = 30
      storage_class = "GLACIER_IR"  # Instant retrieval
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }

    # Keep backups for 7 years
    expiration {
      days = 2555
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}
