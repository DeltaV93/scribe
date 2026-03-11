# Production Launch Execution Guide

Quick reference for executing the production launch plan with Linear ticket mapping.

---

## Week 1: Foundation

### Stream A: Third-Party Services (You)

| Ticket | Task | Status | Notes |
|--------|------|--------|-------|
| **PX-908** | Create Supabase projects | | `inkra-demo` + `inkra-prod` |
| **PX-909** | Create Twilio subaccounts | | Buy phone numbers |
| **PX-910** | Verify Stripe keys | | Test + Live mode |
| **PX-911** | Create AWS IAM user | | `inkra-demo` for demo env |
| **PX-912** | Create Deepgram keys | | Separate demo/prod |

**Quick Commands:**
```bash
# Generate secrets for .env
openssl rand -hex 32  # MFA_ENCRYPTION_KEY
openssl rand -hex 32  # TRUSTED_DEVICE_SECRET
openssl rand -hex 32  # CRON_SECRET
openssl rand -hex 32  # JOBS_API_KEY
```

### Stream B: Railway Demo (You)

| Ticket | Task | Status | Notes |
|--------|------|--------|-------|
| **PX-913** | Create Railway project | | See [RAILWAY_DEMO_SETUP.md](./RAILWAY_DEMO_SETUP.md) |

**Steps:**
1. `railway login`
2. Create project via web UI or `railway init`
3. Add PostgreSQL service
4. Add Redis service
5. Enable pgvector: `railway connect postgres` then `CREATE EXTENSION vector;`
6. Configure env vars from CREDENTIALS_TRACKER.md
7. Deploy: push to `main` branch

---

## Week 2: AWS Infrastructure (You)

| Ticket | Task | Depends On | Notes |
|--------|------|------------|-------|
| **PX-915** | Deploy VPC | - | `cd infrastructure/terraform/vpc && terraform apply` |
| **PX-916** | Deploy RDS | VPC | `cd ../rds && terraform apply` |
| **PX-917** | Deploy ElastiCache | VPC | `cd ../elasticache && terraform apply` |
| **PX-918** | Deploy ECS | VPC, RDS, Redis | `cd ../ecs && terraform apply` |
| **PX-919** | Deploy ALB | VPC, ECS | `cd ../alb && terraform apply` |
| **PX-920** | Deploy Monitoring | All | `cd ../monitoring && terraform apply` |
| **PX-921** | Verify Infrastructure | All | Run health checks |

**Terraform Execution Order:**
```bash
cd infrastructure/terraform

# 1. KMS (if not already)
cd kms && terraform init && terraform apply -var-file=environments/production.tfvars

# 2. VPC
cd ../vpc && terraform init && terraform apply

# 3. RDS (capture outputs)
cd ../rds && terraform init && terraform apply \
  -var="vpc_id=$(terraform -chdir=../vpc output -raw vpc_id)" \
  -var="database_subnet_ids=$(terraform -chdir=../vpc output -json database_subnet_ids)" \
  # ... other vars

# Continue in order...
```

**Capture Outputs:**
After each module, save outputs to CREDENTIALS_TRACKER.md.

---

## Week 3: CI/CD + Security

### Stream A: CI/CD (You)

| Ticket | Task | Status | Notes |
|--------|------|--------|-------|
| **PX-923** | Create GitHub OIDC | | AWS IAM OIDC provider |
| **PX-924** | Setup Vercel project | | Connect repo, set env vars |
| **PX-925** | Configure GitHub secrets | | See CREDENTIALS_TRACKER.md |

**GitHub OIDC Setup:**
```bash
# In AWS Console or via CLI:
# 1. Create OIDC provider for GitHub
# 2. Create IAM role with trust policy for GitHub Actions
# 3. Add to GitHub secrets as AWS_ROLE_ARN
```

### Stream B: Security (You)

| Ticket | Task | Status | Notes |
|--------|------|--------|-------|
| **PX-927** | Enable AWS security services | | CloudTrail, GuardDuty, Config |
| **PX-928** | Verify app security | | Encryption, audit logs |
| **PX-929** | Verify ClamAV | | Test with EICAR file |
| **PX-930** | Run OWASP ZAP scan | | Against staging URL |

---

## Week 4: Testing + Go-Live

### Testing

| Ticket | Task | Status | Notes |
|--------|------|--------|-------|
| **PX-932** | Run E2E tests | | `PLAYWRIGHT_BASE_URL=https://demo.inkra.app npm run test:e2e` |
| **PX-933** | DR test | | Test RDS failover, S3 cross-region |
| **PX-934** | Load testing | | Artillery or k6 |

### Go-Live

| Ticket | Task | Status | Notes |
|--------|------|--------|-------|
| **PX-936** | Pre-launch verification | | All checklist items green |
| **PX-937** | DNS cutover | | Point `app.inkra.app` to Vercel |
| **PX-938** | Post-launch monitoring | | Watch dashboards for 4 hours |

---

## Quick Reference: File Locations

| Purpose | File |
|---------|------|
| Railway config | `railway.toml` |
| VPC Terraform | `infrastructure/terraform/vpc/main.tf` |
| RDS Terraform | `infrastructure/terraform/rds/main.tf` |
| ECS Terraform | `infrastructure/terraform/ecs/main.tf` |
| KMS Terraform | `infrastructure/terraform/kms/main.tf` |
| S3 Terraform | `infrastructure/s3/main.tf` |
| CI/CD ML Services | `.github/workflows/ml-services.yml` |
| CI/CD Main App | `.github/workflows/main-app.yml` |
| Full checklist | `docs/deployment/INFRASTRUCTURE_LAUNCH_CHECKLIST.md` |
| Service isolation | `docs/deployment/SERVICE_ISOLATION.md` |
| Credentials tracker | `docs/deployment/CREDENTIALS_TRACKER.md` |

---

## Verification Commands

### Demo Health Check
```bash
curl -s https://demo.inkra.app/api/health | jq
```

### Production Health Check
```bash
curl -s https://app.inkra.app/api/health | jq
curl -s https://ml.inkra.app/healthz | jq
```

### Database Verification
```bash
# Demo
railway run npx prisma db pull

# Production
aws ecs execute-command \
  --cluster inkra-prod \
  --task TASK_ARN \
  --container ml-services-api \
  --interactive \
  --command "alembic current"
```

---

## Rollback Commands

### Vercel
```bash
vercel rollback --yes
```

### ECS
```bash
aws ecs update-service \
  --cluster inkra-prod \
  --service ml-services-api \
  --task-definition inkra-prod-ml-services-api:PREVIOUS_VERSION \
  --force-new-deployment
```

### DNS (Emergency)
Point `app.inkra.app` back to `demo.inkra.app` while investigating.

---

## Support Contacts

| Service | Support URL |
|---------|-------------|
| AWS | AWS Console → Support |
| Railway | https://railway.app/help |
| Vercel | https://vercel.com/support |
| Supabase | https://supabase.com/docs |
| Twilio | https://console.twilio.com/support |
