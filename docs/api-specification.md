# Scrybe Solutions - API Specification

## Overview

This document provides comprehensive API specifications for Scrybe Solutions, covering both Spec-1 (Form Builder) and Spec-2 (Client & Call Management) implementations.

**Base URL:** `/api`
**Authentication:** Supabase Auth (JWT Bearer Token)
**Content-Type:** `application/json`

---

## Authentication

All API endpoints require authentication via Supabase Auth session.

```typescript
// Request headers
{
  "Authorization": "Bearer <supabase_access_token>",
  "Content-Type": "application/json"
}
```

---

## Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;      // Error code (e.g., "NOT_FOUND", "FORBIDDEN")
    message: string;   // Human-readable message
  };
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Spec-2: Client Management API

### List Clients

```
GET /api/clients
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: ACTIVE, ON_HOLD, CLOSED, PENDING |
| `assignedTo` | string | Filter by assigned user ID |
| `search` | string | Search in name/phone/email |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |

**Response:**

```typescript
{
  success: true,
  data: {
    clients: Client[],
    pagination: {
      total: number,
      page: number,
      limit: number,
      totalPages: number
    }
  }
}
```

### Create Client

```
POST /api/clients
```

**Request Body:**

```typescript
{
  firstName: string;        // Required
  lastName: string;         // Required
  phone: string;            // Required, 10 digits
  email?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    formatted?: string;
    coordinates?: { lat: number; lng: number };
  };
  additionalPhones?: Array<{ number: string; label: string }>;
  internalId?: string;
  status?: ClientStatus;    // Default: ACTIVE
  assignedTo?: string;      // Default: current user
}
```

**Response:**

```typescript
{
  success: true,
  data: Client
}
```

### Get Client

```
GET /api/clients/:clientId
```

**Response:**

```typescript
{
  success: true,
  data: Client & {
    _count: {
      calls: number;
      notes: number;
      formSubmissions: number;
    }
  }
}
```

### Update Client

```
PATCH /api/clients/:clientId
```

**Request Body:** Partial client fields

**Response:**

```typescript
{
  success: true,
  data: Client
}
```

### Delete Client

```
DELETE /api/clients/:clientId
```

Performs soft delete (sets `deletedAt` timestamp).

**Response:**

```typescript
{
  success: true,
  data: { id: string }
}
```

### Check Duplicate

```
POST /api/clients/check-duplicate
```

**Request Body:**

```typescript
{
  phone: string;
  firstName: string;
  lastName: string;
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    hasDuplicates: boolean,
    matches: Array<{
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      score: number;
      matchType: 'exact_phone' | 'fuzzy_name' | 'phonetic';
    }>
  }
}
```

### Get Client Calls

```
GET /api/clients/:clientId/calls
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by call status |
| `limit` | number | Max results (default: 20) |

**Response:**

```typescript
{
  success: true,
  data: Call[]
}
```

### Get Client Notes

```
GET /api/clients/:clientId/notes
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by INTERNAL or SHAREABLE |
| `callId` | string | Filter by linked call |

**Response:**

```typescript
{
  success: true,
  data: Note[]
}
```

### Create Client Note

```
POST /api/clients/:clientId/notes
```

**Request Body:**

```typescript
{
  content: string;          // Required, max 10000 chars
  type?: NoteType;          // Default: INTERNAL
  callId?: string;          // Optional call link
  tags?: string[];
  isDraft?: boolean;        // Default: false
}
```

**Response:**

```typescript
{
  success: true,
  data: Note
}
```

---

## Spec-2: Call Management API

### Initiate Call

```
POST /api/calls
```

**Request Body:**

```typescript
{
  clientId: string;         // Required
  formIds: string[];        // Required, forms to use
  phoneNumber?: string;     // Override client's primary phone
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    callId: string,
    twilioCallSid: string,
    status: CallStatus
  }
}
```

### Get Call

```
GET /api/calls/:callId
```

**Response:**

```typescript
{
  success: true,
  data: Call & {
    client: {
      id: string;
      firstName: string;
      lastName: string;
    };
    caseManager: {
      id: string;
      name: string;
    };
  }
}
```

### Update Call

```
PATCH /api/calls/:callId
```

**Request Body:**

```typescript
{
  status?: CallStatus;
  formIds?: string[];
  endedAt?: string;         // ISO date string
}
```

### End Call

```
POST /api/calls/:callId/end
```

Ends the call and triggers processing.

**Response:**

```typescript
{
  success: true,
  data: {
    callId: string,
    status: 'COMPLETED',
    durationSeconds: number
  }
}
```

### Get Call Transcript

```
GET /api/calls/:callId/transcript
```

**Response:**

```typescript
{
  success: true,
  data: {
    raw: string,
    formatted: string,
    segments: TranscriptSegment[],
    clientStatements: string,
    duration: number,
    wordCount: number
  }
}

