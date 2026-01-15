# Scrybe Solutions
## Workflow 1: Admin Creating an Intake Form
### Technical Specification
**Version 2.0 | January 2026**

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Step-by-Step Workflow](#step-by-step-workflow)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
6. [Security Implementation](#security-implementation)
7. [UI/UX Specifications](#uiux-specifications)
8. [AI Integration](#ai-integration)
9. [File Processing Pipeline](#file-processing-pipeline)
10. [Billing & Subscription](#billing--subscription)
11. [Accessibility & i18n](#accessibility--i18n)
12. [Audit & Compliance](#audit--compliance)
13. [Component Architecture](#component-architecture)
14. [Error Handling](#error-handling)
15. [Future: Mobile App](#future-mobile-app)

---

## Overview

Admins create intake forms through a guided wizard that captures not just the fields needed, but the context behind each field (grant compliance, outcome measurement, etc.). This context powers the AI's ability to extract the right information from call transcripts.

| Attribute | Value |
|-----------|-------|
| **Actors** | Admin, Program Manager (with permissions) |
| **Trigger** | Admin navigates to Forms section and clicks "Create New Form" |
| **Output** | Published form available for case managers to use during calls |

### Preconditions

- User is logged in with Admin or Program Manager role
- Organization has available form slots (based on subscription tier) OR pre-purchased form packs
- User has appropriate CRUD permissions for forms

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14+ | React framework with App Router |
| **UI Components** | Shadcn/ui + Tailwind CSS | Design system |
| **State Management** | Jotai | Atomic state for complex form builder state |
| **Drag & Drop** | dnd-kit | Field reordering and section organization |
| **Conditional Logic UI** | React Flow | Visual flowchart editor for field conditions |
| **Backend** | Next.js API Routes | REST API endpoints |
| **Database** | Railway PostgreSQL | Primary data store |
| **ORM** | Prisma | Type-safe database queries, SQL injection prevention |
| **Auth** | Supabase Auth | Authentication and session management |
| **Encryption** | Supabase Vault | Envelope encryption for sensitive field data |
| **Vector DB** | Supabase Vector (pgvector) | RAG storage for AI extraction examples |
| **File Storage** | Supabase Storage | File uploads with virus scanning |
| **Virus Scanning** | ClamAV (on-demand container) | Malware detection for uploads |
| **Address Autocomplete** | Radar | US address validation and autocomplete |
| **AI Extraction** | Claude API (Haiku) | Transcript data extraction |
| **Billing** | Stripe | Subscription management and form pack purchases |
| **Hosting** | Railway | Application deployment |

---

## Step-by-Step Workflow

### Step 1: Initiate Form Creation

#### User Flow
1. Admin clicks **"Create New Form"** button from Forms dashboard
2. System checks form slot availability via edge middleware
3. System displays form type selection screen
4. Admin selects form type:
   - **Intake Form** — Initial client enrollment
   - **Follow-up Form** — Ongoing case documentation
   - **Referral Form** — Transferring client to services
   - **Assessment Form** — Evaluations (ACES, Cal-VIP, etc.)
   - **Custom** — Organization-specific form type
5. Admin enters form name and optional description
6. System creates draft form and opens Form Builder Wizard

#### Technical Implementation

```typescript
// Middleware tier check (runs at edge)
// middleware.ts
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/forms')) {
    const session = await getSession(request);
    const org = await getOrgWithTier(session.orgId);

    if (request.method === 'POST') {
      const formCount = await getFormCount(session.orgId);
      const limit = TIER_LIMITS[org.tier].forms + org.purchasedFormPacks * 5;

      if (formCount >= limit) {
        return NextResponse.json(
          { error: 'Form limit reached', upgradeUrl: '/billing/form-packs' },
          { status: 402 }
        );
      }
    }
  }
}
```

**Auto-save Implementation:**
- Draft saved immediately on creation
- Auto-save every 30 seconds during editing
- Visual indicator: Icon that animates on save + "Last saved 2 min ago" timestamp
- LocalStorage backup for browser crash recovery

**Optimistic Locking:**
```typescript
interface FormDraft {
  id: string;
  version: number;  // Incremented on each save
  updatedAt: Date;
}

// On save attempt
async function saveForm(formId: string, data: FormData, clientVersion: number) {
  const serverForm = await prisma.form.findUnique({ where: { id: formId } });

  if (serverForm.version !== clientVersion) {
    throw new ConflictError({
      message: 'Form was modified by another session',
      serverVersion: serverForm.version,
      options: ['overwrite', 'reload']
    });
  }

  return prisma.form.update({
    where: { id: formId },
    data: { ...data, version: { increment: 1 } }
  });
}
```

---

### Step 2: Add Fields via Guided Wizard

#### User Flow
1. System prompts: *"What information do you need to collect?"*
2. Admin enters field name (e.g., "Date of Birth", "Current Address")
3. System displays **icon grid** with 12 field types
4. Admin selects field type
5. System prompts: *"Why do you need this information?"*
6. Admin selects purpose category
7. Admin configures field settings (required, sensitive, AI-extractable)
8. Admin clicks **"Add Field"**
9. System prompts: *"Add another field?"*

#### Field Types (Icon Grid UI)

| Type | Icon | Description | AI Extractable |
|------|------|-------------|----------------|
| Text (short) | `Aa` | Single line text input | Yes |
| Text (long) | `¶` | Paragraph/multi-line input | Yes |
| Number | `#` | Numeric values only | Yes |
| Date | `📅` | Date picker | Yes |
| Phone Number | `📞` | Formatted phone input | Yes |
| Email | `@` | Email with validation | Yes |
| Address | `📍` | Radar autocomplete (US only) | Yes |
| Dropdown | `▼` | Single select from options | Yes |
| Checkbox | `☑` | Multi-select from options | Yes |
| Yes/No | `⊘` | Boolean toggle | Yes |
| File Upload | `📎` | Document/image attachment | Limited* |
| Signature | `✍` | Digital signature capture | No |

*File Upload: PDF text extraction enables AI processing

#### Purpose Categories

| Category | Code | Description |
|----------|------|-------------|
| Grant/Funder Requirement | `grant_requirement` | Required for funding compliance |
| Internal Operations | `internal_ops` | Needed for day-to-day case management |
| Compliance/Legal | `compliance` | Required by law or regulation |
| Outcome Measurement | `outcome_measurement` | Tracks program effectiveness |
| Risk Assessment | `risk_assessment` | Identifies client risk factors |
| Other | `other` | Custom reason (free text input) |

#### Field Settings

| Setting | Type | Description |
|---------|------|-------------|
| Required | Boolean | Must be filled before submission |
| Sensitive | Boolean | Triggers audit logging on access |
| AI-Extractable | Boolean | Can be auto-filled from transcript |
| Help Text | Markdown | Instructions shown to case manager |

**Smart AI Validation Warnings:**
When admin toggles "AI-Extractable", system shows rule-based confidence:

```typescript
const AI_CONFIDENCE_RULES: Record<FieldType, { confidence: number; warning?: string }> = {
  signature: { confidence: 0, warning: 'Signatures cannot be extracted from audio' },
  file: { confidence: 20, warning: 'Only PDF text content can be extracted' },
  date: { confidence: 90 },
  phone: { confidence: 85 },
  email: { confidence: 85 },
  address: { confidence: 70, warning: 'Complex addresses may require manual review' },
  yes_no: { confidence: 80 },
  dropdown: { confidence: 75 },
  checkbox: { confidence: 70 },
  number: { confidence: 85 },
  text_short: { confidence: 80 },
  text_long: { confidence: 75 },
};
```

#### Dropdown/Checkbox Options

- **Manual entry**: Type options one by one
- **CSV import**: Upload CSV or paste comma-separated values
- **Hard limit**: Maximum 500 options per field
- Options stored as JSON array in field definition

---

### Step 3: Organize and Configure Form

#### User Flow
1. System displays all added fields in a list view
2. Admin uses **dnd-kit** drag-and-drop to reorder fields
3. Admin groups fields into sections (e.g., "Contact Information", "Demographics")
4. Admin adds section headers and instructions (Markdown supported)
5. Admin configures conditional logic via **React Flow** visual editor
6. Admin sets form-level settings

#### Conditional Logic (React Flow Visual Editor)

**Supported Operators:**
- Equals / Not Equals
- Contains / Does Not Contain
- Greater Than / Less Than (for numbers)
- Is Empty / Is Not Empty
- Before / After (for dates)

**Logic Groups:**
- AND conditions (all must be true)
- OR conditions (any must be true)
- Nested groups supported

```typescript
interface ConditionalLogic {
  id: string;
  targetFieldId: string;  // Field to show/hide
  action: 'show' | 'hide';
  groups: ConditionGroup[];
  operator: 'and' | 'or';  // Between groups
}

interface ConditionGroup {
  id: string;
  conditions: Condition[];
  operator: 'and' | 'or';  // Within group
}

interface Condition {
  fieldId: string;
  operator: ConditionOperator;
  value: string | number | boolean | null;
}
```

**Deletion Handling:**
When a field used in conditional logic is deleted:
1. System shows warning dialog listing affected conditions
2. If confirmed, dependent conditions are removed
3. Affected target fields become always-visible

#### Form-Level Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Allow Partial Saves | Boolean | true | Case manager can save incomplete form |
| Require Supervisor Review | Boolean | false | Submission requires approval |
| Auto-Archive Days | Number | null | Archive after X days of inactivity |
| Activity Triggers | Multi-select | - | What resets inactivity timer (configurable) |

**Activity Trigger Options:**
- New submissions
- Form edits
- Form views
- Any of the above (configurable by admin)

---

### Step 4: Preview Form

#### User Flow
1. Admin clicks **"Preview"** button
2. System displays form exactly as case managers will see it
3. Admin toggles between responsive breakpoints (actual responsive, not device frames)
4. Admin tests filling out form with **ephemeral** sample data (never saved)
5. Admin can add fields directly from preview UI (visual editor mode)
6. **Axe-core accessibility audit runs in real-time**, showing warnings inline
7. Admin clicks "Back to Edit" or "Continue"

#### Accessibility Audit (WCAG 2.1 AAA)

```typescript
// Real-time accessibility checking
import { axe, toHaveNoViolations } from 'jest-axe';

async function runAccessibilityAudit(formHtml: string): Promise<A11yReport> {
  const results = await axe(formHtml, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag2aaa'],
  });

  return {
    violations: results.violations,
    passes: results.passes,
    canPublish: results.violations.filter(v => v.impact === 'critical').length === 0
  };
}
```

**Audit Checks Include:**
- Color contrast ratios (7:1 for AAA)
- Keyboard navigation order
- Screen reader compatibility
- Focus indicators
- Form label associations
- Error message accessibility

---

### Step 5: Configure AI Extraction

#### User Flow
1. System auto-generates extraction prompt based on field configuration
2. Admin can view generated prompt (optional, advanced)
3. Admin adds **extraction examples** for complex fields (RAG-based)
4. Admin can adjust prompt guidance per field

#### AI Extraction Examples (RAG)

Any user with form edit permission can add examples.

```typescript
interface ExtractionExample {
  id: string;
  fieldId: string;
  transcriptSnippet: string;  // "my birthday is March 5th, 1990"
  extractedValue: string;     // "1990-03-05"
  embedding: number[];        // Vector embedding for RAG retrieval
  createdBy: string;
  createdAt: Date;
}
```

**Storage:** Supabase Vector (pgvector extension)

**Retrieval at Extraction Time:**
1. Compute embedding of transcript segment
2. Query similar examples from vector DB
3. Include top 3 most relevant examples in Claude prompt

#### Extraction Prompt Structure

```typescript
const generateExtractionPrompt = (form: Form, examples: ExtractionExample[]) => `
You are extracting structured data from a case management call transcript.

Form: ${form.name}
Purpose: ${form.description}

Fields to extract (in priority order):

${form.fields
  .filter(f => f.isAiExtractable)
  .sort((a, b) => (b.isRequired ? 1 : 0) - (a.isRequired ? 1 : 0))
  .map(field => `
### ${field.name}
- Type: ${field.type}
- Format: ${getFormatGuidance(field.type)}
- Context: ${field.purpose} - ${field.purposeNote || ''}
- Required: ${field.isRequired}
${examples.filter(e => e.fieldId === field.id).map(e => `
Example:
  Transcript: "${e.transcriptSnippet}"
  Extracted: ${e.extractedValue}
`).join('')}
`).join('\n')}

Return JSON with field slugs as keys. For fields you cannot confidently extract, use null.
Include a _confidence object with 0-100 scores for each field.
`;
```

---

### Step 6: Publish Form

#### User Flow
1. Admin clicks **"Publish Form"** button
2. System runs validation:
   - At least one field exists
   - Form has a name
   - All dropdown/checkbox fields have options defined
   - No orphaned conditional logic (referencing deleted fields)
3. If validation fails: Show issue list AND highlight fields inline
4. System prompts for access control configuration
5. Admin assigns teams/users with roles (View, Use, Edit)
6. Admin confirms publication
7. System publishes form, creates version snapshot
8. Form appears in case managers' form selection list

#### Form Access Control

```typescript
interface FormAccess {
  formId: string;
  granteeType: 'team' | 'user';
  granteeId: string;
  role: 'view' | 'use' | 'edit';
  grantedBy: string;
  grantedAt: Date;
}
```

**Roles:**
| Role | Permissions |
|------|-------------|
| View | Can see form definition in library |
| Use | Can fill out form for submissions |
| Edit | Can modify form structure and settings |

#### Version Management

On publish, system creates immutable version snapshot:

```typescript
// Audit table approach for versioning
interface FormVersion {
  id: string;
  formId: string;
  version: number;
  snapshot: JsonValue;  // Complete form state
  publishedBy: string;
  publishedAt: Date;
  aiExtractionPrompt: string;
}
```

**In-progress submissions continue on original version** — when form is updated, existing drafts complete with the version they started on.

---

## Data Models

### Core Tables (Prisma Schema)

```prisma
model Organization {
  id                  String   @id @default(uuid())
  name                String
  tier                Tier     @default(FREE)
  purchasedFormPacks  Int      @default(0)
  encryptionKeyId     String?  // Reference to Supabase Vault key
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  forms               Form[]
  users               User[]
  teams               Team[]
  formTemplates       FormTemplate[]
}

model Form {
  id                  String      @id @default(uuid())
  orgId               String
  name                String
  description         String?
  type                FormType
  status              FormStatus  @default(DRAFT)
  version             Int         @default(1)
  settings            Json        // FormSettings
  createdBy           String
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  archivedAt          DateTime?

  organization        Organization @relation(fields: [orgId], references: [id])
  fields              FormField[]
  versions            FormVersion[]
  access              FormAccess[]
  submissions         FormSubmission[]

  @@index([orgId, status])
}

model FormField {
  id                  String      @id @default(uuid())
  formId              String
  slug                String      // kebab-case, auto-generated with hash suffix
  name                String
  type                FieldType
  purpose             FieldPurpose
  purposeNote         String?     // For 'other' purpose
  helpText            String?     // Markdown
  isRequired          Boolean     @default(false)
  isSensitive         Boolean     @default(false)
  isAiExtractable     Boolean     @default(true)
  options             Json?       // For dropdown/checkbox
  section             String?
  order               Int
  conditionalLogic    Json?       // ConditionalLogic
  translations        Json?       // { [locale]: { name, helpText, options } }
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  form                Form        @relation(fields: [formId], references: [id], onDelete: Cascade)
  extractionExamples  ExtractionExample[]

  @@unique([formId, slug])
  @@index([formId, order])
}

model FormVersion {
  id                  String      @id @default(uuid())
  formId              String
  version             Int
  snapshot            Json        // Complete form state
  aiExtractionPrompt  String      @db.Text
  publishedBy         String
  publishedAt         DateTime    @default(now())

  form                Form        @relation(fields: [formId], references: [id])
  submissions         FormSubmission[]

  @@unique([formId, version])
}

model FormAccess {
  id                  String      @id @default(uuid())
  formId              String
  granteeType         GranteeType
  granteeId           String
  role                FormRole
  grantedBy           String
  grantedAt           DateTime    @default(now())

  form                Form        @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@unique([formId, granteeType, granteeId])
}

model ExtractionExample {
  id                  String      @id @default(uuid())
  fieldId             String
  transcriptSnippet   String      @db.Text
  extractedValue      String
  embedding           Unsupported("vector(1536)")?
  createdBy           String
  createdAt           DateTime    @default(now())

  field               FormField   @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@index([fieldId])
}

model FormTemplate {
  id                  String      @id @default(uuid())
  orgId               String?     // null = system template
  name                String
  description         String?
  tags                String[]
  thumbnail           String?     // URL
  useCaseExamples     String[]
  formSnapshot        Json
  isSystemTemplate    Boolean     @default(false)
  createdBy           String
  createdAt           DateTime    @default(now())
  usageCount          Int         @default(0)

  organization        Organization? @relation(fields: [orgId], references: [id])

  @@index([isSystemTemplate])
  @@index([orgId])
}

model AuditLog {
  id                  String      @id @default(uuid())
  orgId               String
  action              AuditAction
  resourceType        String
  resourceId          String
  actorId             String
  actorIp             String
  actorUserAgent      String
  sessionId           String
  geolocation         Json?       // { lat, lng, country, city } if permitted
  deviceFingerprint   String?
  metadata            Json?
  previousHash        String?     // Hash chain link
  hash                String      // SHA-256 of this entry
  createdAt           DateTime    @default(now())

  @@index([orgId, createdAt])
  @@index([resourceType, resourceId])
}

model FileUpload {
  id                  String      @id @default(uuid())
  orgId               String
  originalName        String
  storagePath         String
  mimeType            String
  sizeBytes           Int
  scanStatus          ScanStatus  @default(PENDING)
  scanResult          Json?
  scannedAt           DateTime?
  extractedText       String?     @db.Text  // PDF text extraction
  uploadedBy          String
  uploadedAt          DateTime    @default(now())

  @@index([scanStatus])
}

model Signature {
  id                  String      @id @default(uuid())
  submissionId        String
  fieldId             String
  imageData           Bytes       // PNG signature image
  timestamp           DateTime    @default(now())
  signerIp            String
  signerUserAgent     String
  signerSessionId     String
  geolocation         Json?
  deviceFingerprint   String?
  consentRecorded     Boolean     @default(true)
  documentHash        String?     // Hash of form at time of signing

  @@index([submissionId])
}

// Enums
enum Tier {
  FREE
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum FormType {
  INTAKE
  FOLLOWUP
  REFERRAL
  ASSESSMENT
  CUSTOM
}

enum FormStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum FieldType {
  TEXT_SHORT
  TEXT_LONG
  NUMBER
  DATE
  PHONE
  EMAIL
  ADDRESS
  DROPDOWN
  CHECKBOX
  YES_NO
  FILE
  SIGNATURE
}

enum FieldPurpose {
  GRANT_REQUIREMENT
  INTERNAL_OPS
  COMPLIANCE
  OUTCOME_MEASUREMENT
  RISK_ASSESSMENT
  OTHER
}

enum GranteeType {
  TEAM
  USER
}

enum FormRole {
  VIEW
  USE
  EDIT
}

enum AuditAction {
  SENSITIVE_FIELD_ACCESS
  FORM_CREATED
  FORM_PUBLISHED
  FORM_ARCHIVED
  SUBMISSION_CREATED
  // ... etc
}

enum ScanStatus {
  PENDING
  SCANNING
  CLEAN
  INFECTED
  ERROR
}
```

### Field Slug Generation

```typescript
import { nanoid } from 'nanoid';

function generateFieldSlug(name: string, existingSlugs: Set<string>): string {
  // Convert to kebab-case
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  // If unique, return as-is
  if (!existingSlugs.has(slug)) {
    return slug;
  }

  // Append short hash for uniqueness
  const hash = nanoid(4);
  return `${slug}-${hash}`;
}

// Examples:
// "Date of Birth" -> "date-of-birth"
// "Date of Birth" (conflict) -> "date-of-birth-a7b3"
```

---

## API Endpoints

### REST Resource Structure

```
/api/forms
  GET     - List forms (with pagination, filtering)
  POST    - Create new form

/api/forms/:id
  GET     - Get form by ID
  PATCH   - Update form
  DELETE  - Delete form (soft delete if has submissions)

/api/forms/:id/fields
  GET     - List fields
  POST    - Add field
  PATCH   - Reorder fields

/api/forms/:id/fields/:fieldId
  GET     - Get field
  PATCH   - Update field
  DELETE  - Delete field

/api/forms/:id/fields/:fieldId/examples
  GET     - List AI extraction examples
  POST    - Add example
  DELETE  - Remove example

/api/forms/:id/publish
  POST    - Publish form (creates version)

/api/forms/:id/versions
  GET     - List versions

/api/forms/:id/versions/:version
  GET     - Get specific version

/api/forms/:id/access
  GET     - List access grants
  POST    - Grant access
  DELETE  - Revoke access

/api/forms/:id/duplicate
  POST    - Duplicate form (full copy)

/api/forms/:id/export
  GET     - Export form (JSON or PDF)

/api/forms/import
  POST    - Import form from JSON (interactive preview)

/api/templates
  GET     - List templates (system + org)
  POST    - Create org template

/api/templates/:id
  GET     - Get template
  DELETE  - Delete template

/api/uploads
  POST    - Upload file (triggers virus scan queue)

/api/uploads/:id/status
  GET     - Check scan status
```

### Rate Limiting (Tiered by Plan)

```typescript
const RATE_LIMITS: Record<Tier, RateLimitConfig> = {
  FREE: { requests: 30, windowMs: 60000 },        // 30/min
  STARTER: { requests: 60, windowMs: 60000 },     // 60/min
  PROFESSIONAL: { requests: 120, windowMs: 60000 }, // 120/min
  ENTERPRISE: { requests: 300, windowMs: 60000 }, // 300/min
};
```

---

## Security Implementation

### Authentication & Session

- **Provider:** Supabase Auth with default session handling
- **Session Storage:** Supabase manages JWT tokens and refresh
- **CSRF Protection:** SameSite=Strict cookies + Origin header validation

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // Origin header validation
  const origin = request.headers.get('origin');
  const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL];

  if (request.method !== 'GET' && origin && !allowedOrigins.includes(origin)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ... rest of middleware
}
```

### Envelope Encryption (Supabase Vault)

Sensitive field data encrypted with per-org keys:

```typescript
import { createClient } from '@supabase/supabase-js';

// Create org encryption key on signup
async function createOrgEncryptionKey(orgId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase.rpc('vault.create_secret', {
    secret: crypto.randomUUID(), // The actual encryption key
    name: `org-key-${orgId}`,
    description: `Encryption key for organization ${orgId}`
  });

  return data.id; // Store this ID in organization record
}

// Encrypt sensitive field value
async function encryptSensitiveValue(value: string, orgKeyId: string): Promise<string> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: keyData } = await supabase.rpc('vault.decrypt_secret', {
    secret_id: orgKeyId
  });

  // Use org key to encrypt value with AES-256-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw',
    Buffer.from(keyData.decrypted_secret, 'hex'),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value)
  );

  return Buffer.concat([iv, new Uint8Array(encrypted)]).toString('base64');
}
```

### XSS Prevention

```typescript
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Strict HTML escaping for field names and options
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Markdown rendering for help text (sanitized)
function renderHelpText(markdown: string): string {
  const html = marked(markdown);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'code'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}
```

### Content Security Policy

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self';
      connect-src 'self' https://*.supabase.co https://api.radar.io https://api.anthropic.com;
      frame-ancestors 'none';
    `.replace(/\n/g, '')
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];
```

### Permission Checks

```typescript
// CRUD split permissions
interface FormPermissions {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPublish: boolean;
}

async function checkFormPermission(
  userId: string,
  formId: string,
  action: keyof FormPermissions
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: true } } }
  });

  // Check role-based permission
  const hasRolePermission = user.role.permissions.some(
    p => p.resource === 'forms' && p.action === action
  );

  if (!hasRolePermission) return false;

  // For read/update/delete, also check form-level access
  if (['canRead', 'canUpdate', 'canDelete'].includes(action)) {
    const access = await prisma.formAccess.findFirst({
      where: {
        formId,
        OR: [
          { granteeType: 'USER', granteeId: userId },
          { granteeType: 'TEAM', granteeId: { in: user.teamIds } }
        ]
      }
    });

    if (!access) return false;

    // Map role to allowed actions
    const roleActions: Record<FormRole, string[]> = {
      VIEW: ['canRead'],
      USE: ['canRead'],
      EDIT: ['canRead', 'canUpdate', 'canDelete', 'canPublish']
    };

    return roleActions[access.role].includes(action);
  }

  return true;
}
```

---

## UI/UX Specifications

### Form Builder Wizard (Linear Steps)

**Stepper Bar Component:**
```
[1. Setup] ─── [2. Add Fields] ─── [3. Organize] ─── [4. Preview] ─── [5. AI Config] ─── [6. Publish]
     ●              ○                   ○                ○                  ○               ○
