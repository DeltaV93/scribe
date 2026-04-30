# Inkra Web App - Disaster Recovery Runbook

**Document ID:** RB-DR-001
**Version:** 1.0
**Last Updated:** April 29, 2026
**Owner:** DevOps Lead

---

## Overview

This runbook provides step-by-step instructions to rebuild the entire Inkra web application infrastructure from scratch. Use this in case of:
- Complete AWS account compromise
- Region-wide AWS outage requiring migration
- Accidental deletion of critical resources
- Compliance audit requiring infrastructure recreation

**Estimated Recovery Time:** 2-4 hours (excluding DNS propagation)

---

## Prerequisites

- AWS CLI configured with admin access
- GitHub repository access (DeltaV93/scribe)
- Access to secret values (stored securely offline)
- Domain DNS access (for ALB endpoint)

---

## Infrastructure Overview

| Component | Current Value |
|-----------|---------------|
| AWS Account | 318928518060 |
| Region | us-east-2 (Ohio) |
| VPC CIDR | 10.0.0.0/16 |
| ECS Cluster | default |
| ECS Service | inkra-prod |
| ECR Repository | inkra-web |
| ALB DNS | Internet-facing-1644845505.us-east-2.elb.amazonaws.com |
| RDS | scrybe-prod-db.cd4s4yyaak8c.us-east-2.rds.amazonaws.com |

---

## Recovery Steps

### Phase 1: VPC and Networking (30 min)

#### 1.1 Create VPC

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=scrybe-prod-vpc}]' \
  --query 'Vpc.VpcId' --output text)

# Enable DNS hostnames and resolution
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support
```

#### 1.2 Create Internet Gateway

```bash
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=inkra-igw}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)

aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID
```

#### 1.3 Create Subnets

**Public Subnets (for ALB):**

```bash
# Public Subnet 1 (us-east-2a)
PUB_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.100.0/24 \
  --availability-zone us-east-2a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=inkra-public-1}]' \
  --query 'Subnet.SubnetId' --output text)

# Public Subnet 2 (us-east-2b)
PUB_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.101.0/24 \
  --availability-zone us-east-2b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=inkra-public-2}]' \
  --query 'Subnet.SubnetId' --output text)

# Enable auto-assign public IP
aws ec2 modify-subnet-attribute --subnet-id $PUB_SUBNET_1 --map-public-ip-on-launch
aws ec2 modify-subnet-attribute --subnet-id $PUB_SUBNET_2 --map-public-ip-on-launch
```

**Private Subnets (for ECS tasks):**

```bash
# Private Subnet 1 (us-east-2a)
PRIV_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.128.0/20 \
  --availability-zone us-east-2a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=project-subnet-private1-us-east-2a}]' \
  --query 'Subnet.SubnetId' --output text)

# Private Subnet 2 (us-east-2b)
PRIV_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.144.0/20 \
  --availability-zone us-east-2b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=project-subnet-private2-us-east-2b}]' \
  --query 'Subnet.SubnetId' --output text)
```

#### 1.4 Create Route Tables

**Public Route Table:**

```bash
PUB_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=inkra-public-rt}]' \
  --query 'RouteTable.RouteTableId' --output text)

# Route to Internet Gateway
aws ec2 create-route --route-table-id $PUB_RT --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID

# Associate with public subnets
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_SUBNET_1
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_SUBNET_2
```

**Private Route Tables:**

```bash
# Route table for private subnet 1
PRIV_RT_1=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=project-rtb-private1-us-east-2a}]' \
  --query 'RouteTable.RouteTableId' --output text)

aws ec2 associate-route-table --route-table-id $PRIV_RT_1 --subnet-id $PRIV_SUBNET_1

# Route table for private subnet 2
PRIV_RT_2=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=project-rtb-private2-us-east-2b}]' \
  --query 'RouteTable.RouteTableId' --output text)

