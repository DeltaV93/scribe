# Scrybe Solutions
## Workflow 2: Case Manager Adding a Client and Taking a Call
### Technical Specification
**Version 2.0 | January 2026**

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Step-by-Step Workflow](#step-by-step-workflow)
5. [Data Models](#data-models)
6. [API Endpoints](#api-endpoints)
7. [Real-Time Communication](#real-time-communication)
8. [VOIP Integration](#voip-integration)
9. [Transcription Pipeline](#transcription-pipeline)
10. [AI Extraction System](#ai-extraction-system)
11. [Security Implementation](#security-implementation)
12. [UI/UX Specifications](#uiux-specifications)
13. [Error Handling & Recovery](#error-handling--recovery)
14. [HIPAA Compliance](#hipaa-compliance)
15. [Internationalization](#internationalization)
16. [Cross-Platform Strategy](#cross-platform-strategy)
17. [Component Architecture](#component-architecture)

---

## Overview

This workflow covers the complete journey from creating a new client record through completing a documented call with auto-filled forms. This is the core value proposition of Scrybe—turning a phone conversation into structured, compliant documentation.

| Attribute | Value |
|-----------|-------|
| **Actors** | Case Manager |
| **Trigger** | Case manager needs to enroll a new client or make a documented call |
| **Output** | Client record with completed intake form, call transcript, and AI-generated summary |

### Preconditions

- User is logged in with Case Manager role
- At least one published form exists for the organization
- Case manager has an assigned VOIP number (auto-provisioned on user creation)
- Case manager is within their caseload capacity (simple client count)

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **AI Extraction Timing** | Post-call only | Reduces complexity, lower API costs, most accurate (full context) |
| **Transcription Display** | Hybrid (interim + final) | Interim in gray/italic, replaced by final when ready |
| **Audio Routing** | Twilio Media Streams → Deepgram | Server-side processing, no API keys exposed to client |
| **Phone Numbers** | Dedicated per case manager | Auto-provisioned on user creation, org-level area code preference |
| **Call Model** | Browser-based WebRTC | Lower cost than phone bridge, full integration with desktop app |
| **HIPAA Hosting** | AWS with BAA | ECS Fargate for compute, required for healthcare compliance |
| **Sensitive Data Masking** | Always masked in UI | SSN shows as `***-**-1234`, only full value in encrypted DB |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14+ | React framework with App Router |
| **UI Components** | Shadcn/ui + Tailwind CSS | Design system |
| **State Management** | Jotai | Atomic state for call state management |
| **Rich Text Editor** | Tiptap | Notes with formatting |
| **Backend** | Next.js API Routes | REST API endpoints |
| **Database** | Railway PostgreSQL | Primary data store (via Prisma) |
| **ORM** | Prisma | Type-safe queries with built-in connection pooling |
| **Auth** | Supabase Auth | Authentication (email/password + Google OAuth) |
| **Encryption Keys** | AWS KMS / HashiCorp Vault | HIPAA-compliant key management for sensitive fields |
| **VOIP** | Twilio Voice | Phone calls, WebRTC, Media Streams |
| **Transcription** | Deepgram (streaming) | Real-time speech-to-text via Twilio Media Streams |
| **AI Extraction** | Claude API (Sonnet) | Transcript data extraction (field-grouped calls) |
| **WebSocket** | Custom Node.js server | Real-time transcript updates, call status |
| **Audio Storage** | AWS S3 | Call recordings with lifecycle policies |
| **Hosting** | AWS ECS Fargate | HIPAA-eligible containerized deployment |
| **Secrets** | AWS Secrets Manager | API keys and encryption key references |
| **Monitoring** | AWS CloudWatch | Logs and metrics |
| **i18n** | next-intl | Full internationalization framework |

---

## Architecture Overview

### HIPAA-Compliant Infrastructure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AWS VPC (HIPAA Eligible)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │   ALB with   │    │  ECS Fargate │    │  ECS Fargate │               │
│  │   WAF/ACM    │───►│  Next.js App │    │  WebSocket   │               │
│  └──────────────┘    └──────────────┘    │   Server     │               │
│                             │             └──────────────┘               │
│                             ▼                    │                       │
│  ┌──────────────┐    ┌──────────────┐           │                       │
│  │    AWS KMS   │    │   Railway    │◄──────────┘                       │
│  │  (Encryption │    │  PostgreSQL  │                                   │
│  │    Keys)     │    └──────────────┘                                   │
│  └──────────────┘           │                                           │
│         │                   ▼                                           │
│         │            ┌──────────────┐    ┌──────────────┐               │
│         └───────────►│   AWS S3     │    │   Supabase   │               │
│                      │ (Recordings) │    │    Auth      │               │
│                      └──────────────┘    └──────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       External Services        │
                    ├───────────────────────────────┤
                    │  • Twilio Voice (VOIP)        │
                    │  • Deepgram (Transcription)   │
                    │  • Claude API (AI Extraction) │
                    └───────────────────────────────┘
```

### Call Flow Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Browser   │     │   Twilio     │     │   Client     │
│   (WebRTC)   │◄───►│   Voice      │◄───►│   Phone      │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    │ Media Streams
       ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  WebSocket   │◄────│   Next.js    │────►│   Deepgram   │
│   Server     │     │   Backend    │     │  (Streaming) │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    ▼                    │
       │             ┌──────────────┐            │
       │             │  PostgreSQL  │            │
       │             └──────────────┘            │
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                   Real-time Transcript                   │
│          (Interim results + Final results)               │
└─────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Workflow

### Part A: Creating a New Client

#### Step 1: Initiate Client Creation

1. Case manager clicks **"Add New Client"** from their dashboard or caseload view
2. System displays the New Client form with minimum required fields

#### Step 2: Enter Minimum Client Information

**Required fields to create a client record:**

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| First Name | Yes | Non-empty string | — |
| Last Name | Yes | Non-empty string | — |
| Phone Number | Yes | 10-digit US format | Primary contact method |
| Internal ID Number | No | Any string | For syncing with other systems |

3. Case manager enters the minimum required information
4. System validates phone number format (10 digits, US only)
5. On phone field blur, system checks for **duplicate records** using weighted scoring:

**Duplicate Detection (Weighted Scoring):**

| Factor | Weight | Threshold |
|--------|--------|-----------|
| Exact phone match | 100 | Auto-flag |
| Fuzzy name match (Levenshtein ≤ 2) | 50 | Combined ≥ 70 |
| Phonetic name match (Soundex) | 30 | Combined ≥ 70 |

6. If potential duplicate found (score ≥ 70), system alerts case manager with options to:
   - View existing record
   - Continue creating new record (flagged for review)
7. Case manager clicks **"Create Client"**
8. System creates client record and navigates to **Client Profile**

> **Technical Note:** Client ID is system-generated UUID. Internal ID is optional org-specific identifier for cross-system reference.

**Implementation:**

```typescript
interface DuplicateCheckResult {
  hasPotentialDuplicate: boolean;
  score: number;
  matches: Array<{
    clientId: string;
    clientName: string;
    matchReasons: string[];
    score: number;
  }>;
}

async function checkForDuplicates(
  orgId: string,
  phone: string,
  firstName: string,
  lastName: string
): Promise<DuplicateCheckResult> {
  // Exact phone match
  const phoneMatch = await prisma.client.findFirst({
    where: { orgId, phone, deletedAt: null }
  });

  if (phoneMatch) {
    return {
      hasPotentialDuplicate: true,
      score: 100,
      matches: [{
        clientId: phoneMatch.id,
        clientName: `${phoneMatch.firstName} ${phoneMatch.lastName}`,
        matchReasons: ['Exact phone number match'],
        score: 100
      }]
    };
  }

  // Fuzzy name matching
  const potentialMatches = await prisma.$queryRaw<Client[]>`
    SELECT * FROM clients
    WHERE org_id = ${orgId}
      AND deleted_at IS NULL
      AND (
        levenshtein(LOWER(first_name), LOWER(${firstName})) <= 2
        OR levenshtein(LOWER(last_name), LOWER(${lastName})) <= 2
        OR soundex(first_name) = soundex(${firstName})
        OR soundex(last_name) = soundex(${lastName})
      )
    LIMIT 5
  `;

  // Calculate scores and return matches
  const scoredMatches = potentialMatches.map(match => ({
    clientId: match.id,
    clientName: `${match.firstName} ${match.lastName}`,
    matchReasons: calculateMatchReasons(match, firstName, lastName),
    score: calculateMatchScore(match, firstName, lastName)
  })).filter(m => m.score >= 70);

  return {
    hasPotentialDuplicate: scoredMatches.length > 0,
    score: Math.max(0, ...scoredMatches.map(m => m.score)),
    matches: scoredMatches
  };
}
```

---

#### Step 3: View Client Profile

The Client Profile is the central hub for all client information and actions.

**Profile sections visible to case manager:**

| Section | Contents |
|---------|----------|
| **Header** | Client name, status badge, assigned case manager |
| **Quick Actions** | Call (dropdown if multiple phones), Add Note |
| **Contact Information** | Phone(s), email, address (as collected) |
| **Case Status** | Current phase (Active, On Hold, Closed, Pending) |
| **Recent Activity** | Last call, last note, upcoming tasks |
| **Forms** | List of completed and in-progress forms |
| **Call History** | Last 10 documented calls with this client |
| **Notes** | Internal and shareable notes with tags |

---

### Part B: Initiating a Documented Call

#### Step 4: Start Call from Client Profile

1. Case manager clicks **"Call"** button on client profile
2. If client has multiple phone numbers, dropdown selector appears
3. System displays **Form Selection modal:** *"Which form(s) should this call populate?"*
4. Case manager selects one or more forms from available options
   - Forms filtered to show only published forms the case manager has access to
   - Previously used forms for this client are highlighted
   - No limit on form selection (user discretion)
5. Case manager clicks **"Start Call"**
6. System requests microphone permission (if not already granted)
7. System initiates WebRTC connection via Twilio
8. Twilio calls client's phone number
9. System begins recording via Twilio Media Streams
10. Audio streams to backend → Deepgram for transcription

**Call Initiation Flow:**

```typescript
async function initiateCall(
  caseManagerId: string,
  clientId: string,
  phoneNumber: string,
  formIds: string[]
): Promise<CallSession> {
  // 1. Create call record
  const call = await prisma.call.create({
    data: {
      id: generateUUID(),
      clientId,
      caseManagerId,
      formIds,
      status: 'initiating',
      startedAt: new Date(),
    }
  });

  // 2. Get case manager's Twilio number
  const caseManager = await prisma.user.findUnique({
    where: { id: caseManagerId },
    include: { twilioNumber: true }
  });

  // 3. Generate Twilio capability token for WebRTC
  const capability = new twilio.jwt.ClientCapability({
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
  });

  capability.addScope(new ClientCapability.OutgoingClientScope({
    applicationSid: process.env.TWILIO_APP_SID,
    clientName: caseManagerId,
  }));

  // 4. Return session with token
  return {
    callId: call.id,
    twilioToken: capability.toJwt(),
    fromNumber: caseManager.twilioNumber.phoneNumber,
    toNumber: phoneNumber,
  };
}
```

> **Note:** If client doesn't answer, case manager can mark as "Attempted Contact" and add a note without completing a form.

---

#### Step 5: During the Call (Desktop View)

The desktop interface displays a **split-screen layout** with priority panel mode during active calls:

**Layout Configuration:**
- Default: Transcript at 70%, Form/Guides at 30%
- User can switch priority (Form at 70%, Transcript at 30%)
- Expand button to maximize either panel
- On screens < 1024px, collapses to tabbed interface

##### Left Panel — Live Transcript & Notes (70%)

| Element | Description |
|---------|-------------|
| Live Transcript | Scrolling in real-time, hybrid display (interim in gray italic, final in black) |
| Speaker Labels | Diarization with confidence indicator (Case Manager / Client / Uncertain) |
| Timestamps | Relative format (mm:ss from call start) |
| Previous Notes | Collapsible section showing past interactions |
| My Notes | Rich text editor (Tiptap) for case manager notes during call |

**Transcript Display:**

```typescript
interface TranscriptSegment {
  id: string;
  speaker: 'case_manager' | 'client' | 'uncertain';
  speakerConfidence: number; // 0-100
  text: string;
  isFinal: boolean;
  timestamp: number; // seconds from call start
}

// Hybrid display component
function TranscriptLine({ segment }: { segment: TranscriptSegment }) {
  return (
    <div className={cn(
      "flex gap-2 py-1",
      !segment.isFinal && "text-gray-400 italic"
    )}>
      <span className="text-xs text-muted-foreground w-12">
        {formatTimestamp(segment.timestamp)}
      </span>
      <span className={cn(
        "text-xs font-medium w-20",
        segment.speaker === 'uncertain' && "text-yellow-600"
      )}>
        {segment.speaker === 'case_manager' ? 'You' :
         segment.speaker === 'client' ? 'Client' : 'Unknown'}
      </span>
      <span className="flex-1">{segment.text}</span>
    </div>
  );
}
```

##### Right Panel — Conversation Guide & Form Preview (30%)

Since AI extraction happens post-call, this panel shows:

| Element | Description |
|---------|-------------|
| Conversation Guide | Static checklist of suggested prompts based on selected form fields |
| Form Preview | Collapsed sections showing form structure (expandable) |
| Check-off | Case manager can mentally track covered topics (no tracking/analytics) |

**Conversation Guide Generation (Static per Form):**

```typescript
interface ConversationPrompt {
  id: string;
  fieldId: string;
  question: string;
  helpText?: string;
}

// Prompts are created by form creator when designing the form
// Stored as part of form definition
interface FormField {
  // ... existing fields
  conversationPrompt?: string; // "What is your date of birth?"
}

function ConversationGuide({ formIds }: { formIds: string[] }) {
  const [forms] = useQuery(['forms', formIds]);

  const prompts = forms.flatMap(form =>
    form.fields
      .filter(f => f.isAiExtractable && f.conversationPrompt)
      .map(f => ({
        id: f.id,
        section: f.section,
        question: f.conversationPrompt,
        helpText: f.helpText,
      }))
  );

  return (
    <div className="space-y-4">
      {Object.entries(groupBy(prompts, 'section')).map(([section, items]) => (
        <Accordion key={section} type="single" collapsible>
          <AccordionItem value={section}>
            <AccordionTrigger>{section || 'General'}</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {items.map(prompt => (
                  <li key={prompt.id} className="flex items-start gap-2">
                    <Checkbox id={prompt.id} />
                    <label htmlFor={prompt.id} className="text-sm">
                      {prompt.question}
                      {prompt.helpText && (
                        <span className="text-xs text-muted-foreground block">
                          {prompt.helpText}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
    </div>
  );
}
```

##### Bottom Bar — Call Controls

| Control | Function | Keyboard Shortcut |
|---------|----------|-------------------|
| Timer | Call duration display (count up only) | — |
| Mute | Toggle microphone | `M` |
| End Call | Terminate call and proceed to review | `E` |
| Abandon | End without submission (requires confirmation) | — |

---

#### Step 6: During the Call (Mobile View)

Mobile interface is **simplified for field use:**

- **No live transcript displayed** (processing happens in background)
- Client name and call duration prominently shown
- Notes field for typing during call
- Call controls at bottom of screen
- **Form review happens after call ends**

```
┌─────────────────────┐
│                     │
│    JOHN SMITH       │
│      12:34          │
│                     │
├─────────────────────┤
│                     │
│   [Notes field]     │
│   (Rich text)       │
│                     │
├─────────────────────┤
│ 🔇    📞 End   ✕   │
└─────────────────────┘
```

> **Technical Note:** Mobile transcription still runs server-side. Case manager reviews everything post-call.

---

### Part C: Post-Call Review and Submission

#### Step 7: Call Ends — AI Processing

1. Case manager clicks **"End Call"** or call terminates naturally
2. System displays **"Processing..."** indicator
3. Twilio call ends, final audio flushed
4. Deepgram completes final transcript processing
5. System sends transcript to Claude API for extraction (field-grouped calls)
6. Post-processing layer normalizes extracted field formats (synchronous)
7. AI generates structured call summary
8. System displays **Review Screen**

**AI Processing Pipeline:**

```typescript
async function processCallCompletion(callId: string): Promise<void> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      forms: { include: { fields: true } },
      transcriptSegments: true
    }
  });

  // 1. Assemble full transcript
  const transcript = call.transcriptSegments
    .filter(s => s.isFinal)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(s => `[${s.speaker}]: ${s.text}`)
    .join('\n');

  // 2. Extract fields in grouped batches
  const allFields = call.forms.flatMap(f => f.fields.filter(f => f.isAiExtractable));
  const fieldGroups = groupFieldsByDomain(allFields);

  const extractions: Record<string, ExtractionResult> = {};

  for (const [domain, fields] of Object.entries(fieldGroups)) {
    const result = await extractFieldGroup(transcript, domain, fields);
    Object.assign(extractions, result);
  }

  // 3. Post-processing normalization (synchronous)
  const normalizedExtractions = normalizeExtractions(extractions, allFields);

  // 4. Calculate confidence scores
  const confidenceScores = calculateConfidenceScores(normalizedExtractions, transcript);

  // 5. Generate summary
  const summary = await generateCallSummary(transcript);

  // 6. Save results
  await prisma.call.update({
    where: { id: callId },
    data: {
      status: 'completed',
      endedAt: new Date(),
      transcriptRaw: transcript,
      aiSummary: JSON.stringify(summary),
      extractedFields: normalizedExtractions,
      confidenceScores,
    }
  });
}

function groupFieldsByDomain(fields: FormField[]): Record<string, FormField[]> {
  // Group related fields for focused extraction context
  return {
    demographics: fields.filter(f =>
      ['first_name', 'last_name', 'dob', 'ssn', 'gender'].some(k =>
        f.slug.includes(k) || f.name.toLowerCase().includes(k)
      )
    ),
    contact: fields.filter(f =>
      ['phone', 'email', 'address'].some(k =>
        f.slug.includes(k) || f.name.toLowerCase().includes(k)
      )
    ),
    case_details: fields.filter(f =>
      !['demographics', 'contact'].some(domain =>
        groupFieldsByDomain(fields)[domain]?.includes(f)
      )
    ),
  };
}
```

> **Technical Note:** Processing typically completes within 10-15 seconds of call end. Longer calls (30+ min) may take up to 45 seconds due to field-grouped extraction.

---

#### Step 8: Review Screen

The Review Screen presents all call outputs for case manager verification:

##### Section 1 — Call Summary

**Structured Sections:**
- **Overview:** 2-3 sentence summary of the call purpose and outcome
- **Key Points:** Bulleted list of important information discussed
- **Action Items:** Tasks identified during the call (display only, no task creation)
- **Next Steps:** Recommended follow-up actions

- Case manager can edit summary text before saving

**Summary Generation:**

```typescript
async function generateCallSummary(transcript: string): Promise<CallSummary> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Analyze this case management call transcript and provide a structured summary.

Transcript:
${transcript}

Respond with JSON in this exact format:
{
  "overview": "2-3 sentence summary of the call",
  "keyPoints": ["point 1", "point 2", ...],
  "actionItems": ["action 1", "action 2", ...],
  "nextSteps": ["step 1", "step 2", ...]
}

Be factual and concise. Do not include sentiment analysis.`
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

##### Section 2 — Extracted Form Fields

- All AI-extracted fields shown with populated values
- Confidence indicator next to each field (green/yellow/red)
- Case manager can click any field to edit
- Required fields that couldn't be extracted are flagged red for manual entry
- Sensitive fields show masked values (e.g., SSN as `***-**-1234`)
- Conflicting information (e.g., two different DOBs mentioned) flagged with both values shown

**Confidence Score Calculation (Rule-Based):**

| Factor | Weight | Description |
|--------|--------|-------------|
| Exact phrase match | 40% | Client said exact field label (e.g., "my date of birth is...") |
| Contextual extraction | 30% | AI inferred from context (e.g., mentioned age near birthday discussion) |
| Format validation | 20% | Extracted value matches expected format (e.g., valid phone number) |
| Multiple mentions | 10% | Same information mentioned more than once |

**Thresholds (Fixed):**
- **Green (High):** 90%+ combined score
- **Yellow (Medium):** 60-89% combined score
- **Red (Low):** Below 60% or conflicting information detected

```typescript
interface ExtractionConfidence {
  fieldId: string;
  score: number;
  factors: {
    exactMatch: number;
    contextual: number;
    formatValid: number;
    multipleMentions: number;
  };
  hasConflict: boolean;
  conflictingValues?: string[];
}

function calculateConfidenceScores(
  extractions: Record<string, any>,
  transcript: string
): Record<string, ExtractionConfidence> {
  const scores: Record<string, ExtractionConfidence> = {};

  for (const [fieldSlug, value] of Object.entries(extractions)) {
    if (value === null) continue;

    const exactMatch = checkExactMatch(transcript, fieldSlug, value);
    const formatValid = validateFieldFormat(fieldSlug, value);
    const mentions = countMentions(transcript, value);
    const conflict = detectConflict(transcript, fieldSlug);

    const score =
      (exactMatch ? 40 : 0) +
      (30) + // Contextual always assumed if extracted
      (formatValid ? 20 : 0) +
      (mentions > 1 ? 10 : 0);

    scores[fieldSlug] = {
      fieldId: fieldSlug,
      score: conflict.hasConflict ? Math.min(score, 59) : score,
      factors: {
        exactMatch: exactMatch ? 40 : 0,
        contextual: 30,
        formatValid: formatValid ? 20 : 0,
        multipleMentions: mentions > 1 ? 10 : 0,
      },
      hasConflict: conflict.hasConflict,
      conflictingValues: conflict.values,
    };
  }

  return scores;
}
```

##### Section 3 — Full Transcript (Collapsible)

- Complete transcript with timestamps (mm:ss from start) for each speaker turn
- Speaker diarization with confidence (Case Manager / Client / Uncertain)
- Case manager can click segments to see context around extractions

---

#### Step 9: Make Corrections

1. Case manager reviews each section of the Review Screen
2. **For incorrect extractions:** Case manager clicks field, types correct value
3. **For conflicting values:** Case manager picks correct value from options or enters new
4. **For missed required fields:** System highlights in red, case manager fills manually
5. **For summary edits:** Case manager clicks into summary text and modifies as needed
6. System tracks all manual corrections (for AI improvement feedback)

> **Note:** Corrections made here are logged for future AI improvement analysis. Fields that are frequently corrected can be reviewed by admins.

**Correction Tracking:**

```typescript
interface FieldCorrection {
  callId: string;
  fieldId: string;
  originalValue: any;
  correctedValue: any;
  originalConfidence: number;
  correctedAt: Date;
  correctedBy: string;
}
```

---

#### Step 10: Submit or Save Draft

Case manager has three options:

##### Option A — Submit
- All required fields must be completed
- Form is finalized and locked
- Case manager can edit anytime with full audit trail (no approval required)
- Data flows to reports and analytics

##### Option B — Save as Draft
- Partial completion allowed
- Case manager can return later to complete
- Draft appears in "Pending" queue on dashboard
- Not included in reports until submitted
- Auto-saved on field blur + every 30 seconds

##### Option C — Abandon Call
- Call is marked as "Abandoned" in system
- No form submission required
- Call record and transcript are still saved for audit
- Client status unchanged

**Edit Audit Trail (No Approval Required):**

```typescript
interface FormEditLog {
  id: string;
  submissionId: string;
  fieldId: string;
  previousValue: any;
  newValue: any;
  editedBy: string;
  editedAt: Date;
  editReason?: string;
}

async function editSubmittedField(
  submissionId: string,
  fieldId: string,
  newValue: any,
  userId: string
): Promise<void> {
  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId }
  });

  const previousValue = submission.data[fieldId];

  // Log the edit
  await prisma.formEditLog.create({
    data: {
      submissionId,
      fieldId,
      previousValue,
      newValue,
      editedBy: userId,
      editedAt: new Date(),
    }
  });

  // Update the value
  await prisma.formSubmission.update({
    where: { id: submissionId },
    data: {
      data: {
        ...submission.data,
        [fieldId]: newValue
      }
    }
  });
}
```

**Process:**
1. Case manager clicks chosen action button
2. System confirms action and returns to Client Profile
3. If submitted: Success message and form appears in client's completed forms

---

#### Step 11: Add Additional Notes (Optional)

After submission, case manager can add supplementary notes:

1. From Client Profile, case manager clicks **"Add Note"**
2. System displays note entry form with options:
   - **Note Type:** Internal (staff only) or Shareable (for future client portal)
   - **Link to Call:** Option to attach note to specific call record
   - **Tags:** Flexible tagging system (urgent, follow-up, billing, etc.)
3. Case manager enters note text (rich text editor, 10,000 character limit)
4. Note auto-saves as draft every 10 seconds
5. Case manager clicks **"Save Note"**
6. Note appears in client's Notes section and activity feed

---

## Data Models

### Core Tables (Prisma Schema)

```prisma
// ==================== CLIENT MANAGEMENT ====================

model Client {
  id              String    @id @default(uuid())
  orgId           String
  firstName       String
  lastName        String
  phone           String    // Primary phone (10 digits)
  additionalPhones Json?    // Array of { number, label }
  email           String?
  address         Json?     // { street, city, state, zip }
  internalId      String?   // Org-specific ID for external system sync
  status          ClientStatus @default(ACTIVE)
  assignedTo      String    // Case manager user ID
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime? // Soft delete

  organization    Organization @relation(fields: [orgId], references: [id])
  assignedUser    User      @relation("AssignedClients", fields: [assignedTo], references: [id])
  calls           Call[]
  notes           Note[]
  formSubmissions FormSubmission[]

  @@index([orgId, status])
  @@index([orgId, phone])
  @@index([assignedTo])
}

enum ClientStatus {
  ACTIVE
  ON_HOLD
  CLOSED
  PENDING
}

// ==================== CALL MANAGEMENT ====================

model Call {
  id                  String      @id @default(uuid())
  clientId            String
  caseManagerId       String
  formIds             String[]    // Forms selected for this call
  status              CallStatus  @default(INITIATING)
  startedAt           DateTime
  endedAt             DateTime?
  durationSeconds     Int?

  // Recording
  twilioCallSid       String?     @unique
  recordingUrl        String?     // S3 URL
  recordingRetention  DateTime?   // When to delete based on org policy

  // Transcript
  transcriptRaw       String?     @db.Text
  transcriptJson      Json?       // Array of TranscriptSegment

  // AI Processing
  aiSummary           Json?       // CallSummary structure
  extractedFields     Json?       // Field slug -> value
  confidenceScores    Json?       // Field slug -> ExtractionConfidence
  manualCorrections   Json?       // Array of FieldCorrection

  // Queue for retry
  aiProcessingStatus  ProcessingStatus @default(PENDING)
  aiProcessingError   String?
  aiProcessingRetries Int         @default(0)

  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  client              Client      @relation(fields: [clientId], references: [id])
  caseManager         User        @relation(fields: [caseManagerId], references: [id])
  linkedNotes         Note[]
  formSubmissions     FormSubmission[]

  @@index([clientId])
  @@index([caseManagerId])
  @@index([status])
  @@index([aiProcessingStatus])
}

enum CallStatus {
  INITIATING
  RINGING
  IN_PROGRESS
  COMPLETED
  ABANDONED
  ATTEMPTED   // Client didn't answer
  FAILED
}

enum ProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  QUEUED_FOR_RETRY
}

model TranscriptSegment {
  id                String    @id @default(uuid())
  callId            String
  speaker           Speaker
  speakerConfidence Float     // 0-1
  text              String
  isFinal           Boolean
  timestamp         Float     // Seconds from call start
  createdAt         DateTime  @default(now())

  call              Call      @relation(fields: [callId], references: [id], onDelete: Cascade)

  @@index([callId, timestamp])
}

enum Speaker {
  CASE_MANAGER
  CLIENT
  UNCERTAIN
}

// ==================== NOTES ====================

model Note {
  id            String    @id @default(uuid())
  clientId      String
  callId        String?   // Optional link to call
  authorId      String
  type          NoteType  @default(INTERNAL)
  content       String    @db.Text // Rich text HTML, max 10000 chars
  tags          String[]  // Flexible tagging
  isDraft       Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime? // Soft delete

  client        Client    @relation(fields: [clientId], references: [id])
  call          Call?     @relation(fields: [callId], references: [id])
  author        User      @relation(fields: [authorId], references: [id])

  @@index([clientId])
  @@index([callId])
}

enum NoteType {
  INTERNAL    // Staff only
  SHAREABLE   // For future client portal
}

// ==================== FORM SUBMISSIONS ====================

model FormSubmission {
  id              String    @id @default(uuid())
  formId          String
  formVersionId   String    // Locked to version at submission time
  clientId        String
  callId          String?   // May be created without call
  submittedBy     String
  status          SubmissionStatus @default(DRAFT)
  data            Json      // Field slug -> value (encrypted sensitive fields)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  submittedAt     DateTime?

  form            Form      @relation(fields: [formId], references: [id])
  formVersion     FormVersion @relation(fields: [formVersionId], references: [id])
  client          Client    @relation(fields: [clientId], references: [id])
  call            Call?     @relation(fields: [callId], references: [id])
  submitter       User      @relation(fields: [submittedBy], references: [id])
  editLogs        FormEditLog[]

  @@index([clientId])
  @@index([formId])
  @@index([status])
}

enum SubmissionStatus {
  DRAFT
  SUBMITTED
}

model FormEditLog {
  id            String    @id @default(uuid())
  submissionId  String
  fieldId       String
  previousValue Json?
  newValue      Json?
  editedBy      String
  editedAt      DateTime  @default(now())
  editReason    String?

  submission    FormSubmission @relation(fields: [submissionId], references: [id])
  editor        User      @relation(fields: [editedBy], references: [id])

  @@index([submissionId])
}

// ==================== USER & ORG ====================

model User {
  id                  String    @id @default(uuid())
  orgId               String
  email               String    @unique
  role                UserRole  @default(CASE_MANAGER)
  firstName           String
  lastName            String
  isActive            Boolean   @default(true)
  maxCaseload         Int?      // Simple client count limit
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  organization        Organization @relation(fields: [orgId], references: [id])
  twilioNumber        TwilioNumber?
  assignedClients     Client[]  @relation("AssignedClients")
  calls               Call[]
  notes               Note[]
  formSubmissions     FormSubmission[]
  formEditLogs        FormEditLog[]

  @@index([orgId])
}

enum UserRole {
  ADMIN
  CASE_MANAGER
}

model TwilioNumber {
  id            String    @id @default(uuid())
  userId        String    @unique
  phoneNumber   String    @unique // E.164 format
  twilioSid     String    @unique
  areaCode      String    // For org preference tracking
  provisionedAt DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id])
}

model Organization {
  id                    String    @id @default(uuid())
  name                  String
  tier                  Tier      @default(FREE)
  encryptionKeyId       String?   // AWS KMS key ARN
  preferredAreaCode     String?   // For Twilio number provisioning
  recordingRetentionDays Int      @default(30) // Default 30, org configurable

  // Recording consent configuration
  consentMode           ConsentMode @default(CASE_MANAGER_SCRIPT)
  consentRecordingUrl   String?   // Pre-recorded consent message if AUTO

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  users                 User[]
  clients               Client[]
  forms                 Form[]

  @@index([tier])
}

enum Tier {
  FREE
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum ConsentMode {
  AUTO_RECORDING      // Play pre-recorded consent message
  CASE_MANAGER_SCRIPT // Prompt case manager to verbally obtain consent
  DISABLED            // No consent handling (org assumes responsibility)
}

// ==================== AUDIT LOGGING ====================

model AuditLog {
  id                String      @id @default(uuid())
  orgId             String
  action            AuditAction
  resourceType      String      // 'client', 'call', 'form_submission', etc.
  resourceId        String
  actorId           String
  actorIp           String
  actorUserAgent    String
  metadata          Json?
  createdAt         DateTime    @default(now())

  @@index([orgId, createdAt])
  @@index([resourceType, resourceId])
  @@index([actorId])
}

enum AuditAction {
  // Client actions
  CLIENT_CREATED
  CLIENT_VIEWED
  CLIENT_UPDATED
  CLIENT_DELETED

  // Call actions
  CALL_INITIATED
  CALL_COMPLETED
  CALL_ABANDONED
  RECORDING_ACCESSED
  TRANSCRIPT_VIEWED

  // Form actions
  FORM_SUBMITTED
  FORM_FIELD_EDITED

  // Sensitive data
  SENSITIVE_FIELD_ACCESSED

  // Auth
  LOGIN
  LOGOUT

  // Export
  DATA_EXPORTED
}

// ==================== REAL-TIME LOCKING ====================

model ResourceLock {
  id            String    @id @default(uuid())
  resourceType  String    // 'form_submission', 'client', etc.
  resourceId    String
  lockedBy      String    // User ID
  lockedAt      DateTime  @default(now())
  expiresAt     DateTime  // Auto-expire after 5 minutes of inactivity

  @@unique([resourceType, resourceId])
  @@index([expiresAt])
}
```

---

## API Endpoints

### REST Resource Structure

```
# Clients
GET     /api/clients                    - List clients (own caseload only)
POST    /api/clients                    - Create new client
GET     /api/clients/:id                - Get client by ID
PATCH   /api/clients/:id                - Update client
DELETE  /api/clients/:id                - Soft delete client

GET     /api/clients/:id/calls          - List client's calls (last 10 default)
GET     /api/clients/:id/notes          - List client's notes
GET     /api/clients/:id/forms          - List client's form submissions

POST    /api/clients/check-duplicate    - Check for duplicate before create

# Calls
POST    /api/calls                      - Initiate new call
GET     /api/calls/:id                  - Get call details
PATCH   /api/calls/:id                  - Update call (status, notes)
POST    /api/calls/:id/end              - End call, trigger AI processing

GET     /api/calls/:id/transcript       - Get full transcript
GET     /api/calls/:id/recording        - Get signed S3 URL for recording

POST    /api/calls/:id/link             - Link resumed call to previous draft

# Call Webhooks (Twilio)
POST    /api/webhooks/twilio/voice      - Incoming call handling
POST    /api/webhooks/twilio/status     - Call status updates
POST    /api/webhooks/twilio/recording  - Recording complete webhook

# Notes
POST    /api/notes                      - Create note
GET     /api/notes/:id                  - Get note
PATCH   /api/notes/:id                  - Update note
DELETE  /api/notes/:id                  - Soft delete note

# Form Submissions
GET     /api/submissions                - List submissions (with filters)
POST    /api/submissions                - Create submission from call
GET     /api/submissions/:id            - Get submission
PATCH   /api/submissions/:id            - Update submission
POST    /api/submissions/:id/submit     - Finalize submission

# Resource Locking
POST    /api/locks                      - Acquire lock
DELETE  /api/locks/:resourceType/:id    - Release lock
GET     /api/locks/:resourceType/:id    - Check lock status

# User
GET     /api/users/me                   - Get current user
GET     /api/users/me/caseload          - Get caseload count

# Export
POST    /api/export/client/:id          - Export client data (JSON/PDF/CSV)

# WebSocket Ticket
POST    /api/ws-ticket                  - Get ticket for WebSocket auth
```

### Rate Limiting (Per-Org Daily Limits)

```typescript
interface OrgApiLimits {
  tier: Tier;
  dailyLimit: number;
  claudeCallsPerDay: number;
}

const ORG_API_LIMITS: Record<Tier, OrgApiLimits> = {
  FREE: {
    tier: 'FREE',
    dailyLimit: 1000,
    claudeCallsPerDay: 50
  },
  STARTER: {
    tier: 'STARTER',
    dailyLimit: 5000,
    claudeCallsPerDay: 200
  },
  PROFESSIONAL: {
    tier: 'PROFESSIONAL',
    dailyLimit: 20000,
    claudeCallsPerDay: 1000
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    dailyLimit: Infinity,
    claudeCallsPerDay: Infinity
  },
};

// Track in database or Redis
interface OrgApiUsage {
  orgId: string;
  date: string; // YYYY-MM-DD
  requestCount: number;
  claudeCallCount: number;
}
```

---

## Real-Time Communication

### WebSocket Server Architecture

Separate Node.js service running on ECS Fargate, handling:
- Live transcript streaming during calls
- Call status updates
- Resource lock notifications

**Ticket-Based Authentication (Most Secure):**

```typescript
// 1. Client requests ticket via REST
// POST /api/ws-ticket
async function getWsTicket(req: Request): Promise<{ ticket: string }> {
  const user = await validateJwt(req.headers.authorization);

  // Generate short-lived, single-use ticket
  const ticket = crypto.randomBytes(32).toString('hex');

  // Store in Redis with 30 second TTL
  await redis.set(`ws-ticket:${ticket}`, JSON.stringify({
    userId: user.id,
    orgId: user.orgId,
  }), 'EX', 30);

  return { ticket };
}

// 2. Client connects with ticket
// ws://ws.scrybe.app?ticket=abc123
async function handleWsConnection(ws: WebSocket, req: Request) {
  const ticket = new URL(req.url, 'http://localhost').searchParams.get('ticket');

  // Validate and consume ticket (single use)
  const ticketData = await redis.get(`ws-ticket:${ticket}`);
  if (!ticketData) {
    ws.close(4001, 'Invalid or expired ticket');
    return;
  }

  await redis.del(`ws-ticket:${ticket}`);

  const { userId, orgId } = JSON.parse(ticketData);

  // Associate connection with user
  connections.set(userId, ws);

  // Handle messages...
}
```

**Message Types:**

```typescript
type WsMessage =
  | { type: 'transcript_segment'; callId: string; segment: TranscriptSegment }
  | { type: 'call_status'; callId: string; status: CallStatus }
  | { type: 'lock_acquired'; resourceType: string; resourceId: string; lockedBy: string }
  | { type: 'lock_released'; resourceType: string; resourceId: string }
  | { type: 'processing_complete'; callId: string }
  | { type: 'processing_failed'; callId: string; error: string };
```

---

## VOIP Integration

### Twilio Configuration

**Phone Number Provisioning (Auto on User Creation):**

```typescript
async function provisionTwilioNumber(userId: string, orgId: string): Promise<TwilioNumber> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });

  // Search for available numbers in preferred area code
  const availableNumbers = await twilioClient.availablePhoneNumbers('US')
    .local
    .list({
      areaCode: org.preferredAreaCode || undefined,
      limit: 1,
    });

  if (availableNumbers.length === 0) {
    // Fallback to any available number
    const fallbackNumbers = await twilioClient.availablePhoneNumbers('US')
      .local
      .list({ limit: 1 });
    availableNumbers.push(...fallbackNumbers);
  }

  // Purchase the number
  const purchased = await twilioClient.incomingPhoneNumbers.create({
    phoneNumber: availableNumbers[0].phoneNumber,
    voiceUrl: `${process.env.APP_URL}/api/webhooks/twilio/voice`,
    statusCallback: `${process.env.APP_URL}/api/webhooks/twilio/status`,
  });

  // Save to database
  return prisma.twilioNumber.create({
    data: {
      userId,
      phoneNumber: purchased.phoneNumber,
      twilioSid: purchased.sid,
      areaCode: purchased.phoneNumber.slice(2, 5),
    }
  });
}
```

**WebRTC Call Flow:**

```typescript
// Client-side: Initialize Twilio Device
import { Device } from '@twilio/voice-sdk';

async function initializeTwilioDevice(token: string) {
  const device = new Device(token, {
    codecPreferences: [Device.Codec.PCMU], // mulaw 8kHz for Deepgram compatibility
    enableRingingState: true,
  });

  await device.register();

  return device;
}

async function makeCall(device: Device, callSession: CallSession) {
  const call = await device.connect({
    params: {
      To: callSession.toNumber,
      From: callSession.fromNumber,
      CallId: callSession.callId,
    }
  });

  call.on('ringing', () => {
    updateCallStatus(callSession.callId, 'RINGING');
  });

  call.on('accept', () => {
    updateCallStatus(callSession.callId, 'IN_PROGRESS');
  });

  call.on('disconnect', () => {
    endCall(callSession.callId);
  });

  return call;
}
```

**Inbound Call Handling (Ring to Browser):**

```typescript
// POST /api/webhooks/twilio/voice
async function handleInboundCall(req: Request): Promise<TwiMLResponse> {
  const { To, From, CallSid } = req.body;

  // Find case manager by Twilio number
  const twilioNumber = await prisma.twilioNumber.findUnique({
    where: { phoneNumber: To },
    include: { user: true }
  });

  if (!twilioNumber) {
    return new VoiceResponse().say('This number is not configured.');
  }

  // Generate client name for WebRTC routing
  const response = new VoiceResponse();

  const dial = response.dial({
    callerId: From,
    timeout: 30,
  });

  dial.client(twilioNumber.userId);

  return response;
}
```

**Recording Consent (Configurable per Org):**

```typescript
async function handleCallConnect(callId: string, org: Organization): Promise<TwiMLResponse> {
  const response = new VoiceResponse();

  switch (org.consentMode) {
    case 'AUTO_RECORDING':
      // Play pre-recorded consent message
      response.play(org.consentRecordingUrl);
      break;

    case 'CASE_MANAGER_SCRIPT':
      // UI will prompt case manager to verbally obtain consent
      // No TwiML action needed
      break;

    case 'DISABLED':
      // Skip consent handling
      break;
  }

  // Start recording and media streams
  response.record({
    recordingStatusCallback: `${process.env.APP_URL}/api/webhooks/twilio/recording`,
    recordingStatusCallbackEvent: ['completed'],
  });

  // Connect to media streams for transcription
  const connect = response.connect();
  connect.stream({
    url: `wss://${process.env.WS_HOST}/twilio-stream/${callId}`,
  });

  return response;
}
```

---

## Transcription Pipeline

### Twilio Media Streams → Deepgram

```typescript
// WebSocket handler for Twilio Media Streams
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

async function handleTwilioMediaStream(ws: WebSocket, callId: string) {
  // Create Deepgram live transcription connection
  const dgConnection = deepgram.listen.live({
    model: 'nova-2',
    language: 'en-US',
    encoding: 'mulaw',    // Twilio default
    sample_rate: 8000,    // Twilio default
    channels: 1,
    punctuate: true,
    diarize: true,        // Speaker diarization
    interim_results: true, // For hybrid display
  });

  dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const segment: TranscriptSegment = {
      id: generateUUID(),
      callId,
      speaker: mapDiarizationToSpeaker(data.channel.alternatives[0]),
      speakerConfidence: data.channel.alternatives[0].confidence,
      text: data.channel.alternatives[0].transcript,
      isFinal: data.is_final,
      timestamp: data.start,
    };

    // Save final segments to database
    if (segment.isFinal && segment.text.trim()) {
      saveTranscriptSegment(segment);
    }

    // Broadcast to case manager via WebSocket
    broadcastToUser(getCaseManagerId(callId), {
      type: 'transcript_segment',
      callId,
      segment,
    });
  });

  // Handle Twilio media stream messages
  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    if (data.event === 'media') {
      // Forward audio to Deepgram
      const audio = Buffer.from(data.media.payload, 'base64');
      dgConnection.send(audio);
    }

    if (data.event === 'stop') {
      dgConnection.finish();
    }
  });

  ws.on('close', () => {
    dgConnection.finish();
  });
}

function mapDiarizationToSpeaker(alternative: any): Speaker {
  // Deepgram returns speaker IDs, map to our enum
  // Typically speaker 0 is caller (case manager), speaker 1 is callee (client)
  const speakerId = alternative.words?.[0]?.speaker;

  if (speakerId === 0) return 'CASE_MANAGER';
  if (speakerId === 1) return 'CLIENT';
  return 'UNCERTAIN';
}
```

### Audio Quality Detection

```typescript
function assessAudioQuality(dgResponse: any): AudioQualityAssessment {
  const words = dgResponse.channel.alternatives[0].words || [];

  // Calculate average confidence
  const avgConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length;

  // Detect quality issues
  const issues: string[] = [];

  if (avgConfidence < 0.7) {
    issues.push('Low transcription confidence');
  }

  // Check for long gaps (potential audio drops)
  const gaps = findTranscriptGaps(words);
  if (gaps.some(g => g.duration > 3)) {
    issues.push('Audio gaps detected');
  }

  return {
    averageConfidence: avgConfidence,
    issues,
    showWarning: issues.length > 0,
  };
}
```

---

## AI Extraction System

### Field-Grouped Extraction

```typescript
async function extractFieldGroup(
  transcript: string,
  domain: string,
  fields: FormField[]
): Promise<Record<string, any>> {
  const prompt = buildExtractionPrompt(domain, fields);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `${prompt}\n\nTranscript:\n${transcript}`
    }]
  });

  const result = JSON.parse(response.content[0].text);
  return result.fields;
}

function buildExtractionPrompt(domain: string, fields: FormField[]): string {
  return `You are extracting ${domain} information from a case management call transcript.

Extract the following fields:
${fields.map(f => `
- ${f.slug} (${f.type}): ${f.name}
  ${f.helpText ? `Context: ${f.helpText}` : ''}
  ${f.conversationPrompt ? `Usually asked as: "${f.conversationPrompt}"` : ''}
`).join('\n')}

Return JSON in this exact format:
{
  "fields": {
    "${fields[0]?.slug}": "extracted value or null",
    // ... other fields
  },
  "conflicts": {
    // If conflicting information detected (e.g., two different dates mentioned)
    "field_slug": ["value1", "value2"]
  }
}

Rules:
- Use null for fields you cannot confidently extract
- Preserve original values without interpretation (don't guess missing digits)
- Flag conflicts rather than picking one value
- Extract exactly what was said, apply format normalization separately`;
}
```

### Post-Processing Normalization Layer

```typescript
interface NormalizationRule {
  fieldType: FieldType;
  normalize: (value: any) => any;
  validate: (value: any) => boolean;
}

const NORMALIZATION_RULES: NormalizationRule[] = [
  {
    fieldType: 'DATE',
    normalize: (value: string) => {
      // Parse various date formats to YYYY-MM-DD
      const parsed = chrono.parseDate(value);
      return parsed ? format(parsed, 'yyyy-MM-dd') : value;
    },
    validate: (value: string) => isValid(parseISO(value)),
  },
  {
    fieldType: 'PHONE',
    normalize: (value: string) => {
      // Remove non-digits, format as (XXX) XXX-XXXX
      const digits = value.replace(/\D/g, '');
      if (digits.length === 10) {
        return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
      }
      return value;
    },
    validate: (value: string) => /^\(\d{3}\) \d{3}-\d{4}$/.test(value),
  },
  {
    fieldType: 'EMAIL',
    normalize: (value: string) => value.toLowerCase().trim(),
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  },
  // ... more rules
];

function normalizeExtractions(
  extractions: Record<string, any>,
  fields: FormField[]
): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [slug, value] of Object.entries(extractions)) {
    if (value === null) {
      normalized[slug] = null;
      continue;
    }

    const field = fields.find(f => f.slug === slug);
    if (!field) continue;

    const rule = NORMALIZATION_RULES.find(r => r.fieldType === field.type);
    if (rule) {
      const normalizedValue = rule.normalize(value);
      normalized[slug] = rule.validate(normalizedValue) ? normalizedValue : value;
    } else {
      normalized[slug] = value;
    }
  }

  return normalized;
}
```

### Retry Queue for AI Failures

```typescript
async function processAiExtractionWithRetry(callId: string): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [5000, 15000, 60000]; // 5s, 15s, 60s

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await prisma.call.update({
        where: { id: callId },
        data: { aiProcessingStatus: 'PROCESSING' }
      });

      await processCallCompletion(callId);

      await prisma.call.update({
        where: { id: callId },
        data: { aiProcessingStatus: 'COMPLETED' }
      });

      return;
    } catch (error) {
      attempt++;

      await prisma.call.update({
        where: { id: callId },
        data: {
          aiProcessingStatus: attempt >= MAX_RETRIES ? 'FAILED' : 'QUEUED_FOR_RETRY',
          aiProcessingError: error.message,
          aiProcessingRetries: attempt,
        }
      });

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
      }
    }
  }

  // Notify user of failure
  broadcastToUser(getCaseManagerId(callId), {
    type: 'processing_failed',
    callId,
    error: 'AI processing failed. You can fill forms manually.',
  });
}
```

---

## Security Implementation

### Field-Level Encryption (AWS KMS)

```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

