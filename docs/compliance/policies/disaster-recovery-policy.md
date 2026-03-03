# Disaster Recovery Policy

**Document ID:** DR-POL-001
**Version:** 2.0
**Effective Date:** March 3, 2026
**Review Date:** March 3, 2027
**Owner:** DevOps Lead

---

## 1. Purpose

This policy establishes procedures for recovering Scrybe systems and data following a disaster or significant service disruption, ensuring business continuity and compliance with HIPAA and SOC 2 requirements.

## 2. Scope

This policy covers:
- All production systems and data
- All PHI and business-critical information
- All infrastructure components (Next.js app, ML Services, databases, caches)
- All third-party service dependencies
- Container orchestration and deployment pipelines

## 3. Recovery Objectives

| Metric | Target | Maximum |
|--------|--------|---------|
| **RTO (Recovery Time Objective)** | 2 hours | 4 hours |
| **RPO (Recovery Point Objective)** | 15 minutes | 1 hour |
| **MTTR (Mean Time to Recover)** | 1 hour | 2 hours |

### 3.1 Service-Specific Objectives

| Service | RTO | RPO | Priority |
|---------|-----|-----|----------|
| Primary Database (PostgreSQL) | 30 min | 15 min | P1 |
| ML Services Database | 1 hour | 15 min | P1 |
| S3 Recordings (PHI) | 1 hour | Real-time | P1 |
| Redis/ElastiCache | 30 min | N/A (ephemeral) | P1 |
| ECS Services (ML) | 15 min | N/A | P1 |
| Next.js App (Railway) | 15 min | N/A | P1 |
| S3 Uploads | 2 hours | 1 hour | P2 |
| Background Jobs | 1 hour | 30 min | P2 |

## 4. Disaster Classification

### 4.1 Severity Levels

| Level | Description | Examples | Response |
|-------|-------------|----------|----------|
| **P1 - Critical** | Complete service outage | Database corruption, region failure, security breach, ECS cluster down | Immediate, all hands |
| **P2 - Major** | Significant degradation | Primary service down, data inaccessible, ML services unavailable | 15 min response |
| **P3 - Minor** | Limited impact | Single component failure, performance issue, background job delays | 1 hour response |
| **P4 - Low** | Minimal impact | Non-critical service issue, third-party API degradation | Next business day |

### 4.2 Disaster Scenarios

| Scenario | Classification | Primary Recovery Strategy |
|----------|----------------|---------------------------|
| Primary database failure | P1 | Restore from continuous replication |
| ML Services database failure | P1 | RDS Multi-AZ failover |
| S3 bucket corruption | P1 | Cross-region failover |
| ECS cluster failure | P1 | Auto-scaling + redeployment |
| Redis/ElastiCache failure | P1 | Cluster recreation + job replay |
| Railway deployment failure | P2 | Rollback to previous version |
| ECR image corruption | P2 | Rebuild from source + redeploy |
| DNS/domain issues | P2 | DNS failover procedure |
| Third-party service outage | P2-P3 | Graceful degradation |
| Region failure | P1 | Multi-region failover |
| Security breach | P1 | Incident response + recovery |
| Data corruption | P1-P2 | Point-in-time recovery |
| Container image vulnerability | P2 | Patch and redeploy |

## 5. System Inventory

### 5.1 Primary Application (Next.js)

| Component | Location | Backup Method | Recovery |
|-----------|----------|---------------|----------|
| Application Code | GitHub | Git history | Redeploy from main |
| Database (Prisma) | AWS RDS / Railway | Continuous replication | Failover to replica |
| Environment Variables | Railway + AWS Secrets Manager | Secrets Manager snapshots | Restore from backup |
| Static Assets | Vercel/Railway CDN | Built from source | Rebuild |

### 5.2 ML Services (Python/FastAPI)

| Component | Location | Backup Method | Recovery |
|-----------|----------|---------------|----------|
| API Service | ECS Fargate | ECR images | Redeploy from ECR |
| Worker Service | ECS Fargate | ECR images | Redeploy from ECR |
| Beat Scheduler | ECS Fargate | ECR images | Redeploy from ECR |
| Database | AWS RDS PostgreSQL | Multi-AZ + PITR | Automatic failover |
| Cache | AWS ElastiCache Redis | Snapshots (7-day) | Restore from snapshot |
| Model Artifacts | S3 | Versioning + CRR | Cross-region restore |
| Audit Logs | S3 (Object Lock) | Immutable storage | Already replicated |

