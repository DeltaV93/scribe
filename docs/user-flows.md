# Scrybe Solutions - User Flow Diagrams

## Admin: Creating a New Form (AI-Powered)

```mermaid
flowchart TD
    START([Admin opens Forms page]) --> CLICK[Click "Create New Form"]
    CLICK --> CHECK{Form limit<br/>reached?}

    CHECK -->|Yes| UPGRADE[Show upgrade prompt]
    UPGRADE --> BILLING[Redirect to billing]

    CHECK -->|No| WIZARD[Open Form Builder Wizard]

    subgraph "Step 1: AI Setup"
        WIZARD --> NAME[Enter form name]
        NAME --> TYPE[Select form type]
        TYPE --> PURPOSE[Describe purpose/outcome]
        PURPOSE --> DATA[List key data points]
        DATA --> COMPLIANCE[Add compliance requirements]
        COMPLIANCE --> CHOICE{Generate with AI<br/>or Skip?}
    end

    CHOICE -->|Skip| MANUAL[Go to Fields step]

    CHOICE -->|Generate| LOADING[Show generating state]
    LOADING --> AI_CALL[Call Claude API]
    AI_CALL --> REVIEW[Display generated fields]

    subgraph "AI Review Phase"
        REVIEW --> SELECT[Select/deselect fields]
        SELECT --> ACCEPT{Accept<br/>fields?}
        ACCEPT -->|Regenerate| AI_CALL
        ACCEPT -->|Start Over| WIZARD
        ACCEPT -->|Accept| FIELDS_STEP
    end

    MANUAL --> FIELDS_STEP[Fields Step]

    subgraph "Step 2: Add Fields"
        FIELDS_STEP --> ADD_FIELD[Click to add field]
        ADD_FIELD --> FIELD_TYPE[Select field type]
        FIELD_TYPE --> FIELD_CONFIG[Configure field]
        FIELD_CONFIG --> MORE{Add more<br/>fields?}
        MORE -->|Yes| ADD_FIELD
        MORE -->|No| ORGANIZE
    end

    subgraph "Step 3: Organize"
        ORGANIZE --> REORDER[Drag to reorder]
        REORDER --> SECTIONS[Create sections]
        SECTIONS --> LOGIC[Add conditional logic]
    end

    subgraph "Step 4: Preview"
        LOGIC --> PREVIEW[Preview form]
        PREVIEW --> A11Y[Run accessibility audit]
        A11Y --> EDIT{Need changes?}
        EDIT -->|Yes| FIELDS_STEP
        EDIT -->|No| AI_CONFIG
    end

    subgraph "Step 5: AI Config"
        AI_CONFIG --> EXAMPLES[Add extraction examples]
        EXAMPLES --> PROMPT[Review AI prompt]
    end

    subgraph "Step 6: Publish"
        PROMPT --> ACCESS[Configure access]
        ACCESS --> VALIDATE[Run validation]
        VALIDATE --> VALID{Valid?}
        VALID -->|No| FIX[Show errors]
        FIX --> FIELDS_STEP
        VALID -->|Yes| PUBLISH[Publish form]
        PUBLISH --> VERSION[Create version snapshot]
        VERSION --> DONE([Form is live])
    end
```

## Admin: Form Builder Wizard Steps

```mermaid
stateDiagram-v2
    [*] --> Setup: Create New Form

    Setup --> Fields: Next (with form name)
    Fields --> Setup: Back

    Fields --> Organize: Next (with fields)
    Organize --> Fields: Back

    Organize --> Logic: Next
    Logic --> Organize: Back

    Logic --> Preview: Next
    Preview --> Logic: Back

    Preview --> AIConfig: Next
    AIConfig --> Preview: Back

    AIConfig --> Publish: Next
    Publish --> AIConfig: Back

    Publish --> [*]: Publish Form

    note right of Setup
        - Form name
        - Form type
        - AI generation inputs
        - Form settings
    end note

    note right of Fields
        - Add fields
        - Configure options
        - Set required/sensitive
        - Mark AI extractable
    end note

    note right of Organize
        - Drag to reorder
        - Create sections
        - Group fields
    end note

    note right of Logic
        - Conditional visibility
        - Show/hide rules
        - AND/OR groups
    end note

    note right of Preview
        - Form preview
        - Responsive test
        - A11y audit
    end note

    note right of AIConfig
        - Extraction examples
        - Prompt preview
        - Confidence hints
    end note

    note right of Publish
        - Access control
        - Validation
        - Version creation
    end note
```

