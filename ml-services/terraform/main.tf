# ML Services Infrastructure
# Terraform configuration for ECS Fargate deployment

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Configure in environments/{env}/backend.tfvars
    # bucket         = "inkra-terraform-state"
    # key            = "ml-services/{env}/terraform.tfstate"
    # region         = "us-east-1"
    # dynamodb_table = "terraform-locks"
    # encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "inkra-ml-services"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_vpc" "main" {
  id = var.vpc_id
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }

  tags = {
    Tier = "private"
  }
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }

  tags = {
    Tier = "public"
  }
}

# ECR Repository
module "ecr" {
  source = "./modules/ecr"

  repository_name = "inkra-ml-services"
  environment     = var.environment
}

# Secrets Manager
module "secrets" {
  source = "./modules/secrets"

  environment     = var.environment
  service_api_key = var.service_api_key
  database_url    = module.rds.connection_url
  redis_url       = module.redis.connection_url
}

# RDS PostgreSQL
module "rds" {
  source = "./modules/rds"

  environment        = var.environment
  vpc_id            = var.vpc_id
  subnet_ids        = data.aws_subnets.private.ids
  instance_class    = var.rds_instance_class
  allocated_storage = var.rds_allocated_storage
  database_name     = "ml_services"

  allowed_security_groups = [module.ecs.service_security_group_id]
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"

  environment   = var.environment
  vpc_id       = var.vpc_id
  subnet_ids   = data.aws_subnets.private.ids
  node_type    = var.redis_node_type

  allowed_security_groups = [module.ecs.service_security_group_id]
}

# ECS Cluster and Services
module "ecs" {
  source = "./modules/ecs"

  environment     = var.environment
  vpc_id         = var.vpc_id
  public_subnets = data.aws_subnets.public.ids
  private_subnets = data.aws_subnets.private.ids

  # Container configuration
  ecr_repository_url = module.ecr.repository_url
  image_tag         = var.image_tag

  # API Service
  api_cpu           = var.api_cpu
  api_memory        = var.api_memory
  api_desired_count = var.api_desired_count

  # Worker Service
  worker_cpu           = var.worker_cpu
  worker_memory        = var.worker_memory
  worker_desired_count = var.worker_desired_count

  # Secrets
  secrets_arn = module.secrets.secret_arn

  # Networking
  certificate_arn = var.certificate_arn
  domain_name    = var.domain_name
}

# S3 Buckets
resource "aws_s3_bucket" "models" {
  bucket = "inkra-ml-models-${var.environment}"
}

resource "aws_s3_bucket_versioning" "models" {
  bucket = aws_s3_bucket.models.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket" "audit" {
  bucket = "inkra-ml-audit-${var.environment}"
}

resource "aws_s3_bucket_lifecycle_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id

  rule {
    id     = "archive-old-events"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}

# Monitoring and Alerting
module "monitoring" {
  source = "./modules/monitoring"

  environment = var.environment

  # ECS
  ecs_cluster_name        = module.ecs.cluster_name
  ecs_api_service_name    = module.ecs.api_service_name
  ecs_worker_service_name = module.ecs.worker_service_name
  api_desired_count       = var.api_desired_count
  worker_desired_count    = var.worker_desired_count

  # RDS
  rds_instance_identifier = module.rds.instance_identifier

  # ElastiCache
  elasticache_cluster_id = module.redis.cluster_id

  # ALB
  alb_arn_suffix          = module.ecs.alb_arn_suffix
  target_group_arn_suffix = module.ecs.target_group_arn_suffix

  # Notifications
  alarm_email              = var.alarm_email
  enable_slack_integration = var.enable_slack_integration
  slack_webhook_url        = var.slack_webhook_url
}

# Outputs
output "api_endpoint" {
  description = "API endpoint URL"
  value       = module.ecs.api_endpoint
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = module.ecr.repository_url
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "monitoring_sns_topic_arn" {
  description = "SNS topic ARN for monitoring alarms"
  value       = module.monitoring.sns_topic_arn
}

output "monitoring_critical_sns_topic_arn" {
  description = "SNS topic ARN for critical monitoring alarms"
  value       = module.monitoring.critical_sns_topic_arn
}

output "cloudwatch_dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = module.monitoring.dashboard_name
}
