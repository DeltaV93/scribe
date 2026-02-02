# Disaster Recovery Policy

**Document ID:** DR-POL-001
**Version:** 1.0
**Effective Date:** February 1, 2026
**Review Date:** February 1, 2027
**Owner:** DevOps Lead

---

## 1. Purpose

This policy establishes procedures for recovering Scrybe systems and data following a disaster or significant service disruption, ensuring business continuity and compliance with HIPAA and SOC 2 requirements.

## 2. Scope

This policy covers:
- All production systems and data
- All PHI and business-critical information
- All infrastructure components
- All third-party service dependencies

## 3. Recovery Objectives

| Metric | Target | Maximum |
|--------|--------|---------|
| **RTO (Recovery Time Objective)** | 2 hours | 4 hours |
| **RPO (Recovery Point Objective)** | 15 minutes | 1 hour |
| **MTTR (Mean Time to Recover)** | 1 hour | 2 hours |

## 4. Disaster Classification

### 4.1 Severity Levels

| Level | Description | Examples | Response |
|-------|-------------|----------|----------|
| **P1 - Critical** | Complete service outage | Database corruption, region failure, security breach | Immediate, all hands |
| **P2 - Major** | Significant degradation | Primary service down, data inaccessible | 15 min response |
| **P3 - Minor** | Limited impact | Single component failure, performance issue | 1 hour response |
| **P4 - Low** | Minimal impact | Non-critical service issue | Next business day |

### 4.2 Disaster Scenarios

| Scenario | Classification | Primary Recovery Strategy |
|----------|----------------|---------------------------|
| Database failure | P1 | Restore from continuous replication |
| S3 bucket corruption | P1 | Cross-region failover |
| Application deployment failure | P2 | Rollback to previous version |
| DNS/domain issues | P2 | DNS failover procedure |
| Third-party service outage | P2-P3 | Graceful degradation |
| Region failure | P1 | Multi-region failover |
| Security breach | P1 | Incident response + recovery |
| Data corruption | P1-P2 | Point-in-time recovery |

## 5. Backup Strategy

### 5.1 Database Backups

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| **Continuous Replication** | Real-time | N/A | Secondary replica |
| **Point-in-Time Recovery** | Continuous (WAL) | 7 days | Cloud storage |
| **Daily Snapshots** | Every 24 hours | 30 days | Cloud storage |
| **Weekly Snapshots** | Every 7 days | 1 year | Archive storage |
| **Monthly Snapshots** | Monthly | 7 years | Archive storage |

### 5.2 S3 Backups

| Type | Configuration | Retention |
|------|---------------|-----------|
| **Versioning** | Enabled | 90 days |
| **Cross-Region Replication** | us-west-2 → us-east-1 | Continuous |
| **Lifecycle Policies** | Transition to Glacier | 1 year → Glacier |

### 5.3 Configuration Backups

| Component | Backup Method | Frequency |
|-----------|---------------|-----------|
| **Infrastructure** | Terraform state in S3 | On every change |
| **Application Config** | Git repository | On every commit |
| **Environment Variables** | AWS Secrets Manager | On every change |
| **DNS Configuration** | Terraform + documentation | On every change |

### 5.4 Encryption Keys

| Key Type | Backup Method | Storage |
|----------|---------------|---------|
| **AWS KMS Master Key** | AWS-managed replication | AWS |
| **DEKs (encrypted)** | Database backup | Included in DB backup |
| **MFA Encryption Key** | Secure secrets vault | Multiple locations |

## 6. Recovery Procedures

### 6.1 Database Recovery

**Scenario: Primary database failure**

1. Verify failure (check monitoring, attempt connection)
2. Notify stakeholders (Slack alert + PagerDuty)
3. Initiate failover to replica (automatic if managed)
4. Verify data integrity
5. Update connection strings if needed
6. Validate application functionality
7. Document incident

**Runbook:** [Database Restore Runbook](./runbooks/database-restore.md)

### 6.2 S3 Recovery

**Scenario: S3 bucket corruption or deletion**

1. Assess scope of corruption/deletion
2. Enable versioning recovery or initiate cross-region failover
3. Restore from versions or replicated bucket
4. Verify file integrity
5. Update application configuration if needed
6. Document incident

**Runbook:** [S3 Failover Runbook](./runbooks/s3-failover.md)

### 6.3 Application Recovery

**Scenario: Deployment failure**

1. Identify failing deployment
2. Rollback to last known good version
3. Verify application health
4. Investigate root cause
5. Plan remediation
6. Document incident

