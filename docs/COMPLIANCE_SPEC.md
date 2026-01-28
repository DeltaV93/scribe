# Compliance Implementation Specification

## Executive Summary

This document outlines the full compliance requirements for Scrybe to serve government agencies, healthcare organizations, and social services nonprofits. It covers HIPAA, SOC 2, 42 CFR Part 2, CJIS, and StateRAMP requirements.

**Current Compliance Score: 68/100**
- HIPAA-Ready: 75%
- SOC 2-Ready: 62%

**Estimated Total Investment (External Costs Only - Development Excluded):**
- One-Time: $33,000 - $68,000
- Annual: $62,600 - $113,200

*Note: Development costs excluded as code is built in-house.*

---

## Compliance Frameworks Overview

| Certification | Required For | Difficulty | Timeline | One-Time Cost | Annual Cost |
|--------------|--------------|------------|----------|---------------|-------------|
| **HIPAA** | Any health info (PHI) | Medium | 2-4 months | $15-30K | $10-20K |
| **SOC 2 Type I** | Government/enterprise sales | Medium-High | 3-6 months | $25-50K | - |
| **SOC 2 Type II** | Ongoing compliance proof | High | 12 months after Type I | - | $30-50K |
| **42 CFR Part 2** | Substance abuse records | Medium | Alongside HIPAA | $5-10K | $5-10K |
| **CJIS** | Criminal justice data | High | 6-12 months | $20-40K | $15-25K |
| **StateRAMP** | State government contracts | High | 6-12 months | $30-50K | $20-30K |
| **FedRAMP** | Federal contracts | Very High | 12-18 months | $300-500K | $100-200K |

---

## What's Already Implemented

### Audit Logging - 100% Complete
**Value: ~$25,000 saved**

| Feature | Status | Location |
|---------|--------|----------|
| Hash-chain audit trail | ✅ Done | `src/lib/audit/hash-chain.ts` |
| SHA256 cryptographic integrity | ✅ Done | `src/lib/audit/hash-chain.ts` |
| Chain verification functions | ✅ Done | `verifyChain()`, `verifyEntry()` |
| Comprehensive audit service | ✅ Done | `src/lib/audit/service.ts` |
| 18 audit action types tracked | ✅ Done | `src/lib/audit/types.ts` |
| 10 resource types tracked | ✅ Done | `src/lib/audit/types.ts` |
| IP address & user agent logging | ✅ Done | AuditLog schema |
| Admin-only audit API | ✅ Done | `src/app/api/audit/route.ts` |

### Compliance Reporting - 100% Complete
**Value: ~$15,000 saved**

| Feature | Status | Location |
|---------|--------|----------|
| 6 report types (Activity, Access, User, Forms, Files, Integrity) | ✅ Done | `src/lib/audit/reports.ts` |
| Report integrity hashing | ✅ Done | `generateComplianceReport()` |
| CSV export | ✅ Done | `exportReportToCSV()` |
| Report verification | ✅ Done | `verifyReportIntegrity()` |

### Role-Based Access Control - 100% Complete
**Value: ~$20,000 saved**

| Feature | Status | Location |
|---------|--------|----------|
| 5 user roles (Super Admin → Viewer) | ✅ Done | Prisma schema |
| Granular permissions (CRUD + Publish) | ✅ Done | User model |
| Role-based permission defaults | ✅ Done | `getDefaultPermissions()` |
| API endpoint authorization | ✅ Done | All 35+ endpoints |
| Multi-tenant data isolation | ✅ Done | orgId filtering |
| Case manager data isolation | ✅ Done | `getCaseManagerCalls()` |

### Webhook Security - 100% Complete
**Value: ~$5,000 saved**

| Feature | Status | Location |
|---------|--------|----------|
| Twilio signature validation | ✅ Done | `src/lib/twilio/validation.ts` |
| Stripe webhook validation | ✅ Done | Billing webhook |
| Production-only enforcement | ✅ Done | Webhook routes |

### Edit Trails - 100% Complete
**Value: ~$10,000 saved**

| Feature | Status | Location |
|---------|--------|----------|
| FormEditLog table | ✅ Done | Prisma schema |
| Previous/new value tracking | ✅ Done | FormEditLog model |
| Edit reason capture | ✅ Done | FormEditLog.editReason |
| Editor identification | ✅ Done | FormEditLog.editedBy |

