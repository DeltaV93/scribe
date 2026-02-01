# Product Requirements Document & Technical Specification

## HIPAA & SOC 2 Compliance Implementation

**Project:** Scribe
**Document Version:** 1.0
**Date:** January 31, 2026
**Author:** Engineering Team
**Related Issue:** PX-662 (Business Legal Requirements)

---

## 1. Executive Summary

This specification outlines the technical implementation required to achieve HIPAA compliance and prepare for SOC 2 Type II certification for the Scribe platform. As a healthcare-adjacent SaaS serving nonprofits and social services organizations, Scribe handles Protected Health Information (PHI) through call recordings, transcripts, and form submissions.

### Current State
- Strong foundation: RBAC, audit logging with hash-chain, S3 KMS encryption
- Critical gaps: No MFA, no application-level PHI encryption, no session timeout

### Target State
- Full HIPAA Technical Safeguards compliance
- SOC 2 Trust Service Criteria readiness
- Audit-ready documentation and controls

### Timeline Summary
| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | 2 weeks | Critical security controls (MFA, encryption, session management) |
| Phase 2 | 2 weeks | Monitoring, logging, and access controls |
| Phase 3 | 3 weeks | Infrastructure hardening and vendor compliance |
| Phase 4 | Ongoing | Certification preparation and maintenance |

---

## 2. Regulatory Background

### 2.1 HIPAA Technical Safeguards (45 CFR § 164.312)

| Requirement | Section | Current Status | Gap |
|-------------|---------|----------------|-----|
| Access Control | §164.312(a)(1) | Partial | Missing MFA, session timeout |
| Audit Controls | §164.312(b) | Good | Need failed auth logging |
| Integrity Controls | §164.312(c)(1) | Good | Hash-chain implemented |
| Transmission Security | §164.312(e)(1) | Good | HTTPS enforced |
| Encryption | §164.312(a)(2)(iv) | Partial | No app-level PHI encryption |

### 2.2 SOC 2 Trust Service Criteria

| Criteria | Category | Current Status | Gap |
|----------|----------|----------------|-----|
| CC6.1 | Logical Access | Partial | No MFA, limited SSO |
| CC6.2 | Access Provisioning | Good | RBAC implemented |
| CC7.1 | System Operations | Partial | No centralized monitoring |
| CC7.2 | Change Management | Partial | Need formal process |
| A1.1 | Availability | Partial | No documented DR plan |
| C1.1 | Confidentiality | Partial | Need data classification |

---

## 3. Phase 1: Critical Security Controls (Week 1-2)

### 3.1 Multi-Factor Authentication (MFA)

**Priority:** CRITICAL
**HIPAA Reference:** §164.312(d) - Person or Entity Authentication
**Effort:** 5-7 days

#### Requirements

1. **TOTP Support (Required)**
   - Support Google Authenticator, Authy, 1Password
   - Generate QR code for setup
   - Accept 6-digit codes with 30-second window
   - Allow backup codes (10 one-time use codes)

2. **SMS Fallback (Optional)**
   - Secondary verification method
   - Rate limit: 3 SMS per hour per user
   - Twilio integration (already available)

3. **Enforcement Rules**
   - Mandatory for ADMIN, PROGRAM_MANAGER roles
   - Optional but encouraged for CASE_MANAGER, VIEWER
   - Org-level setting to require MFA for all users
   - Grace period: 7 days after account creation

4. **Recovery Flow**
   - Backup codes displayed once during setup
   - Admin can reset MFA for users (logged to audit)
   - Email verification required for MFA reset

#### Technical Implementation

