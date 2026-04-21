# Incident Report: Recording Upload Key Mismatch & Backup Job Failures

**Incident ID:** INC-2026-04-09-002
**Date:** April 9, 2026
**Duration:** Unknown (issue present since feature deployment)
**Severity:** High (Recording processing failures, Backup system non-functional)
**Status:** Resolved

---

## Summary

Two production issues were identified affecting core functionality:

1. **Recording Processing Failures:** Longer meetings (and sometimes shorter ones) were failing to process. S3 key mismatch caused by browser MIME type codec suffix (`audio/webm;codecs=opus`) being embedded in S3 keys, creating a mismatch between upload location and lookup location.

2. **Backup/Export System Non-Functional:** All BullMQ background jobs (exports, scheduled reports, document processing) were queuing to Redis but never executing because the worker was never started.

---

## Timeline

| Time | Event |
|------|-------|
| **Unknown** | Recording processing began failing intermittently |
| **Unknown** | Background jobs queuing without processing |
| **Apr 9, PM** | Issue reported: "longer meetings not being saved or processed" |
| **Apr 9, PM** | Logs analyzed, root causes identified |
| **Apr 9, PM** | Fix deployed: MIME codec suffix stripping + BullMQ worker startup |
| **Apr 9, PM** | **Incident resolved** |

---

## Root Causes

### Issue 1: Recording S3 Key Mismatch

**Flow causing the bug:**

1. `/api/conversations/in-person` generates presigned URL with key ending in `.webm`
2. Browser's MediaRecorder reports MIME `audio/webm;codecs=opus`
3. `/api/conversations/[id]/multipart-upload` generates key ending in `.webm;codecs=opus`
4. File uploads to S3 at this malformed key: `recordings/org/2026/04/conv.webm;codecs=opus`
5. `complete-upload` stores malformed key in `recordingUrl`
6. Client's `handleUploadComplete` callback overwrites `recordingUrl` with original clean key
7. Processing looks for `.webm` → File not found (it's at `.webm;codecs=opus`)

**Code Location:**
```typescript
// apps/web/src/app/api/conversations/[id]/multipart-upload/route.ts:71
const extension = contentType.split("/")[1] || "webm";
// Input: "audio/webm;codecs=opus" → Output: "webm;codecs=opus" (WRONG)
```

### Issue 2: BullMQ Worker Never Started

The `startWorker()` function existed in `apps/web/src/lib/jobs/worker.ts` but was never called during application startup.

- `instrumentation.ts` only configured undici timeouts
- Jobs queued to Redis but sat there indefinitely
- All 11 job processors were registered but had no worker to execute them

**Affected Jobs:**
- `funder-export` - Export generation
- `scheduled-export-runner` - Scheduled export checks
- `report-generation` - Report creation
- `document-extraction` - Document processing
- `form-conversion` - Form file conversions
- `mass-note-batch` - Bulk note operations
- `meeting-processing` - Meeting transcription
- `invitation-reminder` - Invitation emails
- `invitation-reminder-runner` - Reminder scheduling
- `token-refresh` - OAuth token refresh
- `import` - Data imports

---

## Resolution

### Fix 1: MIME Codec Suffix Stripping

Added `.split(";")[0]` to strip codec suffix when extracting extension from contentType.

**Files Modified:**
- `apps/web/src/app/api/conversations/[id]/multipart-upload/route.ts` (line 71)
- `apps/web/src/lib/recording/upload.ts` (lines 49, 100)

```typescript
// Before:
const extension = contentType.split("/")[1] || "webm";

// After:
const extension = contentType.split("/")[1]?.split(";")[0] || "webm";
```

### Fix 2: BullMQ Worker Initialization

Added worker startup to `apps/web/src/instrumentation.ts`:

```typescript
if (process.env.REDIS_URL) {
  // Import processors to register them
  await import("./lib/jobs/processors");

  // Start the worker
  const { startWorker } = await import("./lib/jobs/worker");
  startWorker();

  console.log("[Instrumentation] BullMQ worker started");
}
```

---

## Impact

### Recording Issue
- **Users affected:** All users recording conversations
- **Duration:** Unknown (since feature deployment)
- **Business impact:** Failed conversation processing, user frustration
- **Data loss:** Recordings exist in S3 but with malformed keys; recoverable

### Backup Issue
- **Users affected:** All organizations using exports/reports
- **Duration:** Unknown (since feature deployment)
- **Business impact:** No scheduled exports, no background processing
- **Data loss:** None (jobs can be re-queued)

---

## Recovery Steps

### Existing Recordings with Malformed Keys

For conversations that failed due to key mismatch:

1. Query conversations where processing failed with "Recording not found in S3"
2. Check S3 for files with `;codecs=opus` suffix
3. Either:
   - Rename S3 objects to remove suffix, OR
   - Update database `recordingUrl` to match actual S3 key
4. Re-trigger processing via `/api/conversations/[id]/process`

```sql
-- Find affected conversations
SELECT id, "recordingUrl", "aiProcessingError"
FROM "Conversation"
WHERE "aiProcessingError" LIKE '%Recording not found%'
AND "recordingUrl" IS NOT NULL;
```

### Pending Background Jobs

Jobs already in Redis will be processed automatically once the worker starts.
Monitor logs for `Job completed` messages after deployment.

---

## Lessons Learned

### What went well
- Root cause identified quickly from logs
- Fix was minimal and targeted
- No data loss (recordings exist, just misnamed)

### What didn't go well
- Issue existed since feature deployment without detection
- No monitoring for S3 key patterns
- No health check for BullMQ worker status
- Integration testing didn't catch MIME type variations

---

## Action Items

| Priority | Action | Owner | Status |
|----------|--------|-------|--------|
| High | Add monitoring for recording processing success rate | DevOps | TODO |
| High | Add health check endpoint for BullMQ worker | DevOps | TODO |
| Medium | Add integration test with actual MediaRecorder MIME types | Dev | TODO |
| Medium | Run recovery script for affected recordings | Dev | TODO |
| Low | Document MIME type handling in recording flow | Dev | TODO |

---

## Related Commits

- `ed54e1f` - fix(recordings): strip MIME codec suffix from S3 keys & start BullMQ worker

---

## Related Documents

- [Recording Recovery Spec](../specs/RECORDING_RECOVERY_SPEC.md)
- [Recording Offline Resilience](../technical/recording-offline-resilience.md)
- [Conversation Capture Infrastructure](../CONVERSATION_CAPTURE_INFRASTRUCTURE.md)
