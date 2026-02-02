# Incident Response Runbook

**Runbook ID:** RB-IR-001
**Last Updated:** February 1, 2026
**Owner:** Security Team

---

## Overview

This runbook provides step-by-step instructions for responding to security incidents, service outages, and other critical events affecting Scrybe systems.

## Incident Classification

### Severity Levels

| Severity | Impact | Examples | Response Time |
|----------|--------|----------|---------------|
| **SEV-1** | Critical - Service down, data breach | Complete outage, confirmed breach, ransomware | 15 minutes |
| **SEV-2** | Major - Significant degradation | Major feature unavailable, potential breach | 30 minutes |
| **SEV-3** | Moderate - Limited impact | Single component failure, performance issues | 1 hour |
| **SEV-4** | Low - Minimal impact | Non-critical bugs, cosmetic issues | 4 hours |

### Incident Types

| Type | Description | Primary Responder |
|------|-------------|-------------------|
| **Security** | Breach, unauthorized access, malware | Security Lead |
| **Availability** | Outage, degradation, data loss | DevOps Lead |
| **Performance** | Slow response, timeouts | DevOps Lead |
| **Data** | Corruption, incorrect data | DevOps + Security |

---

## Phase 1: Detection & Triage (0-15 minutes)

### 1.1 Initial Alert Received

**Automated Alerts:**
- PagerDuty notification
- Sentry error spike
- AWS CloudWatch alarm
- Uptime monitoring alert

**Manual Reports:**
- Customer report
- Internal discovery
- Third-party notification

### 1.2 Acknowledge Incident

```
1. Acknowledge in PagerDuty
2. Post in #incidents Slack channel:

   🚨 INCIDENT DECLARED
   Severity: SEV-X
   Type: [Security/Availability/Performance/Data]
   Summary: [Brief description]
   Incident Commander: [Your name]
   Status: Investigating
```

### 1.3 Initial Assessment

Answer these questions:
- [ ] What is the impact? (Users affected, data at risk)
- [ ] When did it start?
- [ ] What changed recently? (Deployments, config changes)
- [ ] Is it ongoing or resolved?
- [ ] Is PHI involved?

### 1.4 Assign Severity

Based on assessment:
- **SEV-1**: Escalate immediately, all hands
- **SEV-2**: Escalate to leads, dedicated response
- **SEV-3**: Assigned responder, normal priority
- **SEV-4**: Ticket created, scheduled fix

---

## Phase 2: Containment (15-60 minutes)

### 2.1 Assemble Response Team

| Role | Responsibility |
|------|----------------|
| **Incident Commander** | Coordinates response, makes decisions |
| **Technical Lead** | Hands-on investigation and fixes |
| **Communications** | Internal/external updates |
| **Scribe** | Documents timeline and actions |

### 2.2 Containment Actions by Type

**Security Incident:**
```bash
# Disable compromised accounts
# Block malicious IPs
# Revoke suspicious sessions
# Isolate affected systems

# Example: Disable a user account
prisma.user.update({ where: { id: USER_ID }, data: { status: 'SUSPENDED' }})

# Example: Block IP in WAF
aws wafv2 create-ip-set --name blocked-ips --scope REGIONAL --ip-address-version IPV4 ...
```

**Availability Incident:**
```bash
# Rollback recent deployment
railway rollback

# Scale up resources
railway scale web=4

# Enable maintenance mode
railway variables set MAINTENANCE_MODE=true
```

**Data Incident:**
```bash
# Stop writes to affected tables
# Preserve current state
pg_dump -t affected_table > backup_before_fix.sql

# Identify scope of corruption
SELECT COUNT(*) FROM affected_table WHERE updated_at > 'INCIDENT_START_TIME';
```

### 2.3 Preserve Evidence

For security incidents:
```bash
# Export logs
aws logs filter-log-events \
  --log-group-name /ecs/scrybe-prod \
  --start-time $(date -d "2 hours ago" +%s000) \
  > incident-logs.json

# Export audit trail
psql $DATABASE_URL -c "\copy (SELECT * FROM \"AuditLog\" WHERE \"createdAt\" > NOW() - INTERVAL '2 hours') TO 'audit-export.csv' WITH CSV HEADER"

# Screenshot relevant consoles/dashboards
```

---

## Phase 3: Eradication (30 minutes - 2 hours)

### 3.1 Root Cause Analysis

During the incident:
- Review recent changes (git log, deployment history)
- Analyze logs for errors
- Check third-party service status
- Interview team members who made changes

### 3.2 Fix Implementation

