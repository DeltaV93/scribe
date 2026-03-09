# Inkra Infrastructure Launch Checklist

This document provides a comprehensive checklist for launching Inkra production infrastructure.

## Pre-Launch Infrastructure Checklist

### AWS Resources

#### VPC and Networking
- [ ] VPC created with CIDR `10.0.0.0/16`
- [ ] 3 public subnets (one per AZ)
- [ ] 3 private subnets (one per AZ)
- [ ] 3 database subnets (one per AZ)
- [ ] Internet Gateway attached
- [ ] NAT Gateways provisioned (one per AZ for production)
- [ ] Route tables configured:
  - [ ] Public → Internet Gateway
  - [ ] Private → NAT Gateway
  - [ ] Database → No internet access
- [ ] Security groups created:
  - [ ] ALB security group (80, 443 inbound)
  - [ ] ECS tasks security group (3000, 8000 from ALB)
  - [ ] RDS security group (5432 from ECS)
  - [ ] ElastiCache security group (6379 from ECS)
  - [ ] ClamAV security group (3310 from ECS)
  - [ ] VPC endpoints security group (443 from VPC)
- [ ] VPC endpoints deployed:
  - [ ] S3 Gateway endpoint
  - [ ] ECR API endpoint
  - [ ] ECR DKR endpoint
  - [ ] CloudWatch Logs endpoint
  - [ ] Secrets Manager endpoint
  - [ ] KMS endpoint
- [ ] VPC Flow Logs enabled

#### KMS Keys
- [ ] Primary encryption key created (alias: `inkra-prod-primary`)
- [ ] RDS encryption key created
- [ ] ElastiCache encryption key created
- [ ] Secrets Manager encryption key created
- [ ] Key rotation enabled
- [ ] Key policies allow:
  - [ ] Root account full access
  - [ ] ECS task role encrypt/decrypt
  - [ ] S3 service encrypt/decrypt
  - [ ] CloudWatch Logs encrypt
  - [ ] Key administrators manage
- [ ] CloudTrail logging for key operations

#### S3 Buckets
| Bucket | Status | Encryption | Versioning | Lifecycle |
|--------|--------|------------|------------|-----------|
| `scrybe-uploads-prod` | [ ] | KMS | [ ] | 90-day version cleanup |
| `scrybe-recordings-prod` | [ ] | KMS | [ ] | Glacier 1yr, delete 7yr |
| `scrybe-exports-prod` | [ ] | KMS | [ ] | 30-day retention |
| `scrybe-backups-prod` | [ ] | KMS | [ ] | Deep Archive 90d, 7yr |
| `scrybe-access-logs-prod` | [ ] | KMS | [ ] | 1-year retention |
| `scrybe-audit-logs-prod` | [ ] | KMS + Object Lock | [ ] | 7-year governance |

- [ ] Block public access on all buckets
- [ ] Cross-region replication configured:
  - [ ] Uploads → us-east-1 replica
  - [ ] Recordings → us-east-1 replica
  - [ ] Backups → us-east-1 replica
- [ ] Bucket policies enforce:
  - [ ] KMS encryption required
  - [ ] TLS required
  - [ ] Same-account only

#### RDS Aurora PostgreSQL
- [ ] Aurora cluster created: `inkra-prod`
- [ ] Engine: PostgreSQL 16.1
- [ ] Multi-AZ: Enabled (2 instances minimum)
- [ ] Instance class: `db.serverless` or `db.r6g.large`
- [ ] Serverless v2 scaling: 0.5-16 ACU
- [ ] Encryption at rest: KMS
- [ ] SSL required: `rds.force_ssl = 1`
- [ ] pgvector extension enabled: `CREATE EXTENSION vector;`
- [ ] Parameter group customizations:
  - [ ] `shared_preload_libraries = pg_stat_statements,pgvector`
  - [ ] `log_statement = ddl`
  - [ ] `log_connections = 1`
  - [ ] `log_disconnections = 1`
- [ ] Automated backups: 7-day retention
- [ ] Backup window: 03:00-04:00 UTC
- [ ] Maintenance window: Sun 04:00-05:00 UTC
- [ ] Performance Insights enabled
- [ ] Enhanced monitoring enabled (60s interval)
- [ ] Deletion protection enabled
- [ ] Master credentials in Secrets Manager

