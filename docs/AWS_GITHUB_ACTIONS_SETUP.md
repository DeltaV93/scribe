# AWS + GitHub Actions Setup for HIPAA-Compliant CI/CD

This guide sets up a secure CI/CD pipeline using **ECS Fargate** with VPC endpoints for HIPAA compliance:
- **No secrets stored in GitHub**
- GitHub authenticates to AWS via OIDC (no long-lived credentials)
- **Secrets Manager** (~$0.40/month): Rotating credentials (DB, API keys, auth tokens)
- **Parameter Store** (Free): Static build-time configuration
- **VPC Endpoints**: Private connectivity to AWS services (no internet traversal)
- Full audit trail via CloudTrail

## Architecture

```
GitHub Actions (build, 7GB RAM)
       │
       ▼ (OIDC auth - no stored credentials)
      AWS
       │
       ├──► Parameter Store (build-time config, free)
       │        └── NEXT_PUBLIC_* vars
       │
       ├──► ECR (Docker image storage)
       │
       └──► ECS Fargate (runtime)
              ├── Private subnets (no public IP)
              ├── VPC Endpoints (ECR, Secrets Manager, S3, Logs)
              ├── Application Load Balancer (public subnets)
              ├── Secrets Manager → rotating credentials
              └── Auto-scaling based on CPU
```

## Network Architecture (HIPAA Compliant)

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                         VPC                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              PUBLIC SUBNETS                          │    │
│  │  ┌─────────────┐    ┌─────────────────────────────┐ │    │
│  │  │ Internet    │    │ Application Load Balancer   │ │    │
│  │  │ Gateway     │◄───│ (ALB) - HTTPS termination   │ │    │
│  │  └─────────────┘    └─────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼ (port 3000)                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              PRIVATE SUBNETS                         │    │
│  │  ┌─────────────────┐    ┌─────────────────────────┐ │    │
│  │  │ ECS Fargate     │    │ VPC Endpoints           │ │    │
│  │  │ Tasks           │◄──►│ - ECR API/DKR           │ │    │
│  │  │ (inkra-web)     │    │ - Secrets Manager       │ │    │
│  │  └─────────────────┘    │ - CloudWatch Logs       │ │    │
│  │          │              │ - S3 (Gateway)          │ │    │
│  │          │              └─────────────────────────┘ │    │
│  │          ▼ (port 5432)                              │    │
│  │  ┌─────────────────┐                                │    │
│  │  │ RDS PostgreSQL  │                                │    │
│  │  │ (private only)  │                                │    │
│  │  └─────────────────┘                                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Cost Breakdown

| Service | Items | Cost |
|---------|-------|------|
| Secrets Manager | 1 secret (15+ key/value pairs in JSON) | ~$0.40/month |
| Parameter Store | ~4 parameters (build-time config) | Free (Standard tier) |
| VPC Endpoints | 4 Interface + 1 Gateway | ~$30/month |
| **Total Infrastructure** | | ~$30.40/month |

---

## Current Production Configuration

### AWS Account: 318928518060
### Region: us-east-2 (Ohio)

### Resource IDs

| Resource | ID/ARN |
|----------|--------|
| VPC | `vpc-0eb6ee9cd198ad718` |
| Private Subnet 1 (us-east-2a) | `subnet-06556239ea5b298fd` |
| Private Subnet 2 (us-east-2b) | `subnet-0cae9bde3531d89bd` |
| Public Subnet 1 (us-east-2a) | `subnet-068439ed67891abd9` |
| Public Subnet 2 (us-east-2b) | `subnet-0dda06e9cc3341bfa` |
| App Security Group | `sg-00e3f789895090238` (scrybe-app-sg) |
| ALB Security Group | `sg-0b22ed81096814b45` (inkra-alb-sg) |
| Internet Gateway | `igw-05390a6fc6fc4ae8b` |
| ECR Repository | `318928518060.dkr.ecr.us-east-2.amazonaws.com/inkra-web` |
| ECS Cluster | `default` |
| ECS Service | `inkra-prod` |
| ALB | `inkra-alb` |
| ALB DNS | `Internet-facing-1644845505.us-east-2.elb.amazonaws.com` |
| Target Group | `inkra-tg` |
| Secrets Manager Secret | `inkra/runtime-secrets-SIkCQf` |

### IAM Roles