```
Files to create/modify:
├── src/lib/auth/mfa/
│   ├── totp.ts              # TOTP generation/verification
│   ├── backup-codes.ts      # Backup code management
│   └── sms-verification.ts  # SMS fallback
├── src/app/api/auth/mfa/
│   ├── setup/route.ts       # Initiate MFA setup
│   ├── verify/route.ts      # Verify TOTP code
│   ├── backup-codes/route.ts # Generate/use backup codes
│   └── reset/route.ts       # Admin reset endpoint
├── src/app/(auth)/mfa-setup/ # MFA setup UI
├── src/app/(auth)/mfa-verify/ # MFA verification UI
└── prisma/schema.prisma     # Add MFA fields to User model

Database Changes:
- User.mfaEnabled: Boolean
- User.mfaSecret: String (encrypted)
- User.mfaBackupCodes: String[] (hashed)
- User.mfaLastUsed: DateTime
- MfaRecoveryAttempt model for rate limiting
```

#### Dependencies
- `otplib` - TOTP generation/verification
- `qrcode` - QR code generation for authenticator apps

#### Acceptance Criteria
- [ ] User can enable MFA with authenticator app
- [ ] User can use backup codes when device unavailable
- [ ] Admin can enforce MFA at org level
- [ ] Failed MFA attempts logged to audit trail
- [ ] MFA setup/reset events logged to audit trail

---

### 3.2 Application-Level PHI Encryption

**Priority:** CRITICAL
**HIPAA Reference:** §164.312(a)(2)(iv) - Encryption and Decryption
**Effort:** 5-7 days

#### Requirements

1. **Field-Level Encryption**
   - Encrypt PHI fields at application layer before database storage
   - Use AES-256-GCM (authenticated encryption)
   - Unique IV per encryption operation
   - Key hierarchy: Master Key → Data Encryption Keys (DEKs)

2. **Fields Requiring Encryption**
   - `FormSubmission.data` (contains PHI from form responses)
   - `Client.notes` (case manager notes)
   - `Call.transcript` (transcribed conversations)
   - `Call.extractedData` (AI-extracted form data)
   - `Signature.imageData` (signature images)
   - `Message.content` (SMS/email content)

3. **Key Management**
   - AWS KMS for master key storage
   - DEKs encrypted with master key, stored in database
   - Key rotation: Master key annually, DEKs per-organization
   - Key per organization for data isolation

4. **Search & Query Considerations**
   - Maintain encrypted search index for basic queries
   - Use deterministic encryption for exact-match fields (e.g., SSN last 4)
   - Accept that encrypted fields cannot be searched directly

#### Technical Implementation

```
Files to create/modify:
├── src/lib/encryption/
│   ├── kms.ts               # AWS KMS integration
│   ├── crypto.ts            # AES-256-GCM encrypt/decrypt
│   ├── key-management.ts    # DEK generation/rotation
│   └── field-encryption.ts  # Prisma middleware for auto-encryption
├── src/lib/services/
│   └── encryption-service.ts # High-level encryption service
└── prisma/schema.prisma     # Add EncryptionKey model

Database Changes:
- EncryptionKey model (orgId, encryptedDek, keyVersion, createdAt)
- Add keyVersion to FormSubmission, Client, Call for key rotation

Environment Variables:
- AWS_KMS_KEY_ID: KMS master key ARN
- ENCRYPTION_KEY_ROTATION_DAYS: 365 (default)
```

#### Migration Strategy

1. Create encryption infrastructure
2. Add new encrypted columns alongside existing
3. Background job to encrypt existing data
4. Swap column references
5. Drop old unencrypted columns

#### Acceptance Criteria
- [ ] All PHI fields encrypted at rest in database
- [ ] Encryption keys managed via AWS KMS
- [ ] Key rotation implemented and tested
- [ ] Decryption transparent to application code
- [ ] Encryption/decryption logged to audit trail

---

### 3.3 Session Management & Timeout

**Priority:** HIGH
**HIPAA Reference:** §164.312(a)(2)(iii) - Automatic Logoff
**Effort:** 2-3 days

#### Requirements

1. **Session Timeout**
   - Default: 30 minutes of inactivity
   - Configurable per organization (15-60 minutes)
   - Warning modal at 5 minutes before expiry
   - Option to extend session from warning