async function encryptSensitiveValue(
  value: string,
  orgKeyArn: string
): Promise<string> {
  const command = new EncryptCommand({
    KeyId: orgKeyArn,
    Plaintext: Buffer.from(value),
    EncryptionContext: {
      purpose: 'sensitive_field',
    },
  });

  const response = await kmsClient.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
}

async function decryptSensitiveValue(
  encryptedValue: string,
  orgKeyArn: string
): Promise<string> {
  const command = new DecryptCommand({
    KeyId: orgKeyArn,
    CiphertextBlob: Buffer.from(encryptedValue, 'base64'),
    EncryptionContext: {
      purpose: 'sensitive_field',
    },
  });

  const response = await kmsClient.send(command);
  return Buffer.from(response.Plaintext!).toString('utf-8');
}

// Mask sensitive values for UI display
function maskSensitiveValue(value: string, fieldType: FieldType): string {
  switch (fieldType) {
    case 'SSN':
      // Show last 4 only
      return `***-**-${value.slice(-4)}`;
    case 'PHONE':
      // Show last 4 only
      return `(***) ***-${value.slice(-4)}`;
    default:
      return '••••••••';
  }
}
```

### Audit Logging for Critical Actions

```typescript
async function logCriticalAction(
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  actorId: string,
  request: Request,
  metadata?: Record<string, any>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: await getOrgId(actorId),
      action,
      resourceType,
      resourceId,
      actorId,
      actorIp: getClientIp(request),
      actorUserAgent: request.headers.get('user-agent') || '',
      metadata,
    }
  });
}