aws ec2 associate-route-table --route-table-id $PRIV_RT_2 --subnet-id $PRIV_SUBNET_2
```

#### 1.5 Create Security Groups

**ALB Security Group:**

```bash
ALB_SG=$(aws ec2 create-security-group \
  --group-name inkra-alb-sg \
  --description "Inkra ALB security group" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Inbound HTTP/HTTPS
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0
```

**App Security Group:**

```bash
APP_SG=$(aws ec2 create-security-group \
  --group-name scrybe-app-sg \
  --description "Inkra app security group" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Inbound from ALB on port 3000
aws ec2 authorize-security-group-ingress --group-id $APP_SG --protocol tcp --port 3000 --source-group $ALB_SG

# Inbound HTTPS from self (for VPC endpoints)
aws ec2 authorize-security-group-ingress --group-id $APP_SG --protocol tcp --port 443 --source-group $APP_SG

# Inbound PostgreSQL from self (for RDS)
aws ec2 authorize-security-group-ingress --group-id $APP_SG --protocol tcp --port 5432 --source-group $APP_SG

# Outbound rules (default allows all)
```

---

### Phase 2: VPC Endpoints (15 min)

Create VPC endpoints for private subnet connectivity to AWS services:

```bash
# Secrets Manager
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-2.secretsmanager \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIV_SUBNET_1 $PRIV_SUBNET_2 \
  --security-group-ids $APP_SG \
  --private-dns-enabled \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=inkra-secretsmanager-endpoint}]'

# ECR API
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-2.ecr.api \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIV_SUBNET_1 $PRIV_SUBNET_2 \
  --security-group-ids $APP_SG \
  --private-dns-enabled \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=inkra-ecr-api-endpoint}]'

# ECR Docker
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-2.ecr.dkr \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIV_SUBNET_1 $PRIV_SUBNET_2 \
  --security-group-ids $APP_SG \
  --private-dns-enabled \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=inkra-ecr-dkr-endpoint}]'

# CloudWatch Logs
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-2.logs \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIV_SUBNET_1 $PRIV_SUBNET_2 \
  --security-group-ids $APP_SG \
  --private-dns-enabled \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=inkra-logs-endpoint}]'

# S3 Gateway (uses route tables, not subnets)
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-2.s3 \
  --vpc-endpoint-type Gateway \
  --route-table-ids $PRIV_RT_1 $PRIV_RT_2 \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=inkra-s3-endpoint}]'
```

**Wait for endpoints to become Available (2-3 minutes):**

```bash
aws ec2 describe-vpc-endpoints --query 'VpcEndpoints[*].[Tags[?Key==`Name`].Value|[0],State]' --output table
```

---

### Phase 3: IAM Roles (10 min)

#### 3.1 ECS Task Execution Role

```bash
# Create trust policy
cat > /tmp/ecs-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ecs-tasks.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create role
aws iam create-role \
  --role-name InkraECSTaskExecutionRole \
  --assume-role-policy-document file:///tmp/ecs-trust.json

# Attach managed policy
aws iam attach-role-policy \
  --role-name InkraECSTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create custom policy for secrets and logs
