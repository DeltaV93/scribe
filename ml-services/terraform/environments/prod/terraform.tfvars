# Production Environment Configuration
# Note: Sensitive values should be passed via TF_VAR_* environment variables

environment = "prod"
aws_region  = "us-east-1"

# VPC - Update with your actual VPC ID
vpc_id = "vpc-xxxxxxxxx"

# RDS
rds_instance_class    = "db.t3.medium"
rds_allocated_storage = 50

# Redis
redis_node_type = "cache.t3.medium"

# ECS - API
api_cpu           = 512
api_memory        = 1024
api_desired_count = 2

# ECS - Worker
worker_cpu           = 1024
worker_memory        = 2048
worker_desired_count = 2

# Container
image_tag = "latest"

# SSL/Domain - Update with your actual values
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"
domain_name     = "ml.inkra.io"

# service_api_key - Set via TF_VAR_service_api_key environment variable
