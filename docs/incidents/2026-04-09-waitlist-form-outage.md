# Incident Report: Waitlist Form Outage

**Incident ID:** INC-2026-04-09-001
**Date:** April 9, 2026
**Duration:** ~2 days (intermittent), fully resolved April 9, 2026
**Severity:** Medium (Marketing site form non-functional)
**Status:** Resolved

---

## Summary

The waitlist form on oninkra.com (marketing site) was failing to submit with error:
```json
{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An error occurred. Please try again."}}
```

---

## Timeline

| Time | Event |
|------|-------|
| **Apr 8, 2:04 PM** | First logged error: "Can't reach database server" |
| **Apr 9, 9:32 AM** | Continued errors in logs |
| **Apr 9, 10:10 AM** | Issue reported, investigation begins |
| **Apr 9, ~12:30 PM** | Identified VPC Connector security group mismatch |
| **Apr 9, ~1:30 PM** | Deployed fix: new VPC Connector with correct security group |
| **Apr 9, ~10:00 PM** | Identified missing Waitlist table in database |
| **Apr 9, ~10:15 PM** | Ran migrations via temporary EC2 instance |
| **Apr 9, 10:18 PM** | **Incident resolved** - form working |

---

## Root Causes

### Primary Cause: VPC Connector Security Group Mismatch

The App Runner VPC Connector was configured with the wrong security group:
- **Configured:** `scrybe-db-sg` (sg-0aa99047ecbb2d47f)
- **Should be:** `scrybe-app-sg` (sg-00e3f789895090238)

The RDS security group (`scrybe-db-sg`) only allows inbound traffic from `scrybe-app-sg`. Since App Runner was using `scrybe-db-sg`, the traffic appeared to come from the database security group, which was not in the allowed inbound list.

### Secondary Cause: Missing Database Table

After fixing the connectivity issue, a second error appeared:
```
The table `public.Waitlist` does not exist in the current database.
```

The Waitlist table had not been created via migrations. This likely occurred because:
1. Migrations were not run after initial RDS setup, OR
2. A schema change was deployed but not migrated to production

---

## Resolution

### Fix 1: VPC Connector Security Group

1. Created new VPC Connector `scrybe-prod-vpc` with security group `scrybe-app-sg`
2. Updated App Runner service to use the new VPC Connector
3. Deployed the change

### Fix 2: Database Migrations

1. Launched temporary EC2 instance in the VPC with SSM access
2. Connected via Session Manager
3. Ran `npx prisma@5.22.0 db push` to sync schema
4. Terminated the EC2 instance

### Additional Fix: Build Memory

During troubleshooting, discovered builds were failing with OOM (exit code 137). Added:
- Environment variable: `NODE_OPTIONS=--max-old-space-size=4096`

---

## Impact

- **Users affected:** Unknown (potential waitlist signups during outage period)
- **Duration:** ~2 days (errors started Apr 8)
- **Business impact:** Lost potential waitlist signups
- **Data loss:** None

---

## Lessons Learned

### What went well
- Quick identification once investigation started
- EC2/SSM approach for migrations worked smoothly
- No data loss

### What didn't go well
- Took ~2 days to notice the issue
- VPC Connector was misconfigured during initial setup
- No monitoring alert for database connectivity errors
- No automated migration process for private RDS

---

## Action Items

| Priority | Action | Owner | Status |
|----------|--------|-------|--------|
| High | Add monitoring/alerting for API error rates | DevOps | TODO |
| High | Document VPC Connector security group requirements | DevOps | DONE |
| Medium | Create EC2 migration runbook | DevOps | DONE |
| Medium | Consider adding migration to CI/CD or startup | DevOps | TODO |
| Low | Review all security group configurations | DevOps | TODO |

---

## Documentation Updates

The following documentation was created/updated as a result of this incident:

- **Created:** `docs/compliance/runbooks/database-migration-ec2.md`
- **Updated:** `docs/deployment/AWS_APP_RUNNER_SETUP.md` (VPC Connector warning, troubleshooting)
- **Updated:** `docs/compliance/runbooks/infrastructure-rebuild.md` (VPC Connector guidance)
- **Updated:** `docs/compliance/runbooks/database-restore.md` (EC2 migration method)
- **Created:** This incident report

---

## Related Documents

- [Database Migration via EC2 Runbook](../compliance/runbooks/database-migration-ec2.md)
- [AWS App Runner Setup](../deployment/AWS_APP_RUNNER_SETUP.md)
- [Infrastructure Rebuild Runbook](../compliance/runbooks/infrastructure-rebuild.md)
