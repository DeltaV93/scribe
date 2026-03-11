# Production Launch Plan

## Execution Strategy

### Work Breakdown by Type

| Type | Tickets | Who |
|------|---------|-----|
| **Manual Setup** | PX-908 to PX-912 (third-party accounts) | Human |
| **Terraform** | PX-915 to PX-921 (AWS infra) | Claude/Human |
| **CI/CD Config** | PX-923 to PX-925 | Claude/Human |
| **Security Verification** | PX-927 to PX-930 | Human + Claude |
| **Testing** | PX-932 to PX-934 | Claude/Human |
| **Go-Live** | PX-936 to PX-938 | Human |

### Optimal Execution Order

```
Week 1: Foundation (Can parallelize)
├── Stream A: Third-Party Services (Human)
│   ├── PX-908: Supabase projects
│   ├── PX-909: Twilio subaccounts
│   ├── PX-910: Stripe verification
│   ├── PX-911: AWS IAM setup
│   └── PX-912: Deepgram keys
│
└── Stream B: Railway Demo (Claude + Human)
    └── PX-913: Railway setup

Week 2: AWS Infrastructure (Sequential - dependencies)
├── PX-915: Deploy VPC (first, others depend on it)
├── PX-916: Deploy RDS (needs VPC)
├── PX-917: Deploy ElastiCache (needs VPC)
├── PX-918: Deploy ECS (needs VPC, gets RDS/Redis endpoints)
├── PX-919: Deploy ALB (needs VPC, ECS)
├── PX-920: Deploy Monitoring (needs all above)
└── PX-921: Verify Infrastructure

Week 3: CI/CD + Security (Can parallelize)
├── Stream A: CI/CD
│   ├── PX-923: GitHub OIDC
│   ├── PX-924: Vercel project
│   └── PX-925: GitHub secrets
│
└── Stream B: Security
    ├── PX-927: AWS security services
    ├── PX-928: App security verification
    ├── PX-929: ClamAV deployment
    └── PX-930: OWASP ZAP scan

Week 4: Testing + Go-Live
├── PX-932: E2E tests
├── PX-933: DR test
├── PX-934: Load testing
├── PX-936: Pre-launch verification
├── PX-937: DNS cutover
└── PX-938: Post-launch monitoring
```

### What Claude Can Do Autonomously

**Fully Automated (just run it):**
- Terraform plan/apply (with approval)
- GitHub Actions workflow setup
- Documentation updates
- E2E test execution
- Load test script creation

**Needs Human Input:**
- Creating third-party accounts (Supabase, Twilio, Stripe)
- Purchasing phone numbers
- AWS BAA signing
- DNS changes (final approval)
- Go/no-go decision

### Execution Plan: Parallel Streams

**Stream A (Human)** - Start immediately:
```
PX-908: Create Supabase projects (demo + prod)
PX-909: Create Twilio subaccounts + phone numbers
PX-910: Verify Stripe test/live keys
PX-911: Create AWS IAM user for demo
PX-912: Create Deepgram API keys
```
→ Output needed: All credentials for `.env` files

**Stream B (Claude)** - Start immediately:
```
PX-913: Set up Railway demo environment
  - Create Railway project
  - Add PostgreSQL + Redis services
  - Configure environment variables (use placeholders)
  - Run migrations
```

**Stream C (Claude)** - After VPC outputs ready:
```
PX-915 → PX-916 → PX-917 → PX-918 → PX-919 → PX-920 → PX-921
(Terraform modules in dependency order)
```

**Stream D (Claude)** - After infrastructure:
```
PX-923: GitHub OIDC provider
PX-924: Vercel project setup
PX-925: GitHub secrets configuration
```

**Handoff Points:**
1. Human → Claude: Credentials ready → Update Railway env vars
2. Claude → Human: Terraform outputs → Use for DNS/Vercel config
3. Human → Claude: DNS updated → Run E2E tests

### Start Commands

**For Claude (now):**
```
Start PX-913 (Railway setup)
```

**For Human (now):**
```
1. Go to supabase.com → Create 2 projects (demo, prod)
2. Go to twilio.com → Create 2 subaccounts
3. Go to stripe.com → Copy test + live API keys
4. Go to deepgram.com → Create 2 API keys
5. AWS Console → Create IAM user for demo
```

Once you provide credentials, I'll update Railway and we proceed to Terraform.

---

## Overview

Deploy Inkra to production with two **fully isolated** environments:
- **Demo**: Railway (rapid iteration, customer demos, NO PHI)
- **Production**: AWS (HIPAA-compliant, scalable, real customer data)

### Compliance Rationale

