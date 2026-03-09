# =============================================================================
# Inkra Infrastructure - ElastiCache Redis
# =============================================================================
# HIPAA/SOC2 compliant Redis cluster with encryption and Multi-AZ
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Backend configuration - uncomment for production
  # backend "s3" {
  #   bucket         = "inkra-terraform-state"
  #   key            = "elasticache/terraform.tfstate"
  #   region         = "us-west-2"
  #   encrypt        = true
  #   dynamodb_table = "inkra-terraform-locks"
  # }
}

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "elasticache_subnet_group_name" {
  description = "ElastiCache subnet group name"
  type        = string
}

variable "elasticache_security_group_id" {
  description = "ElastiCache security group ID"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "num_cache_clusters" {
  description = "Number of cache clusters (nodes) in replication group"
  type        = number
  default     = 2
}

variable "parameter_group_family" {
  description = "Redis parameter group family"
  type        = string
  default     = "redis7"
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.1"
}

variable "port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = true
}

variable "at_rest_encryption_enabled" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
}

variable "transit_encryption_enabled" {
  description = "Enable encryption in transit"
  type        = bool
  default     = true
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 7
}

variable "snapshot_window" {
  description = "Daily snapshot window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Weekly maintenance window (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "apply_immediately" {
  description = "Apply changes immediately"
  type        = bool
  default     = false
}

variable "auto_minor_version_upgrade" {
  description = "Enable auto minor version upgrades"
  type        = bool
  default     = true
}

variable "notification_topic_arn" {
  description = "SNS topic ARN for notifications"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Provider
# -----------------------------------------------------------------------------

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Inkra"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "HIPAA-SOC2"
    }
  }
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

# -----------------------------------------------------------------------------
# Random Auth Token
# -----------------------------------------------------------------------------

resource "random_password" "auth_token" {
  length           = 64
  special          = true
  override_special = "!&#$^<>-"
}

# -----------------------------------------------------------------------------
# Secrets Manager - Store Auth Token
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "redis_auth" {
  name        = "inkra/${var.environment}/elasticache/auth-token"
  description = "Redis auth token for Inkra ${var.environment}"
  kms_key_id  = var.kms_key_arn

  tags = {
    Name = "inkra-${var.environment}-redis-auth"
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id = aws_secretsmanager_secret.redis_auth.id
  secret_string = jsonencode({
    auth_token = random_password.auth_token.result
    host       = aws_elasticache_replication_group.main.primary_endpoint_address
    port       = var.port
  })
}

# -----------------------------------------------------------------------------
# Parameter Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_parameter_group" "main" {
  name        = "inkra-${var.environment}-redis7"
  family      = var.parameter_group_family
  description = "Redis 7 parameter group for Inkra"

  # Memory management
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  # Disable dangerous commands
  parameter {
    name  = "rename-command-FLUSHALL"
    value = ""
  }

  parameter {
    name  = "rename-command-FLUSHDB"
    value = ""
  }

  parameter {
    name  = "rename-command-DEBUG"
    value = ""
  }

  # Persistence
  parameter {
    name  = "appendonly"
    value = "yes"
  }

  # Timeout for idle connections
  parameter {
    name  = "timeout"
    value = "300"
  }

  # TCP keepalive
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = {
    Name = "inkra-${var.environment}-redis7"
  }
}

# -----------------------------------------------------------------------------
# Replication Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "inkra-${var.environment}"
  description          = "Redis cluster for Inkra ${var.environment}"

  # Engine
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_clusters
  port                 = var.port
  parameter_group_name = aws_elasticache_parameter_group.main.name

  # Networking
  subnet_group_name  = var.elasticache_subnet_group_name
  security_group_ids = [var.elasticache_security_group_id]

  # High availability
  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled           = var.multi_az_enabled

  # Encryption
  at_rest_encryption_enabled = var.at_rest_encryption_enabled
  kms_key_id                 = var.at_rest_encryption_enabled ? var.kms_key_arn : null
  transit_encryption_enabled = var.transit_encryption_enabled
  auth_token                 = var.transit_encryption_enabled ? random_password.auth_token.result : null

  # Backups
  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window          = var.snapshot_window

  # Maintenance
  maintenance_window         = var.maintenance_window
  auto_minor_version_upgrade = var.auto_minor_version_upgrade
  apply_immediately          = var.apply_immediately

  # Notifications
  notification_topic_arn = var.notification_topic_arn != "" ? var.notification_topic_arn : null

  tags = {
    Name = "inkra-${var.environment}-redis"
  }

  lifecycle {
    ignore_changes = [
      auth_token,
    ]
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "inkra-${var.environment}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis CPU utilization is high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.id}-001"
  }

  tags = {
    Name = "inkra-${var.environment}-redis-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "memory_high" {
  alarm_name          = "inkra-${var.environment}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis memory utilization is high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.id}-001"
  }

  tags = {
    Name = "inkra-${var.environment}-redis-memory-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "evictions" {
  alarm_name          = "inkra-${var.environment}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "Redis is evicting keys - memory pressure"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.id}-001"
  }

  tags = {
    Name = "inkra-${var.environment}-redis-evictions-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "connections_high" {
  alarm_name          = "inkra-${var.environment}-redis-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 1000
  alarm_description   = "Redis connection count is high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.id}-001"
  }

  tags = {
    Name = "inkra-${var.environment}-redis-connections-alarm"
  }
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "replication_group_id" {
  description = "ElastiCache replication group ID"
  value       = aws_elasticache_replication_group.main.id
}

output "primary_endpoint_address" {
  description = "Primary endpoint address"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint_address" {
  description = "Reader endpoint address"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = var.port
}

output "auth_token_secret_arn" {
  description = "Secrets Manager secret ARN for auth token"
  value       = aws_secretsmanager_secret.redis_auth.arn
}

output "connection_string" {
  description = "Redis connection string (TLS enabled)"
  value       = "rediss://:AUTH_TOKEN@${aws_elasticache_replication_group.main.primary_endpoint_address}:${var.port}"
  sensitive   = true
}

output "environment_variables" {
  description = "Environment variables for application configuration"
  value = <<-EOT
    # Redis Configuration
    REDIS_URL=rediss://:AUTH_TOKEN@${aws_elasticache_replication_group.main.primary_endpoint_address}:${var.port}
    REDIS_HOST=${aws_elasticache_replication_group.main.primary_endpoint_address}
    REDIS_PORT=${var.port}
    REDIS_TLS=true

    # Reader endpoint for read-heavy operations (optional)
    REDIS_READER_URL=rediss://:AUTH_TOKEN@${aws_elasticache_replication_group.main.reader_endpoint_address}:${var.port}
  EOT
  sensitive = true
}
