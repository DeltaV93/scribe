# Scrybe Solutions - Production Launch Checklist

## Overview

This checklist tracks all remaining work required for production launch based on spec-1.md and spec-2.md requirements.

**Total Estimated Effort:** 25-35 days
**Recommended Approach:** Phased Launch

---

## Critical Blockers (Must Fix Before Launch)

### 1. ClamAV Virus Scanning Integration

- [ ] **Research ClamAV deployment options**
  - [ ] Option A: ClamAV Docker container on Railway/ECS
  - [ ] Option B: External scanning API service (e.g., VirusTotal API)
  - [ ] Document chosen approach

- [ ] **Implement ClamAV client**
  - [ ] Modify `/src/lib/files/scanner.ts` to replace placeholder
  - [ ] Add ClamAV connection configuration
  - [ ] Implement actual file scanning via clamd socket or REST API
  - [ ] Handle scan timeouts gracefully
  - [ ] Add retry logic for transient failures

- [ ] **Add environment variables**
  - [ ] `CLAMAV_HOST` - ClamAV server hostname
  - [ ] `CLAMAV_PORT` - ClamAV port (default: 3310)
  - [ ] Or `SCANNER_API_KEY` and `SCANNER_API_URL` for external service

- [ ] **Test scanning**
  - [ ] Test with EICAR test file (should detect)
  - [ ] Test with clean files (should pass)
  - [ ] Test with large files (verify timeout handling)
  - [ ] Verify scan status updates in database

**Current Status:** Placeholder only - files queue but aren't actually scanned
**Current Location:** `/src/lib/files/scanner.ts`
**Estimated Effort:** 3-5 days

---

### 2. pgvector Extension for RAG Embeddings

- [ ] **Verify database compatibility**
  - [ ] Confirm Railway PostgreSQL is version 15+
  - [ ] Enable pgvector extension in Railway console

- [ ] **Update Prisma schema**
  - [ ] Uncomment pgvector extension in `prisma/schema.prisma`
  - [ ] Add vector column to `ExtractionExample` model
  - [ ] Run `npx prisma generate`

- [ ] **Create and run migration**
  - [ ] Create migration for vector column
  - [ ] Run `npx prisma migrate deploy`
  - [ ] Verify migration success

- [ ] **Implement vector similarity search**
  - [ ] Create `/src/lib/ai/examples.ts`
  - [ ] Implement embedding generation (OpenAI ada-002 or similar)
  - [ ] Implement cosine similarity search for example retrieval
  - [ ] Update extraction pipeline to use similar examples

- [ ] **Test RAG system**
  - [ ] Add test extraction examples
  - [ ] Verify similarity search returns relevant examples
  - [ ] Test extraction quality improvement with examples

**Current Status:** Disabled in schema - RAG system non-functional
**Current Location:** `prisma/schema.prisma`, missing `/src/lib/ai/examples.ts`
**Estimated Effort:** 2-3 days

---

### 3. WebSocket Server for Real-Time Transcripts

> **Decision Required:** Implement WebSocket + real-time streaming, or launch with post-call transcription only?

- [ ] **Choose architecture**
  - [ ] Option A: Separate Node.js WebSocket server on ECS (spec recommendation)
  - [ ] Option B: Vercel/Railway-compatible solution (Socket.io, Pusher, Ably)
  - [ ] Option C: Defer - launch with post-call only (current implementation)
  - [ ] Document decision

**If implementing (Option A or B):**

- [ ] **Create WebSocket server**
  - [ ] Create `/src/lib/websocket/server.ts`
  - [ ] Implement connection handling
  - [ ] Implement room management (per-call rooms)
  - [ ] Add heartbeat/keepalive

- [ ] **Create message handlers**
  - [ ] Create `/src/lib/websocket/handlers.ts`
  - [ ] Handle transcript segments
  - [ ] Handle call status updates
  - [ ] Handle extraction progress

- [ ] **Implement authentication**
  - [ ] Create `/src/app/api/ws-ticket/route.ts`
  - [ ] Generate time-limited tickets
  - [ ] Validate tickets on WebSocket connect

- [ ] **Update frontend**
  - [ ] Add WebSocket client to call interface
  - [ ] Display real-time transcript segments
  - [ ] Show typing indicators for active speech

- [ ] **Add environment variables**
  - [ ] `WS_SERVER_URL` - WebSocket server URL
  - [ ] `WS_SECRET` - Ticket signing secret

**Current Status:** Not implemented
**Estimated Effort:** 5-7 days (if implementing)

---

### 4. Twilio Media Streams → Deepgram Streaming

