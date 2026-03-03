# CloudWatch Monitoring Module for ML Services
# Includes alarms for ECS, RDS, ElastiCache, ALB, and application metrics

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "ecs_api_service_name" {
  description = "ECS API service name"
  type        = string
}

variable "ecs_worker_service_name" {
  description = "ECS Worker service name"
  type        = string
}

variable "rds_instance_identifier" {
  description = "RDS instance identifier"
  type        = string
}

variable "elasticache_cluster_id" {
  description = "ElastiCache cluster ID"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Target group ARN suffix"
  type        = string
}

variable "api_desired_count" {
  description = "Desired API task count"
  type        = number
  default     = 2
}

variable "worker_desired_count" {
  description = "Desired worker task count"
  type        = number
  default     = 2
}

variable "rds_max_connections" {
  description = "Max RDS connections (for percentage calculation)"
  type        = number
  default     = 100
}

variable "alarm_email" {
  description = "Email address for alarm notifications"
  type        = string
  default     = ""
}

variable "enable_slack_integration" {
  description = "Enable Slack integration for alarms"
  type        = bool
  default     = false
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}

# Local values
locals {
  alarm_prefix = "ml-services-${var.environment}"

  default_tags = merge(
    {
      Component   = "monitoring"
      Environment = var.environment
      Service     = "ml-services"
    },
    var.tags
  )
}

# =============================================================================
# SNS Topics
# =============================================================================

resource "aws_sns_topic" "alarms" {
  name = "${local.alarm_prefix}-alarms"
  tags = local.default_tags
}

resource "aws_sns_topic" "critical_alarms" {
  name = "${local.alarm_prefix}-critical-alarms"
  tags = local.default_tags
}

# Email subscription (if provided)
resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_sns_topic_subscription" "critical_email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.critical_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# =============================================================================
# ECS Alarms
# =============================================================================