cat > /tmp/ecs-secrets.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-2:318928518060:secret:inkra/*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:us-east-2:318928518060:log-group:/ecs/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:DescribeKey"],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name InkraECSTaskExecutionRole \
  --policy-name InkraSecretsAccess \
  --policy-document file:///tmp/ecs-secrets.json
```

#### 3.2 ECS Task Role (for ECS Exec)

This role is attached to running tasks and enables ECS Exec for debugging.

```bash
# Create trust policy
cat > /tmp/ecs-task-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ecs-tasks.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create role
aws iam create-role \
  --role-name InkraECSTaskRole \
  --assume-role-policy-document file:///tmp/ecs-task-trust.json \
  --description "Task role for Inkra ECS tasks with ECS Exec support"

# Add ECS Exec policy for SSM Session Manager
cat > /tmp/ecs-exec-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel"
    ],
    "Resource": "*"
  }]
}
EOF

aws iam put-role-policy \
  --role-name InkraECSTaskRole \
  --policy-name ECSExecPolicy \
  --policy-document file:///tmp/ecs-exec-policy.json
```

#### 3.3 GitHub Actions Role

```bash
# Create OIDC provider (if not exists)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create trust policy
cat > /tmp/github-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::318928518060:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"},
      "StringLike": {"token.actions.githubusercontent.com:sub": "repo:DeltaV93/scribe:*"}
    }
  }]
}
EOF

aws iam create-role \
  --role-name GitHubActionsInkraDeployRole \
  --assume-role-policy-document file:///tmp/github-trust.json

# Create permissions policy
cat > /tmp/github-perms.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*"},
    {"Effect": "Allow", "Action": ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage", "ecr:PutImage", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload"], "Resource": "arn:aws:ecr:us-east-2:318928518060:repository/inkra-web"},
    {"Effect": "Allow", "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"], "Resource": "arn:aws:ssm:us-east-2:318928518060:parameter/inkra/*"},
    {"Effect": "Allow", "Action": ["ecs:RegisterTaskDefinition", "ecs:DescribeTaskDefinition", "ecs:DescribeServices", "ecs:UpdateService", "ecs:DescribeClusters"], "Resource": "*"},
    {"Effect": "Allow", "Action": "iam:PassRole", "Resource": ["arn:aws:iam::318928518060:role/InkraECSTaskExecutionRole", "arn:aws:iam::318928518060:role/InkraECSTaskRole"]}
  ]
}
EOF

aws iam put-role-policy \
  --role-name GitHubActionsInkraDeployRole \
  --policy-name InkraDeployPermissions \
  --policy-document file:///tmp/github-perms.json
```

---

### Phase 4: Secrets and Parameters (10 min)

#### 4.1 Create Secrets Manager Secret

```bash
# Replace with actual values from secure backup
aws secretsmanager create-secret \
  --name inkra/runtime-secrets \
  --secret-string '{
    "DATABASE_URL": "postgresql://user:pass@host:5432/db",
    "DIRECT_URL": "postgresql://user:pass@host:5432/db",
    "REDIS_URL": "redis://...",
    "SUPABASE_SERVICE_ROLE_KEY": "...",
    "ANTHROPIC_API_KEY": "...",
    "DEEPGRAM_API_KEY": "...",
    "STRIPE_SECRET_KEY": "...",
    "STRIPE_WEBHOOK_SECRET": "...",
    "TWILIO_ACCOUNT_SID": "...",
    "TWILIO_AUTH_TOKEN": "...",
    "TWILIO_API_KEY": "...",
    "TWILIO_API_SECRET": "...",
    "MFA_ENCRYPTION_KEY": "...",
    "TRUSTED_DEVICE_SECRET": "...",
    "CRON_SECRET": "..."
  }'

# Get full ARN (includes random suffix)
SECRET_ARN=$(aws secretsmanager describe-secret --secret-id inkra/runtime-secrets --query 'ARN' --output text)
echo "Secret ARN: $SECRET_ARN"
```

#### 4.2 Create Parameter Store Parameters

```bash
aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_APP_URL" --value "https://app.oninkra.com" --type String --overwrite
aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_SUPABASE_URL" --value "https://xxx.supabase.co" --type String --overwrite
aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_SUPABASE_ANON_KEY" --value "eyJ..." --type SecureString --overwrite
aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" --value "pk_live_..." --type String --overwrite
```

---

### Phase 5: ECR Repository (5 min)

```bash
aws ecr create-repository \
  --repository-name inkra-web \
  --region us-east-2 \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256
```

---

### Phase 6: Application Load Balancer (10 min)

```bash
# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name inkra-alb \
  --subnets $PUB_SUBNET_1 $PUB_SUBNET_2 \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Create target group
TG_ARN=$(aws elbv2 create-target-group \
  --name inkra-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB DNS: $ALB_DNS"
```

---

### Phase 7: ECS Service (15 min)

#### 7.1 Update Task Definition

Update `.aws/task-definition.json` with:
- New secret ARN (including random suffix)
- New subnet IDs
- New security group ID

#### 7.2 Register Task Definition

```bash
aws ecs register-task-definition --cli-input-json file://.aws/task-definition.json
```

#### 7.3 Create ECS Service

```bash
aws ecs create-service \
  --cluster default \
  --service-name inkra-prod \
  --task-definition inkra-web \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIV_SUBNET_1,$PRIV_SUBNET_2],securityGroups=[$APP_SG],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=web,containerPort=3000"
```

---

### Phase 8: Verify Deployment (10 min)

```bash
# Wait for service to stabilize
aws ecs wait services-stable --cluster default --services inkra-prod

# Check service status
aws ecs describe-services --cluster default --services inkra-prod --query 'services[0].{status:status,running:runningCount,desired:desiredCount}'

# Test health endpoint
curl http://$ALB_DNS/api/health
```

---

### Phase 9: Configure GitHub (5 min)

In GitHub → DeltaV93/scribe → Settings → Secrets and variables → Actions → Variables:

| Variable | Value |
|----------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::318928518060:role/GitHubActionsInkraDeployRole` |
| `TWILIO_PHONE_NUMBER` | `+16267901480` |

---

### Phase 10: DNS Configuration (varies)

Update DNS records to point to the new ALB:

```
app.oninkra.com → CNAME → <new-alb-dns-name>
```

---

## Validation Checklist

After recovery, verify:

- [ ] VPC and subnets created
- [ ] Internet Gateway attached
- [ ] VPC endpoints all showing "Available"
- [ ] Security groups configured
- [ ] IAM roles created with correct permissions
- [ ] Secrets Manager secret created with all keys
- [ ] Parameter Store parameters created
- [ ] ECR repository exists
- [ ] ALB created and healthy
- [ ] Target group health checks passing
- [ ] ECS service running (1 task)
- [ ] `/api/health` returns 200
- [ ] Login functionality works
- [ ] Database connectivity confirmed
- [ ] GitHub Actions can deploy

---

## Common Issues

### Tasks fail with "ResourceInitializationError"

**Cause:** VPC endpoints not ready or misconfigured

**Fix:**
1. Wait for endpoints to show "Available"
2. Verify endpoints are in private subnets (not public)
3. Verify security group allows inbound HTTPS (443) from itself

### Tasks fail with "CannotPullContainerError"

**Cause:** Missing ECR endpoints or S3 gateway

**Fix:**
1. Verify ecr.api and ecr.dkr endpoints exist
2. Verify S3 gateway endpoint is associated with private route tables

### ALB returns 502

**Cause:** No healthy targets

**Fix:**
1. Check ECS task logs
2. Verify health check path is correct (`/api/health`)
3. Verify security group allows ALB → ECS traffic on port 3000

### Database migrations fail (P3009 or P3018)

**Cause:** Migration partially applied or failed state in `_prisma_migrations` table

**Fix using ECS Exec:**

1. Temporarily skip migrations in `start.sh`:
   ```bash
   # Comment out prisma migrate deploy in scripts/start.sh
   ```

2. Deploy to get a running container

3. Enable ECS Exec on the service:
   ```bash
   aws ecs update-service --cluster default --service inkra-prod --enable-execute-command --force-new-deployment
   ```

4. Connect to running container:
   ```bash
   # Get task ID
   TASK_ID=$(aws ecs list-tasks --cluster default --service-name inkra-prod --query 'taskArns[0]' --output text | cut -d'/' -f3)

   # Connect (requires Session Manager plugin: brew install --cask session-manager-plugin)
   aws ecs execute-command --cluster default --task $TASK_ID --container web --interactive --command "/bin/sh"
   ```

5. Inside container, fix the migration:
   ```sh
   export HOME=/tmp
   prisma migrate status                                           # See current state
   prisma migrate resolve --rolled-back <migration_name>           # Clear failed state
   prisma migrate resolve --applied <migration_name>               # Mark as applied if changes exist
   prisma migrate deploy                                           # Apply remaining migrations
   ```

6. Restore `start.sh` and redeploy

---

## Recovery Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | [Contact info] |
| AWS Support | Enterprise Support Portal |
| GitHub Support | support.github.com |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-04-30 | Added ECS Task Role (3.2), ECS Exec debugging, migration troubleshooting |
| 1.0 | 2026-04-29 | Initial version |
