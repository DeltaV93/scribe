# Inkra Terraform Infrastructure

This directory contains Terraform configurations for deploying Inkra's production infrastructure on AWS.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION (AWS)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │   Route53    │──────┐                                                    │
│  │   DNS        │      │                                                    │
│  └──────────────┘      │                                                    │
│                        ▼                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        VPC (10.0.0.0/16)                               │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    PUBLIC SUBNETS (3 AZs)                        │  │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │  │ │
│  │  │  │ ALB         │  │ NAT GW      │  │ NAT GW      │              │  │ │
│  │  │  │ (HTTPS)     │  │ (AZ-a)      │  │ (AZ-b,c)    │              │  │ │
│  │  │  └──────┬──────┘  └─────────────┘  └─────────────┘              │  │ │
│  │  └─────────┼───────────────────────────────────────────────────────┘  │ │
│  │            │                                                           │ │
│  │  ┌─────────┼───────────────────────────────────────────────────────┐  │ │
│  │  │         │          PRIVATE SUBNETS (3 AZs)                       │  │ │
│  │  │         ▼                                                         │  │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │  │ │
│  │  │  │ ECS Fargate │  │ ECS Fargate │  │ ECS Fargate │              │  │ │
│  │  │  │ ML API      │  │ ML Worker   │  │ ClamAV      │              │  │ │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘              │  │ │
│  │  │                                                                   │  │ │
│  │  │  ┌─────────────────────────────┐                                 │  │ │
│  │  │  │ ElastiCache Redis Cluster   │                                 │  │ │
│  │  │  │ (Multi-AZ, TLS, Auth)       │                                 │  │ │
│  │  │  └─────────────────────────────┘                                 │  │ │
│  │  └───────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    DATABASE SUBNETS (3 AZs)                        │  │ │
│  │  │  ┌─────────────────────────────────────────────────────────────┐  │  │ │
│  │  │  │ Aurora PostgreSQL 16 (Multi-AZ, Serverless v2)              │  │  │ │
│  │  │  │ + pgvector extension                                         │  │  │ │
│  │  │  └─────────────────────────────────────────────────────────────┘  │  │ │
│  │  └───────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     S3 BUCKETS (KMS Encrypted)                         │  │
│  │  uploads | recordings | exports | backups | audit-logs | access-logs   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     KMS KEYS (Customer Managed)                        │  │
│  │  primary | rds | elasticache | secrets                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     MONITORING (CloudWatch)                            │  │
│  │  Dashboard | Alarms (critical/warning/info) | SNS Topics               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Structure

```
infrastructure/terraform/
├── README.md           # This file
├── kms/                # KMS encryption keys
│   ├── main.tf
│   └── environments/
│       ├── development.tfvars
│       ├── staging.tfvars
│       └── production.tfvars
├── vpc/                # VPC, subnets, security groups
│   └── main.tf
├── rds/                # Aurora PostgreSQL
│   └── main.tf
├── elasticache/        # Redis cluster
│   └── main.tf
├── ecs/                # Fargate cluster and services
│   └── main.tf
├── alb/                # Application Load Balancer
│   └── main.tf
└── monitoring/         # CloudWatch dashboards and alarms
    └── main.tf
```

## Prerequisites

1. **Terraform CLI** (>= 1.5.0)
   ```bash
   brew install terraform  # macOS
   ```

2. **AWS CLI** configured with appropriate credentials
   ```bash
   aws configure
   ```

3. **AWS Account** with:
   - HIPAA BAA (if handling PHI)
   - Domain in Route53 (or ready to configure DNS)
   - ACM certificate for `*.inkra.app`

## Deployment Order

Infrastructure must be deployed in this order due to dependencies:

1. **KMS** - Keys needed by all other resources
2. **VPC** - Networking needed by all services
3. **RDS** - Database (depends on VPC, KMS)
4. **ElastiCache** - Cache (depends on VPC, KMS)
5. **ECS** - Compute (depends on VPC, KMS, needs DB/Redis connection strings)
6. **ALB** - Load balancer (depends on VPC, ECS)
7. **Monitoring** - Dashboards/alarms (depends on all above)

## Quick Start

### 1. Create tfvars files

Copy example files and fill in your values:

```bash
cd infrastructure/terraform

# For each module
cp kms/environments/production.tfvars.example kms/environments/production.tfvars
# Edit with your values
```

### 2. Initialize and Apply KMS

```bash
cd kms
terraform init
terraform plan -var-file=environments/production.tfvars
terraform apply -var-file=environments/production.tfvars

# Note the outputs
terraform output kms_key_arn
```

### 3. Initialize and Apply VPC

