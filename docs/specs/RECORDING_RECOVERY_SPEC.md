# Recording Recovery System Specification

## Overview

The Recording Recovery System provides resilience for in-person conversation recordings, ensuring that audio data is never lost due to device failures, network issues, or browser crashes. The system consists of three components:

- **Processing Pipeline Fix**: Pre-flight check to handle missing recordings gracefully
- **Phase 1**: Detection & Recovery UI - Identifies stuck recordings and provides manual recovery options
- **Phase 2**: Offline Resilience - Prevents data loss through IndexedDB backup, chunked uploads, and service workers

---

## Processing Pipeline - Missing Recording Handling

### Problem

When processing is triggered but the recording doesn't exist in S3:
- The pipeline attempts to download the recording
- S3 returns `NoSuchKey` error
- Retry logic triggers (3 retries, 5s delay each)
- After 3 retries, conversation marked as `FAILED`
- User has no visibility into why processing failed

### Solution

Added a pre-flight check in `processConversation()` that verifies the recording exists before attempting to transcribe.

**File:** `apps/web/src/lib/services/conversation-processing.ts`

```typescript
// Step 3.5: Verify recording exists in S3 before attempting to transcribe
if (recordingSource.startsWith("recordings/") || recordingSource.startsWith("in-person/")) {
  const exists = await recordingExists(recordingSource);

  if (!exists) {
    // Check if upload window is still open (1 hour from creation)
    const presignedUrlExpiresAt = new Date(
      conversation.createdAt.getTime() + PRESIGNED_URL_VALID_DURATION_MS
    );
    const presignedUrlValid = presignedUrlExpiresAt > new Date();

    if (presignedUrlValid) {
      // Upload window still open - retry with longer delay
      throw new RecordingNotYetUploadedError(...);
    } else {
      // Upload window expired - mark for recovery UI
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: "RECORDING",
          recoveryStatus: "EXPIRED",
          aiProcessingStatus: ProcessingStatus.FAILED,
          aiProcessingError: "Recording upload window expired - no audio file found",
        },
      });
      return { success: false, ... };
    }
  }
}
```

### Retry Strategy

| Scenario | Delay | Max Retries | Final Status |
|----------|-------|-------------|--------------|
| Recording exists | N/A | N/A | COMPLETED/REVIEW |
| Missing, upload window open | 30 seconds | 3 | FAILED (after 90s total) |
| Missing, upload window expired | None | 0 | EXPIRED (immediate) |
| Other errors (network, transcription) | 5s × retry count | 3 | FAILED |

### Error Types

```typescript
// Custom error for "not yet uploaded" - uses longer retry delay
class RecordingNotYetUploadedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordingNotYetUploadedError";
  }
}
```

### S3 Error Handling Fix

**File:** `apps/web/src/lib/storage/s3.ts`

The `recordingExists()` function now catches both `NotFound` and `NoSuchKey` errors:

```typescript
export async function recordingExists(key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const errorName = (error as { name?: string }).name;
    // AWS S3 returns "NotFound" or "NoSuchKey" depending on SDK version
    if (errorName === "NotFound" || errorName === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}
```

### Integration with Recovery UI

When a recording is marked `recoveryStatus: EXPIRED`:
1. Stale recording cron won't touch it (already marked)
2. Recovery UI shows "Upload Window Expired" badge
3. User can either:
   - Manually upload the recording file
   - Abandon the conversation

---

## Problem Statement

