# Scrybe Solutions - Database Schema Documentation

## Entity Relationship Diagram

```mermaid
erDiagram
    Organization ||--o{ User : "has many"
    Organization ||--o{ Team : "has many"
    Organization ||--o{ Form : "has many"
    Organization ||--o{ FormTemplate : "has many"
    Organization ||--o{ AuditLog : "has many"
    Organization ||--o{ FileUpload : "has many"

    User ||--o{ TeamMember : "has many"
    User ||--o{ Form : "created"
    User ||--o{ FormVersion : "published"
    User ||--o{ FormAccess : "granted"

    Team ||--o{ TeamMember : "has many"
    Team ||--o{ FormAccess : "has many"

    Form ||--o{ FormField : "has many"
    Form ||--o{ FormVersion : "has many"
    Form ||--o{ FormAccess : "has many"
    Form ||--o{ FormSubmission : "has many"

    FormField ||--o{ ExtractionExample : "has many"

    FormVersion ||--o{ FormSubmission : "has many"

    FormSubmission ||--o{ Signature : "has many"

    Organization {
        uuid id PK
        string name
        string slug UK
        enum tier
        int purchasedFormPacks
        string encryptionKeyId
        string webhookUrl
        json settings
        string stripeCustomerId UK
        datetime createdAt
        datetime updatedAt
    }

    User {
        uuid id PK
        uuid orgId FK
        string email UK
        string name
        string avatarUrl
        enum role
        string supabaseUserId UK
        boolean canCreateForms
        boolean canReadForms
        boolean canUpdateForms
        boolean canDeleteForms
        boolean canPublishForms
        boolean isActive
        datetime lastLoginAt
        datetime createdAt
        datetime updatedAt
    }

    Team {
        uuid id PK
        uuid orgId FK
        string name
        string description
        datetime createdAt
        datetime updatedAt
    }

    TeamMember {
        uuid id PK
        uuid teamId FK
        uuid userId FK
        datetime createdAt
    }

    Form {
        uuid id PK
        uuid orgId FK
        string name
        string description
        enum type
        enum status
        int version
        json settings
        uuid createdById FK
        datetime createdAt
        datetime updatedAt
        datetime archivedAt
        datetime publishedAt
    }

    FormField {
        uuid id PK
        uuid formId FK
        string slug
        string name
        enum type
        enum purpose
        string purposeNote
        string helpText
        boolean isRequired
        boolean isSensitive
        boolean isAiExtractable
        json options
        string section
        int order
        json conditionalLogic
        json translations
        datetime createdAt
        datetime updatedAt
    }

    FormVersion {
        uuid id PK
        uuid formId FK
        int version
        json snapshot
        text aiExtractionPrompt
        uuid publishedById FK
        datetime publishedAt
    }

    FormAccess {
        uuid id PK
        uuid formId FK
        enum granteeType
        uuid granteeId
        enum role
        uuid grantedById FK
        datetime grantedAt
    }

    FormSubmission {
        uuid id PK
        uuid orgId FK
        uuid formId FK
        uuid formVersionId FK
        string clientId
        json data
        string status
        boolean isComplete
        boolean isDraft
        json aiExtractedData
        json aiConfidence
        array flaggedFields
        uuid submittedById
        datetime submittedAt
        datetime createdAt
        datetime updatedAt
    }

    Signature {
        uuid id PK
        uuid submissionId FK
        uuid fieldId
        bytes imageData
        string imageHash
        datetime timestamp
        string signerIp
        string signerUserAgent
        string signerSessionId
        json geolocation
        string deviceFingerprint
        boolean consentRecorded
        string consentText
        string documentHash
    }

    ExtractionExample {
        uuid id PK
        uuid fieldId FK
        text transcriptSnippet
        string extractedValue
        uuid createdById
        datetime createdAt
    }

    FormTemplate {
        uuid id PK
        uuid orgId FK
        string name
        string description
        array tags
        string thumbnail
        array useCaseExamples
        json formSnapshot
        boolean isSystemTemplate
        uuid createdById
        datetime createdAt
        int usageCount
    }

    FileUpload {
        uuid id PK
        uuid orgId FK
        string originalName
        string storagePath
        string mimeType
        int sizeBytes
        enum scanStatus
        json scanResult
        datetime scannedAt
        text extractedText
        uuid uploadedById
        datetime uploadedAt
    }

    AuditLog {
        uuid id PK
        uuid orgId FK
        uuid userId
        string action
        string resource
        uuid resourceId
        string resourceName
        json details
        string ipAddress
        string userAgent
        string previousHash
        string hash
        datetime timestamp
    }

    ComplianceReport {
        uuid id PK
        uuid orgId FK
        string reportType
        datetime startDate
        datetime endDate
        datetime generatedAt
        uuid generatedById
        json data
        string hash
    }

    Subscription {
        uuid id PK
        uuid orgId FK
        string stripeSubscriptionId UK
        string stripeCustomerId
        string tier
        string status
        datetime currentPeriodStart
        datetime currentPeriodEnd
        boolean cancelAtPeriodEnd
        datetime createdAt
        datetime updatedAt
    }

    PaymentHistory {
        uuid id PK
        uuid orgId FK
        string stripePaymentId UK
        int amount
        string currency
        string status
        string description
        string type
        json metadata
        datetime createdAt
    }
```

