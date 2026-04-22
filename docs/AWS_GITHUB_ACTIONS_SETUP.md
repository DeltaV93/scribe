# AWS + GitHub Actions Setup for HIPAA-Compliant CI/CD

This guide sets up a secure CI/CD pipeline where:
- **No secrets are stored in GitHub**
- GitHub authenticates to AWS via OIDC (no long-lived credentials)
- Secrets are managed centrally in AWS Secrets Manager
- Full audit trail via CloudTrail

## Architecture

```
GitHub Actions (build)
       │
       ▼ (OIDC auth - no stored credentials)
      AWS
       │
       ├──► Secrets Manager (build-time secrets)
       │
       ├──► ECR (Docker image storage)
       │
       └──► App Runner (runtime, pulls secrets from Secrets Manager)
```

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

## Step 3: Create IAM Role for GitHub Actions

Create a file `github-actions-trust-policy.json`:

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

## Step 4: Attach Permissions to the Role

Create a file `github-actions-permissions.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
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
      "Sid": "SecretsManagerRead",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-2:YOUR_ACCOUNT_ID:secret:inkra/*"
    },
    {
      "Sid": "AppRunnerDeploy",
      "Effect": "Allow",
      "Action": [
        "apprunner:StartDeployment"
      ],
      "Resource": "arn:aws:apprunner:us-east-2:YOUR_ACCOUNT_ID:service/inkra-prod/*"
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

## Step 5: Create Secrets in AWS Secrets Manager

Create the build-time secrets (NEXT_PUBLIC_* variables needed at build time):

```bash
aws secretsmanager create-secret \
  --name inkra/build \
  --secret-string '{
    "NEXT_PUBLIC_APP_URL": "https://app.oninkra.com",
    "NEXT_PUBLIC_SUPABASE_URL": "https://xxx.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "eyJ...",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_..."
  }'
```

Create the runtime secrets (for App Runner):

```bash
aws secretsmanager create-secret \
  --name inkra/runtime \
  --secret-string '{
    "DATABASE_URL": "postgresql://...",
    "SUPABASE_SERVICE_ROLE_KEY": "eyJ...",
    "STRIPE_SECRET_KEY": "sk_live_...",
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "TWILIO_ACCOUNT_SID": "AC...",
    "TWILIO_AUTH_TOKEN": "...",
    "DEEPGRAM_API_KEY": "...",
    "AWS_S3_BUCKET": "inkra-uploads",
    "SENTRY_DSN": "https://..."
  }'
```

## Step 6: Configure GitHub Repository Variables

In GitHub → Repository → Settings → Secrets and variables → Actions → Variables:

| Variable Name | Value |
|---------------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsInkraDeployRole` |
| `APP_RUNNER_SERVICE_ARN` | `arn:aws:apprunner:us-east-2:YOUR_ACCOUNT_ID:service/inkra-prod/xxx` |

**Note:** These are repository **variables** (not secrets) - they're not sensitive.

## Step 7: Configure App Runner to Use ECR

Update App Runner to:

1. **Source**: ECR (instead of GitHub)
2. **Image URI**: `YOUR_ACCOUNT_ID.dkr.ecr.us-east-2.amazonaws.com/inkra-web:latest`
3. **ECR Access Role**: Create a role that allows App Runner to pull from ECR

### Create App Runner ECR Access Role

```bash
# Trust policy for App Runner
cat > apprunner-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "build.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name AppRunnerECRAccessRole \
  --assume-role-policy-document file://apprunner-trust-policy.json

# Attach ECR read policy
aws iam attach-role-policy \
  --role-name AppRunnerECRAccessRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
```

## Step 8: Configure App Runner Runtime Secrets

In App Runner, configure environment variables to pull from Secrets Manager:

1. Go to App Runner → Your Service → Configuration → Service settings
2. Under "Environment variables", add references to Secrets Manager:

For each secret, use the format:
- **Name**: `DATABASE_URL`
- **Value source**: AWS Secrets Manager
- **Secret ARN**: `arn:aws:secretsmanager:us-east-2:YOUR_ACCOUNT_ID:secret:inkra/runtime`
- **Key**: `DATABASE_URL`

## Verification Checklist

- [ ] ECR repository created with encryption enabled
- [ ] OIDC provider created in IAM
- [ ] GitHub Actions IAM role created with trust policy
- [ ] IAM permissions attached (ECR, Secrets Manager, App Runner)
- [ ] Build secrets created in Secrets Manager (`inkra/build`)
- [ ] Runtime secrets created in Secrets Manager (`inkra/runtime`)
- [ ] GitHub repository variables configured (`AWS_ROLE_ARN`, `APP_RUNNER_SERVICE_ARN`)
- [ ] App Runner configured to pull from ECR
- [ ] App Runner ECR access role configured
- [ ] App Runner environment variables pointing to Secrets Manager

## Security Notes

### HIPAA Compliance
- ✅ No PHI in GitHub (secrets in AWS)
- ✅ Encryption at rest (ECR, Secrets Manager)
- ✅ Encryption in transit (TLS everywhere)
- ✅ Audit trail (CloudTrail logs all API calls)
- ✅ Least privilege IAM policies
- ✅ No long-lived credentials (OIDC federation)

### Rotation
Set up automatic rotation for secrets:

```bash
aws secretsmanager rotate-secret \
  --secret-id inkra/runtime \
  --rotation-rules AutomaticallyAfterDays=90
```

## Troubleshooting

### Build fails with "AccessDenied"
- Check IAM role permissions
- Verify OIDC provider thumbprint
- Check repository name in trust policy condition

### App Runner can't pull image
- Verify ECR access role is attached to App Runner service
- Check image URI is correct

### Secrets not available
- Verify secret ARN format
- Check IAM role has `secretsmanager:GetSecretValue` permission
- Ensure secret key names match exactly