## AI Form Generation Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as AI Setup Step
    participant Store as Jotai Store
    participant API as Generate API
    participant Claude as Claude API
    participant Review as Review Component

    Admin->>UI: Enter form details
    Note over UI: Form name, type,<br/>purpose, data points,<br/>compliance

    Admin->>UI: Click "Generate with AI"
    UI->>Store: startGenerationAtom(request)
    Store->>Store: Set status = "generating"

    Store->>API: POST /api/ai/generate-form
    API->>Claude: Send generation prompt

    Note over Claude: Generate fields based on:<br/>- Form type<br/>- Purpose description<br/>- Key data points<br/>- Compliance requirements

    Claude-->>API: JSON response with fields
    API->>API: Parse & validate response
    API-->>Store: GenerateFormResponse

    Store->>Store: Set status = "reviewing"
    Store->>Review: Display generated fields

    Admin->>Review: Review fields
    Admin->>Review: Select/deselect fields
    Admin->>Review: View AI reasoning

    alt Regenerate
        Admin->>Review: Click Regenerate
        Review->>Store: startGenerationAtom(same request)
        Note over Store: Repeat generation
    else Accept
        Admin->>Review: Click Accept
        Review->>Store: acceptGeneratedFieldsAtom(selectedIds)
        Store->>Store: Add fields to form
        Store->>Store: Set status = "accepted"
        Store->>UI: Navigate to Fields step
    else Start Over
        Admin->>Review: Click Start Over
        Review->>Store: resetGenerationAtom()
        Store->>UI: Return to input phase
    end
```

## Billing User Flow

```mermaid
flowchart TD
    START([User accesses Billing]) --> DASH[Billing Dashboard]

    DASH --> SUB[View Subscription]
    DASH --> USAGE[View Usage Stats]
    DASH --> INVOICES[View Invoice History]
    DASH --> PACKS[View Form Packs]

    subgraph "Subscription Management"
        SUB --> SUB_STATUS[Current tier & status]
        SUB_STATUS --> UPGRADE{Want to<br/>upgrade?}
        UPGRADE -->|Yes| PRICING[View pricing table]
        PRICING --> SELECT_TIER[Select new tier]
        SELECT_TIER --> CHECKOUT[Stripe Checkout]
        CHECKOUT --> SUCCESS[Subscription updated]

        SUB_STATUS --> CANCEL{Cancel?}
        CANCEL -->|Yes| CONFIRM[Confirm cancellation]
        CONFIRM --> END_PERIOD[Active until period end]
    end

    subgraph "Form Packs"
        PACKS --> PACK_OPTIONS[5 / 10 / 25 packs]
        PACK_OPTIONS --> BUY_PACK[Select pack]
        BUY_PACK --> PACK_CHECKOUT[Stripe Checkout]
        PACK_CHECKOUT --> PACK_SUCCESS[Forms added]
    end

    subgraph "Usage Tracking"
        USAGE --> FORMS_USED[Forms used / limit]
        USAGE --> AI_CREDITS[AI credits used]
        USAGE --> PERIOD[Current period]
    end

    subgraph "Invoices"
        INVOICES --> LIST[Invoice list]
        LIST --> DOWNLOAD[Download PDF]
        INVOICES --> UPCOMING[Upcoming invoice]
    end
```

## Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant App as Next.js App
    participant MW as Middleware
    participant Supabase as Supabase Auth
    participant DB as Database

    User->>App: Access protected route
    App->>MW: Check authentication
    MW->>Supabase: Verify session

    alt No session
        Supabase-->>MW: No session
        MW-->>App: Redirect to /login
        App->>User: Show login page

        User->>Supabase: Submit credentials
        Supabase->>Supabase: Validate credentials
        Supabase-->>User: Session token

        User->>App: Access with session
        App->>MW: Check session
        MW->>Supabase: Verify session
        Supabase-->>MW: Valid session
    else Valid session
        Supabase-->>MW: Valid session
    end

    MW->>DB: Get user & permissions
    DB-->>MW: User data
    MW-->>App: Authorized request
    App->>User: Show protected content
```

## Form Access Control Flow