#### ElastiCache Redis
- [ ] Replication group created: `inkra-prod`
- [ ] Engine: Redis 7.1
- [ ] Node type: `cache.r6g.large`
- [ ] Cluster: 2 nodes (primary + replica)
- [ ] Multi-AZ enabled
- [ ] Encryption at rest: KMS
- [ ] Encryption in transit: TLS
- [ ] Auth token configured
- [ ] Auth token in Secrets Manager
- [ ] Parameter group customizations:
  - [ ] `maxmemory-policy = volatile-lru`
  - [ ] `appendonly = yes`
  - [ ] Dangerous commands disabled (FLUSHALL, FLUSHDB, DEBUG)
- [ ] Snapshot retention: 7 days
- [ ] Automatic failover enabled

#### ECS Cluster
- [ ] Fargate cluster created: `inkra-prod`
- [ ] Container Insights enabled
- [ ] ECR repository created: `inkra-ml-services-prod`
- [ ] ECR lifecycle policy (keep last 10 images)
- [ ] Task definitions created:
  - [ ] ML Services API (1024 CPU, 2048 MB)
  - [ ] ML Services Worker (1024 CPU, 2048 MB)
  - [ ] ML Services Beat (256 CPU, 512 MB)
  - [ ] ClamAV (512 CPU, 1024 MB)
- [ ] Services deployed:
  - [ ] ml-services-api (desired: 2)
  - [ ] ml-services-worker (desired: 2)
  - [ ] ml-services-beat (desired: 1)
  - [ ] clamav (desired: 1)
- [ ] Auto-scaling configured:
  - [ ] API: 2-10 tasks, target CPU 70%
  - [ ] Worker: 2-20 tasks, target CPU 70%
- [ ] Service discovery namespace: `inkra.internal`
- [ ] ClamAV discoverable at: `clamav.inkra.internal:3310`
- [ ] ECS Exec enabled for debugging
- [ ] CloudWatch log groups created:
  - [ ] `/ecs/inkra-prod/ml-services`
  - [ ] `/ecs/inkra-prod/clamav`
  - [ ] `/ecs/inkra-prod/exec`

#### IAM Roles
- [ ] ECS Task Execution Role:
  - [ ] AmazonECSTaskExecutionRolePolicy
  - [ ] Secrets Manager access
  - [ ] KMS decrypt for secrets
- [ ] ECS Task Role:
  - [ ] S3 read/write for application buckets
  - [ ] KMS encrypt/decrypt for data
  - [ ] Secrets Manager read
  - [ ] SSM messages for ECS Exec
  - [ ] CloudWatch Logs write

#### Application Load Balancer
- [ ] ALB created in public subnets
- [ ] HTTPS listener (port 443)
- [ ] HTTP → HTTPS redirect
- [ ] SSL policy: `ELBSecurityPolicy-TLS13-1-2-2021-06`
- [ ] ACM certificate attached for `*.inkra.app`
- [ ] Target groups:
  - [ ] ML Services (port 8000, health: `/healthz`)
- [ ] Listener rules:
  - [ ] `ml.inkra.app` → ML Services target group
- [ ] Access logging enabled
- [ ] Deletion protection enabled (production)

#### Route53 / DNS
- [ ] Hosted zone for `inkra.app`
- [ ] Records configured:
  - [ ] `app.inkra.app` → Vercel
  - [ ] `ml.inkra.app` → ALB (alias)
  - [ ] `demo.inkra.app` → Railway
- [ ] SSL certificates valid (ACM)
- [ ] CAA records (optional)

#### Monitoring and Alerting
- [ ] CloudWatch dashboard: `inkra-prod-overview`
- [ ] SNS topics:
  - [ ] `inkra-prod-alerts-critical`
  - [ ] `inkra-prod-alerts-warning`
  - [ ] `inkra-prod-alerts-info`
- [ ] Email subscriptions confirmed
- [ ] Alarms configured:
  - [ ] ECS CPU > 80% (warning)
  - [ ] ECS Memory > 80% (warning)
  - [ ] ALB 5xx > 50/min (critical)
  - [ ] ALB p95 latency > 2s (warning)
  - [ ] RDS CPU > 90% (critical)
  - [ ] RDS connections > 200 (warning)
  - [ ] RDS storage < 10GB (critical)
  - [ ] Redis memory > 90% (critical)
  - [ ] Redis evictions > 1000 (warning)

#### Security and Compliance
- [ ] CloudTrail enabled (all regions)
- [ ] VPC Flow Logs enabled
- [ ] GuardDuty enabled (optional)
- [ ] AWS Config enabled (optional)
- [ ] Security Hub enabled (optional)
- [ ] IAM Access Analyzer enabled
- [ ] Root account MFA enabled
- [ ] IAM password policy configured

---

### Third-Party Services Verification

