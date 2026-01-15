# Scrybe Solutions - Technical Architecture

## System Architecture Overview

```mermaid
flowchart TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile App - Future]
    end

    subgraph "Frontend - Next.js 14+"
        APP[App Router]
        UI[Shadcn/UI + Tailwind]
        STATE[Jotai State Management]
        DND[dnd-kit Drag & Drop]
        FLOW[React Flow - Logic Editor]
    end

    subgraph "API Layer - Next.js API Routes"
        AUTH_API[Auth Endpoints]
        FORMS_API[Forms CRUD]
        AI_API[AI Endpoints]
        BILLING_API[Billing Endpoints]
        FILES_API[File Upload]
        AUDIT_API[Audit Endpoints]
    end

    subgraph "Services Layer"
        AUTH_SVC[Auth Service]
        FORM_SVC[Form Service]
        AI_SVC[AI Service]
        BILLING_SVC[Billing Service]
        FILE_SVC[File Service]
        AUDIT_SVC[Audit Service]
    end

    subgraph "External Services"
        SUPABASE[Supabase Auth]
        ANTHROPIC[Claude API]
        STRIPE[Stripe Payments]
        RADAR[Radar - Address]
        CLAMAV[ClamAV Scanner]
    end

    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        PG[(PostgreSQL - Railway)]
        STORAGE[(Supabase Storage)]
    end

    WEB --> APP
    APP --> UI
    UI --> STATE
    STATE --> DND
    STATE --> FLOW

    APP --> AUTH_API
    APP --> FORMS_API
    APP --> AI_API
    APP --> BILLING_API
    APP --> FILES_API
    APP --> AUDIT_API

    AUTH_API --> AUTH_SVC
    FORMS_API --> FORM_SVC
    AI_API --> AI_SVC
    BILLING_API --> BILLING_SVC
    FILES_API --> FILE_SVC
    AUDIT_API --> AUDIT_SVC

    AUTH_SVC --> SUPABASE
    AI_SVC --> ANTHROPIC
    BILLING_SVC --> STRIPE
    FORM_SVC --> RADAR
    FILE_SVC --> CLAMAV

    AUTH_SVC --> PRISMA
    FORM_SVC --> PRISMA
    AI_SVC --> PRISMA
    BILLING_SVC --> PRISMA
    FILE_SVC --> PRISMA
    AUDIT_SVC --> PRISMA

    PRISMA --> PG
    FILE_SVC --> STORAGE
```

## Technology Stack

```mermaid
mindmap
  root((Scrybe Stack))
    Frontend
      Next.js 14+
      React 18
      TypeScript
      Tailwind CSS
      Shadcn/UI
      Jotai
      dnd-kit
      React Flow
    Backend
      Next.js API Routes
      Prisma ORM
      Zod Validation
    Database
      PostgreSQL
      Railway Hosting
    Auth
      Supabase Auth
      JWT Sessions
    AI
      Claude Sonnet
      Form Generation
      Data Extraction
    Payments
      Stripe
      Subscriptions
      Form Packs
    Storage
      Supabase Storage
      ClamAV Scanning
    DevOps
      Railway Deploy
      GitHub Actions
```

## Component Architecture

```mermaid
flowchart TD
    subgraph "Form Builder Components"
        FB[FormBuilder]
        WS[WizardSteps]
        WN[WizardNavigation]

        subgraph "Step Components"
            SETUP[AISetupStep]
            FIELDS[FieldsStep]
            ORGANIZE[OrganizeStep]
            LOGIC[LogicStep]
            PREVIEW[PreviewStep]
            AICONFIG[AIConfigStep]
            PUBLISH[PublishStep]
        end

        subgraph "Field Components"
            PALETTE[FieldPalette]
            CANVAS[FormCanvas]
            CARD[FieldCard]
            EDITOR[FieldEditor]
        end

        subgraph "AI Components"
            REVIEW[GeneratedFormReview]
        end
    end

    FB --> WS
    FB --> WN
    WS --> SETUP
    WS --> FIELDS
    WS --> ORGANIZE
    WS --> LOGIC
    WS --> PREVIEW
    WS --> AICONFIG
    WS --> PUBLISH

    FIELDS --> PALETTE
    FIELDS --> CANVAS
    CANVAS --> CARD
    CARD --> EDITOR

    SETUP --> REVIEW
```