### 5.3 Background Job System

| Component | Dependency | Recovery Strategy |
|-----------|------------|-------------------|
| BullMQ Queues | Redis | Recreate queues, replay failed jobs |
| Form Conversion Jobs | Redis + PostgreSQL | Re-queue from database state |
| Document Extraction | Redis + S3 | Re-process from source files |
| Report Generation | Redis + PostgreSQL | Regenerate from data |
| Meeting Processing | Redis + Deepgram | Re-transcribe if needed |
| Scheduled Exports | Redis + PostgreSQL | Re-run scheduled tasks |

### 5.4 Real-Time Services

| Component | Dependency | Recovery Strategy |
|-----------|------------|-------------------|
| Socket.IO Server | Redis Adapter | Reconnect clients automatically |
| Live Collaboration | Redis Pub/Sub | State persisted in database |
| Call Status Updates | Twilio Webhooks | Webhooks auto-retry |

## 6. Backup Strategy

### 6.1 Database Backups

**Primary Application Database:**

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| **Continuous Replication** | Real-time | N/A | Secondary replica |
| **Point-in-Time Recovery** | Continuous (WAL) | 7 days | Cloud storage |
| **Daily Snapshots** | Every 24 hours | 30 days | Cloud storage |
| **Weekly Snapshots** | Every 7 days | 1 year | Archive storage |
| **Monthly Snapshots** | Monthly | 7 years | Archive storage |

**ML Services Database (RDS):**

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| **Multi-AZ Replication** | Real-time | N/A | Secondary AZ |
| **Automated Backups** | Daily | 7 days (prod) / 1 day (dev) | RDS snapshots |
| **Manual Snapshots** | Pre-deployment | 30 days | RDS snapshots |

### 6.2 S3 Backups

| Bucket | Versioning | Cross-Region Replication | Lifecycle |
|--------|------------|--------------------------|-----------|
| **scrybe-uploads** | 90 days | us-west-2 → us-east-1 | Version cleanup 7 days |
| **scrybe-recordings** | Enabled | us-west-2 → us-east-1 | Glacier 1yr, delete 7yr |
| **scrybe-exports** | Enabled | us-west-2 → us-east-1 | Delete after 30 days |
| **scrybe-backups** | Enabled | us-west-2 → us-east-1 | GLACIER_IR 30d, DEEP_ARCHIVE 90d, 7yr retention |
| **scrybe-audit-logs** | Enabled | N/A (Object Lock) | 7-year governance lock |
| **ml-models** | Enabled | us-west-2 → us-east-1 | Archive after 1 year |
| **ml-audit** | Enabled | N/A (Object Lock) | 7-year governance lock |

### 6.3 Container Registry (ECR)

| Image | Retention | Recovery |
|-------|-----------|----------|
| **inkra-ml-services** | 30 tagged versions | Rebuild from Dockerfile |
| **Production tags** | Indefinite | Immutable tags |
| **Latest tag** | Rolling | Rebuild from main branch |

### 6.4 Configuration Backups

| Component | Backup Method | Frequency |
|-----------|---------------|-----------|
| **Infrastructure** | Terraform state in S3 | On every change |
| **Application Config** | Git repository | On every commit |
| **Environment Variables** | AWS Secrets Manager | On every change |
| **DNS Configuration** | Terraform + documentation | On every change |
| **ECS Task Definitions** | Terraform + ECR | On every deployment |
| **Railway Configuration** | railway.toml in Git | On every commit |

### 6.5 Encryption Keys

| Key Type | Backup Method | Storage |
|----------|---------------|---------|
| **AWS KMS Master Key** | AWS-managed replication | AWS (multi-region) |
| **DEKs (encrypted)** | Database backup | Included in DB backup |
| **MFA Encryption Key** | Secure secrets vault | AWS Secrets Manager |
| **ML Service API Key** | AWS Secrets Manager | Multi-region |

### 6.6 Redis/ElastiCache

| Type | Frequency | Retention | Notes |
|------|-----------|-----------|-------|
| **Snapshots** | Daily | 7 days (prod) | Automatic |
| **Manual Snapshots** | Pre-maintenance | 30 days | On-demand |