2. **Activity Tracking**
   - Track last activity timestamp client-side
   - Heartbeat every 5 minutes to refresh session
   - Mouse/keyboard/touch events reset timer

3. **Concurrent Session Control**
   - Limit: 3 concurrent sessions per user (default)
   - Show active sessions in user settings
   - Allow user to terminate other sessions
   - Admin can configure max sessions per org

4. **Secure Session Handling**
   - Invalidate session on password change
   - Invalidate all sessions on MFA reset
   - Clear sensitive data from memory on logout

#### Technical Implementation

```
Files to create/modify:
├── src/lib/auth/session/
│   ├── timeout.ts           # Session timeout logic
│   ├── activity-tracker.ts  # Client-side activity tracking
│   └── concurrent-sessions.ts # Multi-session management
├── src/components/auth/
│   ├── SessionTimeoutWarning.tsx # Warning modal
│   └── ActiveSessions.tsx   # Session management UI
├── src/app/api/auth/
│   ├── heartbeat/route.ts   # Session refresh endpoint
│   └── sessions/route.ts    # List/terminate sessions
└── prisma/schema.prisma     # Add Session model

Database Changes:
- Session model (userId, token, deviceInfo, ipAddress, lastActivity, createdAt)
- Organization.sessionTimeoutMinutes: Int (default 30)
- Organization.maxConcurrentSessions: Int (default 3)
```

#### Acceptance Criteria
- [ ] Sessions timeout after configurable inactivity period
- [ ] Users warned before session expiry
- [ ] Users can view and terminate active sessions
- [ ] Session events logged to audit trail
- [ ] Password/MFA changes invalidate existing sessions

---

### 3.4 Password Policy Enhancements

**Priority:** HIGH
**HIPAA Reference:** §164.308(a)(5)(ii)(D) - Password Management
**Effort:** 2 days

#### Requirements

1. **Password Expiration**
   - Default: 90 days
   - Configurable per org: 30-180 days
   - Warning: 14 days before expiry
   - Force change on next login after expiry

2. **Password History**
   - Prevent reuse of last 12 passwords
   - Store hashed password history

3. **Complexity Requirements** (Already implemented, verify)
   - Minimum 8 characters
   - At least 1 uppercase, 1 lowercase, 1 number
   - Add: At least 1 special character
   - Add: No common passwords (top 10,000 list)

4. **Account Lockout**
   - Lock after 5 failed attempts
   - Lockout duration: 30 minutes
   - Admin can unlock manually
   - Notify user via email on lockout

#### Technical Implementation

```
Files to create/modify:
├── src/lib/auth/
│   ├── password-policy.ts   # Policy enforcement
│   ├── password-history.ts  # History tracking
│   └── account-lockout.ts   # Lockout logic
├── src/app/api/auth/
│   └── unlock/route.ts      # Admin unlock endpoint
└── prisma/schema.prisma     # Add password history model

Database Changes:
- PasswordHistory model (userId, passwordHash, createdAt)
- User.passwordChangedAt: DateTime
- User.failedLoginAttempts: Int
- User.lockedUntil: DateTime
- Organization.passwordExpirationDays: Int
```

#### Acceptance Criteria
- [ ] Passwords expire after configured period
- [ ] Users cannot reuse recent passwords
- [ ] Accounts lock after failed attempts
- [ ] Lockout events logged to audit trail
- [ ] Admin can unlock accounts

---

### 3.5 Security Headers

**Priority:** HIGH
**SOC 2 Reference:** CC6.7 - Transmission Integrity
**Effort:** 1 day

#### Requirements

Add missing security headers to `next.config.js`:

```javascript
// Already implemented:
'X-Frame-Options': 'DENY',
'X-Content-Type-Options': 'nosniff',
'Referrer-Policy': 'strict-origin-when-cross-origin',

// Add:
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.deepgram.com; frame-src https://js.stripe.com;",
'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(self), payment=(self), usb=()',
'X-XSS-Protection': '1; mode=block',
```

