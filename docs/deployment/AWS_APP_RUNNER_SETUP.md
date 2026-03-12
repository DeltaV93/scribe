# AWS App Runner Setup for app.oninkra.com

**Step-by-Step Console Guide**

This guide walks you through setting up the Inkra web app on AWS App Runner. Follow each step in order - each section maps to a screen in the AWS Console.

---

## Prerequisites

- AWS Account (Account ID: 318928518060)
- GitHub account with access to `DeltaV93/scribe`
- Domain `oninkra.com` with DNS access
- Supabase project credentials ready
- ~2 hours for initial setup

---

## Phase 1: IAM Setup

### Step 1.1: Create IAM Policy

**Console:** IAM → Policies → Create policy

1. Click **JSON** tab
2. Paste this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::inkra-uploads-prod",
        "arn:aws:s3:::inkra-uploads-prod/*",
        "arn:aws:s3:::inkra-recordings-prod",
        "arn:aws:s3:::inkra-recordings-prod/*",
        "arn:aws:s3:::inkra-exports-prod",
        "arn:aws:s3:::inkra-exports-prod/*"
      ]
    },
    {
      "Sid": "KMSAccess",
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-east-2:318928518060:key/*"
    },
    {
      "Sid": "SESAccess",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

3. Click **Next**
4. **Policy name:** `InkraProdApplicationPolicy`
5. **Description:** `Application permissions for Inkra production`
6. Click **Create policy**

---

### Step 1.2: Create IAM User

**Console:** IAM → Users → Create user

| Field | Value |
|-------|-------|
| **User name** | `inkra-app-prod` |
| **Console access** | ❌ Do NOT enable |

1. Click **Next**
2. Select **Attach policies directly**
3. Search for `InkraProdApplicationPolicy`
4. ✅ Check the box
5. Click **Next** → **Create user**

---

### Step 1.3: Create Access Keys

**Console:** IAM → Users → `inkra-app-prod` → Security credentials

1. Scroll to **Access keys**
2. Click **Create access key**
3. Select **Application running outside AWS**
4. Click **Next** → **Create access key**
5. **⚠️ SAVE THESE NOW:**

```
Access Key ID: ____________________
Secret Access Key: ____________________
```

6. Click **Done**

---

## Phase 2: KMS Key

### Step 2.1: Create Encryption Key

**Console:** KMS → Customer managed keys → Create key

| Field | Value |
|-------|-------|
| **Key type** | Symmetric |
| **Key usage** | Encrypt and decrypt |
| **Regionality** | Single-Region key |

1. Click **Next**

| Field | Value |
|-------|-------|
| **Alias** | `inkra-phi-master-key-prod` |
| **Description** | Master encryption key for Inkra PHI data |

2. Click **Next**
3. **Key administrators:** Select your admin user
4. Click **Next**
5. **Key users:** Select `inkra-app-prod`
6. Click **Next** → **Finish**

7. **⚠️ SAVE THE KEY ARN:**

```
Key ARN: arn:aws:kms:us-east-2:318928518060:key/____________________
```

---

## Phase 3: VPC Networking

### Step 3.1: Create VPC

**Console:** VPC → Create VPC

1. Select **VPC and more**

| Field | Value |
|-------|-------|
| **Name tag auto-generation** | `inkra-prod` |
| **IPv4 CIDR block** | `10.0.0.0/16` |
| **IPv6 CIDR block** | No IPv6 |
| **Tenancy** | Default |
| **Number of Availability Zones** | 2 |
| **Number of public subnets** | 2 |
| **Number of private subnets** | 2 |
| **NAT gateways** | None (we create manually) |
| **VPC endpoints** | None |
| **DNS hostnames** | ✅ Enable |
| **DNS resolution** | ✅ Enable |

2. Click **Create VPC**
3. Wait for creation (~1 minute)

4. **⚠️ SAVE VPC ID:**

```
VPC ID: vpc-____________________
```

**Expected subnets created:**

| Subnet | CIDR | Type |
|--------|------|------|
| inkra-prod-subnet-public1-us-east-2a | 10.0.0.0/20 | Public |
| inkra-prod-subnet-public2-us-east-2b | 10.0.16.0/20 | Public |
| inkra-prod-subnet-private1-us-east-2a | 10.0.128.0/20 | Private |
| inkra-prod-subnet-private2-us-east-2b | 10.0.144.0/20 | Private |

---

### Step 3.2: Create NAT Gateway

**Console:** VPC → NAT gateways → Create NAT gateway

| Field | Value |
|-------|-------|
| **Name** | `inkra-prod-nat` |
| **Subnet** | Select a **PUBLIC** subnet (10.0.0.0/20 or 10.0.16.0/20) |
| **Connectivity type** | Public |
| **Elastic IP allocation ID** | Click **Allocate Elastic IP** |

1. Click **Create NAT gateway**
2. Wait for status: **Available** (~2 minutes)

3. **⚠️ SAVE NAT GATEWAY ID:**

```
NAT Gateway ID: nat-____________________
```

---

### Step 3.3: Update Private Subnet Route Table

**Console:** VPC → Route tables

1. Find the route table for **private subnets** (check subnet associations)
2. Click on it
3. Go to **Routes** tab → **Edit routes**
4. Click **Add route**

| Destination | Target |
|-------------|--------|
| `0.0.0.0/0` | NAT Gateway → `inkra-prod-nat` |

5. Click **Save changes**

---

## Phase 4: Security Groups

### Step 4.1: Database Security Group

**Console:** EC2 → Security Groups → Create security group

| Field | Value |
|-------|-------|
| **Security group name** | `inkra-db-sg` |
| **Description** | Security group for Inkra production database |
| **VPC** | `inkra-prod-vpc` |

**Inbound rules:** Leave empty for now (we add after App Runner SG)

**Outbound rules:** Default (all traffic)

1. Click **Create security group**

---

### Step 4.2: Cache Security Group

**Console:** EC2 → Security Groups → Create security group

| Field | Value |
|-------|-------|
| **Security group name** | `inkra-cache-sg` |
| **Description** | Security group for Inkra Valkey cache |
| **VPC** | `inkra-prod-vpc` |

**Inbound rules:** Leave empty for now

**Outbound rules:** Default (all traffic)

1. Click **Create security group**

---

### Step 4.3: Application Security Group

**Console:** EC2 → Security Groups → Create security group

| Field | Value |
|-------|-------|
| **Security group name** | `inkra-app-sg` |
| **Description** | Security group for Inkra App Runner |
| **VPC** | `inkra-prod-vpc` |

**Inbound rules:** None needed (App Runner handles ingress)

**Outbound rules:** Click **Add rule** for each:

| Type | Port | Destination | Description |
|------|------|-------------|-------------|
| PostgreSQL | 5432 | `10.0.0.0/16` | Database access |
| Custom TCP | 6379 | `10.0.0.0/16` | Valkey cache access |
| HTTPS | 443 | `0.0.0.0/0` | External APIs |

1. Click **Create security group**

2. **⚠️ SAVE SECURITY GROUP ID:**

```
inkra-app-sg ID: sg-____________________
```

---

### Step 4.4: Update DB Security Group

**Console:** EC2 → Security Groups → `inkra-db-sg` → Inbound rules → Edit

1. Click **Add rule**

| Type | Port | Source | Description |
|------|------|--------|-------------|
| PostgreSQL | 5432 | `inkra-app-sg` (select by ID) | App Runner access |

2. Click **Save rules**

---

### Step 4.5: Update Cache Security Group

**Console:** EC2 → Security Groups → `inkra-cache-sg` → Inbound rules → Edit

1. Click **Add rule**

| Type | Port | Source | Description |
|------|------|--------|-------------|
| Custom TCP | 6379 | `inkra-app-sg` (select by ID) | App Runner access |

2. Click **Save rules**

---

## Phase 5: RDS PostgreSQL

### Step 5.1: Create DB Subnet Group

**Console:** RDS → Subnet groups → Create DB subnet group

| Field | Value |
|-------|-------|
| **Name** | `inkra-prod-db-subnet-group` |
| **Description** | Private subnets for Inkra database |
| **VPC** | `inkra-prod-vpc` |

**Add subnets:** Select both **PRIVATE** subnets:
- ✅ 10.0.128.0/20 (us-east-2a)
- ✅ 10.0.144.0/20 (us-east-2b)

1. Click **Create**

---

### Step 5.2: Create RDS Instance

**Console:** RDS → Databases → Create database

| Field | Value |
|-------|-------|
| **Creation method** | Standard create |
| **Engine** | PostgreSQL |
| **Engine version** | PostgreSQL 15.x (latest) |
| **Templates** | Production (or Free tier for testing) |

**Availability:**

| Field | Value |
|-------|-------|
| **Deployment** | Single-AZ (cost savings) or Multi-AZ |

**Settings:**

| Field | Value |
|-------|-------|
| **DB instance identifier** | `inkra-prod-db` |
| **Master username** | `inkra_admin` |
| **Master password** | ⚠️ **Letters and numbers ONLY** (no special chars) |

```
Master Password: ____________________
```

**Instance configuration:**

| Field | Value |
|-------|-------|
| **DB instance class** | db.t3.micro (~$15/month) |

**Storage:**

| Field | Value |
|-------|-------|
| **Storage type** | gp3 |
| **Allocated storage** | 20 GB |
| **Storage autoscaling** | ✅ Enable (max 100 GB) |

**Connectivity:**

| Field | Value |
|-------|-------|
| **VPC** | `inkra-prod-vpc` |
| **DB subnet group** | `inkra-prod-db-subnet-group` |
| **Public access** | ❌ **No** |
| **VPC security group** | Choose existing → `inkra-db-sg` |
| **Availability Zone** | No preference |

**Database authentication:** Password authentication

**Additional configuration:**

| Field | Value |
|-------|-------|
| **Initial database name** | `inkra` |
| **Encryption** | ✅ Enable |
| **KMS key** | `inkra-phi-master-key-prod` |
| **Backup retention** | 7 days |
| **Performance Insights** | ✅ Enable |
| **Deletion protection** | ✅ Enable (production) |

1. Click **Create database**
2. Wait for status: **Available** (~5-10 minutes)

3. **⚠️ SAVE ENDPOINT:**

```
RDS Endpoint: inkra-prod-db.____________.us-east-2.rds.amazonaws.com
```

**Connection string format:**
```
postgresql://inkra_admin:PASSWORD@ENDPOINT:5432/inkra
```

---

## Phase 6: ElastiCache Valkey

### Step 6.1: Create Valkey Cluster

**Console:** ElastiCache → Valkey caches → Create

| Field | Value |
|-------|-------|
| **Cluster mode** | Disabled |
| **Name** | `inkra-redis-prod` |
| **Engine version** | Latest Valkey |
| **Node type** | cache.t3.micro (~$12/month) |
| **Number of replicas** | 0 (cost savings) |

**Subnet group:** Create new

| Field | Value |
|-------|-------|
| **Name** | `inkra-prod-cache-subnet` |
| **VPC** | `inkra-prod-vpc` |
| **Subnets** | Select both PRIVATE subnets |

**Security:**

| Field | Value |
|-------|-------|
| **Security groups** | `inkra-cache-sg` |
| **Encryption at rest** | ✅ Enable |
| **Encryption in transit** | ✅ Enable |
| **KMS key** | `inkra-phi-master-key-prod` |

1. Click **Create**
2. Wait for status: **Available** (~5 minutes)

3. **⚠️ SAVE ENDPOINT:**

```
Valkey Endpoint: inkra-redis-prod.______.cache.amazonaws.com
```

**Connection string format (note double 's' for TLS):**
```
rediss://ENDPOINT:6379
```

---

## Phase 7: S3 Buckets

### Step 7.1: Create Upload Bucket

**Console:** S3 → Create bucket

| Field | Value |
|-------|-------|
| **Bucket name** | `inkra-uploads-prod` |
| **Region** | us-east-2 |
| **Object Ownership** | ACLs disabled |
| **Block Public Access** | ✅ Block ALL |
| **Bucket Versioning** | ✅ Enable |
| **Default encryption** | SSE-KMS |
| **KMS key** | `inkra-phi-master-key-prod` |

1. Click **Create bucket**

### Repeat for other buckets:

| Bucket Name | Purpose |
|-------------|---------|
| `inkra-recordings-prod` | Call recordings |
| `inkra-exports-prod` | Data exports |
| `inkra-backups-prod` | Database backups |
| `inkra-audit-logs-prod` | Compliance logs |

---

## Phase 8: App Runner

### Step 8.1: Create VPC Connector

**Console:** App Runner → Networking → VPC connectors → Create

| Field | Value |
|-------|-------|
| **VPC connector name** | `inkra-prod-connector` |
| **VPC** | `inkra-prod-vpc` |
| **Subnets** | Select both PRIVATE subnets |
| **Security groups** | `inkra-app-sg` |

1. Click **Create**
2. Wait for status: **Active**

---

### Step 8.2: Create App Runner Service

**Console:** App Runner → Services → Create service

**Source:**

| Field | Value |
|-------|-------|
| **Repository type** | Source code repository |
| **Provider** | GitHub |
| **Connection** | Connect to GitHub (authorize if needed) |
| **Repository** | `DeltaV93/scribe` |
| **Branch** | `main` |
| **Source directory** | `/` |

> **Important:** Always deploy from `main` branch for production. Feature branches may be missing `pnpm-lock.yaml` or other required files.

**Deployment settings:**

| Field | Value |
|-------|-------|
| **Deployment trigger** | Manual (recommended) or Automatic |

1. Click **Next**

**Build settings:**

| Field | Value |
|-------|-------|
| **Configuration source** | Configure all settings here |
| **Runtime** | Nodejs 22 |
| **Build command** | See below |
| **Start command** | `node apps/web/.next/standalone/apps/web/server.js` |
| **Port** | `8080` |

**Build command** (paste this exactly):
```
corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @inkra/web db:generate && pnpm turbo run build --filter=@inkra/web
```

> **Note:** The first build may fail with "exit code 137" (out of memory). App Runner will automatically retry with a larger instance. This is normal.

1. Click **Next**

**Service settings:**

| Field | Value |
|-------|-------|
| **Service name** | `inkra-prod` |
| **CPU** | 1 vCPU |
| **Memory** | 2 GB |

**Auto scaling:**

| Field | Value |
|-------|-------|
| **Min instances** | 1 |
| **Max instances** | 25 |
| **Max concurrency** | 100 |

**Health check:**

| Field | Value |
|-------|-------|
| **Protocol** | TCP |
| **Port** | `8080` |
| **Timeout** | 5 seconds |
| **Interval** | 10 seconds |
| **Unhealthy threshold** | 5 |
| **Healthy threshold** | 1 |

**Networking:**

| Field | Value |
|-------|-------|
| **Incoming traffic** | Public endpoint |
| **Outgoing traffic** | Custom VPC |
| **VPC connector** | `inkra-prod-connector` |

1. Click **Next** → **Create & deploy**
2. Wait for deployment (~5-10 minutes)

3. **⚠️ SAVE APP RUNNER URL:**

```
Default URL: https://____________.us-east-2.awsapprunner.com
```

---

## Phase 9: Environment Variables

### Step 9.1: Configure App Runner Environment

**Console:** App Runner → `inkra-prod` → Configuration → Edit

**Environment variables:** Add each of these:

#### Required Variables

| Variable | Value |
|----------|-------|
| `HOSTNAME` | `0.0.0.0` |
| `PORT` | `8080` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://inkra_admin:PASSWORD@RDS_ENDPOINT:5432/inkra` |
| `DIRECT_URL` | Same as DATABASE_URL |
| `REDIS_URL` | `rediss://VALKEY_ENDPOINT:6379` |
| `NEXT_PUBLIC_APP_URL` | `https://app.oninkra.com` |

> **Critical:** `HOSTNAME=0.0.0.0` is required for Next.js standalone mode to accept connections from App Runner health checks. Without it, the app binds to localhost only and health checks will fail.

#### Authentication (Supabase)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |

#### AWS

| Variable | Value |
|----------|-------|
| `AWS_REGION` | `us-east-2` |
| `AWS_ACCESS_KEY_ID` | From Step 1.3 |
| `AWS_SECRET_ACCESS_KEY` | From Step 1.3 |
| `AWS_KMS_KEY_ARN` | From Step 2.1 |
| `AWS_S3_BUCKET_UPLOADS` | `inkra-uploads-prod` |
| `AWS_S3_BUCKET_RECORDINGS` | `inkra-recordings-prod` |
| `AWS_S3_BUCKET_EXPORTS` | `inkra-exports-prod` |

#### AI & Transcription

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `DEEPGRAM_API_KEY` | Your Deepgram key |

#### Security

| Variable | Value |
|----------|-------|
| `CRON_SECRET` | Generate: `openssl rand -hex 32` |
| `JOBS_API_KEY` | Generate: `openssl rand -hex 32` |

#### Optional (VoIP, Billing)

| Variable | Value |
|----------|-------|
| `TWILIO_ACCOUNT_SID` | `AC...` |
| `TWILIO_AUTH_TOKEN` | Your token |
| `STRIPE_SECRET_KEY` | `sk_live_...` |

1. Click **Save changes**
2. App will redeploy with new variables

---

## Phase 10: Database Schema

### Step 10.1: Push Schema

**Option A: Via temporary start command**

1. In App Runner → Configuration → Edit
2. Temporarily change start command to:
   ```
   npx prisma db push && npm run start
   ```
3. Save and wait for deployment
4. Check logs for "The database is already in sync"
5. Revert start command to: `npm run start`

**Option B: Local (requires temporary public RDS access)**

1. RDS → `inkra-prod-db` → Modify → **Publicly accessible: Yes**
2. Add your IP to `inkra-db-sg` inbound rules
3. Run locally:
   ```bash
   DATABASE_URL="postgresql://inkra_admin:PASSWORD@RDS_ENDPOINT:5432/inkra" npx prisma db push
   ```
4. **IMMEDIATELY** revert: **Publicly accessible: No** and remove IP

---

## Phase 11: Custom Domain

### Step 11.1: Add Custom Domain to App Runner

**Console:** App Runner → `inkra-prod` → Custom domains → Add

| Field | Value |
|-------|-------|
| **Domain name** | `app.oninkra.com` |

1. Click **Add**
2. App Runner will show DNS records to configure

---

### Step 11.2: Configure DNS

**In your DNS provider (where oninkra.com is managed):**

Add these records (App Runner will show exact values):

| Type | Name | Value |
|------|------|-------|
| CNAME | `app` | `____________.us-east-2.awsapprunner.com` |
| CNAME | `_abc123.app` | `_def456.acm-validations.aws` (for SSL) |

Wait for DNS propagation (~5-15 minutes)

---

### Step 11.3: Update Supabase

**Console:** Supabase Dashboard → Authentication → URL Configuration

| Field | Value |
|-------|-------|
| **Site URL** | `https://app.oninkra.com` |
| **Redirect URLs** | `https://app.oninkra.com/**` |

---

## Phase 12: Verification Checklist

### Health Checks

```bash
# App health
curl https://app.oninkra.com/api/health

# Should return:
# {"status":"healthy","database":"connected","redis":"connected"}
```

### Functional Tests

- [ ] App loads at https://app.oninkra.com
- [ ] Login page renders
- [ ] Can create new account
- [ ] Email confirmation works
- [ ] Can log in after confirming
- [ ] Dashboard loads

### Security Checks

- [ ] RDS is NOT publicly accessible
- [ ] All security groups have correct rules
- [ ] KMS key rotation is enabled
- [ ] S3 buckets block public access

---

## Saved Values Reference

Fill this in as you go:

```
# IAM
Access Key ID: ____________________
Secret Access Key: ____________________

# KMS
Key ARN: arn:aws:kms:us-east-2:318928518060:key/____________________

# VPC
VPC ID: vpc-____________________
NAT Gateway ID: nat-____________________

# Security Groups
inkra-app-sg: sg-____________________
inkra-db-sg: sg-____________________
inkra-cache-sg: sg-____________________

# RDS
Endpoint: inkra-prod-db.____________.us-east-2.rds.amazonaws.com
Password: ____________________

# ElastiCache
Endpoint: inkra-redis-prod.______.cache.amazonaws.com

# App Runner
Default URL: https://____________.us-east-2.awsapprunner.com
```

---

## Monthly Cost Estimate

| Service | Cost |
|---------|------|
| RDS PostgreSQL (db.t3.micro) | ~$15 |
| ElastiCache Valkey (cache.t3.micro) | ~$12 |
| App Runner (1 vCPU, 2GB, min 1) | ~$25-40 |
| NAT Gateway + data | ~$32-45 |
| KMS | ~$1 |
| S3 | ~$5-15 |
| **Total** | **~$90-130/month** |

---

## Troubleshooting

### Health check failed (app starts but deployment fails)
- **Missing `HOSTNAME=0.0.0.0`**: Next.js standalone binds to localhost by default. Without this env var, App Runner health checks can't reach the app.
- **Missing `PORT=8080`**: App must listen on the configured port.
- Check Application logs (not Deployment logs) for crash errors after "Ready in XXms"

### Build fails with exit code 137
- This means out of memory. App Runner will automatically retry with a larger instance.
- If it keeps failing, your build may need optimization.

### "pnpm-lock.yaml is absent"
- Make sure you're deploying from `main` branch (not a feature branch)
- The lock file must be committed to the repository

### "Can't reach database server"
- Check App Runner VPC connector is **Active**
- Verify `inkra-db-sg` allows inbound from `inkra-app-sg`
- Verify RDS and App Runner use same private subnets

### "fetch failed" / "ConnectTimeoutError"
- NAT Gateway not configured or in wrong subnet
- Check private subnet route table has `0.0.0.0/0` → NAT Gateway

### "The scheme is not recognized"
- Remove quotes from DATABASE_URL
- Ensure URL starts with `postgresql://`
- Use ONLY letters and numbers in password

### Web ACL / WAF errors
- If you see "Error while retrieving Web ACL" - this is usually a permissions issue, not a blocking issue
- In App Runner service → Observability, ensure no WAF is associated if you don't need it

---

**Next:** After app.oninkra.com is working, set up the ML services on ECS using the Terraform configs in `/infrastructure/terraform/`.