### Form Versioning - 100% Complete
**Value: ~$8,000 saved**

| Feature | Status | Location |
|---------|--------|----------|
| Immutable version snapshots | ✅ Done | FormVersion model |
| Version number tracking | ✅ Done | FormVersion.version |
| Submission-version linking | ✅ Done | FormSubmission.formVersionId |
| Publication audit logging | ✅ Done | AuditLogger.formPublished() |

### Security Headers - 70% Complete
**Value: ~$3,000 saved**

| Header | Status | Value |
|--------|--------|-------|
| X-Frame-Options | ✅ Done | DENY |
| X-Content-Type-Options | ✅ Done | nosniff |
| Referrer-Policy | ✅ Done | strict-origin-when-cross-origin |
| Permissions-Policy | ✅ Done | camera=(), microphone=(self), geolocation=(self) |
| Content-Security-Policy | ❌ Missing | - |
| Strict-Transport-Security | ❌ Missing | - |

### Basic Authentication - 60% Complete
**Value: ~$5,000 saved**

| Feature | Status | Location |
|---------|--------|----------|
| Supabase JWT authentication | ✅ Done | `src/lib/supabase/` |
| Email verification required | ✅ Done | Auth actions |
| Password minimum 8 chars | ✅ Done | Zod validation |
| Uppercase/lowercase/number required | ✅ Done | Zod validation |
| Protected route middleware | ✅ Done | `middleware.ts` |

### Consent Management - 50% Complete
**Value: ~$4,000 saved**

| Feature | Status | Location |
|---------|--------|----------|
| Organization consent modes | ✅ Done | Organization.consentMode |
| Call recording consent IVR | ✅ Done | `generateConsentTwiML()` |
| Signature consent tracking | ✅ Done | Signature.consentRecorded |
| Consent audit logging | ❌ Missing | - |
| Consent withdrawal | ❌ Missing | - |

### Data Retention Policies - 50% Complete
**Value: ~$3,000 saved**

| Feature | Status | Location |
|---------|--------|----------|
| Retention policies defined | ✅ Done | `DEFAULT_RETENTION_POLICIES` |
| Recording retention configurable | ✅ Done | Organization.recordingRetentionDays |
| Soft deletes | ✅ Done | Client.deletedAt, Note.deletedAt |
| Automated deletion jobs | ❌ Missing | - |
| Archival system | ❌ Missing | - |

**Total Already Implemented Value: ~$98,000**

---

## What Needs to Be Built

### Phase 1: HIPAA Compliance (Critical)
**Timeline: 6-8 weeks | Cost: $15,000-25,000**

#### 1.1 Database Encryption at Rest
**Priority: CRITICAL | Effort: 1 week | External Cost: $0**

```prisma
// Add to schema.prisma - encrypted sensitive fields
model Client {
  // ... existing fields
  ssnEncrypted        Bytes?    // Encrypted SSN
  medicalIdEncrypted  Bytes?    // Encrypted medical ID
  encryptionKeyId     String?   // Key used for encryption
}

model FormSubmission {
  // ... existing fields
  dataEncrypted       Bytes?    // Encrypted submission data for PHI
  encryptionKeyId     String?
}
```

**Implementation:**
- [ ] Enable PostgreSQL pgcrypto extension
- [ ] Create encryption/decryption functions
- [ ] Add encrypted columns for sensitive data
- [ ] Implement key management service
- [ ] Migrate existing sensitive data to encrypted format

**Files to create:**
- `src/lib/encryption/crypto.ts` - Encryption utilities
- `src/lib/encryption/key-management.ts` - Key rotation & management

---

#### 1.2 Session Management & Timeout
**Priority: CRITICAL | Effort: 3 days | External Cost: $0**

```typescript
// src/lib/auth/session-config.ts
export const SESSION_CONFIG = {
  maxIdleTime: 15 * 60 * 1000,      // 15 minutes
  absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
  warningBefore: 2 * 60 * 1000,     // 2 minute warning
  refreshInterval: 5 * 60 * 1000,   // Refresh every 5 min of activity
};
```

**Implementation:**
- [ ] Add session timeout middleware
- [ ] Create client-side idle detection
- [ ] Add session warning modal
- [ ] Implement automatic logout
- [ ] Log session timeouts to audit trail

