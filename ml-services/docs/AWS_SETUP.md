# AWS Infrastructure Setup Guide

This guide walks through deploying ml-services to AWS ECS Fargate.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform >= 1.5.0 installed
- An existing VPC with public/private subnets
- A domain name and ACM certificate for HTTPS
- GitHub repository access for CI/CD

---

## Step 1: Prepare AWS Account

### 1.1 Create S3 Backend for Terraform State

```bash
# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket inkra-terraform-state \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket inkra-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### 1.2 Create IAM Role for GitHub Actions

```bash
# Create OIDC provider for GitHub Actions
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create the trust policy (save as trust-policy.json)
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:DeltaV93/scribe:*"
        }
      }
    }
  ]
}
EOF

# Replace ACCOUNT_ID with your AWS account ID
sed -i '' "s/ACCOUNT_ID/$(aws sts get-caller-identity --query Account --output text)/g" trust-policy.json

# Create the role
aws iam create-role \
  --role-name github-actions-ml-services \
  --assume-role-policy-document file://trust-policy.json

# Attach necessary policies
aws iam attach-role-policy \
  --role-name github-actions-ml-services \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess

aws iam attach-role-policy \
  --role-name github-actions-ml-services \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-role-policy \
  --role-name github-actions-ml-services \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

### 1.3 Get Your VPC Information

```bash
# List VPCs
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,Tags[?Key==`Name`].Value|[0]]' --output table

# Get your VPC ID (replace with your VPC)
export VPC_ID="vpc-xxxxxxxxx"

# Get private subnet IDs (tagged with Tier=private)
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Tier,Values=private" \
  --query 'Subnets[*].SubnetId' --output text

# Get public subnet IDs (tagged with Tier=public)
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Tier,Values=public" \
  --query 'Subnets[*].SubnetId' --output text
```

> **Note:** If your subnets aren't tagged, add tags:
> ```bash
> aws ec2 create-tags --resources subnet-xxx --tags Key=Tier,Value=private
> aws ec2 create-tags --resources subnet-yyy --tags Key=Tier,Value=public
> ```

### 1.4 Create or Get ACM Certificate

```bash
# Request a certificate (if you don't have one)
aws acm request-certificate \
  --domain-name ml.inkra.io \
  --validation-method DNS \
  --region us-east-1

# List certificates to get ARN
aws acm list-certificates --query 'CertificateSummaryList[*].[DomainName,CertificateArn]' --output table
```

---

## Step 2: Configure Terraform

### 2.1 Create Backend Configuration

```bash
cd ml-services/terraform

# Create backend config for prod
cat > environments/prod/backend.tfvars << 'EOF'
bucket         = "inkra-terraform-state"
key            = "ml-services/prod/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "terraform-locks"
encrypt        = true
EOF
```

### 2.2 Update Environment Variables

Edit `environments/prod/terraform.tfvars`:

```hcl
environment = "prod"
aws_region  = "us-east-1"

# Replace with your actual VPC ID
vpc_id = "vpc-0123456789abcdef0"

# RDS Configuration
rds_instance_class    = "db.t3.medium"
rds_allocated_storage = 50

# Redis Configuration
redis_node_type = "cache.t3.medium"

# ECS - API Service
api_cpu           = 512
api_memory        = 1024
api_desired_count = 2

# ECS - Worker Service
worker_cpu           = 1024
worker_memory        = 2048
worker_desired_count = 2

# Container
image_tag = "latest"

# Replace with your ACM certificate ARN
certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Replace with your domain
domain_name = "ml.inkra.io"
```

### 2.3 Generate Service API Key

```bash
# Generate a secure API key
export ML_SERVICE_API_KEY=$(openssl rand -base64 32)
echo "ML_SERVICE_API_KEY: $ML_SERVICE_API_KEY"

# Save this securely - you'll need it for:
# 1. Terraform (TF_VAR_service_api_key)
# 2. Next.js app environment
```

---

## Step 3: Deploy Infrastructure

### 3.1 Initialize Terraform

```bash
cd ml-services/terraform

# Initialize with backend config
terraform init -backend-config=environments/prod/backend.tfvars
```

### 3.2 Plan and Review

```bash
# Set the API key
export TF_VAR_service_api_key="$ML_SERVICE_API_KEY"

# Plan the deployment
terraform plan -var-file=environments/prod/terraform.tfvars -out=tfplan

# Review the plan carefully!
```

### 3.3 Apply Infrastructure

```bash
# Apply the plan
terraform apply tfplan

# Note the outputs:
# - api_endpoint: https://ml.inkra.io
# - ecr_repository_url: 123456789012.dkr.ecr.us-east-1.amazonaws.com/inkra-ml-services-prod
# - rds_endpoint: ml-services-prod.xxxxx.us-east-1.rds.amazonaws.com:5432
```