## State Management (Jotai)

```mermaid
flowchart LR
    subgraph "Core Atoms"
        FA[formBuilderAtom]
        WA[wizardStepAtom]
        DA[draftFormAtom]
    end

    subgraph "Derived Atoms"
        CFA[currentFormAtom]
        FLA[fieldsAtom]
        SFA[sortedFieldsAtom]
        FBS[fieldsBySectionAtom]
        SEL[selectedFieldAtom]
        PUB[canPublishAtom]
        AIE[aiExtractableFieldsAtom]
    end

    subgraph "AI Generation Atoms"
        AIG[aiGenerationAtom]
        AGS[aiGenerationStatusAtom]
        GFA[generatedFieldsAtom]
        ESA[extractionSuggestionsAtom]
    end

    subgraph "Action Atoms"
        UF[updateFormAtom]
        AF[addFieldAtom]
        RF[removeFieldAtom]
        RO[reorderFieldsAtom]
        SG[startGenerationAtom]
        AG[acceptGeneratedFieldsAtom]
    end

    FA --> CFA
    FA --> FLA
    FLA --> SFA
    SFA --> FBS
    FA --> SEL
    FA --> PUB
    SFA --> AIE

    AIG --> AGS
    AIG --> GFA
    AIG --> ESA

    UF --> FA
    AF --> FA
    RF --> FA
    RO --> FA
    SG --> AIG
    AG --> FA
    AG --> AIG
```

## API Endpoint Structure

```mermaid
flowchart TD
    subgraph "Forms API"
        F1[GET /api/forms]
        F2[POST /api/forms]
        F3[GET /api/forms/:id]
        F4[PATCH /api/forms/:id]
        F5[DELETE /api/forms/:id]
        F6[POST /api/forms/:id/publish]
        F7[POST /api/forms/:id/duplicate]
    end

    subgraph "Fields API"
        FD1[GET /api/forms/:id/fields]
        FD2[POST /api/forms/:id/fields]
        FD3[PATCH /api/forms/:id/fields/:fieldId]
        FD4[DELETE /api/forms/:id/fields/:fieldId]
    end

    subgraph "AI API"
        AI1[POST /api/ai/generate-form]
        AI2[POST /api/ai/extract]
        AI3[GET /api/ai/examples]
        AI4[POST /api/ai/examples]
    end

    subgraph "Billing API"
        B1[GET /api/billing/subscription]
        B2[POST /api/billing/subscription]
        B3[POST /api/billing/portal]
        B4[POST /api/billing/form-packs]
        B5[GET /api/billing/invoices]
        B6[GET /api/billing/usage]
        B7[POST /api/billing/webhook]
    end

    subgraph "Files API"
        FL1[POST /api/files/upload]
        FL2[GET /api/files/:id]
        FL3[DELETE /api/files/:id]
    end

    subgraph "Audit API"
        AU1[GET /api/audit]
        AU2[GET /api/audit/:id]
        AU3[GET /api/audit/verify]
    end

    subgraph "Compliance API"
        C1[GET /api/compliance/reports]
        C2[POST /api/compliance/reports]
        C3[GET /api/compliance/reports/:id]
    end
```

## Data Flow - AI Form Generation

```mermaid
sequenceDiagram
    participant U as User
    participant UI as AISetupStep
    participant S as Jotai Store
    participant API as /api/ai/generate-form
    participant AI as Claude API
    participant R as GeneratedFormReview

    U->>UI: Enter form details
    UI->>S: startGenerationAtom
    S->>API: POST request
    API->>AI: Generate form prompt
    AI-->>API: JSON fields + reasoning
    API-->>S: GenerateFormResponse
    S->>R: Display generated fields
    U->>R: Select/deselect fields
    U->>R: Click Accept
    R->>S: acceptGeneratedFieldsAtom
    S->>UI: Navigate to Fields step
```