```

- Linear progression: must complete step 1 before step 2
- Current step highlighted, completed steps show checkmark
- Step names visible in horizontal stepper bar

### Field Type Icon Grid

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │
│  │  Aa  │  │  ¶   │  │  #   │  │  📅  │  │  📞  │  │  @   │ │
│  │ Text │  │ Long │  │Number│  │ Date │  │Phone │  │Email │ │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘ │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │
│  │  📍  │  │  ▼   │  │  ☑   │  │  ⊘   │  │  📎  │  │  ✍   │ │
│  │Address│  │Select│  │Multi │  │Yes/No│  │ File │  │ Sign │ │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save form |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+N` | Add new field |

### Undo/Redo Implementation

- Session-based: 20 undo steps
- Cleared when leaving page
- No persistent undo panel, just Ctrl+Z/Y

### Save Status Indicator

```
[💾 Saving...]  →  [✓ Saved 2 min ago]
```

- Icon animates (spinner) during save
- Shows relative timestamp after save
- Updates every 30 seconds

### Validation Feedback

On publish validation failure:
1. Toast notification with summary
2. Issue list panel showing all problems
3. Inline field highlighting in editor
4. Click issue to scroll to field

### Responsive Preview

- Uses actual Tailwind breakpoints (sm, md, lg, xl)
- Browser resize simulation, not device frame mockups
- Toggle buttons: Desktop | Tablet | Mobile