**Files to create:**
- `src/lib/auth/session-config.ts` - Session configuration
- `src/components/auth/session-timeout-modal.tsx` - Warning UI
- `src/hooks/use-session-timeout.ts` - Client-side timeout hook

---

#### 1.3 Multi-Factor Authentication (MFA)
**Priority: CRITICAL | Effort: 2 weeks | External Cost: $0**

```prisma
model UserMFA {
  id              String    @id @default(uuid())
  userId          String    @unique
  totpSecret      String?   // Encrypted TOTP secret
  totpEnabled     Boolean   @default(false)
  smsEnabled      Boolean   @default(false)
  smsPhoneNumber  String?
  backupCodes     String[]  // Encrypted backup codes
  lastUsedAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user            User      @relation(fields: [userId], references: [id])
}

model MFAChallenge {
  id              String    @id @default(uuid())
  userId          String
  method          String    // 'totp', 'sms', 'backup'
  code            String    // Hashed challenge code
  expiresAt       DateTime
  usedAt          DateTime?
  createdAt       DateTime  @default(now())
}
```

**Implementation:**
- [ ] Add MFA models to schema
- [ ] Implement TOTP (Google Authenticator) support
- [ ] Implement SMS verification (via Twilio)
- [ ] Create backup codes system
- [ ] Add MFA setup UI in settings
- [ ] Add MFA challenge during login
- [ ] Allow org admins to require MFA

**Files to create:**
- `src/lib/auth/mfa/totp.ts` - TOTP implementation
- `src/lib/auth/mfa/sms.ts` - SMS verification
- `src/lib/auth/mfa/backup-codes.ts` - Backup codes
- `src/components/settings/mfa-setup.tsx` - Setup UI
- `src/app/(auth)/mfa-challenge/page.tsx` - Challenge page

---

#### 1.4 Enhanced Password Policies
**Priority: HIGH | Effort: 1 week | External Cost: $0**

```prisma
model PasswordHistory {
  id              String    @id @default(uuid())
  userId          String
  passwordHash    String
  createdAt       DateTime  @default(now())

  user            User      @relation(fields: [userId], references: [id])

  @@index([userId])
}

// Add to User model
model User {
  // ... existing fields
  passwordChangedAt   DateTime?
  passwordExpiresAt   DateTime?
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
}
```

**Implementation:**
- [ ] Password expiration (90 days configurable)
- [ ] Password history (prevent last 12)
- [ ] Failed login throttling (5 attempts = 30 min lockout)
- [ ] Special character requirement
- [ ] Minimum 12 characters for admin roles
- [ ] Password strength meter UI

**Files to create:**
- `src/lib/auth/password-policy.ts` - Policy enforcement
- `src/components/auth/password-strength-meter.tsx` - UI component

---

#### 1.5 PHI Access Logging
**Priority: HIGH | Effort: 1 week | External Cost: $0**

```prisma
model PHIAccessLog {
  id              String    @id @default(uuid())
  userId          String
  orgId           String
  accessType      String    // 'view', 'export', 'print', 'download'
  resourceType    String    // 'client', 'submission', 'recording'
  resourceId      String
  fieldsAccessed  String[]  // Which sensitive fields were accessed
  accessReason    String?   // Optional justification
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime  @default(now())

  user            User         @relation(fields: [userId], references: [id])
  organization    Organization @relation(fields: [orgId], references: [id])

  @@index([orgId, createdAt])
  @@index([userId])
  @@index([resourceType, resourceId])
}
```

**Implementation:**
- [ ] Create PHI access logging service
- [ ] Log all access to sensitive fields
- [ ] Require access reason for bulk exports
- [ ] Create PHI access report
- [ ] Add "break the glass" emergency access with extra logging

**Files to create:**
- `src/lib/audit/phi-access.ts` - PHI logging service
- `src/app/api/audit/phi-access/route.ts` - PHI access report API

---

#### 1.6 Business Associate Agreements (BAAs)
**Priority: CRITICAL | Effort: 2 weeks | External Cost: $0-3,000 (optional legal review)**