## Security Architecture

```mermaid
flowchart TD
    subgraph "Authentication Layer"
        SUP[Supabase Auth]
        JWT[JWT Tokens]
        SES[Session Management]
    end

    subgraph "Authorization Layer"
        RBAC[Role-Based Access]
        PERM[CRUD Permissions]
        FORM_ACC[Form-Level Access]
    end

    subgraph "Data Protection"
        ENC[Envelope Encryption]
        VAULT[Supabase Vault]
        SENS[Sensitive Field Marking]
    end

    subgraph "Input Validation"
        ZOD[Zod Schemas]
        XSS[XSS Prevention]
        CSRF[CSRF Protection]
    end

    subgraph "Audit Trail"
        HASH[Hash Chain]
        LOG[Audit Logging]
        VERIFY[Integrity Verification]
    end

    SUP --> JWT
    JWT --> SES
    SES --> RBAC
    RBAC --> PERM
    PERM --> FORM_ACC

    FORM_ACC --> ENC
    ENC --> VAULT
    VAULT --> SENS

    ZOD --> XSS
    XSS --> CSRF

    FORM_ACC --> LOG
    LOG --> HASH
    HASH --> VERIFY
```

## File Processing Pipeline

```mermaid
flowchart LR
    subgraph "Upload"
        U1[File Upload Request]
        U2[Size/Type Validation]
        U3[Quarantine Storage]
    end

    subgraph "Scanning"
        S1[ClamAV Queue]
        S2[Virus Scan]
        S3{Clean?}
    end

    subgraph "Processing"
        P1[Move to Storage]
        P2{PDF?}
        P3[Text Extraction]
        P4[Image Optimization]
    end

    subgraph "Result"
        R1[File Available]
        R2[File Rejected]
    end

    U1 --> U2
    U2 --> U3
    U3 --> S1
    S1 --> S2
    S2 --> S3
    S3 -->|Yes| P1
    S3 -->|No| R2
    P1 --> P2
    P2 -->|Yes| P3
    P2 -->|No| P4
    P3 --> R1
    P4 --> R1
```

## Deployment Architecture

```mermaid
flowchart TD
    subgraph "Source Control"
        GH[GitHub Repository]
    end

    subgraph "CI/CD"
        GA[GitHub Actions]
        BUILD[Build & Test]
        DEPLOY[Deploy]
    end

    subgraph "Railway Platform"
        WEB_SVC[Web Service]
        DB_SVC[PostgreSQL]
    end

    subgraph "External Services"
        SUP_EXT[Supabase]
        STRIPE_EXT[Stripe]
        ANTHROPIC_EXT[Anthropic]
    end

    GH --> GA
    GA --> BUILD
    BUILD --> DEPLOY
    DEPLOY --> WEB_SVC
    WEB_SVC --> DB_SVC
    WEB_SVC --> SUP_EXT
    WEB_SVC --> STRIPE_EXT
    WEB_SVC --> ANTHROPIC_EXT
```

## Module Dependencies