---

## AI Integration

### Claude API Configuration

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function extractFormData(
  transcript: string,
  form: Form,
  examples: ExtractionExample[]
): Promise<ExtractionResult> {
  const prompt = generateExtractionPrompt(form, examples);

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',  // All fields use Haiku
    max_tokens: 4096,
    messages: [
      { role: 'user', content: `${prompt}\n\nTranscript:\n${transcript}` }
    ],
  });

  const result = JSON.parse(response.content[0].text);

  // Flag low confidence fields for manual review
  const flaggedFields = Object.entries(result._confidence)
    .filter(([_, score]) => score < 70)
    .map(([field]) => field);

  return {
    extractedData: result,
    flaggedForReview: flaggedFields,
    tokenUsage: response.usage,
  };
}
```

### RAG Example Retrieval

```typescript
import { createClient } from '@supabase/supabase-js';

async function getRelevantExamples(
  fieldId: string,
  transcriptSegment: string,
  limit: number = 3
): Promise<ExtractionExample[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Generate embedding for transcript segment
  const embedding = await generateEmbedding(transcriptSegment);

  // Query similar examples
  const { data } = await supabase.rpc('match_extraction_examples', {
    field_id: fieldId,
    query_embedding: embedding,
    match_count: limit,
    match_threshold: 0.7,
  });

  return data;
}