## Enums Reference

### Tier (Subscription Levels)
| Value | Description |
|-------|-------------|
| FREE | Free tier - 3 forms |
| STARTER | Starter tier - 10 forms |
| PROFESSIONAL | Professional tier - 50 forms |
| ENTERPRISE | Enterprise tier - Unlimited forms |

### FormType
| Value | Description |
|-------|-------------|
| INTAKE | Initial client enrollment |
| FOLLOWUP | Ongoing case documentation |
| REFERRAL | Partner agency referrals |
| ASSESSMENT | Evaluations (ACES, Cal-VIP, etc.) |
| CUSTOM | Organization-specific |

### FormStatus
| Value | Description |
|-------|-------------|
| DRAFT | Form is being built |
| PUBLISHED | Form is live and usable |
| ARCHIVED | Form is no longer active |

### FieldType
| Value | Description | AI Extractable |
|-------|-------------|----------------|
| TEXT_SHORT | Single line text | Yes (80%) |
| TEXT_LONG | Paragraph/multi-line | Yes (75%) |
| NUMBER | Numeric values | Yes (85%) |
| DATE | Date picker | Yes (90%) |
| PHONE | Phone number | Yes (85%) |
| EMAIL | Email address | Yes (85%) |
| ADDRESS | US address (Radar) | Yes (70%) |
| DROPDOWN | Single select | Yes (75%) |
| CHECKBOX | Multi-select | Yes (70%) |
| YES_NO | Boolean toggle | Yes (80%) |
| FILE | File upload | Limited (20%) |
| SIGNATURE | Digital signature | No (0%) |

### FieldPurpose
| Value | Description |
|-------|-------------|
| GRANT_REQUIREMENT | Required for funding compliance |
| INTERNAL_OPS | Day-to-day case management |
| COMPLIANCE | Required by law/regulation |
| OUTCOME_MEASUREMENT | Tracks program effectiveness |
| RISK_ASSESSMENT | Identifies client risk factors |
| OTHER | Custom reason |

### UserRole
| Value | Permissions |
|-------|-------------|
| SUPER_ADMIN | Full system access |
| ADMIN | Organization admin |
| PROGRAM_MANAGER | Manage programs/forms |
| CASE_MANAGER | Use forms, manage cases |
| VIEWER | Read-only access |

### ScanStatus (File Uploads)
| Value | Description |
|-------|-------------|
| PENDING | Awaiting scan |
| SCANNING | Currently scanning |
| CLEAN | No threats detected |
| INFECTED | Malware detected |
| ERROR | Scan failed |

## Table Relationships Summary

```mermaid
flowchart TD
    subgraph "Core Entities"
        ORG[Organization]
        USER[User]
        TEAM[Team]
    end

    subgraph "Form Builder"
        FORM[Form]
        FIELD[FormField]
        VER[FormVersion]
        ACCESS[FormAccess]
    end

    subgraph "AI & Extraction"
        EXAMPLE[ExtractionExample]
        TEMPLATE[FormTemplate]
    end

    subgraph "Submissions"
        SUB[FormSubmission]
        SIG[Signature]
        FILE[FileUpload]
    end

    subgraph "Compliance"
        AUDIT[AuditLog]
        REPORT[ComplianceReport]
    end

    subgraph "Billing"
        SUBSCRIPTION[Subscription]
        PAYMENT[PaymentHistory]
    end

    subgraph "Client Management (Spec-2)"
        CLIENT[Client]
        CALL[Call]
        NOTE[Note]
        TWILIO[TwilioNumber]
    end

    ORG --> USER
    ORG --> TEAM
    ORG --> FORM
    ORG --> AUDIT
    ORG --> FILE
    ORG --> CLIENT

    USER --> FORM
    USER --> CLIENT
    USER --> CALL
    USER --> NOTE
    USER --> TWILIO
    TEAM --> ACCESS

    CLIENT --> CALL
    CLIENT --> NOTE
    CLIENT --> SUB

    CALL --> NOTE
    CALL --> SUB

    FORM --> FIELD
    FORM --> VER
    FORM --> ACCESS
    FORM --> SUB

    FIELD --> EXAMPLE

    SUB --> SIG
```

## Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| Organization | slug | Quick lookup by slug |
| Organization | stripeCustomerId | Billing lookups |
| User | orgId | Filter users by org |
| User | email | Login/auth lookups |
| User | supabaseUserId | Auth integration |
| Form | orgId, status | Dashboard filtering |
| Form | createdById | User's forms |
| FormField | formId, order | Field ordering |
| FormSubmission | formId | Submission listing |
| FormSubmission | clientId | Client history |
| AuditLog | orgId, timestamp | Audit queries |
| AuditLog | resource, resourceId | Resource history |
| Client | orgId, status | Client listing |
| Client | orgId, phone | Duplicate detection |
| Client | assignedTo | Caseload queries |
| Call | clientId | Call history |
| Call | caseManagerId | Case manager calls |
| Call | status | Active calls |
| Call | aiProcessingStatus | Processing queue |
| Note | clientId | Client notes |
| Note | callId | Call notes |

---

## Spec-2: Client & Call Management ER Diagram

```mermaid
erDiagram
    Organization ||--o{ Client : "has many"
    User ||--o{ Client : "assigned"
    User ||--o{ Client : "created"
    User ||--o{ Call : "made"
    User ||--o{ Note : "authored"
    User ||--|| TwilioNumber : "has"

    Client ||--o{ Call : "has"
    Client ||--o{ Note : "has"
    Client ||--o{ FormSubmission : "has"

    Call ||--o{ Note : "has"
    Call ||--o{ FormSubmission : "produces"

    Client {
        uuid id PK
        uuid orgId FK
        string firstName
        string lastName
        string phone
        json additionalPhones
        string email
        json address
        string internalId
        enum status
        uuid assignedTo FK
        uuid createdBy FK
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    Call {
        uuid id PK
        uuid clientId FK
        uuid caseManagerId FK
        array formIds
        enum status
        datetime startedAt
        datetime endedAt
        int durationSeconds
        string twilioCallSid UK
        string recordingUrl
        datetime recordingRetention
        text transcriptRaw
        json transcriptJson
        json aiSummary
        json extractedFields
        json confidenceScores
        json manualCorrections
        enum aiProcessingStatus
        string aiProcessingError
        int aiProcessingRetries
        datetime createdAt
        datetime updatedAt
    }

    Note {
        uuid id PK
        uuid clientId FK
        uuid callId FK
        uuid authorId FK
        enum type
        text content
        array tags
        boolean isDraft
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    TwilioNumber {
        uuid id PK
        uuid userId FK UK
        string phoneNumber UK
        string twilioSid UK
        string areaCode
        datetime provisionedAt
    }

    ResourceLock {
        uuid id PK
        string resourceType
        uuid resourceId
        uuid lockedBy
        datetime lockedAt
        datetime expiresAt
    }

    FormEditLog {
        uuid id PK
        uuid submissionId FK
        uuid fieldId
        json previousValue
        json newValue
        uuid editedBy FK
        datetime editedAt
        string editReason
    }
```

## Spec-2: Enums Reference

### ClientStatus
| Value | Description |
|-------|-------------|
| ACTIVE | Currently active client |
| ON_HOLD | Temporarily paused |
| CLOSED | Case closed |
| PENDING | Awaiting activation |

### CallStatus
| Value | Description |
|-------|-------------|
| INITIATING | Call being set up |
| RINGING | Phone is ringing |
| IN_PROGRESS | Call is active |
| COMPLETED | Call ended normally |
| ABANDONED | Call was abandoned |
| ATTEMPTED | Attempted but not connected |
| FAILED | Technical failure |

### ProcessingStatus
| Value | Description |
|-------|-------------|
| PENDING | Awaiting processing |
| PROCESSING | Currently being processed |
| COMPLETED | Processing complete |
| FAILED | Processing failed |
| QUEUED_FOR_RETRY | Scheduled for retry |

### NoteType
| Value | Description |
|-------|-------------|
| INTERNAL | Internal notes only |
| SHAREABLE | Can be shared externally |

### ConsentMode
| Value | Description |
|-------|-------------|
| AUTO_RECORDING | Automatic consent recording |
| CASE_MANAGER_SCRIPT | Case manager reads consent |
| DISABLED | Consent handling disabled |
