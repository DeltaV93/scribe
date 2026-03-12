# Credentials Tracker

Track credentials as you create isolated services. **DO NOT commit this file with values filled in.**

## Instructions

1. Copy this file to a secure location (1Password, Bitwarden, etc.)
2. Fill in values as you create each service
3. Use these values to configure Railway and AWS environments

---

## Demo Environment Credentials

### Supabase (Demo Project)
- [ ] Project created: `inkra-demo`
- [ ] Region: _______________

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://____________.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | |

### Twilio (Demo Subaccount)
- [ ] Subaccount created: `Inkra Demo`
- [ ] Phone number purchased: _______________

| Variable | Value |
|----------|-------|
| `TWILIO_ACCOUNT_SID` | `AC` |
| `TWILIO_AUTH_TOKEN` | |
| `TWILIO_TWIML_APP_SID` | `AP` |
| `TWILIO_API_KEY` | `SK` |
| `TWILIO_API_SECRET` | |
| `TWILIO_PHONE_NUMBER` | `+1` |

### Stripe (Test Mode)
- [ ] Test mode keys copied

| Variable | Value |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_test_` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_` |

### Deepgram (Demo)
- [ ] Project created: `Inkra Demo`

| Variable | Value |
|----------|-------|
| `DEEPGRAM_API_KEY` | |

### AWS (Demo IAM User)
- [ ] IAM user created: `inkra-demo`
- [ ] S3 buckets created (see below)

| Variable | Value |
|----------|-------|
| `AWS_ACCESS_KEY_ID` | `AKIA` |
| `AWS_SECRET_ACCESS_KEY` | |
| `AWS_S3_BUCKET_UPLOADS` | `scrybe-uploads-demo` |
| `AWS_S3_BUCKET_RECORDINGS` | `scrybe-recordings-demo` |
| `AWS_S3_BUCKET_EXPORTS` | `scrybe-exports-demo` |

### Generated Secrets (Demo)
Run: `openssl rand -hex 32` for each

| Variable | Value |
|----------|-------|
| `CRON_SECRET` | |
| `JOBS_API_KEY` | |
| `MFA_ENCRYPTION_KEY` | |
| `TRUSTED_DEVICE_SECRET` | |
| `ML_SERVICE_API_KEY` | |

---

## Production Environment Credentials

### App Runner Required
These are required for Next.js standalone to work on App Runner:

| Variable | Value |
|----------|-------|
| `HOSTNAME` | `0.0.0.0` |
| `PORT` | `8080` |
| `NODE_ENV` | `production` |

### Supabase (Production Project)
- [ ] Project created: `inkra-prod`
- [ ] Region: `us-west-2` (HIPAA)
- [ ] BAA signed (if required)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://____________.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | |

### Twilio (Production Subaccount)
- [ ] Subaccount created: `Inkra Production`
- [ ] Phone number purchased: _______________

| Variable | Value |
|----------|-------|
| `TWILIO_ACCOUNT_SID` | `AC` |
| `TWILIO_AUTH_TOKEN` | |
| `TWILIO_TWIML_APP_SID` | `AP` |
| `TWILIO_API_KEY` | `SK` |
| `TWILIO_API_SECRET` | |
| `TWILIO_PHONE_NUMBER` | `+1` |

### Stripe (Live Mode)
- [ ] Live mode keys copied
- [ ] Products/prices created in live mode

| Variable | Value |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_live_` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_` |

### Deepgram (Production)
- [ ] Project created: `Inkra Production`

| Variable | Value |
|----------|-------|
| `DEEPGRAM_API_KEY` | |

### Generated Secrets (Production)
Run: `openssl rand -hex 32` for each

| Variable | Value |
|----------|-------|
| `CRON_SECRET` | |
| `JOBS_API_KEY` | |
| `MFA_ENCRYPTION_KEY` | |
| `TRUSTED_DEVICE_SECRET` | |
| `ML_SERVICE_API_KEY` | |

---

## Shared Credentials

These can be shared between Demo and Production (no PHI risk):