// Supabase function for similarity search
/*
CREATE OR REPLACE FUNCTION match_extraction_examples(
  field_id UUID,
  query_embedding VECTOR(1536),
  match_count INT,
  match_threshold FLOAT
)
RETURNS TABLE (
  id UUID,
  transcript_snippet TEXT,
  extracted_value TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.transcript_snippet,
    e.extracted_value,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM extraction_examples e
  WHERE e.field_id = match_extraction_examples.field_id
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
*/
```

### Confidence Flagging

When AI returns extraction results:
- Fields with confidence < 70 are flagged
- Case manager sees visual indicator (yellow warning icon)
- Flagged fields require manual review before submission

---

## File Processing Pipeline

### Upload Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌───────────┐
│ Upload  │ ──► │ Quarantine  │ ──► │ ClamAV Scan │ ──► │ Store or  │
│ Request │     │ (Supabase)  │     │ (On-demand) │     │ Reject    │
└─────────┘     └─────────────┘     └─────────────┘     └───────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │ If PDF:     │
                                    │ pdf-parse   │
                                    │ extraction  │
                                    └─────────────┘
```

### ClamAV On-Demand Container

```typescript
// When files are queued for scanning
async function scanFile(fileId: string): Promise<ScanResult> {
  // Spin up ClamAV container if not running
  const clamav = await ensureClamAvRunning();

  const file = await getQuarantinedFile(fileId);
  const result = await clamav.scanBuffer(file.buffer);

  if (result.isInfected) {
    await deleteQuarantinedFile(fileId);
    await logSecurityEvent('MALWARE_DETECTED', { fileId, virus: result.viruses });
    return { status: 'INFECTED', viruses: result.viruses };
  }

  // Move to permanent storage
  await moveToStorage(fileId);
  return { status: 'CLEAN' };
}
```