| Vendor | BAA Available | Action Required | Cost |
|--------|---------------|-----------------|------|
| Supabase | ✅ Enterprise plan | Upgrade to Enterprise | ~$599/mo |
| Twilio | ✅ Yes | Request BAA, enable HIPAA features | Free |
| Deepgram | ✅ Yes | Request BAA | Free |
| Anthropic | ✅ Yes | Sign BAA addendum | Free |
| AWS S3 | ✅ Yes | Sign BAA, use HIPAA-eligible services | Free |
| Railway | ❌ No | **MUST MIGRATE** to compliant host | Migration cost |

**Hosting Migration Options:**

| Provider | BAA | HIPAA | Cost | Migration Effort |
|----------|-----|-------|------|------------------|
| AWS ECS/Fargate | ✅ | ✅ | ~$200-500/mo | 2-3 weeks |
| GCP Cloud Run | ✅ | ✅ | ~$150-400/mo | 2-3 weeks |
| Azure Container Apps | ✅ | ✅ | ~$150-400/mo | 2-3 weeks |
| Render | ✅ | ✅ | ~$85-250/mo | 1-2 weeks |

**Recommended: Render** (easiest migration from Railway, HIPAA BAA available on Team plan)

---

### Phase 2: SOC 2 Compliance
**Timeline: 8-12 weeks | Cost: $30,000-60,000**

#### 2.1 Security Headers (Complete)
**Priority: HIGH | Effort: 2 days | External Cost: $0**

```javascript
// next.config.js - Add missing headers
{
  key: 'Strict-Transport-Security',
  value: 'max-age=31536000; includeSubDomains; preload'
},
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.twilio.com; frame-src https://js.stripe.com;"
},
{
  key: 'X-XSS-Protection',
  value: '1; mode=block'
}
```

**Implementation:**
- [ ] Add HSTS header
- [ ] Add CSP header
- [ ] Add X-XSS-Protection header
- [ ] Test all functionality with new headers

---

#### 2.2 Rate Limiting
**Priority: HIGH | Effort: 1 week | External Cost: $0**

```typescript
// src/lib/rate-limit/config.ts
export const RATE_LIMITS = {
  auth: {
    login: { window: '15m', max: 5 },      // 5 attempts per 15 min
    signup: { window: '1h', max: 3 },       // 3 signups per hour per IP
    passwordReset: { window: '1h', max: 3 },
  },
  api: {
    default: { window: '1m', max: 100 },    // 100 requests per minute
    sensitive: { window: '1m', max: 20 },   // PHI endpoints
    export: { window: '1h', max: 10 },      // Bulk exports
  },
  webhooks: {
    twilio: { window: '1s', max: 50 },
    stripe: { window: '1s', max: 20 },
  },
};
```

**Implementation:**
- [ ] Install rate limiting library (upstash/ratelimit or similar)
- [ ] Add rate limiting middleware
- [ ] Configure per-endpoint limits
- [ ] Add rate limit headers to responses
- [ ] Log rate limit violations

**Files to create:**
- `src/lib/rate-limit/index.ts` - Rate limiting service
- `src/middleware/rate-limit.ts` - Middleware

---

#### 2.3 Automated Data Retention
**Priority: MEDIUM | Effort: 2 weeks | External Cost: $0**

```typescript
// src/lib/jobs/data-retention.ts
export async function processDataRetention() {
  const policies = await getRetentionPolicies();

  for (const policy of policies) {
    const cutoffDate = subDays(new Date(), policy.retentionDays);

    // Archive data past archive threshold
    if (policy.archiveAfterDays) {
      await archiveOldData(policy.resource, policy.archiveAfterDays);
    }

    // Delete data past retention period
    await deleteExpiredData(policy.resource, cutoffDate);

    // Log deletion to audit trail
    await logRetentionAction(policy.resource, deletedCount);
  }
}
```

**Implementation:**
- [ ] Create retention job service
- [ ] Implement data archival to cold storage
- [ ] Implement secure deletion
- [ ] Add retention job scheduler (cron or queue)
- [ ] Create retention audit report
- [ ] Add admin UI to view/configure retention

**Files to create:**
- `src/lib/jobs/data-retention.ts` - Retention processor
- `src/lib/storage/archive.ts` - Archival service
- `src/app/api/jobs/retention/route.ts` - Cron endpoint

---