When a user's device dies or disconnects during an in-person recording:
- The conversation gets stuck in `RECORDING` status indefinitely
- There's no way to recover the recording if audio was uploaded
- No mechanism to abandon stuck recordings
- No detection of orphaned recording sessions
- If the browser session dies, no way to resume or complete the upload

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Recording Flow                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │   Browser    │    │  IndexedDB   │    │   Service    │    │    S3     │  │
│  │  Recording   │───▶│   Backup     │───▶│   Worker     │───▶│  Storage  │  │
│  │              │    │  (10s chunks)│    │ (Background) │    │           │  │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘  │
│         │                   │                    │                  │        │
│         │                   │                    │                  │        │
│         ▼                   ▼                    ▼                  ▼        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │  Heartbeat   │    │   Recovery   │    │  Multipart   │    │   Cron    │  │
│  │   (30s)      │    │     UI       │    │   Upload     │    │   Job     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Detection & Recovery UI

### Schema Changes

Added to `Conversation` model in `prisma/schema.prisma`:

```prisma
model Conversation {
  // ... existing fields ...

  lastHeartbeat     DateTime?        // Last ping from active recording session
  recordingDeviceId String?          // UUID identifying the browser session
  recoveryStatus    RecoveryStatus?  // Set by stale detection cron

  @@index([status, lastHeartbeat])   // For efficient stale detection queries
}

enum RecoveryStatus {
  RECOVERABLE      // Audio found in S3, can process
  AWAITING_UPLOAD  // No audio yet, presigned URL may still be valid
  EXPIRED          // Presigned URL expired, no audio found
  ABANDONED        // User explicitly abandoned
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/conversations/[id]/heartbeat` | POST | Frontend pings every 30s during recording |
| `/api/conversations/[id]/recording-status` | GET | Check S3 for audio, return recovery options |
| `/api/conversations/[id]/abandon` | POST | Mark as FAILED, optionally delete S3 audio |
| `/api/conversations/[id]/fresh-upload-url` | POST | Generate new presigned URL for manual upload |
| `/api/cron/stale-recordings` | POST | Detect orphaned recordings (runs every 5 min) |

### Heartbeat Mechanism

The `InPersonRecorder` component sends a heartbeat every 30 seconds while recording:

```typescript
// Request body
{
  deviceId: string,      // Browser session UUID
  recordingState: "recording" | "paused",
  durationSeconds: number
}

// Response
{
  received: true,
  shouldContinue: boolean,
  message?: string       // Warning if another device is recording
}
```

### Stale Recording Detection

The cron job (`/api/cron/stale-recordings`) runs every 5 minutes:

1. Query: `status=RECORDING AND (lastHeartbeat < 15 min ago OR lastHeartbeat IS NULL AND createdAt < 15 min ago)`
2. For each conversation:
   - Check S3 for recording at expected key
   - If found → `recoveryStatus = RECOVERABLE`
   - If not found AND presignedUrl still valid → `recoveryStatus = AWAITING_UPLOAD`
   - If not found AND presignedUrl expired → `recoveryStatus = EXPIRED`

### Recovery UI Components

**RecordingRecoveryPanel** (`src/components/conversation/recording-recovery-panel.tsx`)
- Shows when `status=RECORDING` AND `recoveryStatus` is set
- Displays: time started, last seen, audio found badge
- Actions based on state:
  - `RECOVERABLE`: "Process Recording" button
  - `AWAITING_UPLOAD`: "Upload Recording" + file picker
  - `EXPIRED`: Explanation + "Abandon" button
  - All states: "Abandon Recording" secondary action

**ManualUploadDialog** (`src/components/conversation/manual-upload-dialog.tsx`)
- File picker accepting `audio/*`
- Progress bar during upload
- Triggers processing on success

---

## Phase 2: Offline Resilience

### IndexedDB Storage

Using Dexie.js for IndexedDB management (`src/lib/recording/offline-db.ts`):

```typescript
interface RecordingChunk {
  id: string;              // `${conversationId}-${chunkIndex}`
  conversationId: string;
  chunkIndex: number;
  blob: Blob;
  timestamp: Date;
  uploaded: boolean;
  uploadAttempts: number;
}

interface RecordingSession {
  conversationId: string;
  deviceId: string;
  orgId: string;
  startedAt: Date;
  lastUpdatedAt: Date;
  status: 'recording' | 'stopped' | 'uploading' | 'complete' | 'failed';
  uploadUrl?: string;
  s3Key?: string;
  error?: string;
}
```

