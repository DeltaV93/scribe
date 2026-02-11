# Phase 1 Implementation Specification

## Overview

This document covers the implementation of Phase 1 tickets for Scribe's program management and compliance features.

## Tickets Implemented

| Ticket | Title | Status |
|--------|-------|--------|
| PX-721 | Session Dropdown in Table Row | ✅ Complete |
| PX-722 | Quick-View Materials | ✅ Complete |
| PX-723 | Session Status History Tracking | ✅ Complete |
| PX-724 | Inline Quick-Status Update | ✅ Complete |
| PX-725 | Draft Status Activation Reminders | ✅ Complete |
| PX-726 | Session Completion Progress Display | ✅ Complete |
| PX-728 | Cross-Role Unified Activity Feed | ✅ Complete |
| PX-729 | Facilitator Role & Class Management | ✅ Schema only |
| PX-732 | Replace Placeholder Emojis | ✅ Complete (using Lucide) |
| PX-735 | Recording Consent & Opt-Out Framework | ✅ Complete |
| PX-736 | Advanced Consent Management (Multi-State) | ✅ Structure + CA rules |

---

## Technical Decisions

### 1. Session Status History (PX-723)

**Decision**: Separate `SessionStatusHistory` table instead of using `AuditLog`

**Rationale**:
- Faster queries for session-specific history
- Cleaner UI integration
- Different retention requirements than audit logs
- Supports session-specific fields like `rescheduledToId`

**Trade-offs**:
- Additional table to maintain
- Some duplication with AuditLog for HIPAA compliance

**Mitigation**: HIPAA-relevant changes (sessions with enrollments) are also logged to AuditLog

### 2. Activity Feed Architecture (PX-728)

**Decision**: Denormalized `ClientActivity` table

**Rationale**:
- Best performance at scale (1000+ daily users)
- Eliminates N+1 queries across multiple tables
- Pre-computed summaries for fast rendering
- Role-based filtering is simple index lookup

**Trade-offs**:
- Storage overhead from denormalization
- Need to maintain consistency when source records change

**Mitigation**: Activity is write-once (append-only), source changes don't retroactively update

### 3. Consent Framework (PX-735, PX-736)

**Decision**:
- 30-day soft delete retention for revoked consent
- DTMF + Silence timeout for automated consent collection
- California rules seeded, registry structure for future states

**Rationale**:
- 30 days aligns with common compliance audit periods
- DTMF is reliable, silence as fallback for accessibility
- Registry pattern allows easy addition of state rules

**Trade-offs**:
- Recordings retained 30 days after consent revoked
- Area code to state mapping is approximate

**Mitigation**:
- Clear communication to users about retention period
- Default to stricter rules when state is uncertain

### 4. Status Transitions (PX-724)

**Decision**: Require confirmation for all backward status transitions

**Rationale**:
- Prevents accidental status changes
- Creates audit trail with reason
- Consistent UX regardless of status type

**Trade-offs**:
- Extra click for legitimate corrections

**Mitigation**: Confirmation dialog is quick with optional reason field

### 5. Notification Delivery (PX-725)

**Decision**: Polling (30-60 sec) for in-app notifications

**Rationale**:
- Simpler than WebSocket/SSE
- Works well with existing infrastructure
- Acceptable latency for draft reminders

**Trade-offs**:
- Not real-time
- Polling overhead on server

**Mitigation**: Minimal payload for polling endpoint, cached where possible

### 6. Icon Library (PX-732)

**Decision**: Use Lucide icons (already in codebase)

**Rationale**:
- Consistent with shadcn/ui
- Comprehensive icon set
- No additional dependencies

---

## Database Schema Changes

### New Models

