# Enhanced Audit Logging - Technical Design

**Status:** Implemented
**Linear Issue:** PX-669
**Date:** January 31, 2026

## Overview

HIPAA-compliant audit logging system with comprehensive event tracking, hash-chain integrity, and 7-year retention support.

## Architecture

### Component Diagram

```mermaid
graph TB
    subgraph "Application Layer"
        API[API Routes]
        Actions[Server Actions]
        Services[Business Services]
    end

    subgraph "Audit Layer"
        AuthLog[AuthLogger]
        AdminLog[AdminLogger]
        PHILog[PHILogger]
        Enhanced[Enhanced Logger]
    end

    subgraph "Core Layer"
        HashChain[Hash Chain]
        Events[Event Types]
        Archival[Archival Service]
    end

    subgraph "Storage Layer"
        DB[(PostgreSQL)]
        S3[(S3 Cold Storage)]
    end

    API --> AuthLog
    API --> PHILog
    Actions --> AuthLog
    Services --> PHILog
    Services --> AdminLog

    AuthLog --> Enhanced
    AdminLog --> Enhanced
    PHILog --> Enhanced

    Enhanced --> HashChain
    Enhanced --> DB

    Archival --> DB
    Archival --> S3
```

## Event Types

### Event Classification

```mermaid
graph LR
    subgraph "AuditEventType"
        AUTH[AUTH]
        PHI[PHI_ACCESS]
        ADMIN[ADMIN]
        SYSTEM[SYSTEM]
        EXPORT[DATA_EXPORT]
        SEC[SECURITY]
    end

    subgraph "Severity"
        LOW[LOW]
        MED[MEDIUM]
        HIGH[HIGH]
        CRIT[CRITICAL]
    end

    AUTH --> MED
    AUTH --> HIGH
    PHI --> HIGH
    PHI --> CRIT
    ADMIN --> HIGH
    EXPORT --> CRIT
    SEC --> CRIT
```

### Event Taxonomy

| Event Type | Actions | Severity |
|------------|---------|----------|
| AUTH | LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, SESSION_TIMEOUT, PASSWORD_CHANGE, MFA_SETUP, MFA_VERIFY, ACCOUNT_LOCKOUT, ACCOUNT_UNLOCK | MEDIUM-CRITICAL |
| PHI_ACCESS | FORM_SUBMISSION_VIEW/EDIT/EXPORT, CLIENT_RECORD_VIEW/EDIT/EXPORT, CALL_RECORDING_PLAY/DOWNLOAD, TRANSCRIPT_VIEW, REPORT_GENERATE | HIGH-CRITICAL |
| ADMIN | USER_CREATE/UPDATE/DELETE, ROLE_ASSIGN, PERMISSION_GRANT, ORG_SETTINGS_UPDATE | HIGH |
| DATA_EXPORT | BULK_EXPORT | CRITICAL |
| SECURITY | SUSPICIOUS_ACTIVITY, RATE_LIMIT_EXCEEDED, UNAUTHORIZED_ACCESS_ATTEMPT | HIGH-CRITICAL |

## User Flows

### PHI Access Logging Flow

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Route
    participant PHI as PHILogger
    participant EL as Enhanced Logger
    participant HC as Hash Chain
    participant DB as Database

    U->>API: Request client record
    API->>API: Authenticate & authorize
    API->>PHI: clientRecordViewed()

    PHI->>EL: logEnhancedAudit()
    EL->>DB: Get last hash
    DB-->>EL: previousHash
    EL->>HC: calculateHash(data, previousHash)
    HC-->>EL: newHash

    EL->>DB: Insert audit log
    Note over DB: {eventType, action, severity,<br/>resource, metadata, hash, previousHash}

    API-->>U: Return client data
```

### Authentication Event Flow

```mermaid
sequenceDiagram
    participant U as User
    participant Auth as Auth Service
    participant AL as AuthLogger
    participant DB as Database

    U->>Auth: Login attempt

    alt Success
        Auth->>AL: loginSuccess()
        AL->>DB: Log LOGIN_SUCCESS (MEDIUM)
        Auth-->>U: Session created
    else Failure
        Auth->>AL: loginFailure()
        AL->>DB: Log LOGIN_FAILURE (HIGH)

        alt Max attempts reached
            Auth->>AL: accountLockout()
            AL->>DB: Log ACCOUNT_LOCKOUT (CRITICAL)
        end

        Auth-->>U: Error message
    end
```

### Log Archival Flow

```mermaid
flowchart TD
    A[Daily Archival Job] --> B{Logs > 1 year old?}
    B -->|Yes| C[Mark as archived]
    B -->|No| D[Skip]
    C --> E{Logs > 7 years old?}
    E -->|Yes| F[Export to S3]
    F --> G[Verify export hash]
    G --> H{Hash valid?}
    H -->|Yes| I[Purge from DB]
    H -->|No| J[Alert: Integrity issue]
    E -->|No| K[Keep in DB]