```mermaid
flowchart TD
    REQ([User requests form access]) --> AUTH{Authenticated?}

    AUTH -->|No| DENY1[Redirect to login]
    AUTH -->|Yes| PERM_CHECK{Check permissions}

    PERM_CHECK --> ROLE[Get user role]
    ROLE --> FORM_ACC[Get form access grants]

    FORM_ACC --> DIRECT{Direct user<br/>access?}
    DIRECT -->|Yes| ROLE_CHECK
    DIRECT -->|No| TEAM_CHECK{Team member<br/>access?}

    TEAM_CHECK -->|Yes| ROLE_CHECK
    TEAM_CHECK -->|No| DENY2[Access denied]

    ROLE_CHECK{Access role?}
    ROLE_CHECK -->|View| CAN_VIEW[Can view form]
    ROLE_CHECK -->|Use| CAN_USE[Can fill form]
    ROLE_CHECK -->|Edit| CAN_EDIT[Can modify form]

    CAN_VIEW --> READ_ONLY[Read-only access]
    CAN_USE --> FILL[Can create submissions]
    CAN_EDIT --> FULL[Full edit access]
```

## Audit Trail Flow

```mermaid
sequenceDiagram
    actor User
    participant Action as User Action
    participant Service as Service Layer
    participant Audit as Audit Service
    participant DB as Database

    User->>Action: Perform action
    Action->>Service: Process action
    Service->>Service: Execute business logic

    Service->>Audit: Log audit entry

    Note over Audit: Create audit entry:<br/>- Action type<br/>- Resource info<br/>- User info<br/>- IP/UserAgent<br/>- Timestamp

    Audit->>DB: Get previous hash
    DB-->>Audit: Previous entry hash

    Audit->>Audit: Compute entry hash
    Note over Audit: Hash = SHA256(<br/>  entry data +<br/>  previous hash<br/>)

    Audit->>DB: Store audit log
    DB-->>Audit: Stored

    Audit-->>Service: Audit complete
    Service-->>Action: Action complete
    Action-->>User: Response
```

## File Upload Flow

```mermaid
flowchart TD
    START([User uploads file]) --> VALIDATE{Valid file?}

    VALIDATE -->|Invalid type| REJECT1[Reject: Invalid type]
    VALIDATE -->|Too large| REJECT2[Reject: Too large]
    VALIDATE -->|Valid| QUARANTINE[Store in quarantine]

    QUARANTINE --> QUEUE[Add to scan queue]
    QUEUE --> SCAN[ClamAV scan]

    SCAN --> RESULT{Scan result?}
    RESULT -->|Infected| DELETE[Delete file]
    DELETE --> ALERT[Security alert]
    ALERT --> NOTIFY[Notify admins]

    RESULT -->|Clean| MOVE[Move to storage]
    MOVE --> TYPE{File type?}

    TYPE -->|PDF| EXTRACT[Extract text]
    EXTRACT --> STORE[Update record]

    TYPE -->|Image| OPTIMIZE[Optimize image]
    OPTIMIZE --> STORE

    TYPE -->|Other| STORE

    STORE --> AVAILABLE([File available])
```

## Subscription Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Free: Signup

    Free --> Starter: Subscribe
    Free --> Professional: Subscribe
    Free --> Enterprise: Subscribe

    Starter --> Professional: Upgrade
    Starter --> Free: Cancel (end of period)

    Professional --> Enterprise: Upgrade
    Professional --> Starter: Downgrade
    Professional --> Free: Cancel (end of period)

    Enterprise --> Professional: Downgrade
    Enterprise --> Starter: Downgrade
    Enterprise --> Free: Cancel (end of period)

    note right of Free
        3 forms
        Basic features
    end note

    note right of Starter
        10 forms
        + Form packs available
    end note

    note right of Professional
        50 forms
        + Advanced features
    end note

    note right of Enterprise
        Unlimited forms
        + Custom integrations
    end note
```

---

## Spec-2: Case Manager Creating a Client

```mermaid
flowchart TD
    START([Case Manager opens Clients]) --> LIST[View client list]
    LIST --> NEW[Click "Add Client"]

    NEW --> FORM[Client creation form]

    subgraph "Client Information"
        FORM --> NAME[Enter first/last name]
        NAME --> PHONE[Enter phone number]
        PHONE --> EMAIL[Enter email - optional]
        EMAIL --> ADDR[Enter address - optional]
    end

    ADDR --> DUP_CHECK{Check for<br/>duplicates}

    DUP_CHECK -->|Match found| WARN[Show duplicate warning]
    WARN --> CHOICE{Proceed anyway?}
    CHOICE -->|No| FORM
    CHOICE -->|Yes| SAVE

    DUP_CHECK -->|No match| SAVE[Save client]

    SAVE --> ASSIGN[Auto-assign to creator]
    ASSIGN --> SUCCESS([Client created])

    SUCCESS --> VIEW[View client profile]
    VIEW --> ACTIONS{Quick actions}
    ACTIONS --> CALL[Start a call]
    ACTIONS --> NOTE[Add a note]
    ACTIONS --> FORM_FILL[Fill a form]