**Storage Strategy:**
- Chunk every 10 seconds of audio (~150KB per chunk at 128kbps)
- Max 360 chunks = 1 hour recording = ~54MB IndexedDB usage
- Auto-cleanup: Delete chunks after successful S3 upload
- Retention: Sessions older than 7 days are purged

### Multipart S3 Upload

For files >10MB, uses S3 multipart upload (`src/lib/storage/multipart-s3.ts`):

| Function | Purpose |
|----------|---------|
| `initiateMultipartUpload()` | Start multipart upload, get uploadId |
| `getPartUploadUrl()` | Get presigned URL for specific part |
| `completeMultipartUpload()` | Finalize upload, assemble parts |
| `abortMultipartUpload()` | Cancel and cleanup failed upload |
| `listUploadedParts()` | Get already-uploaded parts for resume |

**Part Configuration:**
- Part size: 5MB (minimum for S3 multipart)
- Max retries per part: 3
- Exponential backoff: 2^attempt seconds

### API Endpoints (Phase 2)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/conversations/[id]/multipart-upload` | POST | Initiate multipart upload |
| `/api/conversations/[id]/multipart-upload` | GET | List uploaded parts (for resume) |
| `/api/conversations/[id]/upload-part` | POST | Get presigned URL for part |
| `/api/conversations/[id]/complete-upload` | POST | Complete multipart upload |
| `/api/conversations/[id]/complete-upload` | DELETE | Abort multipart upload |

### Service Worker

The service worker (`public/recording-sw.js`) handles background sync:

```javascript
// Triggered when browser regains connectivity
self.addEventListener('sync', (event) => {
  if (event.tag.startsWith('upload-recording-')) {
    const conversationId = event.tag.replace('upload-recording-', '');
    event.waitUntil(handleRecordingUpload(conversationId));
  }
});
```

**Browser Support:**
- Chrome/Edge: Full Background Sync support
- Firefox/Safari: Falls back to `online` event listener

### useRecordingPersistence Hook

React hook for managing offline state (`src/hooks/useRecordingPersistence.ts`):

```typescript
const {
  isAvailable,           // IndexedDB + enabled
  saveAudioChunk,        // Save chunk to IndexedDB
  startPersistence,      // Start new session
  stopPersistence,       // Stop and optionally trigger upload
  recoverPendingUploads, // Upload all pending sessions
  getPendingCount,       // Count of sessions awaiting upload
} = useRecordingPersistence({
  conversationId,
  deviceId,
  orgId,
  uploadUrl,
  s3Key,
  enabled: true,
  onRecoveryFound,
  onUploadComplete,
  onError,
});
```

### InPersonRecorder Integration

The `InPersonRecorder` component now includes:

**New Props:**
```typescript
interface InPersonRecorderProps {
  conversationId?: string;
  orgId?: string;              // Required for persistence
  uploadUrl?: string;
  s3Key?: string;              // S3 key for recording
  maxDurationMinutes?: number;
  onRecordingStart?: () => void;
  onRecordingStop?: (duration: number) => void;
  onUploadComplete?: (conversationId: string) => void;
  onError?: (error: string) => void;
  enableOfflineResilience?: boolean;  // Default: true
}
```

**Features:**
1. **Chunk Saving**: Audio saved to IndexedDB every 10 seconds
2. **beforeunload Warning**: Browser warns before leaving during recording
3. **Visibility Change**: Logs when app goes to background
4. **Chunked Upload**: Files >10MB use multipart upload
5. **Recovery UI**: Shows pending upload count with "Upload Now" button
6. **Status Indicator**: Cloud icon shows offline backup status

---

## Security Considerations

