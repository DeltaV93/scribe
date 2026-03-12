# @inkra/infra

AWS CDK infrastructure for Inkra. Deploys all required AWS resources for HIPAA-compliant production and staging environments.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials:
   ```bash
   aws configure
   ```

2. **Node.js 20+** and **pnpm**

3. **CDK Bootstrap** (one-time per account/region):
   ```bash
   cd packages/infra
   pnpm install
   pnpm cdk bootstrap aws://ACCOUNT_ID/us-east-2
   ```

## Quick Start

```bash
# Install dependencies
cd packages/infra
pnpm install

# Preview changes (staging)
pnpm cdk diff --all --context env=staging

# Deploy staging environment
pnpm cdk deploy --all --context env=staging

# Deploy production environment
pnpm cdk deploy --all --context env=production
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           VPC (10.0.0.0/16)                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Public Subnets                                                 │  │  │
│  │  │  ┌─────────────────┐  ┌─────────────────┐                      │  │  │
│  │  │  │   us-east-2a    │  │   us-east-2b    │                      │  │  │
│  │  │  │  NAT Gateway    │  │                 │                      │  │  │
│  │  │  └─────────────────┘  └─────────────────┘                      │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Private Subnets (App Runner VPC Connector)                     │  │  │
│  │  │  ┌─────────────────┐  ┌─────────────────┐                      │  │  │
│  │  │  │   us-east-2a    │  │   us-east-2b    │                      │  │  │
│  │  │  └─────────────────┘  └─────────────────┘                      │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Isolated Subnets (RDS, ElastiCache)                           │  │  │
│  │  │  ┌─────────────────┐  ┌─────────────────┐                      │  │  │
│  │  │  │  RDS Primary    │  │  RDS Standby    │  (Multi-AZ)          │  │  │
│  │  │  │  ElastiCache    │  │  ElastiCache    │                      │  │  │
│  │  │  └─────────────────┘  └─────────────────┘                      │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ S3 Uploads  │  │S3 Recordings│  │ S3 Exports  │  │  Secrets Manager    │ │
│  │ (KMS enc)   │  │ (KMS enc)   │  │ (KMS enc)   │  │  (API keys, creds)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            App Runner                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  inkra-{env} Service                                                  │  │
│  │  • Connects to VPC via VPC Connector                                  │  │
│  │  • Auto-scaling: 1-10 instances                                       │  │
│  │  • Public endpoint: https://app.oninkra.com                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Stacks

| Stack | Description | Resources |
|-------|-------------|-----------|
| `InkraProductionNetwork` | Network infrastructure | VPC, Subnets, NAT Gateway, Security Groups |
| `InkraProductionSecrets` | Application secrets | Secrets Manager secrets for API keys |
| `InkraProductionDatabase` | Database | RDS PostgreSQL with KMS encryption |
| `InkraProductionCache` | Cache | ElastiCache Valkey (Redis-compatible) |
| `InkraProductionStorage` | Storage | S3 buckets with KMS encryption |
| `InkraProductionApp` | Application | VPC Connector, IAM Roles |

## Deploying Individual Stacks

```bash
# Deploy only network stack
pnpm cdk deploy InkraProductionNetwork --context env=production

# Deploy database (depends on network)
pnpm cdk deploy InkraProductionDatabase --context env=production

# Deploy in order with dependencies
pnpm cdk deploy InkraProductionNetwork InkraProductionDatabase --context env=production
```

## Post-Deployment Steps

After deploying infrastructure, you still need to:

### 1. Update Secrets in Secrets Manager

```bash
# List secrets
aws secretsmanager list-secrets --query "SecretList[?contains(Name, 'inkra-production')]"

# Update a secret
aws secretsmanager put-secret-value \
  --secret-id inkra-production/supabase \
  --secret-string '{"NEXT_PUBLIC_SUPABASE_URL":"https://xxx.supabase.co","NEXT_PUBLIC_SUPABASE_ANON_KEY":"xxx","SUPABASE_SERVICE_ROLE_KEY":"xxx"}'
```

### 2. Enable pgvector Extension

```bash
# Get the database endpoint
aws rds describe-db-instances --db-instance-identifier inkra-production-db \
  --query 'DBInstances[0].Endpoint.Address' --output text

# Connect and enable pgvector
psql "postgresql://inkra_admin:PASSWORD@ENDPOINT:5432/inkra" -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. Create App Runner Service

The CDK creates the VPC Connector and IAM roles, but you need to create the App Runner service manually or via CLI:

```bash
# Create service (use values from CDK outputs)
aws apprunner create-service \
  --service-name inkra-production \
  --source-configuration '{...}' \
  --network-configuration '{
    "EgressConfiguration": {
      "EgressType": "VPC",
      "VpcConnectorArn": "FROM_CDK_OUTPUT"
    }
  }' \
  --instance-configuration '{
    "InstanceRoleArn": "FROM_CDK_OUTPUT"
  }'
```

### 4. Configure Custom Domain

```bash
# Associate custom domain
aws apprunner associate-custom-domain \
  --service-arn SERVICE_ARN \
  --domain-name app.oninkra.com
```

## Environment Configuration

Edit `lib/config/environments.ts` to customize settings:

```typescript
export const production: EnvironmentConfig = {
  name: 'production',
  region: 'us-east-2',
  domainName: 'app.oninkra.com',

  // RDS sizing
  dbInstanceClass: 'db.t3.medium',
  dbMultiAz: true,

  // App Runner sizing
  appRunnerCpu: '1024',      // 1 vCPU
  appRunnerMemory: '2048',   // 2 GB
  // ...
};
```

## HIPAA Compliance Features

This infrastructure includes HIPAA-required controls:

- **Encryption at rest**: All data encrypted with KMS (RDS, S3, Secrets)
- **Encryption in transit**: TLS everywhere (RDS, ElastiCache, S3, App Runner)
- **Key rotation**: Automatic annual rotation for all KMS keys
- **Backup retention**: 30-day backup retention for RDS
- **Access logging**: CloudWatch logs for all services
- **Network isolation**: Private subnets for databases, no public access
- **Deletion protection**: Enabled for production databases

## Cost Estimation

| Resource | Staging | Production |
|----------|---------|------------|
| RDS PostgreSQL | ~$15/mo | ~$50/mo |
| ElastiCache Valkey | ~$15/mo | ~$30/mo |
| NAT Gateway | ~$35/mo | ~$35/mo |
| App Runner | ~$20/mo | ~$50/mo |
| S3 + KMS | ~$5/mo | ~$10/mo |
| **Total** | **~$90/mo** | **~$175/mo** |

## Cleanup

```bash
# Destroy staging environment
pnpm cdk destroy --all --context env=staging

# Production has deletion protection - disable first in console if needed
```

## Troubleshooting

### CDK Bootstrap Failed
```bash
# Make sure you have the right account/region
aws sts get-caller-identity
cdk bootstrap aws://ACCOUNT_ID/us-east-2 --profile YOUR_PROFILE
```

### Stack Creation Failed
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events --stack-name InkraProductionNetwork
```

### Database Connection Issues
```bash
# Verify security group allows App Runner
aws ec2 describe-security-groups --group-ids SG_ID
```