| Aspect | Demo | Production |
|--------|------|------------|
| **Data** | Synthetic/test only | Real PHI |
| **BAA Required** | No | Yes (AWS) |
| **SOC2 Scope** | Out of scope | In scope |
| **Audit Trail** | Basic logging | Full compliance audit |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEMO (Railway) - NO PHI                      │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App ─► Railway PostgreSQL ─► Railway Redis            │
│       │                                                          │
│       └──► S3 (demo bucket) ─► Supabase Auth (demo project)    │
│       └──► Twilio (demo number) ─► Deepgram (demo key)         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      PRODUCTION (AWS)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │ Route53 │───►│ CloudFront  │───►│ Vercel (Next.js)        │ │
│  └─────────┘    └─────────────┘    │ or ECS Fargate          │ │
│                                     └───────────┬─────────────┘ │
│                                                 │                │
│  ┌──────────────────────────────────────────────┼──────────────┐│
│  │ VPC (Private)                                ▼              ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │ RDS Aurora  │  │ ElastiCache │  │ ECS Fargate         │ ││
│  │  │ PostgreSQL  │  │ Redis       │  │ (ML Services)       │ ││
│  │  │ (Multi-AZ)  │  │ (Cluster)   │  │ - API Service       │ ││
│  │  └─────────────┘  └─────────────┘  │ - Worker Service    │ ││
│  │                                     │ - Beat Scheduler    │ ││
│  │                                     │ - Ray Cluster       │ ││
│  │                                     └─────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ S3 Buckets (KMS Encrypted, Cross-Region Replicated)        ││
│  │  - scrybe-uploads-prod, scrybe-recordings-prod             ││
│  │  - scrybe-exports-prod, scrybe-backups-prod                ││
│  │  - scrybe-audit-logs-prod (Object Lock)                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Decision Points (Day 1-2)

### 1.1 WebSocket Architecture Decision

| Option | Pros | Cons |
|--------|------|------|
| A: Defer (post-call only) | Launch faster, less complexity | No real-time transcription |
| B: Pusher/Ably (managed) | Quick to implement, scales | Monthly cost, vendor dependency |
| C: Socket.io on ECS | Full control, no vendor | More complexity |

**Recommendation:** Option A (defer) for initial launch.

### 1.2 ClamAV Hosting Decision

| Option | Pros | Cons |
|--------|------|------|
| A: ClamAV on Railway (demo) | Free, simple | Not for production PHI |
| B: ClamAV on ECS (prod) | HIPAA-compliant | ECS task cost |
| C: VirusTotal API | No hosting | Per-scan cost |

**Recommendation:** Option B for production, Option A for demo.

---

## Phase 2: Service Isolation Setup (Day 3-4)

### 2.1 Create Isolated Third-Party Services

**Supabase:**
- [ ] Create new Supabase project: `inkra-demo`
- [ ] Create new Supabase project: `inkra-prod`
- [ ] Configure auth settings (email, OAuth providers)
- [ ] Enable Row Level Security on both

**Twilio:**
- [ ] Create subaccount: `Inkra Demo`
- [ ] Create subaccount: `Inkra Production`
- [ ] Purchase demo phone number
- [ ] Purchase production phone number
- [ ] Configure webhook URLs per environment

**Stripe:**
- [ ] Verify test mode keys for demo
- [ ] Verify live mode keys for production
- [ ] Configure webhook endpoints per environment

**AWS (Separate IAM Users/Roles):**
- [ ] Create IAM user `inkra-demo` with limited S3 access
- [ ] Create IAM role `inkra-prod` for ECS with full access
- [ ] Create demo S3 buckets (no KMS, no replication)
- [ ] Prod S3 buckets already in Terraform

**Deepgram:**
- [ ] Create separate API key for demo
- [ ] Create separate API key for production (usage tracking)

---

## Phase 3: Railway Demo Environment (Day 5-7)

### 3.1 Railway Services

| Service | Configuration |
|---------|--------------|
| **Next.js App** | `railway.toml`, auto-deploy from `main` |
| **PostgreSQL** | Railway managed, pgvector extension |
| **Redis** | Railway managed |

### 3.2 Railway Tasks

- [ ] Create Railway project
- [ ] Add PostgreSQL service
- [ ] Add Redis service
- [ ] Configure environment variables
- [ ] Enable pgvector: `CREATE EXTENSION vector;`
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Test: `/api/health`

---

## Phase 4: AWS Production Infrastructure (Day 8-14)

### 4.1 Prerequisites

- [ ] AWS account with HIPAA BAA
- [ ] Domain on Route53/Cloudflare
- [ ] SSL certificates in ACM
- [ ] VPC with public/private subnets (3 AZs)
- [ ] KMS key for encryption