### 6.4 Region Failure

**Scenario: Complete AWS region outage**

1. Confirm region failure (AWS status page + monitoring)
2. Execute region failover playbook
3. Update DNS to point to failover region
4. Verify data replication completeness
5. Notify customers of potential brief interruption
6. Monitor failover region performance
7. Plan return to primary region

### 6.5 Security Incident Recovery

**Scenario: Data breach or system compromise**

1. Follow Breach Notification Policy
2. Isolate affected systems
3. Preserve evidence
4. Rebuild from known clean state
5. Rotate all credentials and keys
6. Restore data from pre-compromise backup
7. Enhanced monitoring post-recovery
8. Complete incident review

## 7. Contact Tree

### 7.1 Internal Escalation

| Level | Role | Notification Method | Response Time |
|-------|------|---------------------|---------------|
| 1 | On-Call Engineer | PagerDuty | 5 minutes |
| 2 | DevOps Lead | PagerDuty + Phone | 15 minutes |
| 3 | Security Lead | Phone | 30 minutes |
| 4 | CTO | Phone | 30 minutes |
| 5 | CEO | Phone | 1 hour |

### 7.2 External Contacts

| Service | Contact | Purpose |
|---------|---------|---------|
| AWS Support | Enterprise Support Portal | Infrastructure issues |
| Supabase | support@supabase.io | Database issues |
| Railway | support@railway.app | Hosting issues |
| Cloudflare | Enterprise Dashboard | DNS/CDN issues |
| Twilio | support@twilio.com | Voice services |

### 7.3 Customer Communication

| Severity | Timeline | Channel | Owner |
|----------|----------|---------|-------|
| P1 | 15 min | Status page + Email | Support Lead |
| P2 | 30 min | Status page | DevOps |
| P3 | 1 hour | Status page | DevOps |
| P4 | N/A | N/A | N/A |

## 8. Testing Schedule

### 8.1 Regular Testing

| Test Type | Frequency | Owner | Documentation |
|-----------|-----------|-------|---------------|
| Backup restoration | Monthly | DevOps | Test results log |
| Failover drill | Quarterly | DevOps + Security | Drill report |
| Full DR test | Annually | All teams | Comprehensive report |
| Tabletop exercise | Semi-annually | Leadership | Exercise summary |

### 8.2 Test Scenarios

**Monthly Backup Test:**
- Restore database snapshot to test environment
- Verify data integrity and completeness
- Measure restoration time
- Document results

**Quarterly Failover Drill:**
- Simulate primary service failure
- Execute failover procedure
- Measure RTO/RPO achievement
- Identify improvement areas

**Annual Full DR Test:**
- Complete region failover simulation
- All runbooks executed
- Customer communication tested
- Full documentation review

## 9. Documentation Requirements

### 9.1 Runbooks

All runbooks must include:
- Prerequisites and permissions required
- Step-by-step instructions
- Expected outcomes at each step
- Rollback procedures
- Contact information

### 9.2 Test Results

For each DR test, document:
- Date and participants
- Scenario tested
- Steps executed
- Issues encountered
- RTO/RPO achieved vs. target
- Remediation actions

### 9.3 Incident Reports

Post-incident documentation:
- Incident timeline
- Root cause analysis
- Recovery actions taken
- Impact assessment
- Lessons learned
- Follow-up actions

## 10. Compliance Mapping

### HIPAA

| Requirement | Section |
|-------------|---------|
| §164.308(a)(7)(i) Contingency Plan | All |
| §164.308(a)(7)(ii)(A) Data Backup | 5 |
| §164.308(a)(7)(ii)(B) DR Plan | 6 |
| §164.308(a)(7)(ii)(C) Emergency Mode | 6 |
| §164.308(a)(7)(ii)(D) Testing | 8 |
| §164.308(a)(7)(ii)(E) Criticality Analysis | 4 |

### SOC 2

| Criteria | Section |
|----------|---------|
| A1.1 Recovery Objectives | 3 |
| A1.2 Recovery Procedures | 6 |
| A1.3 Backup Procedures | 5 |
| CC7.4 Incident Response | 6.5 |
| CC7.5 Recovery Activities | 6, 8 |

---

**Approval:**

| Name | Title | Signature | Date |
|------|-------|-----------|------|
| _________________ | DevOps Lead | _________________ | ________ |
| _________________ | Security Lead | _________________ | ________ |
| _________________ | CTO | _________________ | ________ |