### AI Services
| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-` |
| `OPENAI_API_KEY` | `sk-` |

---

## AWS App Runner Infrastructure

For App Runner deployments (simpler than ECS/Terraform):

### RDS PostgreSQL
| Output | Value |
|--------|-------|
| `RDS Endpoint` | `inkra-prod-db.____________.us-east-2.rds.amazonaws.com` |
| `Database Name` | `inkra` |
| `Master Username` | `inkra_admin` |
| `Master Password` | (stored separately) |
| `DATABASE_URL` | `postgresql://inkra_admin:PASSWORD@ENDPOINT:5432/inkra` |
| `DIRECT_URL` | Same as DATABASE_URL |

### ElastiCache Valkey
| Output | Value |
|--------|-------|
| `Endpoint` | `inkra-redis-prod.______.cache.amazonaws.com` |
| `Port` | `6379` |
| `REDIS_URL` | `rediss://ENDPOINT:6379` (note: `rediss` for TLS) |

### App Runner
| Output | Value |
|--------|-------|
| `VPC Connector` | `inkra-prod-connector` |
| `Service Name` | `inkra-prod` |
| `Default URL` | `https://____________.us-east-2.awsapprunner.com` |
| `Custom Domain` | `https://app.oninkra.com` |

### S3 Buckets (App Runner)
| Bucket | Name |
|--------|------|
| Uploads | `inkra-uploads-prod` |
| Recordings | `inkra-recordings-prod` |
| Exports | `inkra-exports-prod` |

---

## AWS Infrastructure Outputs (Terraform/ECS)

After running Terraform, capture these outputs:

### VPC
| Output | Value |
|--------|-------|
| `vpc_id` | `vpc-` |
| `private_subnet_ids` | |
| `public_subnet_ids` | |
| `database_subnet_ids` | |

### RDS
| Output | Value |
|--------|-------|
| `cluster_endpoint` | `.cluster-xxx.us-west-2.rds.amazonaws.com` |
| `cluster_reader_endpoint` | `.cluster-ro-xxx.us-west-2.rds.amazonaws.com` |
| `credentials_secret_arn` | `arn:aws:secretsmanager:us-west-2:xxx:secret:inkra/prod/rds/` |
| `DATABASE_URL` | (construct from above) |

### ElastiCache
| Output | Value |
|--------|-------|
| `primary_endpoint` | `.cache.amazonaws.com:6379` |
| `auth_token_secret_arn` | `arn:aws:secretsmanager:us-west-2:xxx:secret:inkra/prod/redis/` |
| `REDIS_URL` | (construct from above) |

### ECS
| Output | Value |
|--------|-------|
| `cluster_name` | `inkra-prod` |
| `ecr_repository_url` | `xxx.dkr.ecr.us-west-2.amazonaws.com/inkra-ml-services-prod` |
| `ecs_tasks_security_group_id` | `sg-` |
| `clamav_endpoint` | `clamav.inkra.internal:3310` |

### KMS
| Output | Value |
|--------|-------|
| `primary_key_arn` | `arn:aws:kms:us-west-2:xxx:key/` |
| `primary_key_alias` | `alias/inkra-prod-primary` |

### ALB
| Output | Value |
|--------|-------|
| `alb_dns_name` | `.us-west-2.elb.amazonaws.com` |
| `ml_services_target_group_arn` | `arn:aws:elasticloadbalancing:...` |

---

## GitHub Actions Secrets

Add these to GitHub repository secrets:

| Secret | Value | Source |
|--------|-------|--------|
| `AWS_ROLE_ARN` | `arn:aws:iam::xxx:role/github-actions` | IAM OIDC role |
| `PRIVATE_SUBNET_IDS` | Comma-separated | VPC outputs |
| `ECS_SECURITY_GROUP` | `sg-xxx` | VPC outputs |
| `VERCEL_TOKEN` | | Vercel account settings |
| `VERCEL_ORG_ID` | | Vercel project settings |
| `VERCEL_PROJECT_ID` | | Vercel project settings |

---

## Verification Commands

### Demo Environment
```bash
# Test Railway connection
railway status

# Test database
railway run npx prisma db pull

# Test S3 access
aws s3 ls s3://scrybe-uploads-demo/ --profile inkra-demo
```

### Production Environment
```bash
# Test RDS connection (from bastion or ECS exec)
aws ecs execute-command --cluster inkra-prod --task TASK_ID --container ml-services-api --interactive --command "/bin/sh"

# Test secrets access
aws secretsmanager get-secret-value --secret-id inkra/prod/rds/master-credentials

# Test S3 access
aws s3 ls s3://scrybe-uploads-prod/
```