### 4.2 Terraform Deployment

```bash
# 1. KMS Keys
cd infrastructure/terraform/kms
terraform init && terraform apply -var-file=environments/production.tfvars

# 2. S3 Buckets
cd ../..
terraform init && terraform apply

# 3. ML Services
cd ml-services/terraform
terraform init -backend-config=environments/prod/backend.tfvars
terraform apply -var-file=environments/prod/terraform.tfvars
```

### 4.3 Infrastructure Checklist

**Networking:**
- [ ] VPC with 3 AZs
- [ ] Public subnets (NAT Gateway)
- [ ] Private subnets (ECS, RDS, ElastiCache)
- [ ] Security groups
- [ ] VPC endpoints (S3, ECR, CloudWatch)

**Database:**
- [ ] RDS PostgreSQL 16 (Multi-AZ)
- [ ] pgvector extension enabled
- [ ] Automated backups (7-day)
- [ ] Performance Insights

**Cache:**
- [ ] ElastiCache Redis 7 cluster
- [ ] Multi-AZ
- [ ] Auth token enabled

**Storage:**
- [ ] S3 buckets via Terraform
- [ ] KMS encryption
- [ ] Cross-region replication
- [ ] Lifecycle policies
- [ ] Object Lock on audit logs

**Compute:**
- [ ] ECR repository
- [ ] ECS cluster
- [ ] API/Worker/Beat task definitions
- [ ] Ray head/worker tasks
- [ ] Auto-scaling policies

**Monitoring:**
- [ ] CloudWatch dashboards
- [ ] SNS alarm topics
- [ ] Critical alarms (CPU, memory, 5xx)

---

## Phase 5: CI/CD Pipeline (Day 15-17)

### 5.1 GitHub Actions Secrets

```yaml
AWS_ROLE_ARN: arn:aws:iam::xxx:role/github-actions
PRIVATE_SUBNET_IDS: subnet-xxx,subnet-yyy
ECS_SECURITY_GROUP: sg-xxx
```

### 5.2 Tasks

- [ ] Create GitHub Actions OIDC provider in AWS
- [ ] Create IAM role for GitHub Actions
- [ ] Add secrets to GitHub
- [ ] Test ML Services deployment
- [ ] Configure Vercel project
- [ ] Test end-to-end deployment

---

## Phase 6: Security & Compliance (Day 18-20)

### 6.1 AWS Security

- [ ] Enable CloudTrail
- [ ] Enable VPC Flow Logs
- [ ] Enable GuardDuty
- [ ] Configure AWS Config
- [ ] Enable Security Hub
- [ ] Review IAM (least privilege)
- [ ] Enable MFA for root

### 6.2 Application Security

- [ ] Field-level encryption working
- [ ] Audit logging verified
- [ ] MFA implementation tested
- [ ] Session timeout (15 min)
- [ ] OWASP ZAP scan

### 6.3 ClamAV Production

```yaml
# ECS Task Definition
Family: clamav-scanner-prod
Container:
  Image: clamav/clamav:latest
  CPU: 512
  Memory: 1024
  PortMappings: 3310:3310
```

- [ ] Create ECS task definition
- [ ] Create ECS service
- [ ] Test with EICAR file

---

## Phase 7: Testing & Validation (Day 21-23)

### 7.1 E2E Tests

```bash
PLAYWRIGHT_BASE_URL=https://app.inkra.app npm run test:e2e
```

- [ ] Auth flows
- [ ] Form builder
- [ ] Client management
- [ ] Call workflow
- [ ] Consent flows
- [ ] Export/import

### 7.2 DR Test

Per disaster recovery policy:
- [ ] Test RDS failover
- [ ] Test S3 cross-region access
- [ ] Test ECS service restart
- [ ] Measure RTO/RPO

---

## Phase 8: Go-Live (Day 24-27)

### 8.1 Pre-Launch

- [ ] All E2E tests passing
- [ ] Monitoring dashboards working
- [ ] Alerts configured
- [ ] Runbooks accessible
- [ ] On-call rotation set
- [ ] Status page configured

### 8.2 DNS Cutover

```
inkra.app → Vercel/CloudFront
app.inkra.app → Vercel/CloudFront
ml.inkra.app → ALB (ML Services)
```

### 8.3 Post-Launch Monitoring

- [ ] Error rates < 0.1%
- [ ] Latency p95 < 500ms
- [ ] Database connections healthy
- [ ] Background jobs processing
- [ ] Transcription working

---

## Environment Variables

### Full Isolation Matrix