**Standard Fix Process:**
1. Identify the fix
2. Test in staging if possible
3. Get approval from IC
4. Deploy with rollback plan ready
5. Verify fix

**Emergency Hotfix:**
```bash
# Create hotfix branch
git checkout -b hotfix/incident-YYYY-MM-DD

# Make minimal fix
# Test locally
# Deploy

git push origin hotfix/incident-YYYY-MM-DD
# Trigger emergency deployment
```

### 3.3 Verification

After fix deployment:
- [ ] Error rate returned to normal
- [ ] Affected functionality works
- [ ] No new errors introduced
- [ ] Monitoring shows healthy state

---

## Phase 4: Recovery (1-4 hours)

### 4.1 Restore Normal Operations

```bash
# Disable maintenance mode
railway variables set MAINTENANCE_MODE=false

# Restore any suspended accounts
# Re-enable any disabled features

# Scale back to normal levels
railway scale web=2
```

### 4.2 Data Recovery (if needed)

See specific runbooks:
- [Database Restore Runbook](./database-restore.md)
- [S3 Failover Runbook](./s3-failover.md)

### 4.3 Customer Communication

**SEV-1/SEV-2:**
```
Status Page Update:
[Resolved] Service Disruption - [Date/Time]

We experienced a service disruption affecting [description].
The issue has been resolved as of [time].

Root cause: [Brief explanation]
Data impact: [None / Details]

We apologize for any inconvenience.
```

---

## Phase 5: Post-Incident (24-72 hours)

### 5.1 Incident Documentation

Complete the incident report:

```markdown
# Incident Report: INC-YYYY-XXXX

## Summary
- **Date/Time:**
- **Duration:**
- **Severity:**
- **Type:**
- **Commander:**

## Timeline
| Time | Event |
|------|-------|
| HH:MM | First alert |
| HH:MM | Incident declared |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Incident resolved |

## Impact
- Users affected:
- Data affected:
- Revenue impact:

## Root Cause
[Detailed explanation]

## Contributing Factors
-
-

## Resolution
[What was done to fix it]

## Action Items
| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| | | | |

## Lessons Learned
- What went well:
- What could be improved:
- What was lucky:
```

### 5.2 Post-Incident Review Meeting

Within 72 hours:
- Review timeline
- Discuss what went well
- Identify improvement areas
- Assign action items
- Update runbooks if needed

### 5.3 Action Item Tracking

Create Linear issues for:
- Fixes to prevent recurrence
- Monitoring improvements
- Documentation updates
- Training needs

---

## Communication Templates

### Internal Slack Update

```
📊 INCIDENT UPDATE - [Time]
Status: [Investigating | Identified | Monitoring | Resolved]
Impact: [Description]
Current Actions: [What we're doing]
Next Update: [Time]
```

### Customer Status Page

```
[Investigating] We are investigating reports of [issue].

[Identified] We have identified the cause and are implementing a fix.

[Monitoring] A fix has been deployed. We are monitoring the results.

[Resolved] This incident has been resolved.
```

### Executive Summary (for SEV-1/SEV-2)

```
Subject: Incident Summary - [Date]

Incident: [Brief description]
Duration: [X hours Y minutes]
Impact: [Users/data affected]
Root Cause: [1-2 sentences]
Resolution: [1-2 sentences]
Follow-up: [Key action items]
```

---

## Escalation Matrix

| Severity | Escalate To | Method | Timeline |
|----------|-------------|--------|----------|
| SEV-1 | CEO, CTO | Phone + Slack | Immediate |
| SEV-2 | CTO, Security Lead | Slack + Phone | 15 min |
| SEV-3 | Team Lead | Slack | 30 min |
| SEV-4 | On-call only | Slack | N/A |

### Escalation Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| CEO | _______ | _______ | _______ |
| CTO | _______ | _______ | _______ |
| Security Lead | _______ | _______ | _______ |
| DevOps Lead | _______ | _______ | _______ |

---

## Tools & Access

### Monitoring
- **Sentry:** Error tracking - [URL]
- **Datadog/CloudWatch:** Infrastructure monitoring
- **UptimeRobot:** External monitoring

### Logs
- **Railway:** Application logs
- **CloudWatch:** AWS service logs
- **Supabase:** Database logs

### Communication
- **Slack:** #incidents channel
- **PagerDuty:** On-call alerting
- **Status Page:** Customer communication

---

## Related Documents

- [Breach Notification Policy](../policies/breach-notification-policy.md)
- [Disaster Recovery Policy](../policies/disaster-recovery-policy.md)
- [Database Restore Runbook](./database-restore.md)
- [S3 Failover Runbook](./s3-failover.md)
