# PHI Field Encryption - Technical Design

**Status:** Implemented
**Linear Issue:** PX-666
**Date:** January 31, 2026

## Overview

Application-level field encryption for Protected Health Information (PHI) using AES-256-GCM with envelope encryption via AWS KMS. Provides transparent encryption/decryption through Prisma middleware with per-organization Data Encryption Keys (DEKs).

## Architecture

### Key Hierarchy

```mermaid
graph TB
    subgraph "AWS KMS"
        MK[Master Key]
    end

    subgraph "Database"
        EDK1[Encrypted DEK - Org A]
        EDK2[Encrypted DEK - Org B]
        EDK3[Encrypted DEK - Org C]
    end

    subgraph "Application Memory"
        PDK1[Plaintext DEK - Org A]
        PDK2[Plaintext DEK - Org B]
    end

    subgraph "Encrypted PHI"
        FS[FormSubmission.data]
        NC[Note.content]
        CT[Call.transcript]
        MC[Message.content]
    end

    MK -->|Encrypt/Decrypt| EDK1
    MK -->|Encrypt/Decrypt| EDK2
    MK -->|Encrypt/Decrypt| EDK3

    EDK1 -->|Decrypt on demand| PDK1
    EDK2 -->|Decrypt on demand| PDK2

    PDK1 -->|AES-256-GCM| FS
    PDK1 -->|AES-256-GCM| NC
    PDK2 -->|AES-256-GCM| CT
    PDK2 -->|AES-256-GCM| MC
```

### Component Diagram

```mermaid
graph TB
    subgraph "Application Layer"
        API[API Routes]
        Actions[Server Actions]
        Services[Business Services]
    end

    subgraph "Encryption Layer"
        Middleware[Prisma Middleware]
        Service[Encryption Service]
        Crypto[Crypto Module]
    end

    subgraph "Key Management"
        KeyMgmt[Key Management]
        KMS[AWS KMS Client]
        Cache[DEK Cache]
    end

    subgraph "Storage"
        DB[(PostgreSQL)]
        AWSKMS[(AWS KMS)]
    end

    API --> Middleware
    Actions --> Middleware
    Services --> Service

    Middleware --> Crypto
    Service --> Crypto
    Middleware --> KeyMgmt

    KeyMgmt --> KMS
    KeyMgmt --> Cache
    KeyMgmt --> DB

    KMS --> AWSKMS
    Crypto --> DB
```

## Encryption Flow

### Write Flow (Automatic via Middleware)

```mermaid
sequenceDiagram
    participant App as Application
    participant MW as Prisma Middleware
    participant KM as Key Management
    participant KMS as AWS KMS
    participant Crypto as AES-256-GCM
    participant DB as Database

    App->>MW: prisma.formSubmission.create({data})
    MW->>MW: Check if model has encrypted fields

    MW->>KM: getOrCreateOrgDek(orgId)
    KM->>KM: Check in-memory cache

    alt Cache miss
        KM->>DB: Get encrypted DEK
        KM->>KMS: Decrypt DEK
        KMS-->>KM: Plaintext DEK
        KM->>KM: Cache DEK (5 min TTL)
    end

    KM-->>MW: Plaintext DEK

    loop For each PHI field
        MW->>Crypto: encrypt(fieldValue, DEK)
        Crypto->>Crypto: Generate unique IV
        Crypto->>Crypto: AES-256-GCM encrypt
        Crypto-->>MW: "enc:v1:" + Base64(IV + AuthTag + Ciphertext)
    end

    MW->>DB: INSERT with encrypted fields
    DB-->>MW: Record created
    MW-->>App: Return (auto-decrypted)
```

### Read Flow (Automatic via Middleware)