### Scan Failure Handling

If ClamAV is unavailable:
1. File remains in quarantine queue
2. Scan retried when service recovers
3. File not accessible until scanned clean

### Image Optimization

```typescript
import sharp from 'sharp';

async function optimizeImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
  // Keep original format, just compress
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const optimized = await image
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();

  return optimized;
}
```

### PDF Text Extraction

```typescript
import pdfParse from 'pdf-parse';

async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}
```

---

## Billing & Subscription

### Stripe Integration

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Subscription tiers
const TIER_PRODUCTS: Record<Tier, string> = {
  FREE: '', // No product
  STARTER: 'prod_starter123',
  PROFESSIONAL: 'prod_professional456',
  ENTERPRISE: 'prod_enterprise789',
};

// Form pack products (fixed tiers)
const FORM_PACKS: Record<number, string> = {
  5: 'prod_formpack5',   // 5 forms
  10: 'prod_formpack10', // 10 forms
  25: 'prod_formpack25', // 25 forms (best value)
};
```

### Form Limit Calculation

```typescript
function getFormLimit(org: Organization): number {
  const tierLimits: Record<Tier, number> = {
    FREE: 3,
    STARTER: 10,
    PROFESSIONAL: 50,
    ENTERPRISE: Infinity,
  };

  const baseLimit = tierLimits[org.tier];
  const packForms = org.purchasedFormPacks * 5; // Each pack = 5 forms

  return baseLimit + packForms;
}
```

### Purchase Flow

```typescript
async function purchaseFormPack(orgId: string, packSize: 5 | 10 | 25) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { billing: true }
  });

  const session = await stripe.checkout.sessions.create({
    customer: org.billing.stripeCustomerId,
    line_items: [{
      price: FORM_PACKS[packSize],
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.APP_URL}/billing/success?pack=${packSize}`,
    cancel_url: `${process.env.APP_URL}/billing/form-packs`,
    metadata: {
      orgId,
      packSize: packSize.toString(),
    }
  });

  return session.url;
}

// Webhook handler
async function handleFormPackPurchase(session: Stripe.Checkout.Session) {
  const { orgId, packSize } = session.metadata!;

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      purchasedFormPacks: { increment: parseInt(packSize) / 5 }
    }
  });
}
```

---

## Accessibility & i18n

### WCAG 2.1 AAA Compliance

**Real-time Axe-core Integration:**

```typescript
import { useEffect, useState } from 'react';
import axe from 'axe-core';

function useAccessibilityAudit(containerRef: RefObject<HTMLElement>) {
  const [violations, setViolations] = useState<axe.Result[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const runAudit = async () => {
      const results = await axe.run(containerRef.current!, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag2aaa'],
      });
      setViolations(results.violations);
    };

    // Debounced audit on form changes
    const timeout = setTimeout(runAudit, 500);
    return () => clearTimeout(timeout);
  }, [containerRef.current?.innerHTML]);

  return violations;
}
```

**Publish Blocking:**
- Critical violations block publish
- Moderate violations show warning, allow publish
- Minor violations informational only

### Internationalization (Inline Editing)

**Language Switcher in Form Builder:**

```typescript
interface FormBuilderState {
  currentLocale: string;
  availableLocales: string[];
}

function FieldEditor({ field, locale }: { field: FormField; locale: string }) {
  const translation = field.translations?.[locale] ?? {
    name: field.name,
    helpText: field.helpText,
    options: field.options,
  };

  return (
    <div>
      <Input
        label="Field Name"
        value={translation.name}
        onChange={(name) => updateTranslation(field.id, locale, { name })}
      />
      <Textarea
        label="Help Text"
        value={translation.helpText}
        onChange={(helpText) => updateTranslation(field.id, locale, { helpText })}
      />
      {/* Options editor for dropdown/checkbox */}
    </div>
  );
}
```

**Stored Translation Structure:**

```json
{
  "translations": {
    "es": {
      "name": "Fecha de Nacimiento",
      "helpText": "Ingrese su fecha de nacimiento",
      "options": ["Opción 1", "Opción 2"]
    },
    "fr": {
      "name": "Date de Naissance",
      "helpText": "Entrez votre date de naissance",
      "options": ["Option 1", "Option 2"]
    }
  }
}
```

---

## Audit & Compliance

### Hash-Chain Immutable Ledger

```typescript
import { createHash } from 'crypto';

async function createAuditEntry(entry: AuditEntry): Promise<void> {
  // Get previous entry hash
  const lastEntry = await prisma.auditLog.findFirst({
    where: { orgId: entry.orgId },
    orderBy: { createdAt: 'desc' },
  });

  const previousHash = lastEntry?.hash ?? 'GENESIS';

  // Create hash of current entry
  const entryData = JSON.stringify({
    ...entry,
    previousHash,
    timestamp: new Date().toISOString(),
  });

  const hash = createHash('sha256').update(entryData).digest('hex');

  await prisma.auditLog.create({
    data: {
      ...entry,
      previousHash,
      hash,
    }
  });
}
```

### Daily Integrity Verification (Cron)

```typescript
// Runs daily via Railway cron
async function verifyAuditChainIntegrity() {
  const orgs = await prisma.organization.findMany();

  for (const org of orgs) {
    const entries = await prisma.auditLog.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: 'asc' },
    });

    let expectedPreviousHash = 'GENESIS';

    for (const entry of entries) {
      // Verify chain link
      if (entry.previousHash !== expectedPreviousHash) {
        await triggerTamperAlert(org.id, entry.id, 'CHAIN_BREAK');
        break;
      }

      // Verify entry hash
      const computedHash = computeEntryHash(entry);
      if (entry.hash !== computedHash) {
        await triggerTamperAlert(org.id, entry.id, 'HASH_MISMATCH');
        break;
      }

      expectedPreviousHash = entry.hash;
    }
  }
}
```

### Tamper Alert (Incident Response)

```typescript
async function triggerTamperAlert(
  orgId: string,
  entryId: string,
  type: 'CHAIN_BREAK' | 'HASH_MISMATCH'
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { admins: true }
  });

  // 1. Auto-lock affected data
  await prisma.auditLog.updateMany({
    where: {
      orgId,
      createdAt: { gte: (await prisma.auditLog.findUnique({ where: { id: entryId } }))!.createdAt }
    },
    data: { locked: true }
  });

  // 2. Email notification
  await sendEmail({
    to: org.admins.map(a => a.email),
    subject: 'CRITICAL: Audit Log Tampering Detected',
    template: 'tamper-alert',
    data: { orgId, entryId, type }
  });

  // 3. In-app notification
  await createNotification({
    orgId,
    type: 'SECURITY_ALERT',
    severity: 'critical',
    message: 'Audit log integrity violation detected. Investigation required.'
  });

  // 4. Webhook to org endpoint (if configured)
  if (org.webhookUrl) {
    await fetch(org.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'audit.tamper_detected',
        orgId,
        entryId,
        type,
        timestamp: new Date().toISOString()
      })
    });
  }
}
```

### Sensitive Field Access Logging

Every access to a sensitive field is logged:

```typescript
async function accessSensitiveField(
  userId: string,
  fieldId: string,
  submissionId: string,
  request: Request
): Promise<void> {
  const geo = await getGeolocation(request); // If permitted

  await createAuditEntry({
    orgId: await getOrgId(userId),
    action: 'SENSITIVE_FIELD_ACCESS',
    resourceType: 'form_field',
    resourceId: fieldId,
    actorId: userId,
    actorIp: getClientIp(request),
    actorUserAgent: request.headers.get('user-agent') ?? '',
    sessionId: await getSessionId(request),
    geolocation: geo,
    deviceFingerprint: request.headers.get('x-device-fingerprint'),
    metadata: { submissionId }
  });
}
```

### Retention (7 Years)

```typescript
// Retention policy enforcement (monthly cron)
async function enforceRetentionPolicy() {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 7);

  // Archive to cold storage before deletion
  const expiredLogs = await prisma.auditLog.findMany({
    where: { createdAt: { lt: cutoffDate } }
  });

  if (expiredLogs.length > 0) {
    await archiveToColdStorage(expiredLogs);
    await prisma.auditLog.deleteMany({
      where: { id: { in: expiredLogs.map(l => l.id) } }
    });
  }
}
```

### Compliance Report Export

```typescript
async function generateComplianceReport(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const logs = await prisma.auditLog.findMany({
    where: {
      orgId,
      createdAt: { gte: startDate, lte: endDate }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Generate PDF report with:
  // - Executive summary
  // - Access statistics
  // - Sensitive field access breakdown
  // - Chain integrity status
  // - Full log table (appendix)

  const pdfDoc = await generatePdfReport({
    title: 'Compliance Audit Report',
    org: await prisma.organization.findUnique({ where: { id: orgId } }),
    dateRange: { start: startDate, end: endDate },
    logs,
    summary: calculateSummaryStats(logs),
    chainIntegrity: await verifyChainIntegrity(orgId, startDate, endDate)
  });

  return pdfDoc;
}
```

---

## Component Architecture

### Jotai State Structure

```typescript
import { atom } from 'jotai';

// Form state atoms
export const formAtom = atom<Form | null>(null);
export const fieldsAtom = atom<FormField[]>([]);
export const currentStepAtom = atom<WizardStep>('setup');
export const selectedFieldAtom = atom<string | null>(null);
export const undoStackAtom = atom<FormState[]>([]);
export const redoStackAtom = atom<FormState[]>([]);
export const currentLocaleAtom = atom<string>('en');
export const validationErrorsAtom = atom<ValidationError[]>([]);
export const a11yViolationsAtom = atom<A11yViolation[]>([]);
export const saveStatusAtom = atom<'idle' | 'saving' | 'saved' | 'error'>('idle');
export const lastSavedAtom = atom<Date | null>(null);

// Derived atoms
export const canPublishAtom = atom((get) => {
  const errors = get(validationErrorsAtom);
  const a11y = get(a11yViolationsAtom);
  const criticalA11y = a11y.filter(v => v.impact === 'critical');
  return errors.length === 0 && criticalA11y.length === 0;
});

export const formWithFieldsAtom = atom((get) => {
  const form = get(formAtom);
  const fields = get(fieldsAtom);
  return form ? { ...form, fields } : null;
});
```

### Component Tree

```
FormBuilder/
├── WizardStepper           # Horizontal step indicator
├── WizardContent           # Current step content
│   ├── SetupStep           # Form name, type, description
│   ├── FieldsStep          # Add fields wizard
│   │   ├── FieldTypeGrid   # Icon grid selector
│   │   ├── FieldForm       # Field configuration form
│   │   └── FieldList       # Added fields (dnd-kit)
│   ├── OrganizeStep        # Reorder, sections, logic
│   │   ├── SectionManager  # Section headers
│   │   ├── DragDropList    # Field reordering
│   │   └── LogicEditor     # React Flow editor
│   ├── PreviewStep         # Form preview
│   │   ├── ResponsiveToggle
│   │   ├── FormPreview     # Rendered form
│   │   └── A11yPanel       # Accessibility violations
│   ├── AiConfigStep        # AI extraction config
│   │   ├── PromptViewer    # Generated prompt
│   │   └── ExamplesManager # RAG examples
│   └── PublishStep         # Access control, publish
│       ├── AccessManager   # Team/user/role grants
│       └── ValidationPanel # Errors and warnings
├── SaveIndicator           # Auto-save status
├── UndoRedoButtons         # Ctrl+Z/Y controls
└── KeyboardShortcuts       # Shortcut handler
```

### dnd-kit Setup

```typescript
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

function FieldList() {
  const [fields, setFields] = useAtom(fieldsAtom);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id);
      const newIndex = fields.findIndex(f => f.id === over.id);

      const newFields = arrayMove(fields, oldIndex, newIndex)
        .map((f, i) => ({ ...f, order: i }));

      setFields(newFields);
      saveFieldOrder(newFields);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={fields} strategy={verticalListSortingStrategy}>
        {fields.map(field => (
          <SortableFieldCard key={field.id} field={field} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### React Flow Logic Editor

```typescript
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
} from 'reactflow';

interface LogicNode extends Node {
  data: {
    type: 'field' | 'condition' | 'action';
    config: ConditionConfig | ActionConfig;
  };
}

function LogicEditor({ field }: { field: FormField }) {
  const [fields] = useAtom(fieldsAtom);
  const [nodes, setNodes] = useState<LogicNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Convert conditional logic to nodes/edges
  useEffect(() => {
    if (field.conditionalLogic) {
      const { nodes, edges } = logicToFlow(field.conditionalLogic, fields);
      setNodes(nodes);
      setEdges(edges);
    }
  }, [field.conditionalLogic]);

  // Custom node types
  const nodeTypes = useMemo(() => ({
    field: FieldNode,
    condition: ConditionNode,
    action: ActionNode,
  }), []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={handleConnect}
    >
      <Controls />
      <Background />
    </ReactFlow>
  );
}
```

---

## Error Handling

### Toast Notifications

```typescript
import { toast } from 'sonner';

// API error handler
async function handleApiError(error: unknown) {
  if (error instanceof ConflictError) {
    toast.error('Form was modified by another session', {
      action: {
        label: 'Reload',
        onClick: () => window.location.reload()
      }
    });
    return;
  }

  if (error instanceof ValidationError) {
    toast.error('Validation failed', {
      description: error.message
    });
    return;
  }

  // Generic error
  toast.error('Something went wrong', {
    description: 'Please try again or contact support'
  });
}

// Auto-save error
function handleAutoSaveError(error: unknown) {
  toast.error('Failed to save', {
    description: 'Your changes are backed up locally. Retrying...',
    duration: 5000
  });

  // Retry with exponential backoff
  scheduleRetry();
}
```

### LocalStorage Recovery

```typescript
const STORAGE_KEY = 'scrybe_form_draft';

// Save to localStorage on every state change
function useLocalStorageBackup() {
  const [formWithFields] = useAtom(formWithFieldsAtom);

  useEffect(() => {
    if (formWithFields) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        formId: formWithFields.id,
        data: formWithFields,
        savedAt: new Date().toISOString()
      }));
    }
  }, [formWithFields]);
}