// Logged actions:
const CRITICAL_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'CLIENT_CREATED',
  'CLIENT_VIEWED',
  'CALL_INITIATED',
  'CALL_COMPLETED',
  'RECORDING_ACCESSED',
  'FORM_SUBMITTED',
  'FORM_FIELD_EDITED',
  'SENSITIVE_FIELD_ACCESSED',
  'DATA_EXPORTED',
];
```

### Real-Time Resource Locking

```typescript
async function acquireLock(
  resourceType: string,
  resourceId: string,
  userId: string
): Promise<{ success: boolean; lockedBy?: string }> {
  // Clean up expired locks first
  await prisma.resourceLock.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });

  try {
    // Try to acquire lock
    await prisma.resourceLock.create({
      data: {
        resourceType,
        resourceId,
        lockedBy: userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      }
    });

    // Notify other users
    broadcastToOrg(await getOrgId(userId), {
      type: 'lock_acquired',
      resourceType,
      resourceId,
      lockedBy: userId,
    });

    return { success: true };
  } catch (error) {
    // Lock already exists
    const existingLock = await prisma.resourceLock.findUnique({
      where: { resourceType_resourceId: { resourceType, resourceId } }
    });

    return {
      success: false,
      lockedBy: existingLock?.lockedBy,
    };
  }
}