### 3.4 Configure DNS

Add a CNAME record pointing your domain to the ALB:

```bash
# Get ALB DNS name
aws elbv2 describe-load-balancers \
  --names ml-services-prod \
  --query 'LoadBalancers[0].DNSName' --output text

# Add DNS record:
# ml.inkra.io -> CNAME -> ml-services-prod-xxxxx.us-east-1.elb.amazonaws.com
```

---

## Step 4: Build and Push Initial Image

### 4.1 Build Docker Image

```bash
cd ml-services

# Get ECR repository URL from Terraform output
export ECR_REPO=$(cd terraform && terraform output -raw ecr_repository_url)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO

# Build the image
docker build -f docker/Dockerfile -t $ECR_REPO:latest --target production .

# Push to ECR
docker push $ECR_REPO:latest
```

### 4.2 Run Database Migrations

```bash
# Get the task definition ARN
TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition ml-services-api-prod \
  --query 'taskDefinition.taskDefinitionArn' --output text)

# Get subnet and security group IDs
SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Tier,Values=private" \
  --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')

SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=ml-services-ecs-prod" \
  --query 'SecurityGroups[0].GroupId' --output text)

# Run migration task
aws ecs run-task \
  --cluster ml-services-prod \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["alembic","upgrade","head"]}]}'
```

### 4.3 Seed Compliance Frameworks

```bash
# Run seed script via ECS task
aws ecs run-task \
  --cluster ml-services-prod \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["python","scripts/seed_frameworks.py"]}]}'
```

---

## Step 5: Configure GitHub Actions

### 5.1 Add Repository Secrets

Go to GitHub → Repository → Settings → Secrets and variables → Actions

Add the following secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AWS_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/github-actions-ml-services` | IAM role for GitHub Actions |
| `PRIVATE_SUBNET_IDS` | `subnet-xxx,subnet-yyy` | Comma-separated private subnet IDs |
| `ECS_SECURITY_GROUP` | `sg-xxxxxxxxx` | ECS service security group ID |

### 5.2 Verify CI/CD

Push a change to `ml-services/` and verify the GitHub Actions workflow runs:

1. Lint & Type Check
2. Test (with testcontainers)
3. Build & Push to ECR
4. Deploy to ECS
5. Run Migrations

---

## Step 6: Verify Deployment

### 6.1 Health Check

```bash
# Check health endpoint
curl https://ml.inkra.io/healthz
# Expected: {"status":"ok"}

# Check readiness
curl https://ml.inkra.io/readyz
# Expected: {"status":"ok","db":"connected","redis":"connected"}
```

### 6.2 Test API

```bash
# Test with API key
curl -H "X-Service-API-Key: $ML_SERVICE_API_KEY" \
  https://ml.inkra.io/v1/models
```

### 6.3 Check Logs

```bash
# View API logs
aws logs tail /ecs/ml-services-prod --follow --filter-pattern "api"

# View worker logs
aws logs tail /ecs/ml-services-prod --follow --filter-pattern "worker"
```

---

## Troubleshooting

### ECS Tasks Not Starting

```bash
# Check stopped task reasons
aws ecs describe-tasks \
  --cluster ml-services-prod \
  --tasks $(aws ecs list-tasks --cluster ml-services-prod --desired-status STOPPED --query 'taskArns[0]' --output text) \
  --query 'tasks[0].stoppedReason'
```

### Database Connection Issues

```bash
# Verify security group allows traffic from ECS
aws ec2 describe-security-groups \
  --group-ids $(aws rds describe-db-instances --db-instance-identifier ml-services-prod --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text) \
  --query 'SecurityGroups[0].IpPermissions'
```

### Secrets Not Loading

```bash
# Verify secret exists
aws secretsmanager get-secret-value \
  --secret-id ml-services/prod \
  --query 'SecretString' --output text
```

---

## Cost Estimates (Monthly)

| Resource | Size | Estimated Cost |
|----------|------|----------------|
| ECS Fargate (API x2) | 0.5 vCPU, 1GB | ~$30 |
| ECS Fargate (Worker x2) | 1 vCPU, 2GB | ~$60 |
| RDS PostgreSQL | db.t3.medium | ~$50 |
| ElastiCache Redis | cache.t3.medium | ~$45 |
| ALB | Standard | ~$20 |
| S3 (models + audit) | Variable | ~$5-20 |
| **Total** | | **~$210-225/mo** |

---

## Next Steps

1. Set up monitoring dashboards in Grafana
2. Configure alerts in CloudWatch
3. Set up log retention policies
4. Enable AWS Backup for RDS
5. Configure WAF rules on ALB (optional)
