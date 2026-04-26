# AWS + GitHub Actions Setup for HIPAA-Compliant CI/CD

This guide sets up a secure CI/CD pipeline using **ECS Express Mode** with a hybrid secrets strategy:
- **No secrets stored in GitHub**
- GitHub authenticates to AWS via OIDC (no long-lived credentials)
- **Secrets Manager** (~$0.40/month): Rotating credentials (DB, API keys, auth tokens)
- **Parameter Store** (Free): Static configuration that rarely changes
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
       └──► ECS Express Mode (runtime)
              ├── Auto-provisioned ALB with HTTPS
              ├── Auto-scaling based on CPU/memory
              ├── Secrets Manager → rotating credentials
              └── Parameter Store → static config
```

## Cost Breakdown

| Service | Items | Cost |
|---------|-------|------|
| Secrets Manager | 1 secret (13 key/value pairs in JSON) | ~$0.40/month |
| Parameter Store | ~14 parameters (static config) | Free (Standard tier) |
| **Total Secrets** | | ~$0.40/month |

---

## Step 1: Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name inkra-web \
  --region us-east-2 \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256
```

Save the repository URI (e.g., `123456789.dkr.ecr.us-east-2.amazonaws.com/inkra-web`).

## Step 2: Create OIDC Identity Provider for GitHub

```bash
# Create the OIDC provider (only needs to be done once per AWS account)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

## Step 3: Create IAM Roles

### 3.1 Task Execution Role (for ECS to access secrets/parameters)

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

Create the role:

```bash
aws iam create-role \
  --role-name InkraECSTaskExecutionRole \
  --assume-role-policy-document file://ecs-task-trust-policy.json
```

Attach the managed policy:

```bash
aws iam attach-role-policy \
  --role-name InkraECSTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

Create custom secrets/parameters access policy `ecs-secrets-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-2:YOUR_ACCOUNT_ID:secret:inkra/*"
    },
    {
      "Sid": "ParameterStoreAccess",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:us-east-2:YOUR_ACCOUNT_ID:parameter/inkra/*"
    },
    {
      "Sid": "KMSDecrypt",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:us-east-2:YOUR_ACCOUNT_ID:key/*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": [
            "secretsmanager.us-east-2.amazonaws.com",
            "ssm.us-east-2.amazonaws.com"
          ]
        }
      }
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

### 3.2 Infrastructure Role (for ECS Express Mode)

```bash
aws iam create-role \
  --role-name InkraECSInfrastructureRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name InkraECSInfrastructureRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices
```

### 3.3 GitHub Actions Role

Create trust policy `github-actions-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
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

Create the role:

```bash
aws iam create-role \
  --role-name GitHubActionsInkraDeployRole \
  --assume-role-policy-document file://github-actions-trust-policy.json
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
      "Resource": "arn:aws:ecr:us-east-2:YOUR_ACCOUNT_ID:repository/inkra-web"
    },
    {
      "Sid": "ParameterStoreRead",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:us-east-2:YOUR_ACCOUNT_ID:parameter/inkra/*"
    },
    {
      "Sid": "KMSDecrypt",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:us-east-2:YOUR_ACCOUNT_ID:key/*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "ssm.us-east-2.amazonaws.com"
        }
      }
    },
    {
      "Sid": "ECSExpressDeploy",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeExpressGatewayServices"
      ],
      "Resource": "*"
    }
  ]
}
```

Attach the policy:

```bash
aws iam put-role-policy \
  --role-name GitHubActionsInkraDeployRole \
  --policy-name InkraDeployPermissions \
  --policy-document file://github-actions-permissions.json
```

## Step 4: Create Parameters in Parameter Store (Free Tier)

### Build-time Parameters (prefix: `/inkra/build/`)

These are needed during `docker build` for Next.js client-side code:

```bash
# NEXT_PUBLIC_* vars (baked into client bundle)
aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_APP_URL" \
  --value "https://app.oninkra.com" --type String --overwrite

aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_SUPABASE_URL" \
  --value "https://xxx.supabase.co" --type String --overwrite

aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --value "eyJ..." --type SecureString --overwrite

aws ssm put-parameter --name "/inkra/build/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" \
  --value "pk_live_..." --type String --overwrite
```

### Runtime Parameters (prefix: `/inkra/runtime/`)

Static configuration injected at container start:

```bash
# AWS Configuration
aws ssm put-parameter --name "/inkra/runtime/AWS_REGION" \
  --value "us-east-2" --type String --overwrite

aws ssm put-parameter --name "/inkra/runtime/AWS_S3_BUCKET" \
  --value "inkra-uploads" --type String --overwrite

aws ssm put-parameter --name "/inkra/runtime/AWS_S3_BUCKET_AUDIT_LOGS" \
  --value "inkra-audit-logs" --type String --overwrite

aws ssm put-parameter --name "/inkra/runtime/AWS_S3_BUCKET_BACKUPS" \
  --value "inkra-backups" --type String --overwrite

aws ssm put-parameter --name "/inkra/runtime/AWS_S3_BUCKET_EXPORTS" \
  --value "inkra-exports" --type String --overwrite

aws ssm put-parameter --name "/inkra/runtime/AWS_S3_BUCKET_RECORDINGS" \
  --value "inkra-recordings" --type String --overwrite

# Feature Flags & Config
aws ssm put-parameter --name "/inkra/runtime/EMAIL_ENABLED" \
  --value "true" --type String --overwrite

aws ssm put-parameter --name "/inkra/runtime/MARKETING_URL" \
  --value "https://oninkra.com" --type String --overwrite

# Twilio (non-secret identifiers)
aws ssm put-parameter --name "/inkra/runtime/TWILIO_ACCOUNT_SID" \
  --value "AC..." --type String --overwrite

aws ssm put-parameter --name "/inkra/runtime/TWILIO_PHONE_NUMBER" \
  --value "+1..." --type String --overwrite
```

## Step 5: Create Secrets in Secrets Manager

Create a single JSON secret containing all rotating credentials (~$0.40/month):

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
    "TWILIO_AUTH_TOKEN": "...",
    "TWILIO_API_KEY": "...",
    "TWILIO_API_SECRET": "...",
    "MFA_ENCRYPTION_KEY": "...",
    "TRUSTED_DEVICE_SECRET": "...",
    "CRON_SECRET": "..."
  }'
```

**Note:** Do NOT store `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` - ECS tasks get AWS credentials automatically from the task execution role (more secure).

## Step 6: Create ECS Express Mode Service

In the AWS Console:

1. Navigate to **ECS → Create service (Express Mode)**
2. Configure:
   - **Service name**: `inkra-prod`
   - **Container image**: ECR URI (after first push)
   - **Port**: 3000
   - **Health check path**: `/api/health`
   - **CPU**: 1 vCPU
   - **Memory**: 2 GB
   - **Auto-scaling**: Min 1, Max 10, CPU target 70%

### Environment Variables Configuration

**From Parameter Store (static config):**

| Name | Source |
|------|--------|
| `AWS_REGION` | `/inkra/runtime/AWS_REGION` |
| `AWS_S3_BUCKET` | `/inkra/runtime/AWS_S3_BUCKET` |
| `AWS_S3_BUCKET_AUDIT_LOGS` | `/inkra/runtime/AWS_S3_BUCKET_AUDIT_LOGS` |
| `AWS_S3_BUCKET_BACKUPS` | `/inkra/runtime/AWS_S3_BUCKET_BACKUPS` |
| `AWS_S3_BUCKET_EXPORTS` | `/inkra/runtime/AWS_S3_BUCKET_EXPORTS` |
| `AWS_S3_BUCKET_RECORDINGS` | `/inkra/runtime/AWS_S3_BUCKET_RECORDINGS` |
| `EMAIL_ENABLED` | `/inkra/runtime/EMAIL_ENABLED` |
| `MARKETING_URL` | `/inkra/runtime/MARKETING_URL` |
| `TWILIO_ACCOUNT_SID` | `/inkra/runtime/TWILIO_ACCOUNT_SID` |
| `TWILIO_PHONE_NUMBER` | `/inkra/runtime/TWILIO_PHONE_NUMBER` |

**From Secrets Manager (rotating credentials):**

| Name | Secret ARN | Key |
|------|------------|-----|
| `DATABASE_URL` | `inkra/runtime-secrets` | `DATABASE_URL` |
| `DIRECT_URL` | `inkra/runtime-secrets` | `DIRECT_URL` |
| `REDIS_URL` | `inkra/runtime-secrets` | `REDIS_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | `inkra/runtime-secrets` | `SUPABASE_SERVICE_ROLE_KEY` |
| `ANTHROPIC_API_KEY` | `inkra/runtime-secrets` | `ANTHROPIC_API_KEY` |
| `DEEPGRAM_API_KEY` | `inkra/runtime-secrets` | `DEEPGRAM_API_KEY` |
| `STRIPE_SECRET_KEY` | `inkra/runtime-secrets` | `STRIPE_SECRET_KEY` |
| `STRIPE_WEBHOOK_SECRET` | `inkra/runtime-secrets` | `STRIPE_WEBHOOK_SECRET` |
| `TWILIO_AUTH_TOKEN` | `inkra/runtime-secrets` | `TWILIO_AUTH_TOKEN` |
| `TWILIO_API_KEY` | `inkra/runtime-secrets` | `TWILIO_API_KEY` |
| `TWILIO_API_SECRET` | `inkra/runtime-secrets` | `TWILIO_API_SECRET` |
| `MFA_ENCRYPTION_KEY` | `inkra/runtime-secrets` | `MFA_ENCRYPTION_KEY` |
| `TRUSTED_DEVICE_SECRET` | `inkra/runtime-secrets` | `TRUSTED_DEVICE_SECRET` |
| `CRON_SECRET` | `inkra/runtime-secrets` | `CRON_SECRET` |

