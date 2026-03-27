# Feature Spec: Unified My Tasks Dashboard

**Date:** 2026-03-27
**Status:** Implemented
**Author:** Claude (implementation)

## Overview

Unified dashboard that aggregates all user tasks from multiple sources into a single "My Tasks" view. Previously, action items from calls, meetings, and reminders were fragmented across different pages with no unified task management experience.

### Why This Matters
- Users had to check multiple pages to see all their tasks
- No single view of "what do I need to do today"
- Action items extracted from conversations weren't surfacing at all
- Reminders were completely separate from action items

### Before vs After

| Before | After |
|--------|-------|
| `/action-items` showed Call + Meeting items only | `/action-items` shows Call + Meeting + Conversation + Reminder items |
| `/reminders` was a separate page | Reminders integrated into My Tasks |
| Conversation action items not visible anywhere | Conversation action items appear in My Tasks |
| Nav had "Action Items" + "Reminders" links | Nav has single "My Tasks" link |

## Data Sources

### 1. Call Action Items (`CallActionItem`)

Extracted from phone call transcripts via AI processing.

**Visibility Rules:**
- Assigned to user by ID (`assigneeUserId`)
- Assigned to user by name (`assigneeName`)
- From calls where user is case manager (`call.caseManagerId`)

**Status Mapping:** Direct (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)

### 2. Meeting Action Items (`MeetingActionItem`)

Extracted from uploaded meeting recordings via AI processing.

**Visibility Rules:**
- Assigned to user by ID (`assigneeUserId`)
- Assigned to user by name (`assigneeName`)
- Assigned to user by email (`assigneeName`)

**Status Mapping:** Direct (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)

### 3. Conversation Action Items (`DraftedOutput`)

Drafted outputs from conversation processing with `outputType = ACTION_ITEM`.

**Visibility Rules:**
- From conversations user created (`conversation.createdById`)

**Status Mapping:**

| DraftStatus | ActionItemStatus |
|-------------|------------------|
| PENDING | OPEN |
| FAILED | OPEN |
| APPROVED | IN_PROGRESS |
| PUSHED | COMPLETED |
| REJECTED | CANCELLED |

### 4. Reminders (`Reminder`)

User-created or workflow-generated reminders linked to clients.

**Visibility Rules:**
- Assigned to user (`assignedToId`)

**Status Mapping:**

| ReminderStatus | ActionItemStatus |
|----------------|------------------|
| PENDING | OPEN |
| SENT | OPEN |
| OVERDUE | OPEN |
| ACKNOWLEDGED | IN_PROGRESS |
| COMPLETED | COMPLETED |
| CANCELLED | CANCELLED |

## API Design

### Endpoint: `GET /api/action-items`

Unified endpoint that queries all four data sources and returns merged results.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | Filter: OPEN, IN_PROGRESS, COMPLETED, CANCELLED |
| `source` | enum | Filter: call, meeting, conversation, reminder |
| `limit` | number | Max results (default 50, max 100) |
| `offset` | number | Pagination offset |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "description": "Follow up with client about application",
      "assigneeName": "John Smith",
      "assigneeUserId": "uuid | null",
      "dueDate": "2026-03-28T00:00:00Z | null",
      "priority": "HIGH | NORMAL | LOW",
      "status": "OPEN | IN_PROGRESS | COMPLETED | CANCELLED",
      "contextSnippet": "Transcript excerpt...",
      "createdAt": "2026-03-27T10:00:00Z",
      "source": "call | meeting | conversation | reminder",
      "call": { "id": "...", "clientId": "...", "createdAt": "..." },
      "meeting": { "id": "...", "title": "...", "actualStartAt": "..." },
      "conversation": { "id": "...", "title": "...", "startedAt": "...", "originalStatus": "PENDING" },
      "reminder": { "id": "...", "title": "...", "clientId": "...", "clientName": "...", "originalStatus": "PENDING" }
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### Status Toggle Endpoints

Each source uses different endpoints for status changes:

| Source | Complete | Reopen |
|--------|----------|--------|
| Call | `PUT /api/action-items/:id` | `PUT /api/action-items/:id` |
| Meeting | `PUT /api/meetings/:id/action-items` | `PUT /api/meetings/:id/action-items` |
| Conversation | `POST /api/conversations/:id/outputs/:outputId/approve` | `POST /api/conversations/:id/outputs/:outputId/reopen` |
| Reminder | `POST /api/reminders/:id/complete` | `PUT /api/reminders/:id` |

## UI Components

### Page: `/action-items` (My Tasks)

**Header:**
- Title: "My Tasks"
- Subtitle: "Tasks assigned to you from calls, meetings, and reminders."

