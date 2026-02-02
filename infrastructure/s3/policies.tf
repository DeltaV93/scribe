# =============================================================================
# Scrybe S3 Bucket Policies - Security Hardening
# =============================================================================
# HIPAA/SOC 2 compliant bucket policies enforcing:
# - Block all public access
# - Enforce encryption on upload (deny unencrypted)
# - Require TLS for all requests
# - Deny cross-account access
# =============================================================================

# -----------------------------------------------------------------------------
# Uploads Bucket Policy
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "ScrybeUploadsBucketPolicy"
    Statement = [
      # Require TLS for all requests
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      # Require encryption on upload
      {
        Sid       = "DenyUnencryptedUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.uploads.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      # Require specific KMS key
      {
        Sid       = "DenyWrongKMSKey"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.uploads.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption-aws-kms-key-id" = var.kms_key_arn
          }
        }
      },
      # Deny cross-account access
      {
        Sid       = "DenyCrossAccountAccess"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
        Condition = {
          StringNotEquals = {
            "aws:PrincipalAccount" = local.account_id
          }
        }
      },
      # Allow application role access
      {
        Sid       = "AllowApplicationAccess"
        Effect    = "Allow"
        Principal = {
          AWS = var.app_iam_role_arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Recordings Bucket Policy
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "ScrybeRecordingsBucketPolicy"
    Statement = [
      # Require TLS for all requests
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.recordings.arn,
          "${aws_s3_bucket.recordings.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      # Require encryption on upload
      {
        Sid       = "DenyUnencryptedUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.recordings.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      # Require specific KMS key
      {
        Sid       = "DenyWrongKMSKey"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.recordings.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption-aws-kms-key-id" = var.kms_key_arn
          }
        }
      },
      # Deny cross-account access
      {
        Sid       = "DenyCrossAccountAccess"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.recordings.arn,
          "${aws_s3_bucket.recordings.arn}/*"
        ]
        Condition = {
          StringNotEquals = {
            "aws:PrincipalAccount" = local.account_id
          }
        }
      },
      # Allow application role access
      {
        Sid       = "AllowApplicationAccess"
        Effect    = "Allow"
        Principal = {
          AWS = var.app_iam_role_arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.recordings.arn,
          "${aws_s3_bucket.recordings.arn}/*"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Exports Bucket Policy
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "exports" {
  bucket = aws_s3_bucket.exports.id

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "ScrybeExportsBucketPolicy"
    Statement = [
      # Require TLS for all requests
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.exports.arn,
          "${aws_s3_bucket.exports.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      # Require encryption on upload
      {
        Sid       = "DenyUnencryptedUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.exports.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      # Require specific KMS key
      {
        Sid       = "DenyWrongKMSKey"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.exports.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption-aws-kms-key-id" = var.kms_key_arn
          }
        }
      },
      # Deny cross-account access
      {
        Sid       = "DenyCrossAccountAccess"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.exports.arn,
          "${aws_s3_bucket.exports.arn}/*"
        ]
        Condition = {
          StringNotEquals = {
            "aws:PrincipalAccount" = local.account_id
          }
        }
      },
      # Allow application role access
      {
        Sid       = "AllowApplicationAccess"
        Effect    = "Allow"
        Principal = {
          AWS = var.app_iam_role_arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.exports.arn,
          "${aws_s3_bucket.exports.arn}/*"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Backups Bucket Policy
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "backups" {
  bucket = aws_s3_bucket.backups.id

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "ScrybeBackupsBucketPolicy"
    Statement = [
      # Require TLS for all requests
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      # Require encryption on upload
      {
        Sid       = "DenyUnencryptedUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.backups.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      # Require specific KMS key
      {
        Sid       = "DenyWrongKMSKey"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.backups.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption-aws-kms-key-id" = var.kms_key_arn
          }
        }
      },
      # Deny cross-account access
      {
        Sid       = "DenyCrossAccountAccess"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
        ]
        Condition = {
          StringNotEquals = {
            "aws:PrincipalAccount" = local.account_id
          }
        }
      },
      # Allow application role access (limited to put for backup operations)
      {
        Sid       = "AllowApplicationBackups"
        Effect    = "Allow"
        Principal = {
          AWS = var.app_iam_role_arn
        }
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
        ]
      },
      # Allow backup role full access if specified
      dynamic "statement" {
        for_each = var.backup_iam_role_arn != "" ? [1] : []
        content {
          Sid       = "AllowBackupRoleAccess"
          Effect    = "Allow"
          Principal = {
            AWS = var.backup_iam_role_arn
          }
          Action = [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:GetObjectVersion",
            "s3:ListBucket"
          ]
          Resource = [
            aws_s3_bucket.backups.arn,
            "${aws_s3_bucket.backups.arn}/*"
          ]
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Audit Logs Bucket Policy (Strictest - Object Lock enabled)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "ScrybeAuditLogsBucketPolicy"
    Statement = [
      # Require TLS for all requests
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.audit_logs.arn,
          "${aws_s3_bucket.audit_logs.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      # Require encryption on upload
      {
        Sid       = "DenyUnencryptedUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.audit_logs.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      # Require specific KMS key
      {
        Sid       = "DenyWrongKMSKey"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.audit_logs.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption-aws-kms-key-id" = var.kms_key_arn
          }
        }
      },
      # Deny cross-account access
      {
        Sid       = "DenyCrossAccountAccess"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.audit_logs.arn,
          "${aws_s3_bucket.audit_logs.arn}/*"
        ]
        Condition = {
          StringNotEquals = {
            "aws:PrincipalAccount" = local.account_id
          }
        }
      },
      # Deny deletion (Object Lock provides this, but belt and suspenders)
      {
        Sid       = "DenyObjectDeletion"
        Effect    = "Deny"
        Principal = "*"
        Action = [
          "s3:DeleteObject",
          "s3:DeleteObjectVersion"
        ]
        Resource  = "${aws_s3_bucket.audit_logs.arn}/*"
      },
      # Allow application write-only access (append only for audit logs)
      {
        Sid       = "AllowApplicationWriteOnly"
        Effect    = "Allow"
        Principal = {
          AWS = var.app_iam_role_arn
        }
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.audit_logs.arn,
          "${aws_s3_bucket.audit_logs.arn}/*"
        ]
      }
    ]
  })
}