async function refreshLock(
  resourceType: string,
  resourceId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.resourceLock.updateMany({
    where: {
      resourceType,
      resourceId,
      lockedBy: userId,
    },
    data: {
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }
  });

  return result.count > 0;
}

async function releaseLock(
  resourceType: string,
  resourceId: string,
  userId: string
): Promise<void> {
  await prisma.resourceLock.deleteMany({
    where: {
      resourceType,
      resourceId,
      lockedBy: userId,
    }
  });

  broadcastToOrg(await getOrgId(userId), {
    type: 'lock_released',
    resourceType,
    resourceId,
  });
}
```

---

## UI/UX Specifications

### Desktop — Active Call Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  JOHN SMITH                           [Priority: Transcript ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────┬───────────────────────┐│
│  │   LIVE TRANSCRIPT (70%)             │  GUIDES (30%)        ││
│  │   ─────────────────                 │  ─────────────        ││
│  │                                     │                       ││
│  │   00:12 You: Thanks for calling... │  ▼ Contact Info       ││
│  │   00:18 Client: Hi, I need help... │    ☐ Ask phone number ││
│  │   00:25 You: Of course. Can I...   │    ☐ Ask email        ││
│  │   00:31 Client: It's March 5th...  │  ▼ Demographics       ││
│  │   [00:35 Client: born in 1985...]  │    ☐ Ask date of birth││
│  │        ↑ interim (gray italic)     │    ☐ Ask SSN          ││
│  │                                     │                       ││
│  │   ─────────────────                 │  ─────────────        ││
│  │   ▶ PREVIOUS NOTES                 │  ▼ FORM PREVIEW       ││
│  │   ─────────────────                 │    [Collapsed form]   ││
│  │   MY NOTES                          │                       ││
│  │   ┌─────────────────────────────┐  │                       ││
│  │   │ Client mentioned housing... │  │                       ││
│  │   └─────────────────────────────┘  │                       ││
│  │                                     │                       ││
│  └─────────────────────────────────────┴───────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  ⏱ 12:34  |  🔇 Mute (M)  |  📞 End Call (E)  |  ✕ Abandon    │
└─────────────────────────────────────────────────────────────────┘
```