// Check for recovery on load
function useRecoveryCheck() {
  const [, setForm] = useAtom(formAtom);
  const [, setFields] = useAtom(fieldsAtom);

  useEffect(() => {
    const backup = localStorage.getItem(STORAGE_KEY);
    if (!backup) return;

    const { formId, data, savedAt } = JSON.parse(backup);

    // Offer recovery if backup is newer than server
    toast.info('Recovered unsaved changes', {
      description: `From ${formatRelativeTime(savedAt)}`,
      action: {
        label: 'Restore',
        onClick: () => {
          setForm(data);
          setFields(data.fields);
          localStorage.removeItem(STORAGE_KEY);
        }
      },
      cancel: {
        label: 'Discard',
        onClick: () => localStorage.removeItem(STORAGE_KEY)
      }
    });
  }, []);
}
```

---

## Future: Mobile App

### React Native Architecture

For future mobile app (view-only for form builder, full form filling):

```typescript
// Shared business logic via packages
packages/
├── core/           # Types, validation, utilities
├── api-client/     # API wrapper, React Query hooks
├── form-renderer/  # Form display components

apps/
├── web/            # Next.js web app
└── mobile/         # React Native app
```

**Form Builder:** View-only on mobile, redirects to web for editing

**Form Filling:** Full feature parity with web for case managers in field

**Offline Capability:** Form filling works offline for future enhancement

---

## Form Templates

### Template Catalog Structure

```typescript
interface FormTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];           // ['intake', 'housing', 'grant-compliant']
  thumbnail: string;        // Preview image URL
  useCaseExamples: string[]; // When to use this template
  formSnapshot: Form;       // Complete form definition
  isSystemTemplate: boolean;
  createdBy: string;
  usageCount: number;
}
```

### Super Admin Template Submission

Super admins can publish org templates to system library:
- Auto-approved (no review queue)
- Template appears immediately in system library
- All orgs can access and use

### Template from Form

When saving form as org template:
1. Full copy including AI examples
2. Admin enters: name, description, tags, thumbnail, use case examples
3. Template available only to org users

---

## Export/Import

### JSON Export

```typescript
interface FormExport {
  version: '1.0';
  exportedAt: string;
  form: {
    name: string;
    type: FormType;
    description?: string;
    settings: FormSettings;
    fields: ExportedField[];
  };
}