| Service | Demo | Production |
|---------|------|------------|
| **Supabase** | Separate project (demo) | Separate project (prod) |
| **S3 Buckets** | `scrybe-*-demo` | `scrybe-*-prod` |
| **Twilio** | Demo number/subaccount | Prod number/subaccount |
| **Stripe** | Test mode keys | Live mode keys |
| **Deepgram** | Demo API key | Prod API key |
| **Anthropic** | Shared (no PHI in prompts) | Prod API key |
| **OpenAI** | Shared (embeddings only) | Prod API key |

### Demo (Railway) - NO PHI

```env
# Database (Railway)
DATABASE_URL=postgresql://...@railway/inkra_demo
REDIS_URL=redis://...@railway:6379

# Supabase (DEMO PROJECT)
NEXT_PUBLIC_SUPABASE_URL=https://demo-xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...demo
SUPABASE_SERVICE_ROLE_KEY=eyJ...demo

# AWS S3 (DEMO BUCKET)
AWS_ACCESS_KEY_ID=AKIA...demo
AWS_SECRET_ACCESS_KEY=...demo
S3_BUCKET_NAME=scrybe-uploads-demo
S3_RECORDINGS_BUCKET=scrybe-recordings-demo

# Twilio (DEMO SUBACCOUNT)
TWILIO_ACCOUNT_SID=AC...demo
TWILIO_AUTH_TOKEN=...demo
TWILIO_DEFAULT_CALLER_ID=+1555...demo

# Stripe (TEST MODE)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# App
NEXT_PUBLIC_APP_URL=https://demo.inkra.app
NODE_ENV=production
```

### Production (AWS) - HIPAA/SOC2 COMPLIANT

```env
# Database (RDS Multi-AZ)
DATABASE_URL=postgresql://...@rds.amazonaws.com:5432/inkra?sslmode=require
REDIS_URL=rediss://...@cache.amazonaws.com:6379

# Supabase (PROD PROJECT)
NEXT_PUBLIC_SUPABASE_URL=https://prod-xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...prod
SUPABASE_SERVICE_ROLE_KEY=eyJ...prod

# AWS S3 (PROD BUCKETS with KMS)
AWS_KMS_KEY_ID=arn:aws:kms:us-west-2:xxx:key/yyy
S3_BUCKET_NAME=scrybe-uploads-prod
S3_RECORDINGS_BUCKET=scrybe-recordings-prod

# Twilio (PROD SUBACCOUNT)
TWILIO_ACCOUNT_SID=AC...prod
TWILIO_AUTH_TOKEN=...prod
TWILIO_DEFAULT_CALLER_ID=+1...prod

# Stripe (LIVE MODE)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...

# ClamAV (ECS)
CLAMAV_HOST=clamav.internal
CLAMAV_PORT=3310

# App
NEXT_PUBLIC_APP_URL=https://app.inkra.app
NODE_ENV=production
```

---

## Critical Files

| Purpose | Path |
|---------|------|
| **Execution Guide** | `docs/deployment/EXECUTION_GUIDE.md` |
| **Credentials Tracker** | `docs/deployment/CREDENTIALS_TRACKER.md` |
| **Infrastructure Checklist** | `docs/deployment/INFRASTRUCTURE_LAUNCH_CHECKLIST.md` |
| **Service Isolation** | `docs/deployment/SERVICE_ISOLATION.md` |
| **Railway Setup** | `docs/deployment/RAILWAY_DEMO_SETUP.md` |
| Railway config | `railway.toml` |
| VPC Terraform | `infrastructure/terraform/vpc/main.tf` |
| RDS Terraform | `infrastructure/terraform/rds/main.tf` |
| ECS Terraform | `infrastructure/terraform/ecs/main.tf` |
| KMS Terraform | `infrastructure/terraform/kms/main.tf` |
| S3 Terraform | `infrastructure/s3/main.tf` |
| CI/CD ML Services | `.github/workflows/ml-services.yml` |
| CI/CD Main App | `.github/workflows/main-app.yml` |

---

## Verification

1. **Health Endpoints**
   - `GET /api/health` → 200
   - `GET https://ml.inkra.app/healthz` → 200

2. **Database**
   - pgvector enabled
   - Migrations applied
   - ECS connections working

3. **Services**
   - Auth working
   - Twilio calls connecting
   - Transcription processing
   - Form extraction working

---

## Rollback Plan

1. **Immediate:** Revert DNS to demo
2. **ECS:** `aws ecs update-service --force-new-deployment` with previous task def
3. **Database:** Point-in-time recovery
4. **Full:** Follow `docs/compliance/runbooks/region-failover.md`