```

## Spec-2: Case Manager Making a Call

```mermaid
flowchart TD
    START([Open client profile]) --> CALL_BTN[Click "Start Call"]

    CALL_BTN --> FORMS[Select forms to use]
    FORMS --> CONFIRM[Confirm call setup]
    CONFIRM --> MIC{Microphone<br/>access?}

    MIC -->|Denied| ERROR1[Show permission error]
    MIC -->|Granted| INIT[Initialize call]

    INIT --> TOKEN[Get Twilio token]
    TOKEN --> CONNECT[Connect WebRTC]
    CONNECT --> DIAL[Dial client phone]

    DIAL --> RINGING{Call status?}
    RINGING -->|No answer| ABANDON[Mark abandoned]
    RINGING -->|Answered| ACTIVE[Call in progress]

    subgraph "Active Call"
        ACTIVE --> RECORD[Recording active]
        RECORD --> GUIDE[Show conversation guide]
        GUIDE --> NOTES[Take notes in panel]
        NOTES --> TIMER[Show call timer]
    end

    TIMER --> END[End call]
    END --> SAVE_REC[Save recording]
    SAVE_REC --> PROCESS[Queue for processing]
    PROCESS --> REVIEW[Show post-call review]
```

## Spec-2: Call Processing Pipeline

```mermaid
sequenceDiagram
    actor CM as Case Manager
    participant UI as Call Interface
    participant TW as Twilio
    participant S3 as AWS S3
    participant DG as Deepgram
    participant AI as Claude API
    participant DB as Database

    CM->>UI: End call
    UI->>TW: Disconnect
    TW-->>UI: Call ended

    Note over TW: Recording finishes
    TW->>UI: Recording webhook

    UI->>S3: Transfer recording
    Note over S3: SSE-KMS encryption

    UI->>DB: Update call status
    UI->>UI: Queue processing

    Note over UI,DG: Async Processing Begins

    UI->>S3: Download recording
    S3-->>UI: Audio buffer

    UI->>DG: Transcribe audio
    Note over DG: Speaker diarization<br/>nova-2 model
    DG-->>UI: Transcript segments

    UI->>DB: Save transcript

    UI->>AI: Extract fields (grouped by domain)
    AI-->>UI: Extracted values + reasoning

    UI->>UI: Calculate confidence scores

    UI->>AI: Generate call summary
    AI-->>UI: Summary with sentiment

    UI->>DB: Save all results
    UI-->>CM: Processing complete notification
```

## Spec-2: Post-Call Review Flow

```mermaid
flowchart TD
    START([Processing complete]) --> LOAD[Load review screen]

    LOAD --> SUMMARY[View AI summary]
    SUMMARY --> EDIT_SUM{Edit summary?}
    EDIT_SUM -->|Yes| EDIT_SUMMARY[Make corrections]
    EDIT_SUM -->|No| FIELDS
    EDIT_SUMMARY --> FIELDS

    FIELDS --> REVIEW_FIELDS[Review extracted fields]

    subgraph "Field Review"
        REVIEW_FIELDS --> CONF{Check<br/>confidence}
        CONF -->|Green 90%+| ACCEPT[Accept value]
        CONF -->|Yellow 60-89%| VERIFY[Verify value]
        CONF -->|Red <60%| CORRECT[Correct value]
        VERIFY --> ACCEPT
        CORRECT --> LOG[Log correction]
        LOG --> ACCEPT
    end

    ACCEPT --> TRANSCRIPT{View<br/>transcript?}
    TRANSCRIPT -->|Yes| VIEW_TRANS[View full transcript]
    TRANSCRIPT -->|No| SUBMIT
    VIEW_TRANS --> SUBMIT

    SUBMIT --> CHOICE{Action?}
    CHOICE -->|Save Draft| DRAFT[Save as draft]
    CHOICE -->|Submit| FINAL[Submit form]
    CHOICE -->|Abandon| DISCARD[Discard changes]

    DRAFT --> DONE([Return to client])
    FINAL --> DONE
    DISCARD --> DONE