### Review Screen — Post-Call

```
┌─────────────────────────────────────────────────────────────────┐
│  Call Review: JOHN SMITH | March 15, 2026 | 12:34 duration     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ SUMMARY                                           [Edit ✏️] ││
│  │ ─────────                                                   ││
│  │ Overview:                                                   ││
│  │ Discussed housing intake requirements and collected...      ││
│  │                                                             ││
│  │ Key Points:                                                 ││
│  │ • Client seeking emergency housing assistance               ││
│  │ • Currently unemployed, last job was retail                ││
│  │                                                             ││
│  │ Action Items:                                               ││
│  │ • Submit housing application to county office              ││
│  │ • Follow up on employment resources                        ││
│  │                                                             ││
│  │ Next Steps:                                                 ││
│  │ • Schedule follow-up call in 1 week                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ EXTRACTED FIELDS                                            ││
│  │ ─────────────────                                           ││
│  │ Housing Intake Form                                         ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ First Name       [John                    ] 🟢           │ ││
│  │ │ Last Name        [Smith                   ] 🟢           │ ││
│  │ │ Date of Birth    [1985-03-05              ] 🟡 [Review]  │ ││
│  │ │ SSN              [***-**-5678             ] 🟢           │ ││
│  │ │ Phone            [(555) 123-4567          ] 🟢           │ ││
│  │ │ Employment*      [                        ] 🔴 Required  │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ▶ FULL TRANSCRIPT (click to expand)                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Save as Draft]              [Abandon]              [Submit ✓] │
└─────────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts (Essential Only)

| Shortcut | Action | Context |
|----------|--------|---------|
| `M` | Toggle mute | During call |
| `E` | End call | During call |
| `Tab` | Switch panel focus | During call |

### Connection Recovery (Grace Period)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │                    🔄 Reconnecting...                       ││
│  │                                                             ││
│  │         Your call is still active. Attempting to           ││
│  │         restore connection...                               ││
│  │                                                             ││
│  │                         (5 seconds)                         ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

After 5 seconds of failed reconnection:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Connection Lost                                            │
│                                                                 │
│  Your internet connection was interrupted.                     │
│                                                                 │
│  • The call is still being recorded                            │
│  • Transcription continues on our servers                      │
│  • You can review everything when you reconnect                │
│                                                                 │
│  [Try Again]                              [End Call]            │
└─────────────────────────────────────────────────────────────────┘
```