- All endpoints require `requireAuth()` + org membership check
- `abandon` action is audit logged
- S3 presigned URLs scoped to specific conversation's key
- Device ID stored to prevent cross-device interference during active recording
- Recovery actions restricted to: recording creator OR org admin role
- Multipart uploads expire after 7 days (S3 default)

---

## File Reference

### Phase 1 Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Schema with RecoveryStatus enum |
| `src/app/api/conversations/[id]/heartbeat/route.ts` | Heartbeat endpoint |
| `src/app/api/conversations/[id]/recording-status/route.ts` | S3 check + recovery options |
| `src/app/api/conversations/[id]/abandon/route.ts` | Abandon action |
| `src/app/api/conversations/[id]/fresh-upload-url/route.ts` | New presigned URL |
| `src/app/api/cron/stale-recordings/route.ts` | Stale detection cron |
| `src/components/conversation/recording-recovery-panel.tsx` | Recovery UI |
| `src/components/conversation/manual-upload-dialog.tsx` | Manual upload |
| `src/lib/storage/s3.ts` | Added `recordingExists()` function |

### Phase 2 Files

| File | Purpose |
|------|---------|
| `src/lib/recording/offline-db.ts` | IndexedDB storage with Dexie.js |
| `src/lib/storage/multipart-s3.ts` | S3 multipart upload functions |
| `src/lib/recording/chunked-upload.ts` | Client-side chunked upload |
| `src/lib/recording/service-worker.ts` | SW registration helpers |
| `public/recording-sw.js` | Service worker for background sync |
| `src/hooks/useRecordingPersistence.ts` | React hook for persistence |
| `src/app/api/conversations/[id]/multipart-upload/route.ts` | Initiate/list multipart |
| `src/app/api/conversations/[id]/upload-part/route.ts` | Get part presigned URLs |
| `src/app/api/conversations/[id]/complete-upload/route.ts` | Complete/abort multipart |
| `src/components/recording/in-person-recorder.tsx` | Updated with offline resilience |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Authentication for cron job endpoints |
| `AWS_S3_BUCKET` | S3 bucket for recordings |
| `AWS_REGION` | AWS region |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |

---

## Testing Checklist

### Phase 1
- [ ] Start recording → wait 15 min → verify stale detection runs
- [ ] Start recording → close browser → verify heartbeat stops
- [ ] Stuck recording with audio in S3 → verify "Process Recording" works
- [ ] Stuck recording without audio → verify "Abandon" works
- [ ] Manual upload flow → verify new presigned URL + upload + processing

### Phase 2
- [ ] Start recording → verify chunks saved to IndexedDB every 10s
- [ ] Stop recording → verify IndexedDB cleaned up after upload
- [ ] Large file (>10MB) → verify multipart upload used
- [ ] Close tab during recording → verify beforeunload warning shown
- [ ] Upload failure → verify IndexedDB data preserved
- [ ] Pending recovery notification → verify "Upload Now" works
- [ ] Service worker registered → verify in DevTools > Application

---

## Monitoring

### Metrics to Track
- `recording.heartbeat.sent` - Heartbeats sent
- `recording.heartbeat.failed` - Heartbeat failures
- `recording.stale.detected` - Stale recordings found
- `recording.recovery.completed` - Successful recoveries
- `recording.chunks.saved` - Chunks saved to IndexedDB
- `recording.multipart.initiated` - Multipart uploads started
- `recording.multipart.completed` - Multipart uploads completed
- `recording.background_sync.triggered` - SW sync events

### Alerts
- Stale recordings not being detected (cron failing)
- High rate of recording failures
- Multipart uploads timing out

---

## Future Enhancements

1. **Continuous Upload**: Upload chunks as they're recorded, not just at the end
2. **Compression**: Compress chunks before storing in IndexedDB
3. **Cross-Tab Coordination**: Prevent multiple tabs from recording same conversation
4. **Mobile App Support**: Native offline storage for mobile apps
5. **Analytics Dashboard**: View stuck recording trends and recovery rates
