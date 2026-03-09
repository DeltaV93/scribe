# =============================================================================
# Inkra Infrastructure - CloudWatch Monitoring
# =============================================================================
# Dashboards, alarms, and SNS notifications for production monitoring
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration - uncomment for production
  # backend "s3" {
  #   bucket         = "inkra-terraform-state"
  #   key            = "monitoring/terraform.tfstate"
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

variable "alarm_email_endpoints" {
  description = "List of email addresses for alarm notifications"
  type        = list(string)
  default     = []
}

variable "alarm_slack_webhook_url" {
  description = "Slack webhook URL for alarm notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch metrics"
  type        = string
}

variable "rds_cluster_identifier" {
  description = "RDS cluster identifier"
  type        = string
}

variable "elasticache_cluster_id" {
  description = "ElastiCache cluster ID"
  type        = string
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
# SNS Topics
# -----------------------------------------------------------------------------

resource "aws_sns_topic" "alerts_critical" {
  name         = "inkra-${var.environment}-alerts-critical"
  display_name = "Inkra Critical Alerts"

  tags = {
    Name     = "inkra-${var.environment}-alerts-critical"
    Severity = "critical"
  }
}

resource "aws_sns_topic" "alerts_warning" {
  name         = "inkra-${var.environment}-alerts-warning"
  display_name = "Inkra Warning Alerts"

  tags = {
    Name     = "inkra-${var.environment}-alerts-warning"
    Severity = "warning"
  }
}

resource "aws_sns_topic" "alerts_info" {
  name         = "inkra-${var.environment}-alerts-info"
  display_name = "Inkra Info Alerts"

  tags = {
    Name     = "inkra-${var.environment}-alerts-info"
    Severity = "info"
  }
}

# Email subscriptions
resource "aws_sns_topic_subscription" "critical_email" {
  count     = length(var.alarm_email_endpoints)
  topic_arn = aws_sns_topic.alerts_critical.arn
  protocol  = "email"
  endpoint  = var.alarm_email_endpoints[count.index]
}

resource "aws_sns_topic_subscription" "warning_email" {
  count     = length(var.alarm_email_endpoints)
  topic_arn = aws_sns_topic.alerts_warning.arn
  protocol  = "email"
  endpoint  = var.alarm_email_endpoints[count.index]
}

# -----------------------------------------------------------------------------
# ECS Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "inkra-${var.environment}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS cluster CPU utilization is high"
  alarm_actions       = [aws_sns_topic.alerts_warning.arn]
  ok_actions          = [aws_sns_topic.alerts_info.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
  }

  tags = {
    Name = "inkra-${var.environment}-ecs-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "inkra-${var.environment}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS cluster memory utilization is high"
  alarm_actions       = [aws_sns_topic.alerts_warning.arn]
  ok_actions          = [aws_sns_topic.alerts_info.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
  }

  tags = {
    Name = "inkra-${var.environment}-ecs-memory-alarm"
  }
}

# -----------------------------------------------------------------------------
# ALB Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "alb_5xx_critical" {
  alarm_name          = "inkra-${var.environment}-alb-5xx-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "CRITICAL: High rate of 5xx errors from ALB"
  alarm_actions       = [aws_sns_topic.alerts_critical.arn]
  ok_actions          = [aws_sns_topic.alerts_info.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = {
    Name     = "inkra-${var.environment}-alb-5xx-critical"
    Severity = "critical"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_latency_high" {
  alarm_name          = "inkra-${var.environment}-alb-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 2.0 # 2 seconds p95
  alarm_description   = "ALB p95 latency is very high"
  alarm_actions       = [aws_sns_topic.alerts_warning.arn]
  ok_actions          = [aws_sns_topic.alerts_info.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = {
    Name = "inkra-${var.environment}-alb-latency-alarm"
  }
}

# -----------------------------------------------------------------------------
# RDS Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "rds_cpu_critical" {
  alarm_name          = "inkra-${var.environment}-rds-cpu-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 90
  alarm_description   = "CRITICAL: RDS CPU utilization is very high"
  alarm_actions       = [aws_sns_topic.alerts_critical.arn]
  ok_actions          = [aws_sns_topic.alerts_info.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBClusterIdentifier = var.rds_cluster_identifier
  }

  tags = {
    Name     = "inkra-${var.environment}-rds-cpu-critical"
    Severity = "critical"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "inkra-${var.environment}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 200
  alarm_description   = "RDS connection count is high - potential connection leak"
  alarm_actions       = [aws_sns_topic.alerts_warning.arn]
  ok_actions          = [aws_sns_topic.alerts_info.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBClusterIdentifier = var.rds_cluster_identifier
  }

  tags = {
    Name = "inkra-${var.environment}-rds-connections-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "inkra-${var.environment}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240 # 10GB
  alarm_description   = "CRITICAL: RDS free storage is low"
  alarm_actions       = [aws_sns_topic.alerts_critical.arn]
  ok_actions          = [aws_sns_topic.alerts_info.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBClusterIdentifier = var.rds_cluster_identifier
  }

  tags = {
    Name     = "inkra-${var.environment}-rds-storage-alarm"
    Severity = "critical"
  }
}

# -----------------------------------------------------------------------------
# ElastiCache Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "redis_memory_critical" {
  alarm_name          = "inkra-${var.environment}-redis-memory-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 90
  alarm_description   = "CRITICAL: Redis memory utilization is very high"
  alarm_actions       = [aws_sns_topic.alerts_critical.arn]
  ok_actions          = [aws_sns_topic.alerts_info.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = "${var.elasticache_cluster_id}-001"
  }

  tags = {
    Name     = "inkra-${var.environment}-redis-memory-critical"
    Severity = "critical"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  alarm_name          = "inkra-${var.environment}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 1000
  alarm_description   = "Redis is evicting keys - memory pressure"
  alarm_actions       = [aws_sns_topic.alerts_warning.arn]
  ok_actions          = [aws_sns_topic.alerts_info.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = "${var.elasticache_cluster_id}-001"
  }

  tags = {
    Name = "inkra-${var.environment}-redis-evictions-alarm"
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Dashboard
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "inkra-${var.environment}-overview"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: ECS Overview
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# Inkra ${upper(var.environment)} - System Overview"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "ECS CPU Utilization"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, { stat = "Average" }]
          ]
          period = 300
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "ECS Memory Utilization"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, { stat = "Average" }]
          ]
          period = 300
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "ECS Running Tasks"
          view   = "singleValue"
          region = var.aws_region
          metrics = [
            ["ECS/ContainerInsights", "RunningTaskCount", "ClusterName", var.ecs_cluster_name, { stat = "Average" }]
          ]
          period = 300
        }
      },

      # Row 2: ALB Metrics
      {
        type   = "metric"
        x      = 0
        y      = 7
        width  = 8
        height = 6
        properties = {
          title  = "ALB Request Count"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum" }]
          ]
          period = 60
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 7
        width  = 8
        height = 6
        properties = {
          title  = "ALB Response Time (p95)"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p95" }]
          ]
          period = 60
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 7
        width  = 8
        height = 6
        properties = {
          title  = "ALB Error Rate"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", color = "#d62728" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", color = "#ff7f0e" }],
            ["AWS/ApplicationELB", "HTTPCode_ELB_4XX_Count", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", color = "#bcbd22" }]
          ]
          period = 60
        }
      },

      # Row 3: Database Metrics
      {
        type   = "metric"
        x      = 0
        y      = 13
        width  = 8
        height = 6
        properties = {
          title  = "RDS CPU Utilization"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBClusterIdentifier", var.rds_cluster_identifier, { stat = "Average" }]
          ]
          period = 300
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 13
        width  = 8
        height = 6
        properties = {
          title  = "RDS Connections"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBClusterIdentifier", var.rds_cluster_identifier, { stat = "Average" }]
          ]
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 13
        width  = 8
        height = 6
        properties = {
          title  = "RDS Latency"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "ReadLatency", "DBClusterIdentifier", var.rds_cluster_identifier, { stat = "Average", color = "#2ca02c" }],
            ["AWS/RDS", "WriteLatency", "DBClusterIdentifier", var.rds_cluster_identifier, { stat = "Average", color = "#d62728" }]
          ]
          period = 300
        }
      },

      # Row 4: Redis Metrics
      {
        type   = "metric"
        x      = 0
        y      = 19
        width  = 8
        height = 6
        properties = {
          title  = "Redis Memory Usage"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "CacheClusterId", "${var.elasticache_cluster_id}-001", { stat = "Average" }]
          ]
          period = 300
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 19
        width  = 8
        height = 6
        properties = {
          title  = "Redis Connections"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "CurrConnections", "CacheClusterId", "${var.elasticache_cluster_id}-001", { stat = "Average" }]
          ]
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 19
        width  = 8
        height = 6
        properties = {
          title  = "Redis Cache Hits/Misses"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "CacheHits", "CacheClusterId", "${var.elasticache_cluster_id}-001", { stat = "Sum", color = "#2ca02c" }],
            ["AWS/ElastiCache", "CacheMisses", "CacheClusterId", "${var.elasticache_cluster_id}-001", { stat = "Sum", color = "#d62728" }]
          ]
          period = 300
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "sns_topic_critical_arn" {
  description = "SNS topic ARN for critical alerts"
  value       = aws_sns_topic.alerts_critical.arn
}

output "sns_topic_warning_arn" {
  description = "SNS topic ARN for warning alerts"
  value       = aws_sns_topic.alerts_warning.arn
}

output "sns_topic_info_arn" {
  description = "SNS topic ARN for info alerts"
  value       = aws_sns_topic.alerts_info.arn
}

output "dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}