#### Acceptance Criteria
- [ ] All security headers present in responses
- [ ] CSP tested and not breaking functionality
- [ ] Headers verified with securityheaders.com

---

## 4. Phase 2: Monitoring & Logging (Week 3-4)

### 4.1 Enhanced Audit Logging

**Priority:** HIGH
**HIPAA Reference:** §164.312(b) - Audit Controls
**Effort:** 3-4 days

#### Requirements

1. **Authentication Events**
   - Login success/failure with IP, user agent, geolocation
   - Logout (explicit and session timeout)
   - Password change/reset
   - MFA setup/verify/reset
   - Account lockout/unlock

2. **PHI Access Events**
   - Form submission view/edit/export
   - Client record access
   - Call recording playback
   - Transcript view
   - Report generation

3. **Administrative Events**
   - User creation/modification/deletion
   - Role changes
   - Permission changes
   - Organization settings changes
   - Integration configuration

4. **Log Format Enhancement**
   ```json
   {
     "timestamp": "2026-01-31T10:30:00Z",
     "eventType": "PHI_ACCESS",
     "action": "VIEW",
     "resourceType": "FormSubmission",
     "resourceId": "uuid",
     "userId": "uuid",
     "organizationId": "uuid",
     "ipAddress": "192.168.1.1",
     "userAgent": "Mozilla/5.0...",
     "geolocation": {"country": "US", "region": "CA"},
     "previousHash": "abc123",
     "hash": "def456",
     "metadata": {
       "fieldsAccessed": ["clientName", "diagnosis"],
       "exportFormat": null
     }
   }
   ```

5. **Log Retention**
   - 7 years for HIPAA compliance
   - Automated archival to cold storage after 1 year
   - Immutable storage (S3 Glacier with Object Lock)

#### Technical Implementation

```
Files to create/modify:
├── src/lib/audit/
│   ├── events.ts            # Event type definitions
│   ├── logger.ts            # Enhanced audit logger
│   ├── phi-access.ts        # PHI-specific logging
│   └── archival.ts          # Log archival service
├── src/app/api/audit/
│   ├── export/route.ts      # Compliance export
│   └── verify/route.ts      # Chain verification
└── prisma/schema.prisma     # Enhance AuditLog model

Database Changes:
- AuditLog.eventType: Enum (AUTH, PHI_ACCESS, ADMIN, SYSTEM)
- AuditLog.geolocation: Json
- AuditLog.metadata: Json
- AuditLog.archived: Boolean
- AuditLog.archivedAt: DateTime
```

#### Acceptance Criteria
- [ ] All authentication events logged
- [ ] All PHI access events logged
- [ ] Logs include required metadata
- [ ] Hash chain integrity maintained
- [ ] 7-year retention implemented

---

### 4.2 API Rate Limiting

**Priority:** HIGH
**SOC 2 Reference:** CC6.1 - Logical Access Controls
**Effort:** 2-3 days

#### Requirements

1. **Global Rate Limits**
   | Endpoint Category | Limit | Window |
   |-------------------|-------|--------|
   | Authentication | 10 requests | 15 minutes |
   | API (authenticated) | 1000 requests | 1 minute |
   | File uploads | 10 uploads | 1 hour |
   | Webhooks | 100 requests | 1 minute |
   | Public endpoints | 100 requests | 1 minute |

2. **Rate Limit Headers**
   ```
   X-RateLimit-Limit: 1000
   X-RateLimit-Remaining: 999
   X-RateLimit-Reset: 1706698200
   ```

3. **Response on Limit**
   - HTTP 429 Too Many Requests
   - Retry-After header
   - Log rate limit violations

4. **Implementation**
   - Use Redis for distributed rate limiting
   - Sliding window algorithm
   - Per-user and per-IP tracking

#### Technical Implementation