> **Note:** Depends on WebSocket infrastructure (#3). If deferring real-time, defer this too.

- [ ] **Create media stream endpoint**
  - [ ] Create `/src/app/api/webhooks/twilio/stream/route.ts`
  - [ ] Handle Twilio WebSocket connection
  - [ ] Parse media stream messages

- [ ] **Implement Deepgram streaming client**
  - [ ] Create `/src/lib/deepgram/streaming.ts`
  - [ ] Connect to Deepgram live transcription API
  - [ ] Handle audio format conversion (mulaw → compatible format)
  - [ ] Implement reconnection logic

- [ ] **Bridge audio streams**
  - [ ] Forward Twilio audio to Deepgram
  - [ ] Receive transcription events from Deepgram
  - [ ] Broadcast to WebSocket clients

- [ ] **Update Twilio TwiML**
  - [ ] Add `<Stream>` verb to call TwiML
  - [ ] Configure bidirectional streaming

- [ ] **Test streaming**
  - [ ] Test with actual phone calls
  - [ ] Verify low latency (< 500ms)
  - [ ] Test speaker diarization in real-time

**Current Status:** Twilio works for recording, no real-time transcription
**Current Location:** `/src/lib/twilio/`, `/src/lib/deepgram/`
**Estimated Effort:** 3-5 days (requires WebSocket first)

---

## High Priority (Should Fix Before Launch)

### 5. E2E Tests with Playwright

- [ ] **Set up Playwright**
  - [ ] Install Playwright: `npm install -D @playwright/test`
  - [ ] Create `playwright.config.ts`
  - [ ] Configure test database/environment
  - [ ] Add test scripts to `package.json`

- [ ] **Create authentication tests**
  - [ ] Create `tests/e2e/auth.spec.ts`
  - [ ] Test user login flow
  - [ ] Test user logout flow
  - [ ] Test session persistence
  - [ ] Test unauthorized access redirects

- [ ] **Create form builder tests**
  - [ ] Create `tests/e2e/form-builder.spec.ts`
  - [ ] Test form creation
  - [ ] Test field addition (all types)
  - [ ] Test field reordering
  - [ ] Test conditional logic
  - [ ] Test form publishing
  - [ ] Test form preview

- [ ] **Create client management tests**
  - [ ] Create `tests/e2e/client-management.spec.ts`
  - [ ] Test client creation
  - [ ] Test duplicate detection
  - [ ] Test client search
  - [ ] Test client profile view
  - [ ] Test client editing
  - [ ] Test client status changes

- [ ] **Create call workflow tests**
  - [ ] Create `tests/e2e/call-workflow.spec.ts`
  - [ ] Test call initiation (mocked Twilio)
  - [ ] Test post-call review interface
  - [ ] Test field correction
  - [ ] Test form submission
  - [ ] Test call notes

- [ ] **Set up CI integration**
  - [ ] Add Playwright to GitHub Actions
  - [ ] Configure test parallelization
  - [ ] Set up test artifacts (screenshots, videos)

**Current Status:** 0% - No test framework set up
**Estimated Effort:** 7-10 days

---

### 6. Form Templates Library

- [ ] **Create API endpoints**
  - [ ] Create `/src/app/api/templates/route.ts` (GET list, POST create)
  - [ ] Create `/src/app/api/templates/[templateId]/route.ts` (GET, DELETE)
  - [ ] Implement template creation from existing form
  - [ ] Implement form creation from template

- [ ] **Create UI components**
  - [ ] Create `/src/components/templates/template-card.tsx`
  - [ ] Create `/src/components/templates/template-preview.tsx`
  - [ ] Create `/src/components/templates/save-as-template-modal.tsx`
  - [ ] Create `/src/components/templates/create-from-template-modal.tsx`

- [ ] **Create templates page**
  - [ ] Create `/src/app/(dashboard)/templates/page.tsx`
  - [ ] Implement template grid/list view
  - [ ] Add filtering by tags
  - [ ] Add search functionality
  - [ ] Show usage statistics

- [ ] **Add system templates**
  - [ ] Create intake form template
  - [ ] Create follow-up form template
  - [ ] Create referral form template
  - [ ] Create assessment form template

- [ ] **Integrate with form builder**
  - [ ] Add "Save as Template" button to form editor
  - [ ] Add "Create from Template" option to new form flow

**Current Status:** 25% - Database model exists, no UI
**Current Location:** `FormTemplate` model in Prisma schema
**Estimated Effort:** 4-5 days

---

### 7. Form Export/Import

- [ ] **Create export functionality**
  - [ ] Create `/src/app/api/forms/[formId]/export/route.ts`
  - [ ] Create `/src/lib/forms/export.ts`
  - [ ] Implement JSON export (full form definition)
  - [ ] Implement PDF export (printable form)
  - [ ] Handle file downloads

- [ ] **Create import functionality**
  - [ ] Create `/src/app/api/forms/import/route.ts`
  - [ ] Create `/src/lib/forms/import.ts`
  - [ ] Validate imported JSON structure
  - [ ] Handle version compatibility
  - [ ] Detect and resolve conflicts

- [ ] **Create import UI**
  - [ ] Create `/src/components/forms/import-form-modal.tsx`
  - [ ] Create `/src/components/forms/import-preview.tsx`
  - [ ] Show preview of fields to be imported
  - [ ] Allow field selection/mapping
  - [ ] Show validation errors

- [ ] **Add to form list page**
  - [ ] Add "Import Form" button
  - [ ] Add "Export" option to form actions menu

**Current Status:** 0% - Not implemented
**Estimated Effort:** 4-5 days

---

## Lower Priority (Nice to Have)

### 8. Client Activity Feed

- [ ] **Create activity feed component**
  - [ ] Create `/src/components/clients/client-activity-feed.tsx`
  - [ ] Query calls, notes, submissions chronologically
  - [ ] Display in timeline format
  - [ ] Add activity type icons
  - [ ] Show relative timestamps

- [ ] **Create activity feed API**
  - [ ] Create `/src/app/api/clients/[clientId]/activity/route.ts`
  - [ ] Aggregate activities from multiple tables
  - [ ] Implement pagination
  - [ ] Add date range filtering

- [ ] **Integrate with client profile**
  - [ ] Add activity tab to client profile
  - [ ] Replace or augment current sections

**Current Status:** 75% - Profile exists, no activity feed component
**Current Location:** `/src/components/clients/client-profile.tsx`
**Estimated Effort:** 1-2 days

---

### 9. Real-Time Resource Locking

- [ ] **Create locking service**
  - [ ] Create `/src/lib/services/resource-locking.ts`
  - [ ] Implement lock acquisition
  - [ ] Implement lock release
  - [ ] Implement lock expiration
  - [ ] Handle stale lock cleanup

- [ ] **Create locking API**
  - [ ] Create `/src/app/api/locks/route.ts` (POST acquire, DELETE release)
  - [ ] Create `/src/app/api/locks/[lockId]/route.ts` (GET status)
  - [ ] Implement heartbeat extension

- [ ] **Integrate with form editor**
  - [ ] Acquire lock when opening form for edit
  - [ ] Show warning when form is locked by another user
  - [ ] Release lock on close/navigate away
  - [ ] Handle lock expiration gracefully

- [ ] **Integrate with call interface**
  - [ ] Acquire client lock during active call
  - [ ] Prevent concurrent calls to same client

**Current Status:** Database model exists, no implementation
**Current Location:** `ResourceLock` model in Prisma schema
**Estimated Effort:** 2-3 days

---

## Environment Variables Checklist

### New Variables Needed

- [ ] `CLAMAV_HOST` - ClamAV server hostname (if self-hosted)
- [ ] `CLAMAV_PORT` - ClamAV port, default 3310 (if self-hosted)
- [ ] `SCANNER_API_KEY` - External scanner API key (if using external service)
- [ ] `SCANNER_API_URL` - External scanner API URL (if using external service)
- [ ] `WS_SERVER_URL` - WebSocket server URL (if implementing real-time)
- [ ] `WS_SECRET` - WebSocket ticket signing secret (if implementing real-time)

### Verify Existing Variables

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `DIRECT_URL` - Direct PostgreSQL connection (for migrations)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `TWILIO_ACCOUNT_SID` - Twilio account SID
- [ ] `TWILIO_AUTH_TOKEN` - Twilio auth token
- [ ] `DEEPGRAM_API_KEY` - Deepgram API key
- [ ] `OPENAI_API_KEY` - OpenAI API key
- [ ] `AWS_ACCESS_KEY_ID` - AWS access key
- [ ] `AWS_SECRET_ACCESS_KEY` - AWS secret key
- [ ] `AWS_REGION` - AWS region
- [ ] `S3_BUCKET_NAME` - S3 bucket for recordings
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- [ ] `JOBS_API_KEY` - Background jobs API key

---

## Launch Strategy Options

### Option A: Full Launch (25-35 days)
Complete all Tier 1 + Tier 2 items before any public launch.

**Pros:**
- Full feature parity with spec
- No feature gaps for users
- Real-time transcription available

**Cons:**
- Longer time to market
- More risk of scope creep

### Option B: Phased Launch (Recommended)

**Phase 1 - Form Builder Launch (7-10 days)**
- [ ] ClamAV integration
- [ ] pgvector for RAG
- [ ] Basic E2E tests for form builder
- [ ] Form templates (basic)

**Phase 2 - Call Management Launch (10-15 days)**
- [ ] Additional E2E tests
- [ ] Real-time transcription OR post-call only (decision needed)
- [ ] Form export/import
- [ ] Complete form templates

**Phase 3 - Polish (5-7 days)**
- [ ] Activity feed
- [ ] Resource locking
- [ ] Performance optimization
- [ ] Documentation updates

**Pros:**
- Faster time to initial launch
- Early user feedback
- Reduced initial risk

**Cons:**
- Some features delayed
- May need to communicate limitations

---

## Decision Log

| Decision | Options | Chosen | Date | Rationale |
|----------|---------|--------|------|-----------|
| Real-time transcription | Implement / Defer | | | |
| ClamAV hosting | Self-hosted / External | | | |
| Launch strategy | Full / Phased | | | |
| WebSocket provider | Custom / Pusher / Ably | | | |

---

## Progress Tracking

### Completed Items
- (Move items here as they're completed)

### In Progress
- (Currently active work)

### Blocked
- (Items waiting on decisions or dependencies)

---

## Notes

- All effort estimates assume single developer
- Testing estimates include writing tests, not debugging failures
- WebSocket and streaming items are interdependent
- pgvector requires database access to enable extension