interface ExportedField {
  slug: string;
  name: string;
  type: FieldType;
  purpose: FieldPurpose;
  purposeNote?: string;
  helpText?: string;
  isRequired: boolean;
  isSensitive: boolean;
  isAiExtractable: boolean;
  options?: string[];
  section?: string;
  order: number;
  conditionalLogic?: ConditionalLogic;
  translations?: Record<string, FieldTranslation>;
  // AI examples NOT exported (org-specific)
}
```

### Interactive Import

1. Upload JSON file
2. System parses and validates against schema
3. Shows preview with field list
4. Runs publish validation rules
5. Admin can modify before confirming
6. Creates new form from import

### PDF Export (Printable Form)

Generates visual representation of form as it would appear to fill out:
- Headers and sections
- Field labels and help text
- Empty input boxes
- Checkbox/dropdown options listed
- Suitable for printing or offline reference

---

## eSign Implementation (In-House)

### ESIGN/UETA Compliance

```typescript
interface SignatureRecord {
  id: string;
  submissionId: string;
  fieldId: string;

  // Signature image
  imageData: Buffer;      // PNG
  imageHash: string;      // SHA-256 of image

  // Timestamp
  timestamp: Date;

  // Signer identification (Enhanced)
  signerIp: string;
  signerUserAgent: string;
  signerSessionId: string;
  geolocation?: {
    lat: number;
    lng: number;
    accuracy: number;
    country: string;
    city: string;
  };
  deviceFingerprint: string;