**Note:** Redis is treated as ephemeral. Job state is recoverable from database. Session data can be regenerated.

## 7. Recovery Procedures

### 7.1 Database Recovery

**Scenario: Primary database failure**

1. Verify failure (check monitoring, attempt connection)
2. Notify stakeholders (Slack alert + PagerDuty)
3. Initiate failover to replica (automatic if managed)
4. Verify data integrity
5. Update connection strings if needed
6. Validate application functionality
7. Document incident

**Runbook:** [Database Restore Runbook](../runbooks/database-restore.md)

**Scenario: ML Services database failure (RDS)**

1. Verify RDS instance status in AWS Console
2. If Multi-AZ: Automatic failover (2-3 minutes)
3. If single-AZ: Restore from latest snapshot
4. Update ECS services with new endpoint if needed
5. Run Alembic migrations if schema drift
6. Verify ML API health endpoints
7. Document incident

**Runbook:** [ML Services Database Restore](../runbooks/ml-services-database-restore.md)

### 7.2 S3 Recovery

**Scenario: S3 bucket corruption or deletion**

1. Assess scope of corruption/deletion
2. Enable versioning recovery or initiate cross-region failover
3. Restore from versions or replicated bucket
4. Verify file integrity
5. Update application configuration if needed
6. Document incident

**Runbook:** [S3 Failover Runbook](../runbooks/s3-failover.md)

### 7.3 ECS/Container Recovery

**Scenario: ECS cluster or service failure**

1. Check ECS service status and events in AWS Console
2. Review CloudWatch logs for container crashes
3. If image issue: Rollback to previous ECR tag
4. If cluster issue: Terraform apply to recreate
5. If capacity issue: Adjust desired count/auto-scaling
6. Verify service health via ALB health checks
7. Document incident

**Runbook:** [ECS Recovery Runbook](../runbooks/ecs-recovery.md)

**Scenario: ECR image corruption**

1. Identify affected image tags
2. Rebuild image from source: `docker build -f ml-services/docker/Dockerfile`
3. Push to ECR with new tag
4. Update ECS task definition
5. Force new deployment
6. Document incident

### 7.4 Redis/ElastiCache Recovery

**Scenario: ElastiCache cluster failure**

1. Check ElastiCache cluster status
2. If node failure: Automatic replacement (Multi-AZ)
3. If cluster failure: Restore from snapshot
4. Verify Redis connectivity from ECS services
5. Re-queue any in-flight jobs from database state
6. Document incident

**Runbook:** [Redis Recovery Runbook](../runbooks/redis-recovery.md)

### 7.5 Application Recovery

**Scenario: Next.js deployment failure (Railway)**

1. Identify failing deployment in Railway dashboard
2. Rollback to last known good deployment
3. Verify application health
4. Investigate root cause (build logs, env vars)
5. Plan remediation
6. Document incident

**Scenario: ML Services deployment failure**

1. Check GitHub Actions workflow status
2. Review ECS deployment events
3. Rollback ECS service to previous task definition
4. If migration failure: Run rollback migration
5. Verify all services healthy via /healthz and /readyz
6. Document incident

### 7.6 Region Failure

**Scenario: Complete AWS region outage**

1. Confirm region failure (AWS status page + monitoring)
2. Execute region failover playbook
3. Activate secondary RDS instance in failover region
4. Point S3 access to replica buckets
5. Deploy ECS services to secondary region (Terraform)
6. Update DNS to point to failover region
7. Verify data replication completeness
8. Notify customers of potential brief interruption
9. Monitor failover region performance
10. Plan return to primary region

**Runbook:** [Region Failover Runbook](../runbooks/region-failover.md)

### 7.7 Security Incident Recovery

**Scenario: Data breach or system compromise**

1. Follow Breach Notification Policy
2. Isolate affected systems
3. Preserve evidence
4. Rotate all credentials and API keys:
   - AWS access keys
   - ML_SERVICE_API_KEY
   - Database passwords
   - Supabase service role key
   - Third-party API keys
5. Rebuild from known clean state
6. Restore data from pre-compromise backup
7. Enhanced monitoring post-recovery
8. Complete incident review

### 7.8 Third-Party Service Recovery

**Scenario: Critical third-party service outage**