```
Files to create/modify:
├── src/lib/rate-limit/
│   ├── redis.ts             # Redis client
│   ├── limiter.ts           # Rate limit logic
│   └── middleware.ts        # Next.js middleware
├── src/middleware.ts        # Add rate limiting
└── .env.example             # Add REDIS_URL
```

#### Acceptance Criteria
- [ ] Rate limits enforced on all endpoints
- [ ] Rate limit headers in responses
- [ ] Violations logged to audit trail
- [ ] Redis-based for distributed deployment

---

### 4.3 Centralized Logging & Monitoring

**Priority:** MEDIUM
**SOC 2 Reference:** CC7.2 - System Monitoring
**Effort:** 3-4 days

#### Requirements

1. **Structured Logging**
   - JSON format for all logs
   - Correlation IDs for request tracing
   - Log levels: ERROR, WARN, INFO, DEBUG
   - Sensitive data masking

2. **Log Aggregation**
   - Integrate with Datadog, Splunk, or AWS CloudWatch
   - Real-time log streaming
   - Searchable log interface

3. **Error Tracking**
   - Sentry integration for error capture
   - Source maps for stack traces
   - User context (sanitized)
   - Release tracking

4. **Alerting**
   - High error rate (>1% in 5 minutes)
   - Failed login spike (>10 in 1 minute)
   - Rate limit violations spike
   - API latency degradation (p95 > 2s)
   - Database connection issues

#### Technical Implementation

```
Files to create/modify:
├── src/lib/logging/
│   ├── logger.ts            # Structured logger (Pino)
│   ├── correlation.ts       # Request correlation
│   └── masking.ts           # Sensitive data masking
├── src/lib/monitoring/
│   ├── sentry.ts            # Sentry integration
│   └── metrics.ts           # Custom metrics
├── src/middleware.ts        # Add correlation ID
└── sentry.*.config.ts       # Sentry configuration
```

#### Acceptance Criteria
- [ ] Structured JSON logging throughout app
- [ ] Correlation IDs in all request logs
- [ ] Sentry capturing errors with context
- [ ] Alerts configured for critical events
- [ ] Sensitive data masked in logs

---

### 4.4 Failed Authentication Logging

**Priority:** HIGH
**HIPAA Reference:** §164.312(b) - Audit Controls
**Effort:** 1-2 days

#### Requirements

1. **Events to Log**
   - Failed login (wrong password)
   - Failed login (user not found) - same response as wrong password
   - Failed MFA verification
   - Failed password reset
   - Account lockout trigger

2. **Data Captured**
   - Timestamp
   - Username/email attempted
   - IP address
   - User agent
   - Geolocation (country, region)
   - Failure reason (internal only)

3. **Anomaly Detection**
   - Alert on >5 failures from same IP in 10 minutes
   - Alert on >10 failures for same account in 1 hour
   - Block IP after 50 failures in 1 hour

#### Technical Implementation

```
Files to modify:
├── src/lib/auth/actions.ts  # Add failure logging
├── src/lib/audit/auth.ts    # Auth-specific audit
└── src/app/api/auth/*/      # Add logging to endpoints
```

#### Acceptance Criteria
- [ ] All authentication failures logged
- [ ] Anomaly detection implemented
- [ ] IP blocking for repeated failures
- [ ] Alerts configured

---

## 5. Phase 3: Infrastructure & Vendor (Week 5-7)

### 5.1 Database Encryption at Rest

**Priority:** MEDIUM
**HIPAA Reference:** §164.312(a)(2)(iv)
**Effort:** 2-3 days (mostly configuration)

#### Requirements

1. **PostgreSQL Encryption**
   - Enable TDE (Transparent Data Encryption) if using managed service
   - For Supabase: Verify encryption is enabled (default on Pro+)
   - Document encryption configuration

2. **Backup Encryption**
   - Automated backups encrypted with separate key
   - Backup retention: 30 days hot, 1 year cold
   - Test restoration quarterly