```

## Data Model

### Audit Log Entry

```mermaid
erDiagram
    AuditLog {
        string id PK
        string orgId FK
        string userId FK
        string eventType "AUTH|PHI_ACCESS|ADMIN|..."
        string severity "LOW|MEDIUM|HIGH|CRITICAL"
        string action "LOGIN_SUCCESS|FORM_VIEW|..."
        string resource "User|Client|Form|..."
        string resourceId
        string resourceName
        json details
        json metadata
        string ipAddress
        string userAgent
        json geolocation
        string sessionId
        string previousHash
        string hash
        datetime timestamp
    }

    Organization ||--o{ AuditLog : "has"
    User ||--o{ AuditLog : "performed"
```

### Metadata Structure

```json
{
  "eventType": "PHI_ACCESS",
  "severity": "HIGH",
  "fieldsAccessed": ["clientName", "diagnosis", "ssn"],
  "sensitiveFieldsAccessed": ["ssn"],
  "clientId": "uuid",
  "formId": "uuid",
  "exportFormat": "csv",
  "recordCount": 150
}
```

## Hash Chain Integrity

### Hash Calculation

```mermaid
sequenceDiagram
    participant L as Logger
    participant DB as Database
    participant C as Crypto

    L->>DB: Get last entry for org
    DB-->>L: {hash: "abc123..."}

    L->>L: Prepare hash data
    Note over L: {id, orgId, userId, eventType,<br/>action, resource, resourceId, timestamp}

    L->>C: SHA-256(JSON.stringify({data, previousHash}))
    C-->>L: "def456..."

    L->>DB: Insert with hash="def456...", previousHash="abc123..."
```

### Chain Verification

```mermaid
flowchart TD
    A[Start Verification] --> B[Fetch logs in order]
    B --> C{For each log i > 0}
    C --> D{log[i].previousHash == log[i-1].hash?}
    D -->|Yes| E[Continue]
    D -->|No| F[CHAIN BROKEN at i]
    E --> C
    C -->|Done| G[CHAIN VALID]
    F --> H[Return error position]
```

## Retention Policy

### HIPAA Requirements

| Data Type | Retention | Storage |
|-----------|-----------|---------|
| AUTH events | 7 years | Hot → Cold after 1 year |
| PHI_ACCESS | 7 years | Hot → Cold after 1 year |
| ADMIN events | 7 years | Hot → Cold after 1 year |
| SYSTEM events | 3 years | Hot → Cold after 6 months |
| DATA_EXPORT | 7 years | Hot → Cold after 1 year |

### Storage Tiers

```mermaid
graph LR
    subgraph "Hot Storage (PostgreSQL)"
        Recent[0-365 days]
    end

    subgraph "Cold Storage (S3 Glacier)"
        Archived[1-7 years]
    end

    subgraph "Purged"
        Expired[7+ years]
    end

    Recent -->|Archive job| Archived
    Archived -->|After 7 years| Expired
```

## File Structure

```
src/lib/audit/
├── events.ts           # Event types, actions, severity enums
├── enhanced-logger.ts  # Core logging with hash chain
├── phi-access.ts       # PHI-specific logging helpers
├── archival.ts         # Retention and archival service
├── hash-chain.ts       # Hash chain utilities (existing)
├── service.ts          # Legacy service (existing)
├── reports.ts          # Compliance reports (existing)
├── types.ts            # Type definitions (existing)
└── index.ts            # Exports
```

## API Usage

### Logging Authentication Events

```typescript
import { AuthLogger } from "@/lib/audit";

// Login success
await AuthLogger.loginSuccess({
  orgId: user.orgId,
  userId: user.id,
  ipAddress: request.ip,
  userAgent: request.headers["user-agent"],
});

// Login failure
await AuthLogger.loginFailure({
  orgId: org.id,
  attemptedEmail: email,
  ipAddress: request.ip,
  failureReason: "INVALID_PASSWORD",
  failedAttempts: 3,
});

// Account lockout
await AuthLogger.accountLockout({
  orgId: user.orgId,
  userId: user.id,
  ipAddress: request.ip,
  failedAttempts: 5,
  lockoutDurationMinutes: 30,
});
```

### Logging PHI Access

```typescript
import { PHILogger } from "@/lib/audit";

// Form submission viewed
await PHILogger.submissionViewed({
  orgId: user.orgId,
  userId: user.id,
  submissionId: submission.id,
  formId: form.id,
  formName: form.name,
  fieldsAccessed: ["clientName", "address", "phone"],
  sensitiveFieldsAccessed: ["ssn"],
  clientId: client.id,
  ipAddress: request.ip,
});

// Call recording downloaded (CRITICAL)
await PHILogger.callRecordingDownloaded({
  orgId: user.orgId,
  userId: user.id,
  callId: call.id,
  clientId: call.clientId,
  ipAddress: request.ip,
});
```

### Archival Operations

```typescript
import { archiveOldLogs, checkRetentionCompliance } from "@/lib/audit";

// Archive logs older than 1 year
const stats = await archiveOldLogs(orgId, {
  olderThanDays: 365,
  batchSize: 1000,
  dryRun: false,
});

// Check compliance
const compliance = await checkRetentionCompliance(orgId);
if (!compliance.compliant) {
  console.error("Compliance issues:", compliance.issues);
}
```

## Testing Checklist

- [ ] AuthLogger logs all authentication events
- [ ] PHILogger logs all PHI access with field-level detail
- [ ] Hash chain integrity maintained across entries
- [ ] Severity correctly assigned based on event type
- [ ] Geolocation captured when available
- [ ] Session ID correlation working
- [ ] Archival marks old logs correctly
- [ ] Compliance check detects chain breaks
- [ ] Export generates valid integrity hash
- [ ] 7-year retention enforced

## HIPAA Compliance Mapping

| Requirement | Implementation |
|-------------|----------------|
| §164.312(b) Audit Controls | Comprehensive event logging |
| §164.308(a)(1)(ii)(D) | Information system activity review |
| §164.312(c)(1) | Hash chain for integrity |
| §164.530(j) | 7-year retention policy |
| §164.308(a)(5)(ii)(C) | Login monitoring |