**Hardcoded in Dockerfile (no external storage needed):**

| Name | Value |
|------|-------|
| `NODE_ENV` | `production` |
| `NODE_OPTIONS` | `--max-old-space-size=6144` |
| `PORT` | `3000` |
| `HOSTNAME` | `0.0.0.0` |

## Step 7: Configure GitHub Repository Variables

In GitHub → Repository → Settings → Secrets and variables → Actions → Variables:

| Variable Name | Value |
|---------------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsInkraDeployRole` |

**Note:** The `APP_RUNNER_SERVICE_ARN` variable is no longer needed for ECS Express Mode.

## Verification Checklist

- [ ] ECR repository created with encryption enabled
- [ ] OIDC provider created in IAM
- [ ] Task Execution Role created (`InkraECSTaskExecutionRole`)
- [ ] Infrastructure Role created (`InkraECSInfrastructureRole`)
- [ ] GitHub Actions IAM role created with trust policy
- [ ] IAM permissions attached (ECR, Parameter Store, ECS)
- [ ] Build parameters created in Parameter Store (`/inkra/build/*`)
- [ ] Runtime parameters created in Parameter Store (`/inkra/runtime/*`)
- [ ] Runtime secrets created in Secrets Manager (`inkra/runtime-secrets`)
- [ ] GitHub repository variables configured (`AWS_ROLE_ARN`)
- [ ] ECS Express Mode service created and healthy
- [ ] Environment variables configured to pull from Parameter Store and Secrets Manager

## Testing

1. **ECR Push Test**: Manually trigger workflow, verify image appears in ECR
2. **ECS Service**: Verify service starts and reaches healthy state
3. **Health Check**: Curl the ALB endpoint at `/api/health`
4. **Secrets**: Verify environment variables are populated (check ECS logs)
5. **Full Flow**: Make a code change, verify automatic deployment
6. **Rollback**: Verify you can deploy a previous image tag

## Security Notes

### HIPAA Compliance
- ✅ No PHI in GitHub (secrets in AWS)
- ✅ Rotating credentials in AWS Secrets Manager (audit trail, rotation support)
- ✅ Static config in Parameter Store (SecureString for sensitive values)
- ✅ Encryption at rest (ECR, Secrets Manager, Parameter Store SecureString)
- ✅ Encryption in transit (ALB HTTPS)
- ✅ Audit trail (CloudTrail logs all API calls)
- ✅ No long-lived credentials (OIDC federation)
- ✅ Non-root container user
- ✅ Health checks enabled

### Rotation
Set up automatic rotation for secrets:

```bash
aws secretsmanager rotate-secret \
  --secret-id inkra/runtime-secrets \
  --rotation-rules AutomaticallyAfterDays=90
```

## Troubleshooting

### Build fails with "AccessDenied"
- Check IAM role permissions
- Verify OIDC provider thumbprint
- Check repository name in trust policy condition

### ECS can't pull image
- Verify Task Execution Role has ECR access
- Check image URI is correct

### Secrets not available
- Verify secret ARN format
- Check Task Execution Role has `secretsmanager:GetSecretValue` permission
- Ensure secret key names match exactly

### Parameter Store values not loading
- Check parameter path matches `/inkra/runtime/*`
- Verify Task Execution Role has `ssm:GetParameter*` permissions
- For SecureString, ensure KMS decrypt permission

## Migration from App Runner

If migrating from an existing App Runner deployment:

1. Keep App Runner service running during migration
2. Deploy to ECS Express Mode and verify it works
3. Update DNS/routing to point to ECS ALB
4. Monitor for issues
5. After confirmation, delete App Runner service

### Rollback Plan

If ECS Express Mode fails:
1. App Runner service remains active during migration
2. Update DNS/routing to point back to App Runner
3. Investigate and fix ECS configuration