3. **Connection Encryption**
   - Enforce SSL/TLS for all database connections
   - Verify certificate validation

#### Acceptance Criteria
- [ ] Database encryption verified and documented
- [ ] Backup encryption configured
- [ ] SSL connections enforced
- [ ] Restoration tested and documented

---

### 5.2 Key Management System

**Priority:** HIGH
**SOC 2 Reference:** CC6.1
**Effort:** 3-4 days

#### Requirements

1. **AWS KMS Integration**
   - Master key for DEK encryption
   - Key aliases for easy rotation
   - IAM policies for key access

2. **Key Rotation**
   - Master key: Annual rotation
   - DEKs: On-demand rotation per org
   - Automatic key version tracking

3. **Key Access Logging**
   - CloudTrail logging for all key operations
   - Alert on unusual key access patterns

#### Technical Implementation

```
Files to create/modify:
├── src/lib/encryption/
│   ├── kms.ts               # AWS KMS operations
│   └── key-rotation.ts      # Rotation logic
├── infrastructure/
│   ├── kms.tf               # Terraform for KMS
│   └── iam.tf               # IAM policies
```

#### Acceptance Criteria
- [ ] KMS master key created with rotation
- [ ] DEK rotation implemented
- [ ] Key access logged via CloudTrail
- [ ] IAM least-privilege enforced

---

### 5.3 Vendor Compliance Verification

**Priority:** HIGH
**HIPAA Reference:** §164.314 - Business Associate Contracts
**Effort:** 1-2 weeks (mostly coordination)

#### Requirements

1. **Business Associate Agreements (BAAs)**
   - AWS: Sign AWS BAA via console
   - Twilio: Request HIPAA-eligible services, sign BAA
   - Deepgram: Verify HIPAA compliance, sign BAA
   - Anthropic: Verify PHI handling policy, sign BAA if available
   - Supabase: Verify HIPAA compliance on Enterprise tier

2. **Vendor Assessment**
   - Request SOC 2 reports from each vendor
   - Review security practices
   - Document compliance status

3. **Data Processing Agreements**
   - GDPR DPAs where applicable
   - Data residency requirements

#### Deliverables
- [ ] BAA tracker spreadsheet
- [ ] Signed BAAs on file
- [ ] Vendor compliance matrix
- [ ] Annual review schedule

---

### 5.4 Disaster Recovery Plan

**Priority:** MEDIUM
**SOC 2 Reference:** A1.2 - Recovery
**Effort:** 3-4 days

#### Requirements

1. **Recovery Objectives**
   - RTO (Recovery Time Objective): 4 hours
   - RPO (Recovery Point Objective): 1 hour

2. **Backup Strategy**
   - Database: Continuous replication + daily snapshots
   - S3: Cross-region replication
   - Configuration: Infrastructure as Code (Terraform)

3. **Recovery Procedures**
   - Document step-by-step recovery process
   - Runbooks for common failure scenarios
   - Contact escalation tree

4. **Testing**
   - Quarterly DR tests
   - Annual full failover test
   - Document test results

#### Deliverables
- [ ] DR plan document
- [ ] Recovery runbooks
- [ ] Backup verification scripts
- [ ] DR test schedule and results log

---

### 5.5 S3 Security Hardening

**Priority:** HIGH
**Effort:** 2 days

#### Requirements

1. **Bucket Policies**
   - Block all public access
   - Enforce encryption on upload
   - Require TLS for all requests

2. **Access Logging**
   - Enable S3 access logging to separate bucket
   - Retain logs for 1 year

3. **Lifecycle Policies**
   - Call recordings: Archive to Glacier after 90 days
   - Delete after retention period (org-configurable, default 7 years)

4. **Object Lock**
   - Enable for compliance bucket (audit logs)
   - Governance mode for 7 years

5. **Versioning**
   - Enable on all buckets
   - MFA Delete for production buckets