#### Supabase (Production)
- [ ] Production project exists: `inkra-prod`
- [ ] Region: us-west-2 (HIPAA region)
- [ ] Auth providers configured
- [ ] Row Level Security enabled
- [ ] BAA signed (if required)

#### Twilio (Production)
- [ ] Production subaccount exists
- [ ] Production phone number purchased
- [ ] TwiML app configured
- [ ] Webhooks pointing to production URLs:
  - [ ] Voice: `https://app.inkra.app/api/webhooks/twilio/voice`
  - [ ] Status: `https://app.inkra.app/api/webhooks/twilio/status`

#### Stripe (Live Mode)
- [ ] Live mode keys ready
- [ ] Products and prices created
- [ ] Webhook endpoint: `https://app.inkra.app/api/billing/webhook`
- [ ] Webhook events selected
- [ ] Signing secret stored

#### Deepgram (Production)
- [ ] Production project exists
- [ ] API key created

---

### CI/CD Pipeline

#### GitHub Actions
- [ ] OIDC provider created in AWS
- [ ] IAM role for GitHub Actions
- [ ] Secrets configured:
  - [ ] `AWS_ROLE_ARN`
  - [ ] `VERCEL_TOKEN`
  - [ ] `VERCEL_ORG_ID`
  - [ ] `VERCEL_PROJECT_ID`
  - [ ] `ANTHROPIC_API_KEY`
- [ ] Main app workflow passing
- [ ] ML services workflow passing

#### Vercel
- [ ] Production project created
- [ ] Environment variables set
- [ ] Domain configured: `app.inkra.app`
- [ ] Preview deployments working

---

## Launch Day Procedures

### T-2 Hours: Final Preparation
- [ ] Notify team of deployment window
- [ ] Confirm on-call engineer
- [ ] Open monitoring dashboards
- [ ] Verify staging is stable
- [ ] Final code review complete

### T-0: Deployment
1. **Merge to main**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

2. **Verify CI/CD**
   - [ ] GitHub Actions pipeline started
   - [ ] All jobs passing
   - [ ] Vercel deployment initiated

3. **Database Migrations**
   - [ ] Migrations executed successfully
   - [ ] Schema verified

4. **Health Checks**
   ```bash
   curl https://app.inkra.app/api/health
   curl https://ml.inkra.app/healthz
   ```

### T+15 Minutes: Smoke Tests
- [ ] Login working
- [ ] Form creation working
- [ ] Client creation working
- [ ] Test call (internal) working
- [ ] Transcription processing
- [ ] Form extraction working

### T+1 Hour: Monitoring
- [ ] Error rate < 0.1%
- [ ] Latency p95 < 500ms
- [ ] No 5xx errors
- [ ] Database healthy
- [ ] Redis healthy
- [ ] Background jobs processing

---

## Rollback Procedures

### Application Rollback
```bash
# Vercel
vercel rollback --yes

# ECS (specific version)
aws ecs update-service \
  --cluster inkra-prod \
  --service ml-services-api \
  --task-definition inkra-prod-ml-services-api:PREVIOUS \
  --force-new-deployment
```

### Database Rollback
```bash
# Point-in-time recovery
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier inkra-prod \
  --db-cluster-identifier inkra-prod-restored \
  --restore-to-time "2026-03-08T12:00:00Z"
```

---

## Terraform Commands Reference

```bash
# Initialize all modules
cd infrastructure/terraform
for dir in kms vpc rds elasticache ecs alb monitoring; do
  cd $dir
  terraform init
  cd ..
done

# Plan (dry run)
cd vpc
terraform plan -var-file=environments/production.tfvars

# Apply
terraform apply -var-file=environments/production.tfvars

# Recommended order:
# 1. kms (keys needed by other resources)
# 2. vpc (networking needed by all services)
# 3. rds (database)
# 4. elasticache (cache)
# 5. ecs (compute)
# 6. alb (load balancer)
# 7. monitoring (dashboards/alarms)
```

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-Call Engineer | TBD |
| Engineering Lead | TBD |
| AWS Support | AWS Console |
| Vercel Support | support.vercel.com |

---

## Sign-Off

| Checkpoint | Verified By | Date |
|------------|-------------|------|
| VPC/Networking | | |
| KMS Keys | | |
| S3 Buckets | | |
| RDS Aurora | | |
| ElastiCache | | |
| ECS Cluster | | |
| ALB/DNS | | |
| Monitoring | | |
| Third-Party Services | | |
| CI/CD Pipeline | | |
| **Launch Approved** | | |