### Error Messages (With Codes)

| Error | User Message | Code |
|-------|--------------|------|
| Twilio connection failed | Unable to connect call. Please check your internet and try again. | ERR_VOIP_001 |
| Microphone access denied | Microphone access required for calls. Please enable in browser settings. | ERR_MIC_001 |
| AI processing failed | Unable to auto-fill form. Please fill fields manually. | ERR_AI_001 |
| Network disconnect | Connection lost. Attempting to reconnect... | ERR_NET_001 |
| Recording failed | Call recording unavailable. Transcription will continue. | ERR_REC_001 |

---

## Error Handling & Recovery

### Auto-Save for Notes and Drafts

```typescript
function useAutoSave<T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  options: { debounceMs?: number; intervalMs?: number } = {}
) {
  const { debounceMs = 1000, intervalMs = 30000 } = options;
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Debounced save on change
  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setStatus('saving');
        await saveFunction(data);
        setStatus('saved');
        setLastSaved(new Date());
      } catch {
        setStatus('error');
      }
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [data]);

  // Periodic save
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await saveFunction(data);
        setLastSaved(new Date());
      } catch {
        // Silent fail for interval saves
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [data]);

  return { status, lastSaved };
}

// Usage for form drafts
const { status, lastSaved } = useAutoSave(
  formData,
  (data) => saveDraft(submissionId, data),
  { debounceMs: 0, intervalMs: 30000 } // On blur + every 30 seconds
);
```

