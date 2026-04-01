# Recording Offline Resilience - Technical Implementation

## Overview

This document covers the technical implementation of offline resilience for in-person conversation recordings, ensuring audio data survives device failures, network issues, and browser crashes.

---

## Processing Pipeline - Missing Recording Handling

### Problem

The conversation processing pipeline would retry indefinitely when a recording didn't exist in S3, eventually marking the conversation as `FAILED` with no user recourse.

### Solution

Added a pre-flight check that verifies the recording exists before processing.

**File:** `apps/web/src/lib/services/conversation-processing.ts`

**Constants:**
```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;                    // 5s for normal errors
const UPLOAD_WAIT_DELAY_MS = 30000;             // 30s for "not yet uploaded"
const PRESIGNED_URL_VALID_DURATION_MS = 3600000; // 1 hour
```

**Flow:**
```
processConversation(id)
       ↓
  Fetch conversation
       ↓
  Check S3 existence ─── exists ──→ Continue to transcription
       │
   not exists
       ↓
  Check upload window
       │
   ┌───┴───┐
 valid   expired
   ↓        ↓
 Throw   Mark EXPIRED
 error   Return failure
   ↓
 Retry with 30s delay
```

**Error Handling:**
```typescript
class RecordingNotYetUploadedError extends Error {
  name = "RecordingNotYetUploadedError";
}

// In catch block:
const isUploadPending = error instanceof RecordingNotYetUploadedError;
const delayMs = isUploadPending ? UPLOAD_WAIT_DELAY_MS : RETRY_DELAY_MS * retries;
```

### S3 Error Handling

**File:** `apps/web/src/lib/storage/s3.ts`

Fixed `recordingExists()` to handle both AWS error types:
```typescript
export async function recordingExists(key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const errorName = (error as { name?: string }).name;
    if (errorName === "NotFound" || errorName === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}
```

### Behavior Matrix

| Recording State | Upload Window | Action | Final Status |
|-----------------|---------------|--------|--------------|
| Exists in S3 | N/A | Process normally | COMPLETED/REVIEW |
| Missing | Open (< 1hr) | Retry with 30s delay | Depends on outcome |
| Missing | Expired (> 1hr) | Stop immediately | EXPIRED |
| Missing | Expired, max retries | Stop | FAILED |

---

## Components

### 1. IndexedDB Storage (Dexie.js)

**Location:** `apps/web/src/lib/recording/offline-db.ts`

Uses Dexie.js (IndexedDB wrapper) with two object stores:

```typescript
// Database schema
class RecordingDB extends Dexie {
  chunks!: Table<RecordingChunk, string>;
  sessions!: Table<RecordingSession, string>;

  constructor() {
    super("InkraRecordings");
    this.version(1).stores({
      chunks: "id, conversationId, chunkIndex, uploaded",
      sessions: "conversationId, status",
    });
  }
}
```

**Key Functions:**
- `startSession()` - Create new recording session
- `saveChunk()` - Store audio chunk with deduplication
- `getChunks()` - Retrieve all chunks for a session (sorted)
- `concatenateChunks()` - Combine chunks into single Blob
- `deleteSession()` - Remove session and all chunks
- `cleanupOldSessions()` - Purge sessions older than 7 days

**Storage Limits:**
- ~150KB per 10-second chunk (128kbps audio)
- ~54MB for 1-hour recording
- IndexedDB typically allows 50-100MB per origin

### 2. S3 Multipart Upload

**Location:** `apps/web/src/lib/storage/multipart-s3.ts`

Server-side functions using AWS SDK v3:

```typescript
// Initiate upload
initiateMultipartUpload(key: string, contentType: string)
// Returns: { uploadId, key }

// Generate presigned URL for part
getPartUploadUrl(key: string, uploadId: string, partNumber: number)
// Returns: { presignedUrl, partNumber }

// Complete upload (assemble parts)
completeMultipartUpload(key: string, uploadId: string, parts: CompletedPartInfo[])
// Returns: { location, key }

// Abort failed upload
abortMultipartUpload(key: string, uploadId: string)

// List already-uploaded parts (for resume)
listUploadedParts(key: string, uploadId: string)
// Returns: CompletedPartInfo[]
```