```prisma
model SessionStatusHistory {
  id              String         @id @default(cuid())
  sessionId       String
  session         ProgramSession @relation(...)
  oldStatus       SessionStatus?
  newStatus       SessionStatus
  changedById     String
  changedBy       User           @relation(...)
  changedAt       DateTime       @default(now())
  reason          String?
  rescheduledToId String?
}

model ConsentRecord {
  id              String                  @id @default(cuid())
  clientId        String
  consentType     ConsentType
  status          ConsentStatus           @default(PENDING)
  grantedAt       DateTime?
  revokedAt       DateTime?
  method          ConsentCollectionMethod?
  callId          String?
  revokedById     String?
  retentionUntil  DateTime?
  @@unique([clientId, consentType])
}

model StateConsentRule {
  stateCode             String          @id
  stateName             String
  consentType           StateConsentType
  requiresExplicitOptIn Boolean
  silenceImpliesConsent Boolean
  minorAgeThreshold     Int             @default(18)
  additionalRules       Json?
  effectiveDate         DateTime
  notes                 String?         @db.Text
  lastReviewedAt        DateTime?
}

model ClientActivity {
  id           String       @id @default(cuid())
  clientId     String
  actorId      String
  actorRole    UserRole
  activityType ActivityType
  summary      String
  rawData      Json
  sourceType   String
  sourceId     String
  createdAt    DateTime     @default(now())
}
```

### New Enums

```prisma
enum ConsentType { RECORDING, DATA_SHARING, COMMUNICATION }
enum ConsentStatus { PENDING, GRANTED, REVOKED }
enum ConsentCollectionMethod { VERBAL, DTMF, WRITTEN, ELECTRONIC, SILENCE_TIMEOUT }
enum StateConsentType { ONE_PARTY, TWO_PARTY, ALL_PARTY }
enum ActivityType {
  CALL_COMPLETED, CALL_MISSED, NOTE_ADDED, FORM_SUBMITTED,
  FORM_UPDATED, ATTENDANCE_RECORDED, ENROLLMENT_CREATED,
  ENROLLMENT_UPDATED, ACTION_ITEM_CREATED, ACTION_ITEM_COMPLETED,
  CONSENT_GRANTED, CONSENT_REVOKED
}
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions/[sessionId]/status-history` | GET | Get session status change history |
| `/api/sessions/[sessionId]/status` | PATCH | Update session status with history |
| `/api/clients/[clientId]/consent` | GET | Get all consent records |
| `/api/clients/[clientId]/consent` | POST | Grant consent |
| `/api/clients/[clientId]/consent` | DELETE | Revoke consent |
| `/api/consent-rules` | GET | Get state consent rules |
| `/api/consent-rules` | POST | Create/update rule (admin) |
| `/api/clients/[clientId]/activity` | GET | Get activity feed |
| `/api/notifications/poll` | GET | Poll for new notifications |
| `/api/cron/draft-reminders` | POST/GET | Process draft reminders (cron) |

---

## UI Components

### SessionStatusDropdown
- Location: `src/components/programs/session-status-dropdown.tsx`
- Inline dropdown for status updates
- Confirmation dialog for backward transitions
- Status icons with color coding

### SessionProgressBadge
- Location: `src/components/programs/session-progress-badge.tsx`
- Compact "X/Y" progress display
- Color-coded by completion percentage
- Tooltip with detailed info

### MaterialsQuickView
- Location: `src/components/programs/materials-quick-view.tsx`
- Popover for quick-viewing materials
- Lazy-loads content on open
- MaterialsIndicator badge component

---

## Testing

E2E tests added in `tests/e2e/`:
- `programs.spec.ts` - Session management UI
- `consent.spec.ts` - Consent management
- `activity-feed.spec.ts` - Activity feed
- `notifications.spec.ts` - Notifications and reminders

---

## Future Work (Phase 2)

1. **Additional State Consent Rules** - See PX-XXX (to be created)
   - Add rules for other two-party consent states
   - Washington, Maryland, Pennsylvania, etc.

2. **Activity Feed Enhancements**
   - Real-time updates via WebSocket
   - Activity aggregation for batch operations

3. **Facilitator UI Components**
   - Class management dashboard
   - Attendance tracking interface

---

## Compliance Notes

### HIPAA
- All consent operations logged to AuditLog
- PHI limited in activity feed summaries
- Recording deletion follows 30-day retention policy

### SOC2
- Status changes require authentication
- Backward transitions audited with reason
- Consent revocation is irreversible (soft delete only)

---

*Last Updated: February 2025*
*Author: Claude Code*