### Call Continuation (Dropped Call Link)

```typescript
// When calling same client within 15 minutes of a draft
async function checkForContinuation(
  clientId: string,
  caseManagerId: string
): Promise<{ hasDraft: boolean; draftCall?: Call }> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const draftCall = await prisma.call.findFirst({
    where: {
      clientId,
      caseManagerId,
      status: 'COMPLETED',
      endedAt: { gte: fifteenMinutesAgo },
      formSubmissions: {
        some: { status: 'DRAFT' }
      }
    },
    orderBy: { endedAt: 'desc' },
    include: {
      formSubmissions: {
        where: { status: 'DRAFT' }
      }
    }
  });

  return {
    hasDraft: !!draftCall,
    draftCall,
  };
}

// UI prompts: "Continue previous call or start new?"
```

---

## HIPAA Compliance

### Technical Safeguards

| Requirement | Implementation |
|-------------|----------------|
| Access Controls | Role-based (Admin, Case Manager), own caseload only |
| Audit Controls | All PHI access logged with IP, user agent |
| Integrity Controls | Soft deletes, edit audit trail |
| Transmission Security | TLS 1.3 everywhere, encrypted WebSocket |
| Encryption at Rest | AWS KMS for sensitive fields, S3 SSE for recordings |

### Administrative Safeguards

| Requirement | Implementation |
|-------------|----------------|
| Workforce Training | Not in scope (org responsibility) |
| Access Management | User provisioning, auto-deprovisioning with bulk reassignment |
| Workstation Security | Not in scope (org responsibility) |
| Contingency Plan | Database backups, S3 versioning |

### Physical Safeguards

| Requirement | Implementation |
|-------------|----------------|
| Facility Access | AWS data centers (SOC 2 Type II) |
| Workstation Use | Not in scope (org responsibility) |
| Device Controls | Not in scope (org responsibility) |

### BAA Requirements

- AWS BAA signed for all services (ECS, S3, KMS, etc.)
- Railway PostgreSQL: BAA available for Enterprise tier
- Twilio: HIPAA-eligible services with BAA
- Deepgram: HIPAA compliance available
- Supabase Auth: Data minimized (no PHI in auth)

### Recording Retention (Org Configurable)

```typescript
// Default: 30 days, configurable per org
async function enforceRecordingRetention(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    select: { id: true, recordingRetentionDays: true }
  });

  for (const org of orgs) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - org.recordingRetentionDays);

    const expiredCalls = await prisma.call.findMany({
      where: {
        client: { orgId: org.id },
        recordingUrl: { not: null },
        recordingRetention: { lt: new Date() }
      },
      select: { id: true, recordingUrl: true }
    });

    for (const call of expiredCalls) {
      // Delete from S3
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: call.recordingUrl!.replace(`s3://${process.env.S3_BUCKET}/`, ''),
      }));

      // Clear URL in database
      await prisma.call.update({
        where: { id: call.id },
        data: { recordingUrl: null }
      });
    }
  }
}
```

---

## Internationalization

### next-intl Setup

```typescript
// i18n/config.ts
export const locales = ['en', 'es', 'fr', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// i18n/request.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default
}));
```

**Message Structure:**

```json
// messages/en.json
{
  "call": {
    "status": {
      "initiating": "Connecting...",
      "ringing": "Ringing...",
      "inProgress": "In Progress",
      "completed": "Completed",
      "abandoned": "Abandoned"
    },
    "controls": {
      "mute": "Mute",
      "endCall": "End Call",
      "abandon": "Abandon"
    }
  },
  "review": {
    "title": "Call Review",
    "summary": "Summary",
    "extractedFields": "Extracted Fields",
    "transcript": "Full Transcript",
    "actions": {
      "saveDraft": "Save as Draft",
      "submit": "Submit",
      "abandon": "Abandon"
    }
  }
}
```

```json
// messages/es.json
{
  "call": {
    "status": {
      "initiating": "Conectando...",
      "ringing": "Sonando...",
      "inProgress": "En Progreso",
      "completed": "Completado",
      "abandoned": "Abandonado"
    }
  }
}
```

---

## Cross-Platform Strategy

### Web-First, Electron Wrap

```
packages/
├── core/               # Shared types, validation, utilities
├── api-client/         # API wrapper, React Query hooks
├── ui-components/      # Shared React components (Shadcn-based)
│
apps/
├── web/                # Next.js web app (primary)
├── desktop/            # Electron wrapper
│   └── main.ts         # Electron main process
│   └── preload.ts      # Context bridge for native features
└── mobile/             # React Native (future)
    └── (native dialer integration)
```

### Desktop (Electron)

```typescript
// apps/desktop/main.ts
import { app, BrowserWindow } from 'electron';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  });

  // Load the Next.js app
  win.loadURL(process.env.APP_URL || 'https://app.scrybe.io');
}

app.whenReady().then(createWindow);
```

### Mobile (Future - React Native)

**Native Dialer Integration (CallKit/ConnectionService):**

```typescript
// apps/mobile/src/services/NativeDialer.ts
import { CallKeep } from 'react-native-callkeep';

const options = {
  ios: {
    appName: 'Scrybe',
    supportsVideo: false,
  },
  android: {
    alertTitle: 'Permissions required',
    alertDescription: 'This app needs to access your phone accounts',
  }
};

CallKeep.setup(options);

// Handle incoming calls
CallKeep.addEventListener('answerCall', ({ callUUID }) => {
  // Connect to Twilio and start call
});

// Handle outgoing calls
async function makeNativeCall(phoneNumber: string, callId: string) {
  const uuid = generateUUID();

  // Start native call UI
  CallKeep.startCall(uuid, phoneNumber, phoneNumber);

  // Connect backend
  const session = await api.calls.initiate({
    clientId: getClientId(),
    phoneNumber,
    formIds: selectedFormIds,
  });

  // Audio routing happens through native call UI
}
```

---

## Component Architecture

### Jotai State Structure

```typescript
import { atom } from 'jotai';

// Call state
export const activeCallAtom = atom<Call | null>(null);
export const callStatusAtom = atom<CallStatus>('idle');
export const transcriptSegmentsAtom = atom<TranscriptSegment[]>([]);
export const callNotesAtom = atom<string>('');

// Review state
export const extractedFieldsAtom = atom<Record<string, any>>({});
export const confidenceScoresAtom = atom<Record<string, ExtractionConfidence>>({});
export const callSummaryAtom = atom<CallSummary | null>(null);
export const editedFieldsAtom = atom<Set<string>>(new Set());

// UI state
export const activePanelAtom = atom<'transcript' | 'guides'>('transcript');
export const isReconnectingAtom = atom<boolean>(false);

// Derived atoms
export const canSubmitAtom = atom((get) => {
  const fields = get(extractedFieldsAtom);
  const forms = get(selectedFormsAtom);

  // Check all required fields are filled
  const requiredFields = forms.flatMap(f =>
    f.fields.filter(field => field.isRequired)
  );

  return requiredFields.every(field =>
    fields[field.slug] !== null && fields[field.slug] !== undefined
  );
});
```

### Component Tree

```
CallFlow/
├── CallInitiation/
│   ├── PhoneSelector           # Dropdown if multiple phones
│   ├── FormSelector            # Modal for form selection
│   └── MicrophoneCheck         # Permission check
│
├── ActiveCall/
│   ├── CallHeader              # Client name, timer
│   ├── SplitPanel/
│   │   ├── TranscriptPanel/
│   │   │   ├── LiveTranscript  # Scrolling transcript with hybrid display
│   │   │   ├── PreviousNotes   # Collapsible past notes
│   │   │   └── NoteEditor      # Tiptap rich text
│   │   └── GuidePanel/
│   │       ├── ConversationGuide # Static checklist
│   │       └── FormPreview     # Collapsed form structure
│   ├── CallControls            # Mute, End, Abandon
│   └── ReconnectingOverlay     # Shown during connection issues
│
├── PostCallReview/
│   ├── ReviewHeader            # Call metadata
│   ├── SummarySection/
│   │   ├── SummaryDisplay      # Structured summary
│   │   └── SummaryEditor       # Edit mode
│   ├── FieldsSection/
│   │   ├── FormFieldGroup      # Grouped by form
│   │   ├── ExtractedField      # Individual field with confidence
│   │   └── ConflictResolver    # For conflicting values
│   ├── TranscriptSection       # Collapsible full transcript
│   └── ActionBar               # Submit, Save Draft, Abandon
│
└── CallContinuation/
    └── ContinuationPrompt      # "Continue previous call?" modal
```

---

## Data Export

### Export Formats (JSON + PDF + CSV)

```typescript
async function exportClientData(
  clientId: string,
  format: 'json' | 'pdf' | 'csv'
): Promise<Buffer | string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      calls: {
        include: {
          formSubmissions: true,
        }
      },
      notes: true,
      formSubmissions: true,
    }
  });

  // Log export for audit
  await logCriticalAction('DATA_EXPORTED', 'client', clientId, getCurrentUserId(), request);

  switch (format) {
    case 'json':
      return JSON.stringify(sanitizeForExport(client), null, 2);

    case 'pdf':
      return generateClientPdf(client);

    case 'csv':
      return generateClientCsv(client);
  }
}

