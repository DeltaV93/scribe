# Infrastructure Rebuild Runbook

**Runbook ID:** RB-INFRA-001
**Last Updated:** February 4, 2026
**Owner:** DevOps Team

---

## Overview

This runbook provides step-by-step instructions for rebuilding the complete Scrybe production infrastructure on AWS from scratch. Use this document if the infrastructure needs to be recreated due to a disaster, region migration, or environment provisioning.

**Estimated Rebuild Time:** 2-4 hours (manual), excludes data migration

## Current Production Configuration Summary

| Component | Service | Region | Identifier |
|-----------|---------|--------|------------|
| **VPC** | Amazon VPC | us-east-2 | scrybe-prod-vpc (vpc-0eb6ee9cd198ad718) |
| **Database** | Amazon RDS PostgreSQL | us-east-2b | scrybe-prod-db |
| **Cache** | Amazon ElastiCache Valkey | us-east-2 | scrybe-redis-prod |
| **Application** | AWS App Runner | us-east-2 | scrybe-prod |
| **Encryption** | AWS KMS | us-east-2 | scrybe-phi-master-key-prod |
| **Storage** | Amazon S3 | us-east-2 | Multiple buckets (see S3 section) |
| **NAT** | NAT Gateway | us-east-2 | scrybe-prod-nat |
| **Auth** | Supabase (external) | - | Supabase project |

## AWS Account Details

| Item | Value |
|------|-------|
| **AWS Account ID** | 318928518060 |
| **Primary Region** | us-east-2 (Ohio) |
| **Secondary Region** | us-east-1 (N. Virginia) |
| **IAM Application User** | scrybe-app-prod |
| **Environment** | Production |

---

## Phase 1: IAM Setup

### 1.1 Create Application IAM Policy

1. Go to **IAM** → **Policies** → **Create policy**
2. Select **JSON** tab
3. Paste policy (see `/infrastructure/terraform/kms/main.tf` for current policy)
4. Policy should include permissions for:
   - S3 (GetObject, PutObject, DeleteObject, ListBucket)
   - KMS (Encrypt, Decrypt, GenerateDataKey, DescribeKey)
   - SES (SendEmail, SendRawEmail) if using AWS SES
5. Name: `ScrybeProdApplicationPolicy`
6. Click **Create policy**

### 1.2 Create Application IAM User

1. Go to **IAM** → **Users** → **Create user**
2. **User name**: `scrybe-app-prod`
3. Do NOT enable console access
4. Click **Next**
5. **Attach policies directly** → Search and select `ScrybeProdApplicationPolicy`
6. Click **Create user**
7. Go to the user → **Security credentials** → **Create access key**
8. Select **Application running outside AWS**
9. **Save the Access Key ID and Secret Access Key** securely

---

## Phase 2: KMS Key

### 2.1 Create KMS Key