```mermaid
flowchart TD
    subgraph "UI Layer"
        COMP[components/]
        FB_COMP[form-builder/]
        BILL_COMP[billing/]
        UI_COMP[ui/]
        CLIENT_COMP[clients/]
        CALL_COMP[calls/]
    end

    subgraph "Library Layer"
        LIB[lib/]
        AI_LIB[ai/]
        FB_LIB[form-builder/]
        BILL_LIB[billing/]
        AUTH_LIB[auth/]
        DB_LIB[db/]
        AUDIT_LIB[audit/]
        TWILIO_LIB[twilio/]
        DEEPGRAM_LIB[deepgram/]
        S3_LIB[storage/s3]
        SERVICES[services/]
    end

    subgraph "API Layer"
        API[app/api/]
        AI_API[ai/]
        FORMS_API[forms/]
        BILLING_API_R[billing/]
        FILES_API_R[files/]
        CLIENTS_API[clients/]
        CALLS_API[calls/]
        WEBHOOKS[webhooks/twilio/]
        JOBS[jobs/]
    end

    subgraph "Types"
        TYPES[types/]
    end

    FB_COMP --> FB_LIB
    FB_COMP --> AI_LIB
    FB_COMP --> UI_COMP
    BILL_COMP --> BILL_LIB
    BILL_COMP --> UI_COMP
    CLIENT_COMP --> SERVICES
    CALL_COMP --> SERVICES

    AI_API --> AI_LIB
    FORMS_API --> FB_LIB
    BILLING_API_R --> BILL_LIB
    FILES_API_R --> DB_LIB
    CLIENTS_API --> SERVICES
    CALLS_API --> SERVICES
    WEBHOOKS --> TWILIO_LIB
    WEBHOOKS --> SERVICES
    JOBS --> SERVICES

    SERVICES --> TWILIO_LIB
    SERVICES --> DEEPGRAM_LIB
    SERVICES --> S3_LIB
    SERVICES --> AI_LIB

    AI_LIB --> TYPES
    FB_LIB --> TYPES
    BILL_LIB --> TYPES
    AUTH_LIB --> TYPES
    DB_LIB --> TYPES
```

---

## Spec-2: Call Processing Pipeline

```mermaid
flowchart TD
    subgraph "Call Initiation"
        CM[Case Manager]
        CLIENT[Select Client]
        FORMS[Select Forms]
        INIT[Initiate Call]
    end

    subgraph "VOIP Layer (Twilio)"
        TOKEN[Get Capability Token]
        WEBRTC[WebRTC Connection]
        DIAL[Dial Client Phone]
        RECORD[Record Call]
    end

    subgraph "Recording Pipeline"
        WEBHOOK[Recording Webhook]
        S3[Transfer to S3]
        QUEUE[Processing Queue]
    end

    subgraph "AI Processing Pipeline"
        DEEPGRAM[Deepgram Transcription]
        DIARIZE[Speaker Diarization]
        EXTRACT[Field Extraction]
        CONFIDENCE[Confidence Scoring]
        SUMMARY[Call Summary]
    end

    subgraph "Storage"
        DB[(PostgreSQL)]
        S3_STORE[(AWS S3)]
    end

    CM --> CLIENT
    CLIENT --> FORMS
    FORMS --> INIT
    INIT --> TOKEN
    TOKEN --> WEBRTC
    WEBRTC --> DIAL
    DIAL --> RECORD
    RECORD --> WEBHOOK
    WEBHOOK --> S3
    S3 --> S3_STORE
    S3 --> QUEUE
    QUEUE --> DEEPGRAM
    DEEPGRAM --> DIARIZE
    DIARIZE --> EXTRACT
    EXTRACT --> CONFIDENCE
    CONFIDENCE --> SUMMARY
    SUMMARY --> DB
```

## Spec-2: Transcription & AI Extraction Flow

```mermaid
sequenceDiagram
    participant TW as Twilio
    participant WH as Recording Webhook
    participant S3 as AWS S3
    participant DG as Deepgram
    participant AI as Claude API
    participant DB as Database

    TW->>WH: Recording complete callback
    WH->>S3: Transfer recording (SSE-KMS)
    WH->>DB: Update call with S3 key
    WH->>WH: Trigger async processing

    Note over WH,DG: Call Processing Pipeline

    WH->>S3: Download recording
    S3-->>WH: Audio buffer
    WH->>DG: Transcribe (nova-2 model)
    DG-->>WH: Transcript with diarization

    Note over WH: Map speakers:<br/>Speaker 0 = CASE_MANAGER<br/>Speaker 1 = CLIENT

    WH->>DB: Save transcript

    Note over WH,AI: Domain-Grouped Extraction

    loop For each field domain
        WH->>AI: Extract fields (demographics)
        AI-->>WH: Extracted values
        WH->>AI: Extract fields (contact)
        AI-->>WH: Extracted values
        WH->>AI: Extract fields (case_details)
        AI-->>WH: Extracted values
    end

    WH->>WH: Calculate confidence scores
    WH->>AI: Generate call summary
    AI-->>WH: Structured summary
    WH->>DB: Save all results
```