| Role | Purpose |
|------|---------|
| `InkraECSTaskExecutionRole` | ECS task execution (pull images, get secrets) |
| `GitHubActionsInkraDeployRole` | GitHub Actions OIDC authentication |

### VPC Endpoints

| Endpoint | Service | Type |
|----------|---------|------|
| `inkra-secretsmanager-endpoint` | `com.amazonaws.us-east-2.secretsmanager` | Interface |
| `inkra-ecr-api-endpoint` | `com.amazonaws.us-east-2.ecr.api` | Interface |
| `inkra-ecr-dkr-endpoint` | `com.amazonaws.us-east-2.ecr.dkr` | Interface |
| `inkra-logs-endpoint` | `com.amazonaws.us-east-2.logs` | Interface |
| `inkra-s3-endpoint` | `com.amazonaws.us-east-2.s3` | Gateway |

---

## Step-by-Step Setup Guide

### Step 1: Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name inkra-web \
  --region us-east-2 \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256
```

### Step 2: Create OIDC Identity Provider for GitHub

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### Step 3: Create IAM Roles

#### 3.1 Task Execution Role

Create trust policy `ecs-task-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Create the role and attach policies:

```bash
aws iam create-role \
  --role-name InkraECSTaskExecutionRole \
  --assume-role-policy-document file://ecs-task-trust-policy.json

aws iam attach-role-policy \
  --role-name InkraECSTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

Create custom secrets/logs access policy `ecs-secrets-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-2:318928518060:secret:inkra/*"
    },
    {
      "Sid": "ParameterStoreAccess",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:us-east-2:318928518060:parameter/inkra/*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-2:318928518060:log-group:/ecs/*"
    },
    {
      "Sid": "KMSDecrypt",
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:DescribeKey"],
      "Resource": "*"
    }
  ]
}
```

Attach the policy:

```bash
aws iam put-role-policy \
  --role-name InkraECSTaskExecutionRole \
  --policy-name InkraSecretsAccess \
  --policy-document file://ecs-secrets-policy.json
```

#### 3.2 GitHub Actions Role

Create trust policy `github-actions-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::318928518060:oidc-provider/token.actions.githubusercontent.com"
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
```

Create permissions policy `github-actions-permissions.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "ECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:us-east-2:318928518060:repository/inkra-web"
    },
    {
      "Sid": "ParameterStoreRead",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:us-east-2:318928518060:parameter/inkra/*"
    },
    {
      "Sid": "ECSDeployment",
      "Effect": "Allow",
      "Action": [
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeServices",
        "ecs:UpdateService",
        "ecs:DescribeClusters"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::318928518060:role/InkraECSTaskExecutionRole"
    }
  ]
}
```

Create role and attach:

```bash
aws iam create-role \
  --role-name GitHubActionsInkraDeployRole \
  --assume-role-policy-document file://github-actions-trust-policy.json

aws iam put-role-policy \
  --role-name GitHubActionsInkraDeployRole \
  --policy-name InkraDeployPermissions \
  --policy-document file://github-actions-permissions.json
```

### Step 4: Create VPC Endpoints

VPC endpoints allow ECS tasks in private subnets to access AWS services without internet access.

#### Interface Endpoints (in private subnets)

```bash
# Secrets Manager
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0eb6ee9cd198ad718 \
  --service-name com.amazonaws.us-east-2.secretsmanager \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-06556239ea5b298fd subnet-0cae9bde3531d89bd \
  --security-group-ids sg-00e3f789895090238 \
  --private-dns-enabled

# ECR API
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0eb6ee9cd198ad718 \
  --service-name com.amazonaws.us-east-2.ecr.api \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-06556239ea5b298fd subnet-0cae9bde3531d89bd \
  --security-group-ids sg-00e3f789895090238 \
  --private-dns-enabled

# ECR Docker
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0eb6ee9cd198ad718 \
  --service-name com.amazonaws.us-east-2.ecr.dkr \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-06556239ea5b298fd subnet-0cae9bde3531d89bd \
  --security-group-ids sg-00e3f789895090238 \
  --private-dns-enabled

# CloudWatch Logs
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0eb6ee9cd198ad718 \
  --service-name com.amazonaws.us-east-2.logs \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-06556239ea5b298fd subnet-0cae9bde3531d89bd \
  --security-group-ids sg-00e3f789895090238 \
  --private-dns-enabled
```

#### S3 Gateway Endpoint

```bash
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0eb6ee9cd198ad718 \
  --service-name com.amazonaws.us-east-2.s3 \
  --vpc-endpoint-type Gateway \
  --route-table-ids rtb-00fc7fd6176eeb2ac rtb-0c0b86a49cc5d9eab
```

### Step 5: Create Parameter Store Parameters

Build-time parameters (needed during Docker build):

```bash
aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_APP_URL" \
  --value "https://app.oninkra.com" --type String --overwrite

aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_SUPABASE_URL" \
  --value "https://xxx.supabase.co" --type String --overwrite

aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --value "eyJ..." --type SecureString --overwrite

aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" \
  --value "pk_live_..." --type String --overwrite
```

### Step 6: Create Secrets Manager Secret

Create a JSON secret containing all runtime credentials:

```bash
aws secretsmanager create-secret \
  --name inkra/runtime-secrets \
  --secret-string '{
    "DATABASE_URL": "postgresql://...",
    "DIRECT_URL": "postgresql://...",
    "REDIS_URL": "redis://...",
    "SUPABASE_SERVICE_ROLE_KEY": "eyJ...",
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "DEEPGRAM_API_KEY": "...",
    "STRIPE_SECRET_KEY": "sk_live_...",
    "STRIPE_WEBHOOK_SECRET": "whsec_...",
    "TWILIO_ACCOUNT_SID": "AC...",
    "TWILIO_AUTH_TOKEN": "...",
    "TWILIO_API_KEY": "...",
    "TWILIO_API_SECRET": "...",
    "MFA_ENCRYPTION_KEY": "...",
    "TRUSTED_DEVICE_SECRET": "...",
    "CRON_SECRET": "..."
  }'
```

**Note the full ARN** (includes random suffix like `-SIkCQf`):
```bash
aws secretsmanager describe-secret --secret-id inkra/runtime-secrets --query 'ARN'
```

### Step 7: Create Security Groups

#### ALB Security Group

```bash
aws ec2 create-security-group \
  --group-name inkra-alb-sg \
  --description "Inkra ALB security group" \
  --vpc-id vpc-0eb6ee9cd198ad718

# Allow HTTP/HTTPS from internet
aws ec2 authorize-security-group-ingress \
  --group-id sg-0b22ed81096814b45 \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-0b22ed81096814b45 \
  --protocol tcp --port 443 --cidr 0.0.0.0/0
```

#### App Security Group (scrybe-app-sg)

```bash
# Allow port 3000 from ALB
aws ec2 authorize-security-group-ingress \
  --group-id sg-00e3f789895090238 \
  --protocol tcp --port 3000 \
  --source-group sg-0b22ed81096814b45

# Allow HTTPS for VPC endpoints (self-referencing)
aws ec2 authorize-security-group-ingress \
  --group-id sg-00e3f789895090238 \
  --protocol tcp --port 443 \
  --source-group sg-00e3f789895090238

# Outbound rules (should already exist)
# - HTTPS (443) to 0.0.0.0/0
# - PostgreSQL (5432) to 0.0.0.0/0
# - Redis (6379) to 0.0.0.0/0
```

### Step 8: Create Application Load Balancer

```bash
# Create ALB in public subnets
aws elbv2 create-load-balancer \
  --name inkra-alb \
  --subnets subnet-068439ed67891abd9 subnet-0dda06e9cc3341bfa \
  --security-groups sg-0b22ed81096814b45 \
  --scheme internet-facing \
  --type application

# Create target group
aws elbv2 create-target-group \
  --name inkra-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-0eb6ee9cd198ad718 \
  --target-type ip \
  --health-check-path /api/health

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn <ALB_ARN> \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=<TARGET_GROUP_ARN>
```

### Step 9: Create ECS Service

Via AWS Console:
1. **ECS → Clusters → default → Create Service**
2. **Launch type:** FARGATE
3. **Task definition:** `inkra-web`
4. **Service name:** `inkra-prod`
5. **Desired tasks:** 1
6. **Networking:**
   - VPC: `vpc-0eb6ee9cd198ad718`
   - Subnets: Private subnets only
   - Security group: `sg-00e3f789895090238`
   - Public IP: OFF
7. **Load balancing:**
   - ALB: `inkra-alb`
   - Target group: `inkra-tg`

### Step 10: Configure GitHub Repository

In GitHub → Repository → Settings → Secrets and variables → Actions → Variables:

| Variable Name | Value |
|---------------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::318928518060:role/GitHubActionsInkraDeployRole` |
| `TWILIO_PHONE_NUMBER` | `+16267901480` |

---

## Deployment Workflow

The deployment is handled by `.github/workflows/deploy.yml`:

1. **Checkout** code
2. **Authenticate** to AWS via OIDC
3. **Fetch build parameters** from Parameter Store
4. **Build and push** Docker image to ECR
5. **Render task definition** with new image
6. **Deploy** to ECS (update service)

---

## Secrets Configuration

### Secrets Manager (Runtime)

Full secret ARN: `arn:aws:secretsmanager:us-east-2:318928518060:secret:inkra/runtime-secrets-SIkCQf`

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | PostgreSQL direct connection (migrations) |
| `REDIS_URL` | Redis connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key |
| `ANTHROPIC_API_KEY` | Claude API key |
| `DEEPGRAM_API_KEY` | Transcription API key |
| `STRIPE_SECRET_KEY` | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_API_KEY` | Twilio API key |
| `TWILIO_API_SECRET` | Twilio API secret |
| `MFA_ENCRYPTION_KEY` | MFA TOTP encryption key |
| `TRUSTED_DEVICE_SECRET` | Device trust signing key |
| `CRON_SECRET` | Cron job authentication |

### Environment Variables (Hardcoded in Task Definition)

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `HOSTNAME` | `0.0.0.0` |
| `AWS_REGION` | `us-east-2` |
| `AWS_S3_BUCKET` | `inkra-uploads-prod` |
| `AWS_S3_BUCKET_AUDIT_LOGS` | `inkra-audit-logs-prod` |
| `AWS_S3_BUCKET_BACKUPS` | `inkra-backups-prod` |
| `AWS_S3_BUCKET_EXPORTS` | `inkra-exports-prod` |
| `AWS_S3_BUCKET_RECORDINGS` | `inkra-recordings-prod` |
| `EMAIL_ENABLED` | `true` |
| `MARKETING_URL` | `https://oninkra.com` |
| `NEXT_PUBLIC_APP_URL` | `https://app.oninkra.com` |

---

## Troubleshooting

### Task fails to start with "ResourceInitializationError"

**Symptoms:** Cannot pull secrets or registry auth

**Cause:** Network connectivity issue - tasks can't reach AWS services

**Solution:**
1. Verify VPC endpoints exist and are in **Available** status
2. Verify endpoints are in the **same private subnets** as ECS tasks
3. Verify security group allows **inbound HTTPS (443)** from itself
4. Verify Private DNS is enabled on endpoints

### Task fails with "CannotPullContainerError"

**Symptoms:** dial tcp timeout to ECR

**Cause:** Missing or misconfigured ECR endpoints

**Solution:**
1. Verify `ecr.api` and `ecr.dkr` endpoints exist
2. Verify S3 Gateway endpoint is associated with correct route tables
3. Check endpoint security groups

### Secrets not found

**Symptoms:** "secret not found" or "json key not found"

**Cause:** Wrong secret ARN or missing key

**Solution:**
1. Use full ARN including random suffix (e.g., `-SIkCQf`)
2. Verify key names match exactly (case-sensitive)
3. Check IAM permissions on task execution role

### ALB returns 502/503

**Symptoms:** Bad gateway errors

**Cause:** Tasks not healthy or not registered

**Solution:**
1. Check target group health
2. Verify tasks are in RUNNING state
3. Check container logs for startup errors
4. Verify health check path (`/api/health`)

---

## HIPAA Compliance Checklist

- [x] No PHI in GitHub (secrets in AWS)
- [x] Rotating credentials in AWS Secrets Manager
- [x] VPC endpoints (traffic never leaves AWS network)
- [x] Private subnets for compute (no public IPs)
- [x] Encryption at rest (ECR, Secrets Manager, RDS)
- [x] Encryption in transit (ALB HTTPS, VPC endpoint TLS)
- [x] Audit trail (CloudTrail logs all API calls)
- [x] No long-lived credentials (OIDC federation)
- [x] Non-root container user
- [x] Health checks enabled

---

## Related Documentation

- [Disaster Recovery Runbook](./compliance/runbooks/inkra-web-disaster-recovery.md)
- [ECS Recovery Runbook](./compliance/runbooks/ecs-recovery.md)
- [Infrastructure Launch Checklist](./deployment/INFRASTRUCTURE_LAUNCH_CHECKLIST.md)