function sanitizeForExport(client: Client): any {
  // Decrypt sensitive fields for export
  // Mask or include based on user permissions
  return {
    ...client,
    // Full values (decrypted) for authorized export
  };
}
```

---

## Error States and Edge Cases

| Scenario | System Behavior |
|----------|-----------------|
| **Client doesn't answer** | Prompt to mark as "Attempted Contact". No form required. Note field available. |
| **Call drops mid-conversation** | Transcript saved to point of disconnection. Grace period (5s), then warning. Can save as draft or call back (linked to same form). |
| **Poor audio quality** | Deepgram confidence below 70% triggers warning banner: "Audio quality affected transcription accuracy. Please review carefully." |
| **Transcription service fails** | Call continues but case manager sees alert: "Transcription unavailable. Please take manual notes." Audio still recorded for later processing. |
| **AI extraction fails** | Queue for retry (3 attempts). After failure, show empty form with message: "Unable to auto-fill. Please complete manually." |
| **Required field not mentioned in call** | Field flagged red in review screen. Case manager must fill manually or save as draft. |
| **Duplicate client detected** | Show weighted score with match reasons. Options: View existing, Create anyway (flagged), or Cancel. |
| **Case manager loses connection** | If mid-call: Call continues on Twilio. 5s grace period, then warning. Reconnection restores state. If post-call: Draft auto-saved. Can resume from Review screen. |
| **Conflicting information in call** | Flag for review. Show both values, case manager picks correct one or enters new. |

---

## Appendix: Reminders and Notifications

### Follow-Up Reminders (Email + In-App)

```typescript
interface FollowUpReminder {
  id: string;
  clientId: string;
  caseManagerId: string;
  scheduledFor: Date;
  note: string;
  status: 'pending' | 'sent' | 'dismissed';
}

// Cron job runs every minute
async function processFollowUpReminders(): Promise<void> {
  const now = new Date();

  const dueReminders = await prisma.followUpReminder.findMany({
    where: {
      scheduledFor: { lte: now },
      status: 'pending',
    },
    include: {
      client: true,
      caseManager: true,
    }
  });

  for (const reminder of dueReminders) {
    // Send email
    await sendEmail({
      to: reminder.caseManager.email,
      subject: `Follow-up reminder: ${reminder.client.firstName} ${reminder.client.lastName}`,
      template: 'follow-up-reminder',
      data: {
        clientName: `${reminder.client.firstName} ${reminder.client.lastName}`,
        note: reminder.note,
        clientUrl: `${process.env.APP_URL}/clients/${reminder.clientId}`,
      }
    });

    // Create in-app notification
    await createInAppNotification({
      userId: reminder.caseManagerId,
      type: 'follow_up_reminder',
      message: `Follow-up with ${reminder.client.firstName} ${reminder.client.lastName}`,
      link: `/clients/${reminder.clientId}`,
    });

    // Mark as sent
    await prisma.followUpReminder.update({
      where: { id: reminder.id },
      data: { status: 'sent' }
    });
  }
}
```

---

## Appendix: User Offboarding

### Bulk Client Reassignment

```typescript
async function reassignAllClients(
  fromUserId: string,
  toUserId: string,
  adminId: string
): Promise<{ reassignedCount: number }> {
  // Verify permissions
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (admin?.role !== 'ADMIN') {
    throw new ForbiddenError('Only admins can reassign clients');
  }

  // Get all clients
  const clients = await prisma.client.findMany({
    where: { assignedTo: fromUserId, deletedAt: null }
  });

  // Bulk reassign
  await prisma.client.updateMany({
    where: { assignedTo: fromUserId, deletedAt: null },
    data: { assignedTo: toUserId }
  });

  // Audit log
  await logCriticalAction('CLIENTS_BULK_REASSIGNED', 'user', fromUserId, adminId, request, {
    toUserId,
    clientCount: clients.length,
    clientIds: clients.map(c => c.id),
  });

  return { reassignedCount: clients.length };
}
```

---

## Appendix: Trade-offs & Deferred Features

This section documents design decisions where we chose simpler implementations for MVP, and features explicitly deferred to future iterations.

### Trade-offs Made for MVP

| Decision | Chosen Approach | Alternative Considered | Rationale |
|----------|----------------|------------------------|-----------|
| **AI Extraction Timing** | Post-call only | Real-time during call | Significantly reduces complexity, API costs, and avoids context-switching UX during calls. Full transcript context yields more accurate extractions. |
| **Confidence Thresholds** | Fixed (90/60) | Configurable per org or per field | Consistent UX across all orgs, simpler to support, avoids decision fatigue for admins. |
| **Form Selection Limit** | No limit | Max 3 forms per call | Trust case managers to be reasonable; artificial limits add friction without clear benefit. |
| **Caseload Tracking** | Simple client count | Weighted scoring by case complexity | Easy to understand and implement; weighted system adds complexity without proven value in MVP. |
| **Call Timer** | Count up only | Optional time targets with warnings | Less stressful for case managers; avoids pressure that could harm client relationships. |
| **Note Priority** | Tags (flexible) | Priority levels (Low/Normal/High) | Tags are more expressive and avoid rigid categorization. |
| **Phone Validation** | Format only (10 digits) | Carrier lookup via Twilio | Faster validation, no per-lookup costs; carrier info not essential for MVP. |
| **Conversation Guide Tracking** | No tracking | AI detection or manual check-off with analytics | Keeps MVP simple; tracking may feel like surveillance. Can add later if data proves valuable. |
| **AI Summary Sentiment** | No sentiment analysis | Overall tone indicator | Avoids subjective interpretation that could bias case managers or cause liability issues. |
| **Edit Approval Workflow** | Audit trail only | Admin approval required | Doesn't block case managers from making corrections; full edit history preserved for compliance. |
| **DB Connection Pooling** | Prisma built-in | PgBouncer on Railway | Simpler to start; can add PgBouncer later if connection limits become an issue. |
| **Monitoring** | AWS CloudWatch only | Full stack (Sentry + Datadog) | Sufficient for MVP; add Sentry when error patterns need deeper investigation. |
| **Dark Mode** | Light only | System preference or toggle | Focus on core features; add later as UX enhancement. |

### Features Explicitly Deferred

| Feature | Original Consideration | Deferral Reason | When to Revisit |
|---------|----------------------|-----------------|-----------------|
| **Transcript Search** | Full-text search of call transcripts | Not essential for core workflow; adds indexing complexity | When org feedback indicates need for historical transcript lookup |
| **AI Extraction Analytics Dashboard** | Track accuracy metrics, frequently corrected fields | Good feature but not critical for shipping MVP | After 3+ months of production data to analyze |
| **Client Templates** | Pre-fill common client types (Veteran, Senior) | Adds admin complexity; case managers can handle manually | When onboarding patterns are better understood |
| **Multi-Location Support** | Associate clients with org locations | Most early orgs are single-location; adds schema complexity | When multi-location org becomes a customer |
| **Scheduled Calls** | Calendar integration, automated reminders | External calendars work fine; significant engineering effort | If user research shows strong demand |
| **Voicemail Drop** | Pre-recorded or live voicemail on no-answer | Complex answering machine detection; case managers can use personal phones | Low priority unless heavily requested |
| **Action Items as Tasks** | Convert AI-identified actions to trackable tasks | Adds task management system; display-only is sufficient | When workflow management becomes a selling point |
| **Biometric Login (Mobile)** | Face ID/fingerprint authentication | Keep parity with web; simpler to maintain | When native mobile app is prioritized |
| **Phone Extensions** | Store and auto-dial extensions via DTMF | Adds complexity; most clients have direct numbers | If enterprise customers require it |
| **Multiple Concurrent Calls** | Allow hold + second call | Unrealistic for case management workflow | Only if specific use case emerges |
| **Real-Time AI Extraction** | Show fields populating during call | High complexity, cost, and potential UX issues | Post-MVP if user research strongly supports it |
| **Supervisor Role** | View hierarchy, see team's work | Two roles (Admin + Case Manager) sufficient for MVP | When larger org structure requires it |
| **Custom Client Statuses** | Org-defined status labels | Fixed set (Active, On Hold, Closed, Pending) keeps reporting consistent | If multiple orgs request customization |
| **Call Recording Voicemail** | Let case managers leave voicemails through system | Out of scope; use personal phones for now | Low priority feature |

### Infrastructure Decisions to Revisit

| Current State | Future Consideration | Trigger |
|---------------|---------------------|---------|
| **Prisma connection pooling** | Add PgBouncer on Railway | Connection exhaustion under load or serverless spikes |
| **CloudWatch only** | Add Sentry for error tracking | When debugging production errors becomes painful |
| **Single WebSocket server** | Multiple instances with Redis pub/sub | When concurrent call volume exceeds single server capacity |
| **Railway PostgreSQL** | Consider AWS RDS for full HIPAA control | If Railway BAA terms are insufficient for enterprise customers |

### Scope Boundaries Established

The following were discussed and explicitly decided as **out of scope** for this product:

1. **HIPAA Workforce Training** - Org responsibility, not in-app
2. **Device/Workstation Security** - Org responsibility
3. **Client Portal** - "Shareable" notes prep for future, not building portal now
4. **International Phone Numbers** - US only for MVP
5. **Video Calls** - Audio only; video transcription is different product
6. **SMS/Text Messaging** - Calls only for now
7. **Multi-Language Transcription** - English only for Deepgram initially (i18n framework ready for UI)

---

*End of Technical Specification*

*Prepared for Scrybe Solutions | Phoenixing LLC | January 2026*