#### Acceptance Criteria
- [ ] Public access blocked on all buckets
- [ ] Access logging enabled
- [ ] Lifecycle policies configured
- [ ] Object Lock enabled for compliance data

---

## 6. Phase 4: Certification Preparation (Ongoing)

### 6.1 HIPAA Compliance Documentation

#### Required Documents
1. **Risk Assessment** - Annual security risk analysis
2. **Policies & Procedures**
   - Security Policy
   - Privacy Policy
   - Breach Notification Policy
   - Access Control Policy
   - Disaster Recovery Policy
   - Workforce Security Policy
3. **Training Records** - Security awareness training logs
4. **BAA Register** - All signed business associate agreements
5. **Incident Log** - Security incident tracking
6. **Audit Reports** - Internal audit results

### 6.2 SOC 2 Preparation

#### Trust Service Criteria Coverage
- **Security (Common Criteria)**: CC1-CC9
- **Availability**: A1.1-A1.3
- **Confidentiality**: C1.1-C1.2

#### Evidence Collection
- [ ] Policy documents
- [ ] Configuration screenshots
- [ ] Access control matrices
- [ ] Audit log samples
- [ ] Penetration test reports
- [ ] Vulnerability scan reports
- [ ] Training completion records
- [ ] Incident response logs

### 6.3 Ongoing Compliance Activities

| Activity | Frequency |
|----------|-----------|
| Access review | Quarterly |
| Vulnerability scanning | Monthly |
| Penetration testing | Annual |
| DR testing | Quarterly |
| Policy review | Annual |
| Security training | Annual |
| Risk assessment | Annual |
| Audit log verification | Daily (automated) |

---

## 7. Technical Dependencies

### New NPM Packages
```json
{
  "otplib": "^12.0.0",        // TOTP for MFA
  "qrcode": "^1.5.0",         // QR code generation
  "@sentry/nextjs": "^8.0.0", // Error tracking
  "pino": "^9.0.0",           // Structured logging
  "ioredis": "^5.0.0",        // Redis for rate limiting
  "@aws-sdk/client-kms": "^3.0.0" // AWS KMS
}
```

### Infrastructure Requirements
- Redis instance for rate limiting and sessions
- AWS KMS key for encryption
- Sentry account for error tracking
- Log aggregation service (Datadog/CloudWatch)

### Environment Variables (New)
```bash
# MFA
MFA_ISSUER=Scribe

# Encryption
AWS_KMS_KEY_ID=arn:aws:kms:...
ENCRYPTION_KEY_ROTATION_DAYS=365

# Rate Limiting
REDIS_URL=redis://...

# Monitoring
SENTRY_DSN=https://...
LOG_LEVEL=info

# Session
SESSION_TIMEOUT_MINUTES=30
MAX_CONCURRENT_SESSIONS=3
```

---

## 8. Database Schema Changes