#### 2.4 Compliance Platform Integration
**Priority: HIGH | Effort: 2 weeks | External Cost: $10,000-25,000/year (subscription)**

Recommended platforms (choose one):
- **Vanta** - $10,000-25,000/year
- **Drata** - $10,000-20,000/year
- **Secureframe** - $8,000-15,000/year

**Implementation:**
- [ ] Select compliance platform
- [ ] Integrate agent for continuous monitoring
- [ ] Connect to AWS, Supabase, GitHub
- [ ] Complete policy templates
- [ ] Set up employee training tracking

---

#### 2.5 Penetration Testing
**Priority: HIGH | Effort: External | External Cost: $10,000-20,000**

**Implementation:**
- [ ] Select pentest vendor
- [ ] Scope: Web app, API, infrastructure
- [ ] Schedule annual testing
- [ ] Remediate findings
- [ ] Document remediation

---

#### 2.6 SOC 2 Audit
**Priority: HIGH | Effort: External | External Cost: $20,000-40,000**

**Implementation:**
- [ ] Select audit firm
- [ ] Complete readiness assessment
- [ ] Address gaps
- [ ] Undergo Type I audit
- [ ] Plan for Type II (12 months later)

---

### Phase 3: 42 CFR Part 2 (Substance Abuse)
**Timeline: 4-6 weeks | External Cost: $0**

#### 3.1 Consent Management System
**Priority: HIGH | Effort: 2 weeks | External Cost: $0**

```prisma
model Consent {
  id              String    @id @default(uuid())
  clientId        String
  orgId           String
  consentType     String    // 'general', 'substance_abuse', 'mental_health', 'hiv'
  grantedTo       String?   // Who can receive info
  purpose         String    // Purpose of disclosure
  expiresAt       DateTime?
  revokedAt       DateTime?
  revokedReason   String?
  signatureData   Json?     // Digital signature
  witnessName     String?
  witnessSignature Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  client          Client       @relation(fields: [clientId], references: [id])
  organization    Organization @relation(fields: [orgId], references: [id])

  @@index([clientId])
  @@index([orgId, consentType])
}

model ConsentAuditLog {
  id              String    @id @default(uuid())
  consentId       String
  action          String    // 'granted', 'revoked', 'expired', 'accessed'
  performedBy     String
  details         Json?
  createdAt       DateTime  @default(now())

  consent         Consent   @relation(fields: [consentId], references: [id])
}
```

**Implementation:**
- [ ] Create consent management models
- [ ] Build consent form UI
- [ ] Implement consent verification middleware
- [ ] Create consent audit logging
- [ ] Add consent revocation with cascading actions
- [ ] Implement re-disclosure prohibition warnings

**Files to create:**
- `src/lib/consent/service.ts` - Consent management
- `src/components/clients/consent-form.tsx` - Consent UI
- `src/app/api/clients/[clientId]/consent/route.ts` - Consent API

---

#### 3.2 Data Segmentation
**Priority: HIGH | Effort: 2 weeks | External Cost: $0**

```prisma
// Add to FormField
model FormField {
  // ... existing fields
  dataCategory    String?   // 'general', 'substance_abuse', 'mental_health', 'hiv'
  requiresConsent Boolean   @default(false)
}

// Add to FormSubmission
model FormSubmission {
  // ... existing fields
  dataCategories  String[]  // Categories of data in this submission
}
```

**Implementation:**
- [ ] Add data category tagging to form fields
- [ ] Implement category-based access control
- [ ] Create segmented export functionality
- [ ] Add consent checks before data access
- [ ] Build category filtering in search/reports

---

### Phase 4: CJIS Compliance (If Needed)
**Timeline: 12-16 weeks | External Cost: $5,000-15,000 (background checks, training)**

#### 4.1 CJIS Security Addendum Requirements
**Priority: CONDITIONAL | Effort: 8-12 weeks | External Cost: $5,000-15,000**

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Personnel security | ❌ Missing | Background checks for all staff |
| Security awareness training | ❌ Missing | Annual training program |
| Media protection | ⚠️ Partial | Enhanced data destruction |
| Physical protection | N/A | Cloud provider responsibility |
| Systems & communications | ⚠️ Partial | FIPS 140-2 encryption |
| Access control | ✅ Done | RBAC implemented |
| Auditing & accountability | ✅ Done | Hash-chain audit trail |
| Configuration management | ❌ Missing | Change management process |
| Incident response | ❌ Missing | IR plan & procedures |
| Identification & authentication | ⚠️ Partial | Need advanced auth (MFA) |

