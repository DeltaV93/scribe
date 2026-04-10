# Database Migration via EC2 Runbook

**Runbook ID:** RB-DB-002
**Last Updated:** April 9, 2026
**Owner:** DevOps Team

---

## Overview

This runbook documents how to run Prisma database migrations against a **private RDS instance** using a temporary EC2 instance with AWS Systems Manager Session Manager access.

**Use this when:**
- RDS is not publicly accessible (Internet access gateway: Disabled)
- You need to run `prisma db push`, `prisma migrate deploy`, or other schema commands
- CI/CD cannot reach the private database

**Estimated Time:** 15-30 minutes

---

## Prerequisites

- AWS Console access with EC2 and IAM permissions
- Git repository access (for cloning the codebase)
- Database credentials (DATABASE_URL)

---

## Procedure

### Step 1: Create IAM Role for SSM (One-Time Setup)

If `EC2-SSM-Role` doesn't exist, create it:

1. Go to **IAM Console** → **Roles** → **Create role**
2. **Trusted entity type**: AWS service
3. **Use case**: EC2
4. Click **Next**
5. Search and select: `AmazonSSMManagedInstanceCore`
6. Click **Next**
7. **Role name**: `EC2-SSM-Role`
8. **Description**: Allows EC2 instances to use Systems Manager Session Manager
9. Click **Create role**

> **Note:** This role can be reused for all future migrations. Do not delete it.

---

### Step 2: Launch Temporary EC2 Instance

1. Go to **EC2 Console** → **Instances** → **Launch instance**

2. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `temp-migration-runner` |
| **AMI** | Amazon Linux 2023 (free tier eligible) |
| **Instance type** | `t2.micro` (free tier) |
| **Key pair** | Proceed without key pair (using Session Manager) |

3. **Network settings** → Click **Edit**:

| Setting | Value |
|---------|-------|
| **VPC** | `scrybe-prod-vpc` (vpc-0eb6ee9cd198ad718) |
| **Subnet** | Private subnet in same AZ as RDS (e.g., `subnet-0cae9bde3531d89bd` for us-east-2b) |
| **Auto-assign public IP** | Disable |
| **Security group** | Select existing → `scrybe-app-sg` |

4. **Advanced details** (expand):

| Setting | Value |
|---------|-------|
| **IAM instance profile** | `EC2-SSM-Role` |

5. Click **Launch instance**

6. Wait for instance state: **Running** (~1 minute)

---

### Step 3: Connect via Session Manager

1. Go to **EC2** → **Instances** → select `temp-migration-runner`
2. Click **Connect**
3. Select **Session Manager** tab
4. Click **Connect**

> **Note:** If Session Manager shows "SSM agent not connected", wait 1-2 minutes for the agent to register.

---

### Step 4: Install Dependencies

In the Session Manager terminal:

```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git

# Verify
node --version
```

---

### Step 5: Clone Repository

```bash
cd /tmp

# For public repo:
git clone https://github.com/DeltaV93/scribe.git

# For private repo (use personal access token):
# git clone https://YOUR_GITHUB_TOKEN@github.com/DeltaV93/scribe.git

cd scribe
```

---

### Step 6: Run Migration

Set environment variables and run the migration:

```bash
# Export database URLs (replace with actual credentials)
export DATABASE_URL="postgresql://scrybe_admin:PASSWORD@scrybe-prod-db.XXXXXXXXXX.us-east-2.rds.amazonaws.com:5432/scrybe"
export DIRECT_URL="$DATABASE_URL"

# Use the same Prisma version as the project (check package.json)
npx prisma@5.22.0 db push
```

**Expected output:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "scrybe", schema "public" at "scrybe-prod-db.XXXXXXXXXX.us-east-2.rds.amazonaws.com:5432"

🚀 Your database is now in sync with your Prisma schema. Done in X.XXs
```

---

### Step 7: Verify Migration

```bash
# Check that key tables exist
psql "$DATABASE_URL" -c "\dt"

# Or check specific table
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"User\";"
```

If psql is not installed:
```bash
sudo yum install -y postgresql15
```

---

### Step 8: Cleanup - IMPORTANT

**Always terminate the EC2 instance after migration:**

1. Go to **EC2 Console** → **Instances**
2. Select `temp-migration-runner`
3. **Instance state** → **Terminate instance**
4. Confirm termination

> **Warning:** Leaving the instance running incurs costs and is a security risk (it has database access).

---

## Troubleshooting

### "SSM agent status: Not connected"

- Wait 1-2 minutes for the agent to register
- Verify the IAM instance profile is attached correctly
- Check the instance is in a private subnet with NAT Gateway for SSM connectivity

### "Error: Could not find Prisma Schema"

- Make sure you're in the repository root directory (`cd /tmp/scribe`)
- Check the `prisma/schema.prisma` file exists

### "The provided database string is invalid"

- Ensure DATABASE_URL is on a single line (no line breaks)
- Check for special characters in password (use only letters and numbers)
- Verify the URL format: `postgresql://user:password@host:5432/database`

### "Can't reach database server"

- Verify EC2 is in the same VPC as RDS
- Verify EC2 security group (`scrybe-app-sg`) is allowed by RDS security group
- Check RDS is running (status: Available)

### "Unsupported engine" warnings

- These are warnings, not errors. The migration should still complete.
- To avoid: Use the exact Prisma version from the project's package.json

---

## Security Considerations

- **Never commit credentials** to the repository
- **Always terminate** the EC2 instance after migration
- **Use Session Manager** instead of SSH keys (no ports need to be opened)
- **EC2 instance should use `scrybe-app-sg`** which is already authorized for database access

---

## Related Documents

- [Infrastructure Rebuild Runbook](./infrastructure-rebuild.md)
- [Database Restore Runbook](./database-restore.md)
- [AWS App Runner Setup](../../deployment/AWS_APP_RUNNER_SETUP.md)
