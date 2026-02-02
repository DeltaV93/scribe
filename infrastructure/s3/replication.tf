# =============================================================================
# Scrybe S3 Cross-Region Replication
# =============================================================================
# Cross-region replication for critical data (recordings, backups)
# Provides disaster recovery and data redundancy for HIPAA compliance
# =============================================================================

# -----------------------------------------------------------------------------
# Replica Buckets in Secondary Region
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "uploads_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = "${local.bucket_prefix}-uploads-replica"

  tags = {
    Name        = "User Uploads Replica"
    Description = "Cross-region replica for user uploads"
    DataType    = "phi-documents-replica"
    Compliance  = "HIPAA-SOC2"
    SourceBucket = aws_s3_bucket.uploads.id
  }
}

resource "aws_s3_bucket_public_access_block" "uploads_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.uploads_replica[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "uploads_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.uploads_replica[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.uploads_replica[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn_secondary
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket" "recordings_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = "${local.bucket_prefix}-recordings-replica"

  tags = {
    Name         = "Call Recordings Replica"
    Description  = "Cross-region replica for call recordings"
    DataType     = "phi-audio-replica"
    Compliance   = "HIPAA-SOC2"
    SourceBucket = aws_s3_bucket.recordings.id
  }
}

resource "aws_s3_bucket_public_access_block" "recordings_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.recordings_replica[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "recordings_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.recordings_replica[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "recordings_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.recordings_replica[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn_secondary
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket" "backups_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = "${local.bucket_prefix}-backups-replica"

  tags = {
    Name         = "Database Backups Replica"
    Description  = "Cross-region replica for database backups"
    DataType     = "database-backups-replica"
    Compliance   = "HIPAA-SOC2"
    SourceBucket = aws_s3_bucket.backups.id
  }
}

resource "aws_s3_bucket_public_access_block" "backups_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.backups_replica[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "backups_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.backups_replica[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.secondary
  bucket   = aws_s3_bucket.backups_replica[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn_secondary
    }
    bucket_key_enabled = true
  }
}

# -----------------------------------------------------------------------------
# Replication IAM Role
# -----------------------------------------------------------------------------

resource "aws_iam_role" "replication" {
  count = var.enable_cross_region_replication ? 1 : 0
  name  = "${var.project_name}-s3-replication-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "S3 Replication Role"
    Description = "IAM role for S3 cross-region replication"
  }
}

resource "aws_iam_policy" "replication" {
  count = var.enable_cross_region_replication ? 1 : 0
  name  = "${var.project_name}-s3-replication-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.uploads.arn,
          aws_s3_bucket.recordings.arn,
          aws_s3_bucket.backups.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = [
          "${aws_s3_bucket.uploads.arn}/*",
          "${aws_s3_bucket.recordings.arn}/*",
          "${aws_s3_bucket.backups.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = [
          "${aws_s3_bucket.uploads_replica[0].arn}/*",
          "${aws_s3_bucket.recordings_replica[0].arn}/*",
          "${aws_s3_bucket.backups_replica[0].arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.kms_key_arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Encrypt"
        ]
        Resource = var.kms_key_arn_secondary
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "replication" {
  count      = var.enable_cross_region_replication ? 1 : 0
  role       = aws_iam_role.replication[0].name
  policy_arn = aws_iam_policy.replication[0].arn
}

# -----------------------------------------------------------------------------
# Replication Configurations
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_replication_configuration" "uploads" {
  count  = var.enable_cross_region_replication ? 1 : 0
  bucket = aws_s3_bucket.uploads.id
  role   = aws_iam_role.replication[0].arn

  depends_on = [aws_s3_bucket_versioning.uploads]

  rule {
    id     = "uploads-replication"
    status = "Enabled"

    filter {
      prefix = ""
    }

    destination {
      bucket        = aws_s3_bucket.uploads_replica[0].arn
      storage_class = "STANDARD"

      encryption_configuration {
        replica_kms_key_id = var.kms_key_arn_secondary
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }

    delete_marker_replication {
      status = "Enabled"
    }
  }
}

resource "aws_s3_bucket_replication_configuration" "recordings" {
  count  = var.enable_cross_region_replication ? 1 : 0
  bucket = aws_s3_bucket.recordings.id
  role   = aws_iam_role.replication[0].arn

  depends_on = [aws_s3_bucket_versioning.recordings]

  rule {
    id     = "recordings-replication"
    status = "Enabled"

    filter {
      prefix = ""
    }

    destination {
      bucket        = aws_s3_bucket.recordings_replica[0].arn
      storage_class = "STANDARD"

      encryption_configuration {
        replica_kms_key_id = var.kms_key_arn_secondary
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }

    delete_marker_replication {
      status = "Enabled"
    }
  }
}

resource "aws_s3_bucket_replication_configuration" "backups" {
  count  = var.enable_cross_region_replication ? 1 : 0
  bucket = aws_s3_bucket.backups.id
  role   = aws_iam_role.replication[0].arn

  depends_on = [aws_s3_bucket_versioning.backups]

  rule {
    id     = "backups-replication"
    status = "Enabled"

    filter {
      prefix = ""
    }

    destination {
      bucket        = aws_s3_bucket.backups_replica[0].arn
      storage_class = "STANDARD"

      encryption_configuration {
        replica_kms_key_id = var.kms_key_arn_secondary
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }

    delete_marker_replication {
      status = "Enabled"
    }
  }
}