# API Service - CPU High
resource "aws_cloudwatch_metric_alarm" "ecs_api_cpu_high" {
  alarm_name          = "${local.alarm_prefix}-ecs-api-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS API service CPU utilization above 80%"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_api_service_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# API Service - Memory High
resource "aws_cloudwatch_metric_alarm" "ecs_api_memory_high" {
  alarm_name          = "${local.alarm_prefix}-ecs-api-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS API service memory utilization above 80%"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_api_service_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# API Service - Task Count Low
resource "aws_cloudwatch_metric_alarm" "ecs_api_task_count_low" {
  alarm_name          = "${local.alarm_prefix}-ecs-api-task-count-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = var.api_desired_count
  alarm_description   = "ECS API service running fewer tasks than desired"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_api_service_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# API Service - No Running Tasks (Critical)
resource "aws_cloudwatch_metric_alarm" "ecs_api_no_tasks" {
  alarm_name          = "${local.alarm_prefix}-ecs-api-no-tasks"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "CRITICAL: No ECS API tasks running"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_api_service_name
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = local.default_tags
}

# Worker Service - CPU High
resource "aws_cloudwatch_metric_alarm" "ecs_worker_cpu_high" {
  alarm_name          = "${local.alarm_prefix}-ecs-worker-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS Worker service CPU utilization above 80%"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_worker_service_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# Worker Service - Memory High
resource "aws_cloudwatch_metric_alarm" "ecs_worker_memory_high" {
  alarm_name          = "${local.alarm_prefix}-ecs-worker-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS Worker service memory utilization above 80%"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_worker_service_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# Worker Service - No Running Tasks (Critical)
resource "aws_cloudwatch_metric_alarm" "ecs_worker_no_tasks" {
  alarm_name          = "${local.alarm_prefix}-ecs-worker-no-tasks"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "CRITICAL: No ECS Worker tasks running"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_worker_service_name
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = local.default_tags
}

# =============================================================================
# RDS Alarms
# =============================================================================

# RDS - CPU High
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${local.alarm_prefix}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization above 80%"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# RDS - Free Storage Low
resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "${local.alarm_prefix}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240  # 10 GB in bytes
  alarm_description   = "RDS free storage below 10GB"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = local.default_tags
}

# RDS - Connection Count High
resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${local.alarm_prefix}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_max_connections * 0.8
  alarm_description   = "RDS connection count above 80% of max"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# RDS - Read Latency High
resource "aws_cloudwatch_metric_alarm" "rds_read_latency_high" {
  alarm_name          = "${local.alarm_prefix}-rds-read-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 0.1  # 100ms
  alarm_description   = "RDS read latency above 100ms"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# RDS - Write Latency High
resource "aws_cloudwatch_metric_alarm" "rds_write_latency_high" {
  alarm_name          = "${local.alarm_prefix}-rds-write-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "WriteLatency"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 0.1  # 100ms
  alarm_description   = "RDS write latency above 100ms"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# =============================================================================
# ElastiCache Alarms
# =============================================================================

# Redis - Memory High
resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "${local.alarm_prefix}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis memory usage above 80%"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# Redis - CPU High
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "${local.alarm_prefix}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis CPU utilization above 80%"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# Redis - Evictions
resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  alarm_name          = "${local.alarm_prefix}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Redis is evicting keys"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# Redis - Current Connections High
resource "aws_cloudwatch_metric_alarm" "redis_connections_high" {
  alarm_name          = "${local.alarm_prefix}-redis-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 100
  alarm_description   = "Redis connection count high"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# =============================================================================
# ALB Alarms
# =============================================================================

# ALB - Target Response Time High
resource "aws_cloudwatch_metric_alarm" "alb_response_time_high" {
  alarm_name          = "${local.alarm_prefix}-alb-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 1  # 1 second
  alarm_description   = "ALB target response time above 1 second"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# ALB - Unhealthy Host Count
resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "${local.alarm_prefix}-alb-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "ALB has unhealthy hosts"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = local.default_tags
}

# ALB - 5xx Count High
resource "aws_cloudwatch_metric_alarm" "alb_5xx_count_high" {
  alarm_name          = "${local.alarm_prefix}-alb-5xx-count-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "ALB 5xx error count above threshold"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# =============================================================================
# Application-Level Alarms (Custom Metrics)
# =============================================================================

# Application - Error Rate High
resource "aws_cloudwatch_metric_alarm" "app_error_rate_high" {
  alarm_name          = "${local.alarm_prefix}-app-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2

  metric_query {
    id          = "error_rate"
    expression  = "errors/requests*100"
    label       = "Error Rate"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "5xxCount"
      namespace   = "Inkra/MLServices"
      period      = 300
      stat        = "Sum"
      dimensions = {
        Environment = var.environment
      }
    }
  }

  metric_query {
    id = "requests"
    metric {
      metric_name = "RequestCount"
      namespace   = "Inkra/MLServices"
      period      = 300
      stat        = "Sum"
      dimensions = {
        Environment = var.environment
      }
    }
  }

  threshold         = 1  # 1%
  alarm_description = "Application 5xx error rate above 1%"

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = local.default_tags
}

# Application - Latency P99 High
resource "aws_cloudwatch_metric_alarm" "app_latency_p99_high" {
  alarm_name          = "${local.alarm_prefix}-app-latency-p99-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "LatencyP99"
  namespace           = "Inkra/MLServices"
  period              = 60
  extended_statistic  = "p99"
  threshold           = 2000  # 2 seconds in ms
  alarm_description   = "Application p99 latency above 2 seconds"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = local.default_tags
}

# Application - Health Check Failures
resource "aws_cloudwatch_metric_alarm" "app_health_check_failures" {
  alarm_name          = "${local.alarm_prefix}-app-health-check-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthCheckFailures"
  namespace           = "Inkra/MLServices"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Application health check failures detected"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = local.default_tags
}

# =============================================================================
# CloudWatch Dashboard
# =============================================================================

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.alarm_prefix}-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# ML Services Dashboard - ${var.environment}"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 6
        height = 6
        properties = {
          title  = "ECS API CPU"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_api_service_name]
          ]
          period = 300
          stat   = "Average"
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 1
        width  = 6
        height = 6
        properties = {
          title  = "ECS API Memory"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_api_service_name]
          ]
          period = 300
          stat   = "Average"
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 1
        width  = 6
        height = 6
        properties = {
          title  = "RDS CPU"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_identifier]
          ]
          period = 300
          stat   = "Average"
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 1
        width  = 6
        height = 6
        properties = {
          title  = "Redis Memory"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "CacheClusterId", var.elasticache_cluster_id]
          ]
          period = 300
          stat   = "Average"
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 7
        width  = 12
        height = 6
        properties = {
          title  = "ALB Response Time"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix]
          ]
          period = 60
          stat   = "Average"
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 7
        width  = 12
        height = 6
        properties = {
          title  = "ALB Request Count & Errors"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix],
            [".", "HTTPCode_Target_5XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."]
          ]
          period = 60
          stat   = "Sum"
          view   = "timeSeries"
        }
      }
    ]
  })
}

# Data source for region
data "aws_region" "current" {}

# =============================================================================
# Outputs
# =============================================================================

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alarms"
  value       = aws_sns_topic.alarms.arn
}

output "critical_sns_topic_arn" {
  description = "ARN of the SNS topic for critical alarms"
  value       = aws_sns_topic.critical_alarms.arn
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}