```mermaid
sequenceDiagram
    participant App as Application
    participant MW as Prisma Middleware
    participant KM as Key Management
    participant Crypto as AES-256-GCM
    participant DB as Database

    App->>MW: prisma.formSubmission.findFirst({where})
    MW->>DB: SELECT * FROM form_submission
    DB-->>MW: Record with encrypted fields

    MW->>KM: getOrCreateOrgDek(orgId)
    KM-->>MW: DEK (from cache or KMS)

    loop For each encrypted field
        MW->>MW: Check "enc:v1:" prefix
        MW->>Crypto: decrypt(encryptedValue, DEK)
        Crypto->>Crypto: Extract IV, AuthTag, Ciphertext
        Crypto->>Crypto: AES-256-GCM decrypt + verify
        Crypto-->>MW: Plaintext value
    end

    MW-->>App: Record with decrypted fields
```

### Key Rotation Flow

```mermaid
sequenceDiagram
    participant Admin as Admin
    participant Service as Encryption Service
    participant KM as Key Management
    participant KMS as AWS KMS
    participant DB as Database
    participant Job as Background Job

    Admin->>Service: rotateOrganizationKey(orgId)

    Service->>KM: rotateOrgDek(orgId)
    KM->>KMS: generateDataKey()
    KMS-->>KM: {plaintextKey, encryptedKey}

    KM->>DB: INSERT new EncryptionKey (v2, active=true)
    KM->>DB: UPDATE old key (active=false, rotatedAt)
    KM->>KM: Clear cache

    KM-->>Service: {oldVersion: 1, newVersion: 2}

    Service->>Job: Schedule re-encryption job
    Job->>Service: reEncryptOrganizationData(orgId, v1, v2)

    loop For each model (FormSubmission, Note, Call, Message)
        loop Batch of 100 records
            Service->>DB: Fetch records
            Service->>Service: Decrypt with old DEK
            Service->>Service: Re-encrypt with new DEK
            Service->>DB: Update records
        end
    end

    Service-->>Admin: Re-encryption complete
```

## Data Model

### EncryptionKey Entity

```mermaid
erDiagram
    Organization ||--o{ EncryptionKey : "has"
    EncryptionKey ||--o{ FormSubmission : "encrypts"
    EncryptionKey ||--o{ Note : "encrypts"
    EncryptionKey ||--o{ Call : "encrypts"
    EncryptionKey ||--o{ Message : "encrypts"

    EncryptionKey {
        string id PK
        string organizationId FK
        string encryptedDek "KMS-encrypted DEK"
        int keyVersion "Increments on rotation"
        boolean isActive "Only one active per org"
        datetime createdAt
        datetime rotatedAt
    }
```

### Encrypted Data Format

```
enc:v1:[Base64-encoded data]

Where Base64 decodes to:
┌────────────────┬──────────────────┬─────────────────┐
│   IV (12B)     │  Auth Tag (16B)  │   Ciphertext    │
└────────────────┴──────────────────┴─────────────────┘
```

## Encrypted Fields

| Model | Field | Type | Description |
|-------|-------|------|-------------|
| FormSubmission | data | JSON | Form field values with PHI |
| FormSubmission | aiExtractedData | JSON | AI-extracted data from calls |
| Note | content | String | Rich text HTML content |
| Call | transcriptRaw | String | Raw call transcript |
| Call | transcriptJson | JSON | Structured transcript |
| Call | extractedFields | JSON | AI-extracted form fields |
| Call | aiSummary | JSON | AI-generated summary |
| Call | confidenceScores | JSON | AI confidence scores |
| Message | content | String | Message text |

## Configuration

### Environment Variables

```bash
# AWS KMS Configuration
AWS_KMS_KEY_ID=arn:aws:kms:us-west-2:123456789:key/abc-123
AWS_KMS_REGION=us-west-2  # Optional, defaults to AWS_REGION

# Development mode (KMS not required)
# If AWS_KMS_KEY_ID is not set, uses local key generation
# Keys are prefixed with "dev:" and NOT suitable for production
```

### Prisma Schema Addition

```prisma
model EncryptionKey {
  id              String    @id @default(uuid())
  organizationId  String
  encryptedDek    String    @db.Text
  keyVersion      Int       @default(1)
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  rotatedAt       DateTime?

  @@index([organizationId, isActive])
  @@index([organizationId, keyVersion])
}
```