**Configuration:**
- Part size: 5MB (S3 minimum)
- Presigned URL expiry: 1 hour
- S3 multipart expiry: 7 days (default)

### 3. Client-Side Chunked Upload

**Location:** `apps/web/src/lib/recording/chunked-upload.ts`

Handles chunking and upload with retry logic:

```typescript
async function chunkedUpload(config: {
  conversationId: string;
  blob: Blob;
  contentType?: string;
  onProgress?: (progress: ChunkedUploadProgress) => void;
  signal?: AbortSignal;
}): Promise<ChunkedUploadResult>
```

**Features:**
- Automatic chunking at 5MB boundaries
- 3 retries per part with exponential backoff
- Progress tracking per part
- Abort support via AbortSignal
- Automatic cleanup on failure

**Threshold:** Files >10MB use chunked upload

### 4. Service Worker

**Location:** `apps/web/public/recording-sw.js`

Handles background sync for upload recovery:

```javascript
self.addEventListener("sync", (event) => {
  if (event.tag.startsWith("upload-recording-")) {
    const conversationId = event.tag.replace("upload-recording-", "");
    event.waitUntil(handleRecordingUpload(conversationId));
  }
});
```

**Capabilities:**
- Background Sync API (Chrome/Edge only)
- Reads from IndexedDB directly
- Posts messages to clients on completion
- Handles PING/GET_VERSION messages

**Registration:** `apps/web/src/lib/recording/service-worker.ts`

```typescript
// Register SW
registerServiceWorker(): Promise<ServiceWorkerRegistration | null>

// Register sync for upload
registerRecordingSync(conversationId: string): Promise<boolean>

// Check for pending syncs
hasPendingSync(conversationId: string): Promise<boolean>

// Online event fallback
onOnline(callback: () => void): () => void
```

### 5. React Hook

**Location:** `apps/web/src/hooks/useRecordingPersistence.ts`

Unified interface for persistence operations:

```typescript
const {
  isAvailable,           // boolean - IndexedDB supported and enabled
  saveAudioChunk,        // (blob, chunkIndex) => Promise<void>
  startPersistence,      // () => Promise<void>
  stopPersistence,       // (uploadNow?: boolean) => Promise<void>
  recoverPendingUploads, // () => Promise<void>
  getPendingCount,       // () => Promise<number>
} = useRecordingPersistence(config);
```

**Lifecycle:**
1. On mount: Register service worker, check for pending sessions
2. On recording start: Call `startPersistence()`
3. During recording: Call `saveAudioChunk()` every 10 seconds
4. On recording stop: Call `stopPersistence(true)` to trigger upload
5. On cancel: Call `stopPersistence(false)` to delete data

## API Endpoints

### POST /api/conversations/[id]/multipart-upload

Initiate multipart upload.

**Request:**
```json
{
  "contentType": "audio/webm"
}
```

**Response:**
```json
{
  "uploadId": "abc123",
  "key": "recordings/org-id/conv-id/recording.webm"
}
```

### GET /api/conversations/[id]/multipart-upload

List uploaded parts for resume.

**Query params:** `?uploadId=abc123&key=recordings/...`

**Response:**
```json
{
  "parts": [
    { "partNumber": 1, "etag": "\"abc...\"" },
    { "partNumber": 2, "etag": "\"def...\"" }
  ]
}
```

### POST /api/conversations/[id]/upload-part

Get presigned URL for part upload.

**Request:**
```json
{
  "uploadId": "abc123",
  "key": "recordings/...",
  "partNumber": 1
}
```

**Response:**
```json
{
  "presignedUrl": "https://s3.../...",
  "partNumber": 1
}
```