```prisma
// Add to User model
model User {
  // ... existing fields

  // MFA
  mfaEnabled        Boolean   @default(false)
  mfaSecret         String?   // Encrypted TOTP secret
  mfaBackupCodes    String[]  // Hashed backup codes
  mfaLastUsed       DateTime?

  // Password policy
  passwordChangedAt DateTime  @default(now())
  failedLoginAttempts Int     @default(0)
  lockedUntil       DateTime?

  // Relations
  passwordHistory   PasswordHistory[]
  sessions          Session[]
}

model PasswordHistory {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  passwordHash  String
  createdAt     DateTime @default(now())
}

model Session {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  token         String   @unique
  deviceInfo    String?
  ipAddress     String?
  lastActivity  DateTime @default(now())
  createdAt     DateTime @default(now())
  expiresAt     DateTime
}

model EncryptionKey {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  encryptedDek    String   // DEK encrypted with KMS master key
  keyVersion      Int      @default(1)
  createdAt       DateTime @default(now())
  rotatedAt       DateTime?
}

model MfaRecoveryAttempt {
  id            String   @id @default(uuid())
  userId        String
  ipAddress     String
  success       Boolean
  createdAt     DateTime @default(now())
}

// Enhance Organization model
model Organization {
  // ... existing fields

  // Security settings
  sessionTimeoutMinutes   Int @default(30)
  maxConcurrentSessions   Int @default(3)
  passwordExpirationDays  Int @default(90)
  requireMfa              Boolean @default(false)

  // Relations
  encryptionKeys          EncryptionKey[]
}

// Enhance AuditLog model
model AuditLog {
  // ... existing fields

  eventType     AuditEventType
  geolocation   Json?
  metadata      Json?
  archived      Boolean   @default(false)
  archivedAt    DateTime?
}

enum AuditEventType {
  AUTH
  PHI_ACCESS
  ADMIN
  SYSTEM
}
```

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| MFA adoption | 100% for admin roles | User query |
| Encryption coverage | 100% PHI fields | Code review |
| Audit log completeness | 100% security events | Log analysis |
| Session timeout compliance | 100% sessions | Monitoring |
| Failed login logging | 100% attempts | Audit query |
| Rate limit coverage | All endpoints | Code review |
| Security header score | A+ | securityheaders.com |
| Vulnerability scan | 0 critical/high | Scan report |

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| MFA friction increases churn | Medium | Medium | Gradual rollout, clear UX |
| Encryption performance impact | Medium | Low | Benchmark, optimize hot paths |
| Key rotation data loss | High | Low | Extensive testing, rollback plan |
| Vendor BAA delays | High | Medium | Start early, have alternatives |
| Redis downtime affects auth | High | Low | Local fallback, HA Redis |

---

## 11. Appendix

### A. HIPAA Technical Safeguard Mapping

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| §164.312(a)(1) Access Control | RBAC + MFA + Session Timeout | Phase 1 |
| §164.312(a)(2)(i) Unique User ID | Email-based user accounts | Done |
| §164.312(a)(2)(ii) Emergency Access | Admin bypass with audit | Phase 2 |
| §164.312(a)(2)(iii) Auto Logoff | Session timeout | Phase 1 |
| §164.312(a)(2)(iv) Encryption | AES-256-GCM + KMS | Phase 1 |
| §164.312(b) Audit Controls | Enhanced audit logging | Phase 2 |
| §164.312(c)(1) Integrity | Hash-chain audit logs | Done |
| §164.312(c)(2) Mechanism | Digital signatures | Phase 3 |
| §164.312(d) Authentication | MFA + password policy | Phase 1 |
| §164.312(e)(1) Transmission | TLS 1.3, HSTS | Phase 1 |
| §164.312(e)(2)(i) Integrity | TLS + checksums | Done |
| §164.312(e)(2)(ii) Encryption | End-to-end TLS | Done |

### B. SOC 2 Common Criteria Mapping

| Criteria | Description | Implementation | Phase |
|----------|-------------|----------------|-------|
| CC1.1-1.5 | Control Environment | Policies, training | Phase 4 |
| CC2.1-2.3 | Communication | Security awareness | Phase 4 |
| CC3.1-3.4 | Risk Assessment | Annual assessment | Phase 4 |
| CC4.1-4.2 | Monitoring | Logging, alerting | Phase 2 |
| CC5.1-5.3 | Control Activities | Procedures | Phase 4 |
| CC6.1-6.8 | Logical Access | MFA, RBAC, encryption | Phase 1-3 |
| CC7.1-7.5 | System Operations | Monitoring, incident response | Phase 2-3 |
| CC8.1 | Change Management | Git, CI/CD | Existing |
| CC9.1-9.2 | Risk Mitigation | Vendor management | Phase 3 |

---

## 12. Approval & Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Engineering Lead | | | |
| Security Lead | | | |
| Compliance Officer | | | |

---

*Document maintained by Engineering Team. Last updated: January 31, 2026*