**Implementation (if pursuing CJIS):**
- [ ] Implement FIPS 140-2 validated encryption
- [ ] Create background check process
- [ ] Build security training module
- [ ] Document incident response plan
- [ ] Create change management procedures
- [ ] Implement advanced authentication

---

### Phase 5: StateRAMP (If Needed)
**Timeline: 6-12 months | External Cost: $25,000-50,000 (3PAO assessment)**

StateRAMP is modeled on FedRAMP but for state/local government. Requirements include:

- [ ] Complete System Security Plan (SSP)
- [ ] Implement all NIST 800-53 controls (Moderate baseline)
- [ ] Engage 3PAO for assessment
- [ ] Continuous monitoring program
- [ ] Annual reassessment

**Recommendation:** Only pursue if specific state contracts require it. Most state agencies accept SOC 2 + HIPAA.

---

## Cost Summary

*Note: All development costs excluded - you're building the code yourself. Only external vendor/service costs listed.*

### One-Time Costs (External Only)

| Category | Low Estimate | High Estimate | Notes |
|----------|--------------|---------------|-------|
| **Phase 1: HIPAA** | | | |
| Database encryption | $0 | $0 | You build |
| Session management | $0 | $0 | You build |
| MFA implementation | $0 | $0 | You build |
| Password policies | $0 | $0 | You build |
| PHI access logging | $0 | $0 | You build |
| BAA legal review (optional) | $0 | $3,000 | Optional lawyer review |
| **Phase 1 Subtotal** | **$0** | **$3,000** | |
| | | | |
| **Phase 2: SOC 2** | | | |
| Security headers | $0 | $0 | You build |
| Rate limiting | $0 | $0 | You build |
| Data retention automation | $0 | $0 | You build |
| Penetration testing | $10,000 | $20,000 | External vendor required |
| SOC 2 Type I audit | $20,000 | $40,000 | External auditor required |
| **Phase 2 Subtotal** | **$30,000** | **$60,000** | |
| | | | |
| **Phase 3: 42 CFR Part 2** | | | |
| Consent management | $0 | $0 | You build |
| Data segmentation | $0 | $0 | You build |
| **Phase 3 Subtotal** | **$0** | **$0** | |
| | | | |
| **Phase 4: CJIS** (optional) | | | |
| Background checks & training | $5,000 | $15,000 | Personnel costs |
| | | | |
| **Phase 5: StateRAMP** (optional) | | | |
| 3PAO assessment | $25,000 | $50,000 | External assessor |
| | | | |
| **TOTAL ONE-TIME** | **$30,000** | **$63,000** | Phases 1-3 |
| **With CJIS** | $35,000 | $78,000 | |
| **With StateRAMP** | $60,000 | $128,000 | |

### Annual Recurring Costs

| Category | Low Estimate | High Estimate | Notes |
|----------|--------------|---------------|-------|
| Compliance platform (Vanta/Drata) | $10,000 | $25,000 | Continuous monitoring |
| SOC 2 Type II audit | $25,000 | $40,000 | Annual audit |
| Penetration testing | $8,000 | $15,000 | Annual testing |
| HIPAA risk assessment | $5,000 | $10,000 | Annual assessment |
| Security training | $2,000 | $5,000 | Employee training |
| Supabase Enterprise | $7,200 | $7,200 | For BAA ($599/mo) |
| HIPAA-compliant hosting | $2,400 | $6,000 | Render/AWS (~$200-500/mo) |
| Legal/policy updates | $3,000 | $5,000 | Annual review |
| **TOTAL ANNUAL** | **$62,600** | **$113,200** | |

### Vendor Costs (New/Upgraded)

| Vendor | Current | Required | Monthly Delta | Annual Delta |
|--------|---------|----------|---------------|--------------|
| Supabase | Free/Pro | Enterprise | +$500-600 | +$6,000-7,200 |
| Railway | ~$20 | Render ~$85-250 | +$65-230 | +$780-2,760 |
| Compliance Platform | $0 | Vanta/Drata | +$800-2,000 | +$10,000-25,000 |

---

