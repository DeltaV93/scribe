# Development Environment Configuration

environment = "dev"
aws_region  = "us-east-1"

# VPC - Update with your actual VPC ID
vpc_id = "vpc-xxxxxxxxx"

# RDS - Smaller for dev
rds_instance_class    = "db.t3.small"
rds_allocated_storage = 20

# Redis - Smaller for dev
redis_node_type = "cache.t3.small"

# ECS - API (minimal for dev)
api_cpu           = 256
api_memory        = 512
api_desired_count = 1

# ECS - Worker (minimal for dev)
worker_cpu           = 512
worker_memory        = 1024
worker_desired_count = 1

# Container
image_tag = "latest"

# SSL/Domain - Update with your actual values
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"
domain_name     = "ml-dev.inkra.io"

# service_api_key - Set via TF_VAR_service_api_key environment variable