```

## Spec-2: Client Notes Flow

```mermaid
flowchart TD
    START([View client]) --> NOTES_TAB[Open notes tab]

    NOTES_TAB --> LIST[View note history]
    LIST --> FILTER[Filter by type/date]

    subgraph "Note Display"
        FILTER --> INTERNAL[Internal notes]
        FILTER --> SHAREABLE[Shareable notes]
        FILTER --> CALL_NOTES[Call-linked notes]
    end

    LIST --> ADD[Click "Add Note"]
    ADD --> EDITOR[Rich text editor]

    subgraph "Note Creation"
        EDITOR --> TYPE[Select type]
        TYPE --> INTERNAL_NEW[Internal]
        TYPE --> SHARE_NEW[Shareable]
        EDITOR --> TAGS[Add tags]
        EDITOR --> LINK{Link to<br/>call?}
        LINK -->|Yes| SELECT_CALL[Select call]
        LINK -->|No| CONTENT
        SELECT_CALL --> CONTENT
        CONTENT --> DRAFT{Save as<br/>draft?}
    end

    DRAFT -->|Yes| SAVE_DRAFT[Save draft]
    DRAFT -->|No| PUBLISH[Publish note]

    SAVE_DRAFT --> DONE([Note saved])
    PUBLISH --> DONE
```

## Spec-2: Twilio Number Provisioning

```mermaid
flowchart TD
    START([User needs phone number]) --> CHECK{Has number?}

    CHECK -->|Yes| SHOW[Show existing number]
    CHECK -->|No| PROV[Provision new number]

    PROV --> ORG_PREF{Org has<br/>area code?}
    ORG_PREF -->|Yes| USE_PREF[Use preferred area code]
    ORG_PREF -->|No| DEFAULT[Use default area code]

    USE_PREF --> SEARCH[Search Twilio inventory]
    DEFAULT --> SEARCH

    SEARCH --> FOUND{Number<br/>found?}
    FOUND -->|No| FALLBACK[Try nearby area codes]
    FALLBACK --> FOUND
    FOUND -->|Yes| PURCHASE[Purchase number]

    PURCHASE --> SAVE[Save to database]
    SAVE --> CONFIG[Configure for voice]
    CONFIG --> DONE([Number ready])
```

## Spec-2: AI Processing Retry Flow

```mermaid
stateDiagram-v2
    [*] --> PENDING: Call completed

    PENDING --> PROCESSING: Start processing

    PROCESSING --> COMPLETED: Success
    PROCESSING --> FAILED: Error

    FAILED --> QUEUED_FOR_RETRY: Retry count < 3
    QUEUED_FOR_RETRY --> PROCESSING: Retry processing

    FAILED --> PERMANENTLY_FAILED: Retry count >= 3

    COMPLETED --> [*]
    PERMANENTLY_FAILED --> [*]

    note right of PROCESSING
        Steps:
        1. Transcribe recording
        2. Extract fields
        3. Score confidence
        4. Generate summary
    end note

    note right of QUEUED_FOR_RETRY
        Auto-retry via
        background job
    end note
```

## Spec-2: Duplicate Detection Flow

```mermaid
flowchart TD
    START([Enter client info]) --> PHONE_CHECK{Phone<br/>entered?}

    PHONE_CHECK -->|Yes| EXACT[Exact phone match?]
    EXACT -->|Yes| SCORE_100[Score: 100 pts - Auto flag]
    EXACT -->|No| FUZZY

    PHONE_CHECK -->|No| FUZZY[Check name fuzzy match]

    FUZZY --> LEV{Levenshtein<br/>distance ≤ 2?}
    LEV -->|Yes| SCORE_50[Add 50 pts]
    LEV -->|No| SOUNDEX

    SOUNDEX{Soundex<br/>match?}
    SOUNDEX -->|Yes| SCORE_30[Add 30 pts]
    SOUNDEX -->|No| TOTAL

    SCORE_100 --> TOTAL[Calculate total]
    SCORE_50 --> TOTAL
    SCORE_30 --> TOTAL

    TOTAL --> THRESHOLD{Score >= 70?}
    THRESHOLD -->|Yes| WARN[Show warning with matches]
    THRESHOLD -->|No| PROCEED[Proceed with creation]

    WARN --> CHOICE{User choice}
    CHOICE -->|View match| VIEW[Open matched client]
    CHOICE -->|Create anyway| PROCEED
    CHOICE -->|Cancel| CANCEL[Cancel creation]
```