interface TranscriptSegment {
  speaker: 'CASE_MANAGER' | 'CLIENT' | 'UNCERTAIN';
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}
```

### Get Call Recording

```
GET /api/calls/:callId/recording
```

Returns a pre-signed URL for the recording (15-minute expiry).

**Response:**

```typescript
{
  success: true,
  data: {
    url: string,
    expiresAt: string       // ISO date
  }
}
```

### Trigger Call Processing

```
POST /api/calls/:callId/process
```

**Request Body:**

```typescript
{
  mode?: 'full' | 'extract' | 'summary';  // Default: 'full'
  formIds?: string[];       // For 'extract' mode
}
```

**Modes:**
- `full`: Transcription + extraction + summary
- `extract`: Re-extract fields (requires existing transcript)
- `summary`: Regenerate summary (requires existing transcript)

**Response:**

```typescript
{
  success: true,
  data: {
    callId: string,
    hasTranscript: boolean,
    extractedFieldCount: number,
    hasSummary: boolean
  }
}
```

---

## Spec-2: Twilio Webhooks

### Voice Webhook

```
POST /api/webhooks/twilio/voice
```

Handles incoming Twilio voice events. Returns TwiML response.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `callId` | string | Internal call ID |
| `orgId` | string | Organization ID |

### Status Callback

```
POST /api/webhooks/twilio/status
```

Handles call status updates from Twilio.

**Form Data:**

| Field | Description |
|-------|-------------|
| `CallSid` | Twilio call SID |
| `CallStatus` | Current status |
| `CallDuration` | Duration in seconds |

### Recording Callback

```
POST /api/webhooks/twilio/recording
```

Handles recording completion notifications.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `callId` | string | Internal call ID |
| `orgId` | string | Organization ID |

**Form Data:**

| Field | Description |
|-------|-------------|
| `RecordingUrl` | URL to recording |
| `RecordingSid` | Twilio recording SID |
| `RecordingStatus` | Recording status |
| `RecordingDuration` | Duration in seconds |

---

## Spec-2: Background Jobs API

### Process Pending Calls

```
POST /api/jobs/process-calls
```

Processes all pending calls in the queue. Protected by API key.

**Headers:**

```
Authorization: Bearer <JOBS_API_KEY>
```

**Response:**

```typescript
{
  success: true,
  data: {
    processed: number,
    failed: number,
    errors: Array<{ callId: string; error: string }>
  }
}
```

### Health Check

```
GET /api/jobs/process-calls
```

**Response:**

```typescript
{
  status: 'ok',
  job: 'process-calls',
  description: 'Processes pending call recordings...'
}
```

---

## Data Types

### Client

```typescript
interface Client {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  phone: string;
  additionalPhones: Array<{ number: string; label: string }> | null;
  email: string | null;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    formatted?: string;
    coordinates?: { lat: number; lng: number };
  } | null;
  internalId: string | null;
  status: ClientStatus;
  assignedTo: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

enum ClientStatus {
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  CLOSED = 'CLOSED',
  PENDING = 'PENDING'
}
```

### Call

```typescript
interface Call {
  id: string;
  clientId: string;
  caseManagerId: string;
  formIds: string[];
  status: CallStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  twilioCallSid: string | null;
  recordingUrl: string | null;
  recordingRetention: string | null;
  transcriptRaw: string | null;
  transcriptJson: TranscriptSegment[] | null;
  aiSummary: CallSummary | null;
  extractedFields: Record<string, unknown> | null;
  confidenceScores: Record<string, number> | null;
  manualCorrections: FieldCorrection[] | null;
  aiProcessingStatus: ProcessingStatus;
  aiProcessingError: string | null;
  aiProcessingRetries: number;
  createdAt: string;
  updatedAt: string;
}

enum CallStatus {
  INITIATING = 'INITIATING',
  RINGING = 'RINGING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
  ATTEMPTED = 'ATTEMPTED',
  FAILED = 'FAILED'
}

enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  QUEUED_FOR_RETRY = 'QUEUED_FOR_RETRY'
}
```

### Note

```typescript
interface Note {
  id: string;
  clientId: string;
  callId: string | null;
  authorId: string;
  type: NoteType;
  content: string;
  tags: string[];
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

enum NoteType {
  INTERNAL = 'INTERNAL',
  SHAREABLE = 'SHAREABLE'
}
```

### CallSummary

```typescript
interface CallSummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  nextSteps: string[];
  clientSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  topics: string[];
}
```

### TranscriptSegment

```typescript
interface TranscriptSegment {
  speaker: 'CASE_MANAGER' | 'CLIENT' | 'UNCERTAIN';
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}
```

### ConfidenceBreakdown

```typescript
interface ConfidenceBreakdown {
  overall: number;              // 0-100
  factors: {
    directStatement: number;    // Weight: 40%
    contextMatch: number;       // Weight: 30%
    formatValidation: number;   // Weight: 20%
    multipleConfirmations: number; // Weight: 10%
  };
  level: 'high' | 'medium' | 'low';
  needsReview: boolean;
}
```

---

## Rate Limiting

API requests are rate-limited based on subscription tier:

| Tier | Requests/Minute |
|------|-----------------|
| FREE | 30 |
| STARTER | 60 |
| PROFESSIONAL | 120 |
| ENTERPRISE | 300 |

Rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1704067200
```

---

## Pagination

List endpoints support pagination:

```typescript
// Request
GET /api/clients?page=2&limit=20

// Response
{
  success: true,
  data: {
    clients: [...],
    pagination: {
      total: 150,
      page: 2,
      limit: 20,
      totalPages: 8
    }
  }
}
```

---

## Webhooks Security

Twilio webhooks are validated using signature verification:

```typescript
// In production, all Twilio webhooks verify X-Twilio-Signature header
const isValid = validateTwilioWebhook(
  signature,    // X-Twilio-Signature header
  url,          // Full request URL
  params        // Request body as key-value pairs
);
```

---

## HIPAA Compliance Notes

1. **Recording URLs**: Pre-signed URLs expire after 15 minutes
2. **S3 Storage**: All recordings encrypted with SSE-KMS
3. **Audit Logging**: All sensitive data access is logged
4. **Transcript Access**: Requires authentication and org membership
5. **Retention**: Recordings deleted per org policy (default: 30 days)