```bash
cd ../vpc
terraform init
terraform plan -var="environment=prod"
terraform apply -var="environment=prod"

# Note the outputs
terraform output private_subnet_ids
terraform output rds_security_group_id
```

### 4. Apply Remaining Modules

Continue with RDS, ElastiCache, ECS, ALB, and Monitoring in order.

## Environment-Specific Configuration

### Production

```hcl
environment = "prod"
enable_nat_gateway = true
single_nat_gateway = false  # One per AZ for HA
deletion_protection = true
enable_performance_insights = true
```

### Staging

```hcl
environment = "staging"
enable_nat_gateway = true
single_nat_gateway = true  # Cost savings
deletion_protection = false
enable_performance_insights = true
```

### Development

```hcl
environment = "dev"
enable_nat_gateway = true
single_nat_gateway = true
deletion_protection = false
enable_performance_insights = false
```

## State Management

For production, use remote state with S3 backend:

```hcl
terraform {
  backend "s3" {
    bucket         = "inkra-terraform-state"
    key            = "MODULE_NAME/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "inkra-terraform-locks"
  }
}
```

### Setting Up Remote State

```bash
# Create S3 bucket for state
aws s3 mb s3://inkra-terraform-state --region us-west-2

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket inkra-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for locks
aws dynamodb create-table \
  --table-name inkra-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

## Outputs Reference

### VPC Module

| Output | Description |
|--------|-------------|
| `vpc_id` | VPC ID |
| `public_subnet_ids` | List of public subnet IDs |
| `private_subnet_ids` | List of private subnet IDs |
| `database_subnet_ids` | List of database subnet IDs |
| `alb_security_group_id` | ALB security group ID |
| `ecs_tasks_security_group_id` | ECS tasks security group ID |
| `rds_security_group_id` | RDS security group ID |
| `elasticache_security_group_id` | ElastiCache security group ID |
| `db_subnet_group_name` | Database subnet group name |
| `elasticache_subnet_group_name` | ElastiCache subnet group name |

### RDS Module

| Output | Description |
|--------|-------------|
| `cluster_endpoint` | Aurora cluster endpoint (writer) |
| `cluster_reader_endpoint` | Aurora cluster reader endpoint |
| `credentials_secret_arn` | Secrets Manager ARN for credentials |

### ElastiCache Module

| Output | Description |
|--------|-------------|
| `primary_endpoint_address` | Redis primary endpoint |
| `auth_token_secret_arn` | Secrets Manager ARN for auth token |

### ECS Module

| Output | Description |
|--------|-------------|
| `cluster_name` | ECS cluster name |
| `ecr_repository_url` | ECR repository URL |
| `task_role_arn` | ECS task role ARN |
| `clamav_endpoint` | ClamAV internal endpoint |

### ALB Module

| Output | Description |
|--------|-------------|
| `alb_dns_name` | ALB DNS name |
| `ml_services_target_group_arn` | ML Services target group ARN |

## Security Considerations

- All resources use KMS customer-managed keys
- S3 buckets block public access
- RDS/ElastiCache only accessible from ECS
- VPC Flow Logs enabled
- CloudTrail enabled for KMS operations
- Secrets stored in Secrets Manager
- TLS required for all connections

## Compliance

This infrastructure is designed for:
- HIPAA compliance (with signed BAA)
- SOC 2 Type II compliance

Key controls:
- Encryption at rest (KMS)
- Encryption in transit (TLS 1.3)
- Access logging
- Audit trails
- Multi-AZ deployment
- Automated backups
- Network isolation

## Troubleshooting

### Common Issues

**"Access Denied" on S3**
- Verify KMS key policy allows the IAM role
- Check bucket policy requires KMS encryption

**RDS Connection Failures**
- Verify security group allows traffic from ECS
- Check SSL is required (`sslmode=require`)

**ECS Task Failures**
- Check CloudWatch logs for container errors
- Verify Secrets Manager permissions

### Useful Commands

```bash
# Check VPC endpoint status
aws ec2 describe-vpc-endpoints --filters Name=vpc-id,Values=vpc-xxx

# Check RDS cluster status
aws rds describe-db-clusters --db-cluster-identifier inkra-prod

# Check ECS service status
aws ecs describe-services --cluster inkra-prod --services ml-services-api

# Check ALB health
aws elbv2 describe-target-health --target-group-arn arn:aws:...
```

## Related Documentation

- [Infrastructure Launch Checklist](../../docs/deployment/INFRASTRUCTURE_LAUNCH_CHECKLIST.md)
- [Service Isolation Guide](../../docs/deployment/SERVICE_ISOLATION.md)
- [Production Decisions](../../docs/architecture/PRODUCTION_DECISIONS.md)
- [Railway Demo Setup](../../docs/deployment/RAILWAY_DEMO_SETUP.md)