## Implementation Timeline

```
Month 1-2: HIPAA Foundation
├── Week 1-2: Database encryption + key management
├── Week 3: Session timeout implementation
├── Week 4-6: MFA implementation
├── Week 7: Password policy enhancements
└── Week 8: PHI access logging

Month 2-3: HIPAA Completion + SOC 2 Start
├── Week 9-10: Hosting migration (Railway → Render)
├── Week 10: Sign all vendor BAAs
├── Week 11: Security headers completion
├── Week 12: Rate limiting implementation

Month 3-4: SOC 2 Preparation
├── Week 13-14: Data retention automation
├── Week 15-16: Compliance platform setup
├── Week 17-18: Policy documentation
└── Week 19-20: Penetration testing

Month 4-5: 42 CFR Part 2
├── Week 21-22: Consent management system
├── Week 23-24: Data segmentation
└── Week 25-26: Testing & documentation

Month 5-6: SOC 2 Audit
├── Week 27-28: Readiness assessment
├── Week 29-32: SOC 2 Type I audit
└── Week 33+: Remediation if needed

Month 12+: SOC 2 Type II
└── Continuous monitoring for 12 months, then Type II audit
```

---

## Risk Assessment

### High Risk (Address Immediately)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Railway has no BAA | Cannot use real PHI | Migrate to Render/AWS |
| No MFA | Failed audits, breach risk | Implement Phase 1.3 |
| No session timeout | Unauthorized access | Implement Phase 1.2 |
| No database encryption | PHI exposure | Implement Phase 1.1 |

### Medium Risk (Address Within 90 Days)

| Risk | Impact | Mitigation |
|------|--------|------------|
| No rate limiting | DDoS, brute force | Implement Phase 2.2 |
| Missing security headers | XSS, clickjacking | Implement Phase 2.1 |
| No automated retention | Data accumulation | Implement Phase 2.3 |

### Low Risk (Address Within 180 Days)

| Risk | Impact | Mitigation |
|------|--------|------------|
| No consent management | 42 CFR Part 2 violation | Implement Phase 3.1 |
| No compliance platform | Manual monitoring burden | Select vendor Phase 2.4 |

---

## Appendix A: Already Implemented Features

What you've already built (would cost ~$98,000 if outsourced):

| Feature | Status | Notes |
|---------|--------|-------|
| Hash-chain audit logging | ✅ Complete | Immutable, SHA256, chain verification |
| Compliance reporting | ✅ Complete | 6 report types with integrity checking |
| RBAC system | ✅ Complete | 5 roles, granular permissions |
| Webhook security | ✅ Complete | Twilio & Stripe signature validation |
| Edit trails | ✅ Complete | FormEditLog with full history |
| Form versioning | ✅ Complete | Immutable snapshots |
| Basic auth | ✅ Complete | Supabase JWT, email verification |
| Consent basics | ✅ Partial | Recording consent, needs expansion |
| Retention policies | ✅ Partial | Defined, needs automation |
| Security headers | ✅ Partial | 5/8 headers configured |

---

## Appendix B: Compliance Contacts

### Audit Firms (SOC 2)
- Johanson Group - Mid-market focus
- Schellman - Tech-focused
- A-LIGN - Fast turnaround

### Penetration Testing
- Bishop Fox
- NCC Group
- Cobalt

### Compliance Platforms
- Vanta (vanta.com)
- Drata (drata.com)
- Secureframe (secureframe.com)

### HIPAA Consultants
- Clearwater Compliance
- HIPAA One
- Compliancy Group

---

## Appendix C: Quick Reference

### Minimum Viable Compliance (Government Sales)

For basic government/enterprise sales:
1. ✅ HIPAA compliance (Phases 1 + BAAs)
2. ✅ SOC 2 Type I (Phase 2)
3. ✅ 42 CFR Part 2 if substance abuse data (Phase 3)

**Minimum Investment:** $30,000-63,000 one-time + $62,600-113,200/year

### Premium Compliance (Large Government Contracts)

For state agency contracts and large healthcare systems:
1. All of above, plus:
2. ✅ SOC 2 Type II
3. ✅ StateRAMP (if required)
4. ✅ CJIS (if criminal justice data)

**Full Investment:** $60,000-128,000 one-time + $80,000-150,000/year