  // Consent
  consentRecorded: true;
  consentText: string;    // What they agreed to

  // Document state
  documentHash: string;   // Hash of form data at signing time
}
```

### Signature Capture UI

```typescript
function SignatureField({ field, onSign }: SignatureFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agreed, setAgreed] = useState(false);

  async function handleSign() {
    if (!agreed) {
      toast.error('Please agree to the terms before signing');
      return;
    }

    const imageData = canvasRef.current!.toDataURL('image/png');
    const geo = await requestGeolocation(); // With permission

    onSign({
      imageData,
      geolocation: geo,
      deviceFingerprint: await getDeviceFingerprint(),
      consentRecorded: true,
    });
  }

  return (
    <div>
      <canvas ref={canvasRef} className="border rounded" />
      <label>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        I agree that this signature constitutes my legal signature
      </label>
      <Button onClick={handleSign} disabled={!agreed}>
        Sign
      </Button>
    </div>
  );
}
```

---

## Address Autocomplete (Radar)

### Integration

```typescript
import Radar from 'radar-sdk-js';

Radar.initialize(process.env.NEXT_PUBLIC_RADAR_KEY!);

function AddressField({ value, onChange }: AddressFieldProps) {
  const [suggestions, setSuggestions] = useState<RadarAddress[]>([]);

  async function handleInputChange(query: string) {
    if (query.length < 3) return;

    const result = await Radar.autocomplete({
      query,
      country: 'US', // US only
      limit: 5,
    });

    setSuggestions(result.addresses);
  }

  function handleSelect(address: RadarAddress) {
    onChange({
      street: address.addressLabel,
      city: address.city,
      state: address.state,
      zip: address.postalCode,
      formatted: address.formattedAddress,
      coordinates: {
        lat: address.latitude,
        lng: address.longitude,
      }
    });
  }

  return (
    <Combobox value={value} onChange={handleSelect}>
      <Combobox.Input onChange={(e) => handleInputChange(e.target.value)} />
      <Combobox.Options>
        {suggestions.map(addr => (
          <Combobox.Option key={addr.placeId} value={addr}>
            {addr.formattedAddress}
          </Combobox.Option>
        ))}
      </Combobox.Options>
    </Combobox>
  );
}
```

---

*End of Technical Specification*

*Prepared for Scrybe Solutions | Phoenixing LLC | January 2026*
