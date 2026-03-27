# Task Aggregation System

**Last Updated:** 2026-03-27

## Overview

The task aggregation system provides a unified view of user tasks by querying multiple data sources and normalizing them into a common format. This enables the "My Tasks" dashboard to display action items from calls, meetings, conversations, and reminders in a single interface.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GET /api/action-items                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Calls   │  │ Meetings │  │  Convos  │  │Reminders │        │
│  │  Query   │  │  Query   │  │  Query   │  │  Query   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │                │
│       ▼             ▼             ▼             ▼                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Status Mapping Layer                     │       │
│  │   ReminderStatus → ActionItemStatus                   │       │
│  │   DraftStatus → ActionItemStatus                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              UnifiedActionItem[]                      │       │
│  │   - Sorted by dueDate (nulls last)                   │       │
│  │   - Paginated                                         │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### Source Models

| Model | Table | Status Enum | Has UserId |
|-------|-------|-------------|------------|
| CallActionItem | call_action_items | ActionItemStatus | Yes (optional) |
| MeetingActionItem | meeting_action_items | ActionItemStatus | Yes (optional) |
| DraftedOutput | drafted_outputs | DraftStatus | No |
| Reminder | reminders | ReminderStatus | Yes (required) |

### Unified Interface

```typescript
interface UnifiedActionItem {
  id: string;
  description: string;
  assigneeName: string | null;
  assigneeUserId: string | null;
  dueDate: string | null;
  priority: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  contextSnippet: string | null;
  createdAt: string;
  source: "call" | "meeting" | "conversation" | "reminder";

  // Source-specific data (only one populated)
  call?: { id, clientId, createdAt };
  meeting?: { id, title, actualStartAt, scheduledStartAt };
  conversation?: { id, title, startedAt, originalStatus };
  reminder?: { id, title, clientId, clientName, originalStatus };
}
```

## Status Mapping

### ReminderStatus → ActionItemStatus

```typescript
PENDING      → OPEN
SENT         → OPEN
OVERDUE      → OPEN
ACKNOWLEDGED → IN_PROGRESS
COMPLETED    → COMPLETED
CANCELLED    → CANCELLED
```

### DraftStatus → ActionItemStatus

```typescript
PENDING  → OPEN
FAILED   → OPEN
APPROVED → IN_PROGRESS
PUSHED   → COMPLETED
REJECTED → CANCELLED
```

### Reverse Mapping (for filtering)

When user filters by ActionItemStatus, we convert to source-specific statuses:

```typescript
// Filter by OPEN
calls/meetings: status = "OPEN"
conversations: status IN ("PENDING", "FAILED")
reminders: status IN ("PENDING", "SENT", "OVERDUE")
```

## Query Patterns

### Call Action Items

```typescript
const callWhere = {
  orgId: user.orgId,
  OR: [
    { assigneeUserId: user.id },
    { assigneeName: user.name },
    { call: { caseManagerId: user.id } },  // Show all from user's calls
  ],
  ...(status && { status }),
};
```

**Key insight:** Including `call.caseManagerId` ensures case managers see ALL action items from their calls, even those assigned to clients or with generic names.

### Meeting Action Items

```typescript
const meetingWhere = {
  meeting: { orgId: user.orgId },
  OR: [
    { assigneeUserId: user.id },
    { assigneeName: user.name },
    { assigneeName: user.email },
  ],
  ...(status && { status }),
};
```

### Conversation Action Items

```typescript
const draftWhere = {
  outputType: "ACTION_ITEM",
  conversation: {
    orgId: user.orgId,
    createdById: user.id,  // Only from user's conversations
  },
  ...(draftStatuses && { status: { in: draftStatuses } }),
};
```

### Reminders

```typescript
const reminderWhere = {
  orgId: user.orgId,
  assignedToId: user.id,  // Only assigned to user
  ...(reminderStatuses && { status: { in: reminderStatuses } }),
};
```

## Sorting Strategy

Results are merged and sorted client-side after all queries complete:

```typescript
results.sort((a, b) => {
  // Due date ascending (nulls last)
  if (!a.dueDate && !b.dueDate) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  }
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return new Date(a.dueDate) - new Date(b.dueDate);
});
```

## Pagination

Pagination is applied AFTER merging and sorting:

```typescript
const total = results.length;
const paginatedResults = results.slice(offset, offset + limit);
```

**Trade-off:** This means we fetch all matching records from all sources, then paginate. For users with many tasks, this could be inefficient. Future optimization: use cursor-based pagination with database-level sorting.

## Status Update Endpoints

Each source has different endpoints for status changes:

### Call Action Items
```
PUT /api/action-items/:id
Body: { status: "COMPLETED" | "OPEN" }
```

### Meeting Action Items
```
PUT /api/meetings/:meetingId/action-items
Body: { actionItemId: "...", status: "COMPLETED" | "OPEN" }
```

### Conversation Action Items
```
POST /api/conversations/:id/outputs/:outputId/approve  # → APPROVED
POST /api/conversations/:id/outputs/:outputId/reopen   # → PENDING
```

### Reminders
```
POST /api/reminders/:id/complete  # → COMPLETED
PUT /api/reminders/:id            # → any status
Body: { status: "PENDING" }
```

## File Structure

```
apps/web/src/
├── app/
│   ├── api/
│   │   └── action-items/
│   │       └── route.ts           # Unified GET endpoint
│   └── (dashboard)/
│       └── action-items/
│           └── page.tsx           # My Tasks UI
└── lib/
    └── services/
        └── tasks/
            └── status-mapping.ts  # Status conversion utilities
```

## Performance Considerations

### Current Approach
- 4 parallel database queries (one per source)
- In-memory merge and sort
- Pagination after merge

### Potential Optimizations
1. **Database-level UNION** - Single query with UNION ALL, but complex due to different schemas
2. **Materialized view** - Pre-computed task list, updated via triggers
3. **Cursor pagination** - Avoid fetching all results
4. **Caching** - Cache per-user task list, invalidate on changes

### When to Optimize
- User has >1000 tasks across sources
- P95 latency exceeds 500ms
- Database CPU spikes during task list loads

## Error Handling

Each source query is independent. If one fails, we log the error but continue with other sources:

```typescript
// Future enhancement: partial results with error indicator
{
  "success": true,
  "data": [...],
  "errors": [
    { "source": "conversations", "message": "Query timeout" }
  ]
}
```

Currently, any error fails the entire request.

## Testing

### Unit Tests
- Status mapping functions (all edge cases)
- Priority conversion

### Integration Tests
- Query returns items from all sources
- Source filtering works
- Status filtering maps correctly
- Pagination works with merged results

### E2E Tests
- Create item in each source → appears in My Tasks
- Toggle status → updates correctly
- Filter combinations work