## Spec-2: Confidence Scoring System

```mermaid
flowchart LR
    subgraph "Input"
        EX[Extracted Field]
        TR[Transcript Segments]
        FT[Field Type]
    end

    subgraph "Scoring Factors"
        DS[Direct Statement<br/>Weight: 40%]
        CM[Context Match<br/>Weight: 30%]
        FV[Format Validation<br/>Weight: 20%]
        MC[Multiple Confirmations<br/>Weight: 10%]
    end

    subgraph "Thresholds"
        HIGH[High: 90%+<br/>Green indicator]
        MED[Medium: 60-89%<br/>Yellow indicator]
        LOW[Low: <60%<br/>Red indicator]
    end

    subgraph "Output"
        SCORE[Final Score]
        REVIEW[Needs Review?]
    end

    EX --> DS
    EX --> CM
    TR --> DS
    TR --> CM
    TR --> MC
    FT --> FV

    DS --> SCORE
    CM --> SCORE
    FV --> SCORE
    MC --> SCORE

    SCORE --> HIGH
    SCORE --> MED
    SCORE --> LOW

    MED --> REVIEW
    LOW --> REVIEW
```

## Spec-2: HIPAA-Compliant Storage

```mermaid
flowchart TD
    subgraph "Recording Sources"
        TW[Twilio Recording URL]
    end

    subgraph "Transfer Layer"
        DL[Download Recording]
        ENC[Encrypt with SSE-KMS]
        UP[Upload to S3]
    end

    subgraph "S3 Configuration"
        BUCKET[recordings/{orgId}/{year}/{month}/]
        KMS[AWS KMS Key]
        POLICY[Bucket Policy]
        LIFECYCLE[Lifecycle Rules]
    end

    subgraph "Access Layer"
        SIGNED[Pre-signed URLs]
        TTL[15 min expiry]
        AUDIT[Access Logging]
    end

    TW --> DL
    DL --> ENC
    ENC --> KMS
    ENC --> UP
    UP --> BUCKET

    BUCKET --> SIGNED
    SIGNED --> TTL
    SIGNED --> AUDIT
    LIFECYCLE --> BUCKET
```

## Spec-2: Client Management Architecture

```mermaid
flowchart TD
    subgraph "Client Operations"
        CREATE[Create Client]
        READ[View Client]
        UPDATE[Update Client]
        DELETE[Soft Delete]
    end

    subgraph "Duplicate Detection"
        PHONE[Phone Match<br/>100 points - auto flag]
        NAME[Fuzzy Name Match<br/>Levenshtein ≤ 2: 50 points]
        SOUND[Phonetic Match<br/>Soundex: 30 points]
        SCORE[Combined Score ≥ 70]
    end

    subgraph "Client Profile"
        INFO[Basic Info]
        CALLS[Call History]
        NOTES[Notes]
        FORMS[Form Submissions]
        ACTIVITY[Activity Feed]
    end

    subgraph "Quick Actions"
        CALL_BTN[Start Call]
        NOTE_BTN[Add Note]
        FORM_BTN[Fill Form]
    end

    CREATE --> PHONE
    CREATE --> NAME
    PHONE --> SCORE
    NAME --> SCORE
    SOUND --> SCORE

    READ --> INFO
    READ --> CALLS
    READ --> NOTES
    READ --> FORMS
    READ --> ACTIVITY

    INFO --> CALL_BTN
    INFO --> NOTE_BTN
    INFO --> FORM_BTN
```