1. Go to **KMS** → **Customer managed keys** → **Create key**
2. **Key type**: Symmetric
3. **Key usage**: Encrypt and decrypt
4. **Alias**: `scrybe-phi-master-key-prod`
5. **Description**: Master encryption key for Scrybe PHI data
6. **Key administrators**: Your admin IAM user
7. **Key usage permissions**: `scrybe-app-prod` IAM user
8. **Automatic key rotation**: Enable (annually)
9. Click **Create key**
10. **Save the Key ARN** (format: `arn:aws:kms:us-east-2:318928518060:key/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

> **HIPAA Note**: This key encrypts all PHI at rest. Enable CloudTrail logging for key usage auditing.

---

## Phase 3: VPC Networking

### 3.1 Create VPC

1. Go to **VPC** → **Create VPC**
2. Select **VPC and more** (creates subnets, route tables, etc.)
3. Settings:

| Setting | Value |
|---------|-------|
| **Name tag** | `scrybe-prod` |
| **IPv4 CIDR** | `10.0.0.0/16` |
| **Number of Availability Zones** | 2 |
| **Number of public subnets** | 2 |
| **Number of private subnets** | 2 |
| **NAT gateways** | None (we create manually in 3.2) |
| **VPC endpoints** | None |
| **DNS hostnames** | Enable |
| **DNS resolution** | Enable |

4. Click **Create VPC**

**Expected Subnets Created:**

| Subnet | CIDR | AZ | Type |
|--------|------|----|------|
| project-subnet-public1-us-east-2a | 10.0.0.0/20 | us-east-2a | Public |
| project-subnet-public2-us-east-2b | 10.0.16.0/20 | us-east-2b | Public |
| project-subnet-private1-us-east-2a | 10.0.128.0/20 | us-east-2a | Private |
| project-subnet-private2-us-east-2b | 10.0.144.0/20 | us-east-2b | Private |

### 3.2 Create NAT Gateway

Required for private subnets to reach external services (Supabase, Stripe, Anthropic, etc.).

1. Go to **VPC** → **NAT gateways** → **Create NAT gateway**
2. Settings:

| Setting | Value |
|---------|-------|
| **Name** | `scrybe-prod-nat` |
| **Availability mode** | Zonal |
| **VPC** | scrybe-prod-vpc |
| **Subnet** | Select a **public** subnet (10.0.0.0/20 or 10.0.16.0/20) |
| **Connectivity type** | Public |
| **EIP allocation** | Automatic |

3. Click **Create NAT gateway**
4. Wait for status to change to **Available**

### 3.3 Update Private Subnet Route Table

1. Go to **VPC** → **Route tables**
2. Find the route table associated with the **private subnets**
3. Click on it → **Routes** tab → **Edit routes**
4. Add route:

| Destination | Target |
|-------------|--------|
| `0.0.0.0/0` | NAT Gateway (`scrybe-prod-nat`) |

5. Click **Save changes**

> **Cost**: NAT Gateway ~$32/month + data transfer charges.

---

## Phase 4: Security Groups

### 4.1 Create Database Security Group

1. Go to **EC2** → **Security Groups** → **Create security group**
2. Settings:

| Setting | Value |
|---------|-------|
| **Name** | `scrybe-db-sg` |
| **Description** | Security group for Scrybe production database |
| **VPC** | scrybe-prod-vpc |

3. **Inbound rules**: Leave empty for now (will add App Runner SG after it's created)
4. **Outbound rules**: Default (all traffic)
5. Click **Create security group**

### 4.2 Create Cache Security Group

1. Go to **EC2** → **Security Groups** → **Create security group**
2. Settings:

| Setting | Value |
|---------|-------|
| **Name** | `scrybe-cache-sg` |
| **Description** | Security group for Scrybe Valkey cache |
| **VPC** | scrybe-prod-vpc |

3. **Inbound rules**: Leave empty for now
4. **Outbound rules**: Default (all traffic)
5. Click **Create security group**

### 4.3 Create Application Security Group

1. Go to **EC2** → **Security Groups** → **Create security group**
2. Settings:

| Setting | Value |
|---------|-------|
| **Name** | `scrybe-app-sg` |
| **Description** | Security group for Scrybe App Runner |
| **VPC** | scrybe-prod-vpc |

3. **Inbound rules**: None needed (App Runner handles ingress)
4. **Outbound rules**:

| Type | Port | Destination | Description |
|------|------|-------------|-------------|
| PostgreSQL | 5432 | `10.0.0.0/16` | Database access within VPC |
| Custom TCP | 6379 | `10.0.0.0/16` | Valkey cache access within VPC |
| HTTPS | 443 | `0.0.0.0/0` | External APIs (Supabase, Stripe, etc.) |

5. Click **Create security group**

### 4.4 Update Database Security Group Inbound Rules

1. Go to **EC2** → **Security Groups** → **scrybe-db-sg**
2. **Edit inbound rules** → **Add rule**:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| PostgreSQL | 5432 | `scrybe-app-sg` (select by SG ID) | App Runner access |

3. Click **Save rules**

### 4.5 Update Cache Security Group Inbound Rules

1. Go to **EC2** → **Security Groups** → **scrybe-cache-sg**
2. **Edit inbound rules** → **Add rule**:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| Custom TCP | 6379 | `scrybe-app-sg` (select by SG ID) | App Runner access |

3. Click **Save rules**

> **Important**: Outbound rules on `scrybe-app-sg` must use `10.0.0.0/16` (VPC CIDR) for database and cache, NOT `0.0.0.0/16` which is invalid.

---

## Phase 5: RDS PostgreSQL Database

### 5.1 Create DB Subnet Group

1. Go to **RDS** → **Subnet groups** → **Create DB subnet group**
2. Settings:

| Setting | Value |
|---------|-------|
| **Name** | `scrybe-prod-db-subnet-group` |
| **Description** | Private subnets for Scrybe database |
| **VPC** | scrybe-prod-vpc |

3. **Add subnets**: Select both **private** subnets
   - `subnet-xxxxx` (10.0.128.0/20) us-east-2a
   - `subnet-xxxxx` (10.0.144.0/20) us-east-2b

4. Click **Create**

### 5.2 Create RDS Instance

1. Go to **RDS** → **Databases** → **Create database**
2. Settings:

| Setting | Value |
|---------|-------|
| **Creation method** | Standard create |
| **Engine** | PostgreSQL |
| **Engine version** | 15.x (latest minor) |
| **Template** | Production (or Free Tier for dev) |
| **Availability** | Single-AZ (cost optimization) |
| **DB instance identifier** | `scrybe-prod-db` |
| **Master username** | `scrybe_admin` |
| **Master password** | Letters and numbers only, no special characters |
| **Instance class** | db.t3.micro (~$15/month) |
| **Storage type** | gp3 |
| **Allocated storage** | 20 GB |
| **Storage autoscaling** | Enable (max 100 GB) |
| **VPC** | scrybe-prod-vpc |
| **Subnet group** | scrybe-prod-db-subnet-group |
| **Public access** | **No** |
| **Security group** | scrybe-db-sg |
| **Database name** | `scrybe` |
| **Encryption** | Enable |
| **KMS key** | scrybe-phi-master-key-prod |
| **Backup retention** | 7 days |
| **Performance Insights** | Enable (free for db.t3.micro) |

3. Click **Create database**
4. Wait for status to become **Available** (5-10 minutes)

> **Important**: Save the master password securely. AWS does not store it for retrieval. Use only letters and numbers to avoid URL encoding issues.

### 5.3 Record Connection Details

After creation, note:
- **Endpoint**: `scrybe-prod-db.xxxxxxxxxx.us-east-2.rds.amazonaws.com`
- **Port**: 5432
- **Database**: scrybe
- **Username**: scrybe_admin

**Connection string format**:
```
postgresql://scrybe_admin:PASSWORD@ENDPOINT:5432/scrybe
```

---

## Phase 6: ElastiCache Valkey (Redis-Compatible)

### 6.1 Create Valkey Cluster

1. Go to **ElastiCache** → **Valkey caches** → **Create**
2. Settings:

| Setting | Value |
|---------|-------|
| **Cluster mode** | Disabled |
| **Name** | `scrybe-redis-prod` |
| **Engine version** | Latest Valkey version |
| **Node type** | cache.t3.micro (~$12/month) |
| **Number of replicas** | 0 (cost optimization) |
| **Subnet group** | Create new with private subnets |
| **VPC** | scrybe-prod-vpc |
| **Security group** | scrybe-cache-sg |
| **Encryption at rest** | Enable |
| **Encryption in transit** | Enable |
| **KMS key** | scrybe-phi-master-key-prod |

3. Click **Create**
4. Wait for status to become **Available**

### 6.2 Record Connection Details

After creation, note:
- **Primary endpoint**: `scrybe-redis-prod.xxxxx.cache.amazonaws.com`
- **Port**: 6379

**Connection string format** (note double 's' for TLS):
```
rediss://ENDPOINT:6379
```

> **Note**: Valkey is Redis-compatible. The ioredis library works without code changes.

---

## Phase 7: S3 Buckets

See `/infrastructure/README.md` for Terraform-based S3 deployment.

### 7.1 Required Buckets

| Bucket Name | Purpose | Versioning | Encryption |
|-------------|---------|------------|------------|
| `scrybe-uploads-prod` | User uploads, documents | Enabled | KMS |
| `scrybe-recordings-prod` | Call recordings | Enabled | KMS |
| `scrybe-exports-prod` | Data exports, reports | Enabled | KMS |
| `scrybe-backups-prod` | Database backups | Enabled | KMS |
| `scrybe-audit-logs-prod` | Compliance audit logs | Enabled | KMS + Object Lock |

### 7.2 Common Bucket Settings (HIPAA Required)

For each bucket:
- **Block all public access**: Enabled
- **Versioning**: Enabled
- **Default encryption**: SSE-KMS with `scrybe-phi-master-key-prod`
- **Access logging**: Enable to a separate logging bucket
- **TLS enforcement**: Bucket policy requiring `aws:SecureTransport`
- **Lifecycle policies**: Per `/infrastructure/s3/main.tf`

### 7.3 Deploy via Terraform

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with actual values
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

---

## Phase 8: AWS App Runner

### 8.1 Create VPC Connector

1. Go to **App Runner** → **Networking** → **VPC connectors** → **Create**
2. Settings:

| Setting | Value |
|---------|-------|
| **Name** | `scrybe-prod-connector` |
| **VPC** | scrybe-prod-vpc |
| **Subnets** | Both private subnets |
| **Security group** | scrybe-app-sg |

3. Click **Create**

### 8.2 Create App Runner Service

1. Go to **App Runner** → **Create service**
2. **Source configuration**:

| Setting | Value |
|---------|-------|
| **Repository type** | Source code repository |
| **Provider** | GitHub |
| **Connection** | Connect to GitHub account |
| **Repository** | `DeltaV93/scribe` |
| **Branch** | `main` |
| **Source directory** | `/` |
| **Deployment trigger** | Automatic (on push to main) |

3. **Build settings**:

| Setting | Value |
|---------|-------|
| **Configuration source** | API |
| **Runtime** | Node.js 22 |
| **Build command** | `npm install && npx prisma generate && npm run build` |
| **Start command** | `npm run start` |
| **Port** | `3000` |

4. **Service settings**:

| Setting | Value |
|---------|-------|
| **Service name** | `scrybe-prod` |
| **CPU** | 1 vCPU |
| **Memory** | 2 GB |

5. **Auto scaling**:

| Setting | Value |
|---------|-------|
| **Min instances** | 1 |
| **Max instances** | 25 |
| **Concurrency** | 100 |

6. **Health check**:

| Setting | Value |
|---------|-------|
| **Protocol** | TCP |
| **Port** | 3000 |
| **Timeout** | 5 seconds |
| **Interval** | 10 seconds |
| **Unhealthy threshold** | 5 |
| **Healthy threshold** | 1 |

7. **Networking**:

| Setting | Value |
|---------|-------|
| **Incoming** | Public endpoint |
| **Outgoing** | Custom VPC |
| **VPC connector** | scrybe-prod-connector |

8. Click **Create & deploy**

### 8.3 Record App Runner URL

After deployment, note:
- **Default domain**: `https://xxxxxxxxxx.us-east-2.awsapprunner.com`

---

## Phase 9: Environment Variables

### 9.1 Required Variables

Set these in **App Runner** → **Configuration** → **Environment variables**:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://scrybe_admin:PASSWORD@RDS_ENDPOINT:5432/scrybe` | No special chars in password |
| `DIRECT_URL` | Same as DATABASE_URL | Required by Prisma |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | From Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | From Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | From Supabase dashboard |
| `NEXT_PUBLIC_APP_URL` | `https://xxxxxxxxxx.us-east-2.awsapprunner.com` | Your App Runner URL |
| `NODE_ENV` | `production` | |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | From Anthropic dashboard |
| `AWS_REGION` | `us-east-2` | |
| `AWS_ACCESS_KEY_ID` | IAM user access key | From Phase 1.2 |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | From Phase 1.2 |
| `AWS_KMS_KEY_ARN` | KMS key ARN | From Phase 2.1 |
| `REDIS_URL` | `rediss://VALKEY_ENDPOINT:6379` | Note: double 's' for TLS |
| `CRON_SECRET` | Random secure string | For cron job auth |
| `JOBS_API_KEY` | Random secure string | For job endpoint auth |

### 9.2 Optional Variables (Feature-Dependent)

| Variable | Purpose |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | VoIP calling |
| `TWILIO_AUTH_TOKEN` | VoIP calling |
| `TWILIO_TWIML_APP_SID` | Browser-based calling |
| `TWILIO_API_KEY` | Client access tokens |
| `TWILIO_API_SECRET` | Client access tokens |
| `TWILIO_PHONE_NUMBER` | SMS notifications |
| `STRIPE_SECRET_KEY` | Billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Checkout UI |
| `STRIPE_*_PRICE_ID` | Subscription plan price IDs |
| `DEEPGRAM_API_KEY` | Speech-to-text |
| `OPENAI_API_KEY` | Embeddings |
| `SENDGRID_API_KEY` | Email delivery |
| `TEAMS_CLIENT_ID` / `TEAMS_CLIENT_SECRET` | Teams integration |
| `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | Zoom integration |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Meet integration |
| `NEXT_PUBLIC_RADAR_KEY` | Address autocomplete |
| `SENTRY_DSN` | Error tracking |
| `AWS_S3_BUCKET_UPLOADS` | Upload bucket name |
| `AWS_S3_BUCKET_RECORDINGS` | Recordings bucket name |
| `AWS_S3_BUCKET_EXPORTS` | Exports bucket name |
| `AWS_S3_BUCKET_BACKUPS` | Backups bucket name |
| `AWS_S3_BUCKET_AUDIT_LOGS` | Audit logs bucket name |

> **Important**: Never add quotes around environment variable values in App Runner. Use only letters and numbers in the database password to avoid URL encoding issues.

---

## Phase 10: Database Schema Setup

### 10.1 Initial Schema Push

On first deployment, the database will be empty. Run schema push:

**Option A: Via App Runner start command (one-time)**

Temporarily change the start command to:
```
npx prisma db push && npm run start
```

Deploy, verify tables are created (check logs for "The database is already in sync"), then revert start command to:
```
npm run start
```

**Option B: From local machine (requires temporary public access)**

1. Temporarily set RDS to **Publicly accessible: Yes**
2. Add your IP to `scrybe-db-sg` inbound rules
3. Run:
```bash
DATABASE_URL="postgresql://scrybe_admin:PASSWORD@RDS_ENDPOINT:5432/scrybe" npx prisma db push
```
4. Immediately revert: Set **Publicly accessible: No** and remove your IP

---

## Phase 11: Supabase Configuration

### 11.1 Update Supabase URLs

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Set:

| Setting | Value |
|---------|-------|
| **Site URL** | `https://xxxxxxxxxx.us-east-2.awsapprunner.com` |
| **Redirect URLs** | `https://xxxxxxxxxx.us-east-2.awsapprunner.com/**` |

---

## Phase 12: AWS BAA (HIPAA Compliance)

### 12.1 Sign Business Associate Agreement

1. Go to **AWS Artifact** → **Agreements**
2. Find **AWS Business Associate Addendum (BAA)**
3. Review and accept the agreement
4. This covers all HIPAA-eligible AWS services used

> **Critical**: The BAA must be signed before processing any PHI in production.

---

## Phase 13: Post-Deployment Verification

### 13.1 Verification Checklist

- [ ] App Runner service status is **Running**
- [ ] App loads at the public URL
- [ ] Login page renders correctly
- [ ] User can sign up and receive confirmation email
- [ ] Confirmation email links to correct URL (not localhost)
- [ ] User can log in after confirming email
- [ ] Dashboard loads with database data
- [ ] No `PrismaClientInitializationError` in logs
- [ ] No `fetch failed` / `ConnectTimeoutError` in logs
- [ ] Teams/Zoom/Google warnings are acceptable (optional integrations)
- [ ] Rate limiting is functional (check for Redis connection)

### 13.2 Security Verification

- [ ] RDS is NOT publicly accessible
- [ ] All security groups have correct rules
- [ ] KMS key rotation is enabled
- [ ] S3 buckets block public access
- [ ] NAT Gateway is functional (app can reach external APIs)
- [ ] AWS BAA is signed

---

## Monthly Cost Estimate

| Service | Configuration | Est. Monthly Cost |
|---------|--------------|-------------------|
| **RDS PostgreSQL** | db.t3.micro, Single-AZ, 20GB | ~$15 |
| **ElastiCache Valkey** | cache.t3.micro | ~$12 |
| **App Runner** | 1 vCPU, 2GB, min 1 instance | ~$25-40 |
| **NAT Gateway** | Single AZ + data transfer | ~$32-45 |
| **KMS** | 1 key + API calls | ~$1 |
| **S3** | Storage + requests | ~$5-15 |
| **Elastic IP** | For NAT Gateway | Included with NAT |
| **Total** | | **~$90-130/month** |

> **Cost optimization**: The largest cost driver is the NAT Gateway. If costs need to be reduced further, consider VPC endpoints for AWS services (S3, KMS) to reduce NAT data transfer.

---

## Troubleshooting Common Issues

### "Can't reach database server"
- Verify App Runner VPC connector is **Active**
- Verify `scrybe-db-sg` allows inbound from `scrybe-app-sg` on port 5432
- Verify `scrybe-app-sg` has outbound rule to `10.0.0.0/16` on port 5432
- Verify RDS and App Runner are in the **same VPC**
- Verify RDS and App Runner use the **same private subnets**

### "The scheme is not recognized in database URL"
- Remove quotes from DATABASE_URL value
- Ensure URL starts with `postgresql://`
- Check for special characters in password (use only letters and numbers)
- Remove trailing spaces
- Verify both `DATABASE_URL` and `DIRECT_URL` are set

### "fetch failed" / "ConnectTimeoutError"
- NAT Gateway is missing or not configured
- Private subnet route table doesn't have `0.0.0.0/0` → NAT Gateway route
- NAT Gateway is in wrong subnet (must be in **public** subnet)
- `scrybe-app-sg` outbound rules missing HTTPS (443) to `0.0.0.0/0`

### "Table does not exist"
- Database schema not pushed. Run `npx prisma db push`
- See Phase 10 for schema setup options

### Health check fails / Container exit code 1
- Check application logs in CloudWatch
- Usually caused by DATABASE_URL or other env var issues
- Start command might be failing before the app starts listening

### App Runner deployment rolls back
- Check build logs for compilation errors
- Check start command isn't running a command that fails (like `prisma migrate deploy` without migration files)
- Ensure start command is simply `npm run start`

---

## Related Documents

- [Disaster Recovery Policy](../policies/disaster-recovery-policy.md)
- [Database Restore Runbook](./database-restore.md)
- [S3 Failover Runbook](./s3-failover.md)
- [Incident Response Runbook](./incident-response.md)
- [Infrastructure README](/infrastructure/README.md)
- [KMS Infrastructure](/infrastructure/terraform/kms/README.md)
- [S3 Security Hardening](/docs/technical/s3-security-hardening.md)
- [AWS KMS Key Management](/docs/technical/aws-kms-key-management.md)
- [Environment Variables Reference](/.env.example)