### POST /api/conversations/[id]/complete-upload

Complete multipart upload.

**Request:**
```json
{
  "uploadId": "abc123",
  "key": "recordings/...",
  "parts": [
    { "partNumber": 1, "etag": "\"abc...\"" },
    { "partNumber": 2, "etag": "\"def...\"" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "location": "https://s3.../...",
  "key": "recordings/..."
}
```

### DELETE /api/conversations/[id]/complete-upload

Abort multipart upload.

**Request:**
```json
{
  "uploadId": "abc123",
  "key": "recordings/..."
}
```

## Data Flow

### Normal Recording Flow

```
1. User starts recording
   └─▶ startPersistence() creates IndexedDB session

2. Every 10 seconds during recording
   └─▶ saveAudioChunk() stores chunk in IndexedDB

3. User stops recording
   ├─▶ Final chunk saved to IndexedDB
   ├─▶ All chunks concatenated
   ├─▶ If >10MB: chunkedUpload() with multipart
   │   └─▶ Each part uploaded with retry
   └─▶ If <10MB: uploadToPresignedUrl()

4. Upload success
   └─▶ stopPersistence(false) deletes IndexedDB data
```

### Recovery Flow (Device Failure)

```
1. User closes browser/device dies during recording
   └─▶ IndexedDB data persists

2. Service Worker triggers (when online)
   ├─▶ Reads chunks from IndexedDB
   ├─▶ Concatenates into Blob
   ├─▶ Fetches fresh upload URL
   ├─▶ Uploads to S3
   └─▶ Cleans up IndexedDB

3. OR: User returns to app
   ├─▶ useRecordingPersistence detects pending sessions
   ├─▶ Shows "X recordings pending upload" UI
   └─▶ User clicks "Upload Now"
       └─▶ recoverPendingUploads() handles upload
```

### Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| IndexedDB | Yes | Yes | Yes | Yes |
| Service Worker | Yes | Yes | Yes | Yes |
| Background Sync | Yes | No | No | Yes |
| Multipart Upload | Yes | Yes | Yes | Yes |

**Fallback:** When Background Sync unavailable, uses `online` event listener.

## Error Handling

### IndexedDB Errors
- Quota exceeded: Show warning, continue recording (audio still in memory)
- Database locked: Retry with exponential backoff
- Schema upgrade: Handled by Dexie automatically

### Upload Errors
- Network failure: Retry 3 times with backoff, then preserve in IndexedDB
- S3 errors: Log and preserve data for manual recovery
- Part upload failure: Retry that part, not entire upload

### Service Worker Errors
- Registration failure: Fall back to online event + manual recovery
- Sync failure: Re-register sync, data preserved in IndexedDB

## Performance Considerations

| Metric | Target | Implementation |
|--------|--------|----------------|
| Chunk save latency | <50ms | Async writes, no transactions |
| Memory during recording | <200MB | Stream to IndexedDB immediately |
| Upload throughput | Maximize | Parallel part uploads (future) |
| Battery impact | Minimal | Batch operations, no polling |

## Security

- All API endpoints require authentication
- Presigned URLs scoped to specific S3 keys
- IndexedDB data tied to origin
- Service worker scope limited to `/`
- Multipart uploadId is single-use token
- Session cleanup prevents data leakage

## Monitoring

### Log Messages

```
[Persistence] Started session for {conversationId}
[Persistence] Saved chunk {index} for {conversationId}
[Persistence] Uploaded session {conversationId}
[Persistence] Failed to upload: {error}
[RecordingSW] Sync event: upload-recording-{id}
[RecordingSW] Successfully uploaded conversation {id}
[ChunkedUpload] Part {n} attempt {m} failed: {error}
```

### Health Checks

- IndexedDB availability: `isOfflineStorageAvailable()`
- Service worker status: `getServiceWorkerVersion()`
- Pending session count: `getPendingSessions().length`