**Filters:**
- Status dropdown: All Status, Open, In Progress, Completed, Cancelled
- Source dropdown: All Sources, Calls, Meetings, Conversations, Reminders

**Table Columns:**
1. Done (checkbox)
2. Description (with context snippet tooltip)
3. Status (badge)
4. Due Date (with overdue highlighting)
5. Source (clickable link to source record)

**Source Display:**

| Source | Icon | Link | Subtitle |
|--------|------|------|----------|
| Call | Phone | `/calls/:id` | Date |
| Meeting | - | `/meetings/:id` | Meeting title |
| Conversation | MessageSquare | `/conversations/:id` | Date |
| Reminder | Bell | `/clients/:clientId` | Client name |

### Navigation

Sidebar changes:
- Renamed "Action Items" → "My Tasks"
- Removed "Reminders" nav item (consolidated into My Tasks)

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/services/tasks/status-mapping.ts` | Status conversion utilities |
| `apps/web/src/app/api/conversations/[id]/outputs/[outputId]/reopen/route.ts` | Reopen conversation action items |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/src/app/api/action-items/route.ts` | Added conversation + reminder queries, extended interface |
| `apps/web/src/app/(dashboard)/action-items/page.tsx` | Added source filter, handle all source types |
| `apps/web/src/components/layout/sidebar.tsx` | Renamed nav, removed Reminders |

## Status Mapping Utilities

Location: `apps/web/src/lib/services/tasks/status-mapping.ts`

```typescript
// Reminder → ActionItem
reminderToActionItemStatus(status: ReminderStatus): ActionItemStatus
actionItemStatusToReminderStatuses(status: ActionItemStatus): ReminderStatus[]

// DraftedOutput → ActionItem
draftStatusToActionItemStatus(status: DraftStatus): ActionItemStatus
actionItemStatusToDraftStatuses(status: ActionItemStatus): DraftStatus[]

// Priority conversion
numericPriorityToString(priority: number): string  // 1=HIGH, 2=NORMAL, 3=LOW
```

## Query Logic

### Call Action Items

Shows items where user is:
1. Directly assigned (`assigneeUserId = user.id`)
2. Assigned by name match (`assigneeName = user.name`)
3. Case manager on the call (`call.caseManagerId = user.id`)

This ensures case managers see ALL action items from their calls, even client-assigned ones.

### Default Filters

By default (no status filter), shows only non-completed items:
- Calls/Meetings: `status IN (OPEN, IN_PROGRESS)`
- Conversations: `status IN (PENDING, APPROVED, FAILED)`
- Reminders: `status IN (PENDING, SENT, ACKNOWLEDGED, OVERDUE)`

## HIPAA Compliance

- Existing `requireAuth()` middleware enforces authentication
- All queries filter by `orgId` for tenant isolation
- Reminders contain PHI via client association (already audited in `/reminders` endpoints)
- No additional audit logging added (viewing aggregated list, not individual records)

## Testing Checklist

### API Testing
- [ ] `GET /api/action-items` returns items from all four sources
- [ ] `?source=call` filters to call items only
- [ ] `?source=meeting` filters to meeting items only
- [ ] `?source=conversation` filters to conversation items only
- [ ] `?source=reminder` filters to reminder items only
- [ ] `?status=COMPLETED` shows completed items from all sources
- [ ] Pagination works correctly with merged results

### UI Testing
- [ ] Navigate to My Tasks, verify items from all sources appear
- [ ] Toggle complete on call action item
- [ ] Toggle complete on meeting action item
- [ ] Toggle complete on conversation action item
- [ ] Toggle complete on reminder
- [ ] Reopen completed item from each source
- [ ] Filter by source, verify correct items shown
- [ ] Filter by status, verify correct items shown
- [ ] Click source link, verify navigation works

### E2E Flow
- [ ] Create call → verify action items appear in My Tasks
- [ ] Create meeting → verify action items appear in My Tasks
- [ ] Record conversation → verify action items appear in My Tasks
- [ ] Create reminder → verify it appears in My Tasks

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Merge into `/action-items` vs new route | Minimal changes, preserves bookmarks |
| Remove Reminders nav | Single entry point reduces confusion |
| Show case manager's call items | Users expect to see tasks from their own calls |
| Map APPROVED → IN_PROGRESS | Approved but not pushed = still in progress |
| Map PENDING/SENT/OVERDUE → OPEN | All represent "needs attention" state |

## Future Enhancements

| Enhancement | Notes |
|-------------|-------|
| Bulk actions | Select multiple items, complete/cancel all |
| Due date editing | Edit due dates inline |
| Reassignment | Assign items to other team members |
| Notification integration | Push notifications for overdue items |
| Calendar sync | Export due dates to calendar |