## File Structure

```
src/lib/encryption/
├── crypto.ts           # AES-256-GCM encrypt/decrypt functions
├── kms.ts              # AWS KMS client and operations
├── key-management.ts   # DEK lifecycle and caching
├── field-encryption.ts # Prisma middleware
└── index.ts            # Public exports

src/lib/services/
└── encryption-service.ts # High-level API
```

## Usage Examples

### Automatic Encryption (Recommended)

```typescript
// Enable middleware in Prisma client initialization
import { createEncryptionMiddleware } from '@/lib/encryption';
prisma.$use(createEncryptionMiddleware());

// All operations are automatically encrypted/decrypted
const submission = await prisma.formSubmission.create({
  data: {
    orgId: 'org-123',
    formId: 'form-456',
    data: { ssn: '123-45-6789', name: 'John Doe' }, // Auto-encrypted
  }
});

// Reading returns decrypted data
const result = await prisma.formSubmission.findFirst({
  where: { id: submission.id }
});
console.log(result.data); // { ssn: '123-45-6789', name: 'John Doe' }
```

### Manual Encryption

```typescript
import { encryptValue, decryptValue } from '@/lib/services/encryption-service';

// Encrypt a value
const encrypted = await encryptValue('org-123', 'sensitive PHI data');
// Returns: "enc:v1:base64..."

// Decrypt a value
const decrypted = await decryptValue('org-123', encrypted);
// Returns: "sensitive PHI data"
```

### Key Rotation

```typescript
import {
  rotateOrganizationKey,
  reEncryptOrganizationData
} from '@/lib/services/encryption-service';

// 1. Rotate the key
const { oldVersion, newVersion } = await rotateOrganizationKey('org-123');

// 2. Re-encrypt existing data (run as background job)
const results = await reEncryptOrganizationData('org-123', oldVersion, newVersion, {
  batchSize: 100,
  onProgress: (model, count) => console.log(`${model}: ${count} processed`)
});
```

### Initial Migration

```typescript
import { encryptExistingData } from '@/lib/services/encryption-service';

// Encrypt all unencrypted data for an organization
const results = await encryptExistingData('org-123', {
  batchSize: 100,
  onProgress: (model, count) => console.log(`Encrypting ${model}: ${count}`)
});
```

## Security Considerations

### Key Protection

```mermaid
flowchart TD
    A[Master Key] -->|Never leaves| B[AWS KMS]
    C[DEK] -->|Encrypted by Master Key| D[Database]
    C -->|Plaintext only in| E[Application Memory]
    E -->|5-minute TTL| F[Cleared from Cache]
    C -->|Rotated| G[Annually or on Demand]
```

### Data Flow Security

1. **Master Key**: Never leaves AWS KMS hardware security modules
2. **DEK Storage**: Always encrypted at rest in database
3. **DEK in Memory**: Cached for 5 minutes, then cleared
4. **Unique IV**: Every encryption operation uses a random 12-byte IV
5. **Authentication**: GCM mode provides integrity verification

## Testing Checklist

- [ ] Encryption produces "enc:v1:" prefixed output
- [ ] Decryption reverses encryption correctly
- [ ] Unique IV per encryption operation
- [ ] Auth tag verification prevents tampering
- [ ] Organization isolation (Org A can't decrypt Org B data)
- [ ] Key rotation creates new version
- [ ] Re-encryption migrates data to new key
- [ ] Cache invalidation on key rotation
- [ ] Development mode works without KMS
- [ ] Production rejects dev-mode keys

## HIPAA Compliance Mapping

| Requirement | Implementation |
|-------------|----------------|
| §164.312(a)(2)(iv) Encryption | AES-256-GCM for PHI at rest |
| §164.312(e)(2)(ii) Encryption | Same encryption for PHI in transit |
| §164.312(c)(1) Integrity | GCM authentication tag |
| §164.308(a)(5)(ii)(D) Key Management | AWS KMS with rotation support |
| §164.312(d) Authentication | Per-organization key isolation |