| Service | Graceful Degradation | Recovery |
|---------|---------------------|----------|
| **Supabase** | Cached sessions, read-only mode | Wait for recovery, no alternative |
| **Anthropic** | Queue extraction jobs, manual fallback | Auto-retry when available |
| **Deepgram** | Queue transcription jobs | Switch to OpenAI Whisper |
| **Twilio** | Disable call features, SMS fallback | Wait for recovery |
| **Stripe** | Existing subscriptions continue | Wait for recovery |
| **AWS SES** | Queue emails, use SendGrid fallback | Switch to backup provider |

## 8. Contact Tree

### 8.1 Internal Escalation

| Level | Role | Notification Method | Response Time |
|-------|------|---------------------|---------------|
| 1 | On-Call Engineer | PagerDuty | 5 minutes |
| 2 | DevOps Lead | PagerDuty + Phone | 15 minutes |
| 3 | Security Lead | Phone | 30 minutes |
| 4 | CTO | Phone | 30 minutes |
| 5 | CEO | Phone | 1 hour |

### 8.2 External Contacts

| Service | Contact | Purpose |
|---------|---------|---------|
| AWS Support | Enterprise Support Portal | Infrastructure issues |
| Supabase | support@supabase.io | Auth/database issues |
| Railway | support@railway.app | Hosting issues |
| Cloudflare | Enterprise Dashboard | DNS/CDN issues |
| Twilio | support@twilio.com | Voice services |
| Anthropic | support@anthropic.com | AI API issues |
| Deepgram | support@deepgram.com | Transcription issues |
| Stripe | dashboard.stripe.com/support | Billing issues |
| SendGrid | support@sendgrid.com | Email delivery |

### 8.3 Customer Communication

| Severity | Timeline | Channel | Owner |
|----------|----------|---------|-------|
| P1 | 15 min | Status page + Email | Support Lead |
| P2 | 30 min | Status page | DevOps |
| P3 | 1 hour | Status page | DevOps |
| P4 | N/A | N/A | N/A |

## 9. Testing Schedule

### 9.1 Regular Testing

| Test Type | Frequency | Owner | Documentation |
|-----------|-----------|-------|---------------|
| Database backup restoration | Monthly | DevOps | Test results log |
| S3 cross-region failover | Quarterly | DevOps | Failover report |
| ECS service failover | Quarterly | DevOps | Service report |
| Redis snapshot restore | Quarterly | DevOps | Cache report |
| Full DR test | Annually | All teams | Comprehensive report |
| Tabletop exercise | Semi-annually | Leadership | Exercise summary |
| Container rebuild test | Monthly | DevOps | Build report |

### 9.2 Test Scenarios

**Monthly Backup Test:**
- Restore database snapshot to test environment
- Restore Redis snapshot to test cluster
- Verify data integrity and completeness
- Measure restoration time
- Document results

**Quarterly Failover Drill:**
- Simulate primary service failure
- Execute ECS service failover
- Test S3 cross-region access
- Measure RTO/RPO achievement
- Identify improvement areas

**Annual Full DR Test:**
- Complete region failover simulation
- All runbooks executed
- Container rebuild from source
- Customer communication tested
- Full documentation review

### 9.3 ML Services Specific Tests

| Test | Frequency | Procedure |
|------|-----------|-----------|
| ECS task restart | Monthly | Force stop task, verify auto-recovery |
| Database failover | Quarterly | Trigger RDS failover, measure downtime |
| ECR image rollback | Monthly | Deploy previous version, verify functionality |
| Migration rollback | Per-release | Test downgrade path before production |

## 10. Documentation Requirements

### 10.1 Runbooks

All runbooks must include:
- Prerequisites and permissions required
- Step-by-step instructions
- Expected outcomes at each step
- Rollback procedures
- Contact information
- Terraform/CLI commands where applicable

**Required Runbooks:**
- [x] Database Restore
- [x] S3 Failover
- [x] Incident Response
- [x] Infrastructure Rebuild
- [ ] ML Services Database Restore
- [ ] ECS Recovery
- [ ] Redis Recovery
- [ ] Region Failover
- [ ] Container Rebuild

### 10.2 Test Results

For each DR test, document:
- Date and participants
- Scenario tested
- Steps executed
- Issues encountered
- RTO/RPO achieved vs. target
- Remediation actions

### 10.3 Incident Reports

Post-incident documentation:
- Incident timeline
- Root cause analysis
- Recovery actions taken
- Impact assessment
- Lessons learned
- Follow-up actions

## 11. Infrastructure Dependencies

### 11.1 Critical Path

```
┌─────────────────────────────────────────────────────────────────┐
│                        CRITICAL PATH                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DNS (Cloudflare) ──► ALB/Railway ──► Application               │
│                            │                                     │
│                            ▼                                     │
│                    ┌───────────────┐                            │
│                    │   PostgreSQL   │◄── Primary Database        │
│                    └───────────────┘                            │
│                            │                                     │
│              ┌─────────────┼─────────────┐                      │
│              ▼             ▼             ▼                       │
│         ┌────────┐   ┌─────────┐   ┌──────────┐                │
│         │ Redis  │   │   S3    │   │ Supabase │                │
│         │ Cache  │   │ Storage │   │   Auth   │                │
│         └────────┘   └─────────┘   └──────────┘                │
│              │                                                   │
│              ▼                                                   │
│     ┌─────────────────┐                                         │
│     │  ML Services    │◄── ECS Fargate                          │
│     │  (API/Worker)   │                                         │
│     └─────────────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│     ┌─────────────────┐                                         │
│     │  ML Database    │◄── RDS PostgreSQL                       │
│     │  + ElastiCache  │                                         │
│     └─────────────────┘                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Recovery Order

In a full system recovery, restore in this order:

1. **DNS** - Verify domain resolution
2. **Databases** - Primary PostgreSQL, then ML Services RDS
3. **Redis/ElastiCache** - Cache layer
4. **S3 Buckets** - Verify access to all buckets
5. **Secrets Manager** - Verify all secrets accessible
6. **ECR** - Verify container images available
7. **ECS Services** - Deploy ML Services (API → Worker → Beat)
8. **Application** - Deploy Next.js to Railway
9. **Background Jobs** - Verify job processing
10. **Third-party Integrations** - Verify webhooks, API connections

## 12. Compliance Mapping

### HIPAA

| Requirement | Section |
|-------------|---------|
| §164.308(a)(7)(i) Contingency Plan | All |
| §164.308(a)(7)(ii)(A) Data Backup | 6 |
| §164.308(a)(7)(ii)(B) DR Plan | 7 |
| §164.308(a)(7)(ii)(C) Emergency Mode | 7 |
| §164.308(a)(7)(ii)(D) Testing | 9 |
| §164.308(a)(7)(ii)(E) Criticality Analysis | 4, 5 |

### SOC 2

| Criteria | Section |
|----------|---------|
| A1.1 Recovery Objectives | 3 |
| A1.2 Recovery Procedures | 7 |
| A1.3 Backup Procedures | 6 |
| CC7.4 Incident Response | 7.7 |
| CC7.5 Recovery Activities | 7, 9 |

---

## Appendix A: Quick Reference Commands

### Database Recovery

```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier ml-services-prod

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ml-services-prod-restored \
  --db-snapshot-identifier <snapshot-id>
```

### ECS Recovery

```bash
# Force new deployment
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api --force-new-deployment

# Rollback to previous task definition
aws ecs update-service --cluster ml-services-prod \
  --service ml-services-api \
  --task-definition ml-services-api-prod:<previous-revision>
```

### Redis Recovery

```bash
# Restore from snapshot
aws elasticache create-replication-group \
  --replication-group-id ml-services-redis-restored \
  --snapshot-name <snapshot-name>
```

### S3 Recovery

```bash
# List object versions
aws s3api list-object-versions --bucket scrybe-recordings-prod

# Restore specific version
aws s3api copy-object \
  --bucket scrybe-recordings-prod \
  --copy-source scrybe-recordings-prod/<key>?versionId=<version-id> \
  --key <key>
```

---

**Approval:**

| Name | Title | Signature | Date |
|------|-------|-----------|------|
| _________________ | DevOps Lead | _________________ | ________ |
| _________________ | Security Lead | _________________ | ________ |
| _________________ | CTO | _________________ | ________ |

---

**Revision History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 1, 2026 | DevOps Lead | Initial version |
| 2.0 | Mar 3, 2026 | DevOps Lead | Added ML Services infrastructure (ECS, RDS, ElastiCache), container registry recovery, background job system, real-time services, updated third-party contacts, quick reference commands |
