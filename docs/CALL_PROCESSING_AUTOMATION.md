# Call Processing Automation

This document describes how phone calls in Scrybe automatically trigger grant metric tracking, goal progress updates, and action item creation.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CALL LIFECYCLE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────┐ │
│  │  Call Start  │────▶│  Call Active │────▶│  endCall() - Call Completes │ │
│  └──────────────┘     └──────────────┘     └──────────────┬───────────────┘ │
│                                                           │                  │
│                                                           ▼                  │
│                                            ┌──────────────────────────────┐ │
│                                            │   GRANT METRICS TRACKED      │ │
│                                            │   (CLIENT_CONTACTS +1)       │ │
│                                            │   - No AI dependency         │ │
│                                            │   - Immediate on call end    │ │
│                                            └──────────────┬───────────────┘ │
│                                                           │                  │
│                                                           ▼                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    ASYNC: processCompletedCall()                        │ │
│  │  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────────┐ │ │
│  │  │ Deepgram   │──▶│ Field      │──▶│ Summary    │──▶│ Action Items   │ │ │
│  │  │ Transcript │   │ Extraction │   │ Generation │   │ Saved to DB    │ │ │
│  │  └────────────┘   └────────────┘   └────────────┘   └────────────────┘ │ │
│  │         ▲                                                    │          │ │
│  │         │                                                    │          │ │
│  │    Recording                                           Requires AI      │ │
│  │    from S3                                             Summary          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Principle: Separation of Concerns

**Grant metrics** and **action items** are decoupled:

| Feature | Trigger Point | AI Dependency | Failure Impact |
|---------|---------------|---------------|----------------|
| Grant Metrics | `endCall()` | None | Independent |
| Action Items | `processCompletedCall()` | Requires summary | Depends on AI |

This separation ensures:
- Grant deliverable counts are always accurate (call happened = +1 contact)
- AI failures don't affect metric tracking
- Action items only created when AI successfully generates them

---

## Grant Metrics Flow

```
┌──────────────┐     ┌───────────────────┐     ┌───────────────────────────┐
│  endCall()   │────▶│ onCallCompleted() │────▶│ trackMetricEvent()        │
└──────────────┘     └───────────────────┘     │ type: CLIENT_CONTACTS     │
                                               └─────────────┬─────────────┘
                                                             │
                     ┌───────────────────────────────────────┼───────────────┐
                     │                                       │               │
                     ▼                                       ▼               ▼
         ┌───────────────────┐               ┌───────────────────┐   ┌──────────┐
         │ findApplicable    │               │ incrementDeliver- │   │ recordKpi│
         │ Deliverables()    │               │ able() for each   │   │ Progress │
         │                   │               │ matching grant    │   │ ()       │
         │ MetricType match  │               └─────────┬─────────┘   └────┬─────┘
         └───────────────────┘                         │                  │
                                                       ▼                  │
                                           ┌───────────────────┐          │
                                           │ DeliverableProgress│          │
                                           │ (audit trail)      │          │
                                           └─────────┬─────────┘          │
                                                     │                    │
                                                     ▼                    │
                                           ┌───────────────────┐          │
                                           │ onGrantProgress   │◀─────────┘
                                           │ Updated()         │
                                           └─────────┬─────────┘
                                                     │
                                                     ▼
                                           ┌───────────────────┐
                                           │ recalculateGoal   │
                                           │ Progress()        │
                                           │ - weighted avg    │
                                           │ - status update   │
                                           └─────────┬─────────┘
                                                     │
                                                     ▼
                                           ┌───────────────────┐
                                           │ Goal Notifications │
                                           │ - milestones      │
                                           │ - at-risk alerts  │
                                           └───────────────────┘
```

### Files Involved

| File | Function | Purpose |
|------|----------|---------|
| `src/lib/services/calls.ts` | `endCall()` | Entry point - calls `onCallCompleted()` |
| `src/lib/services/grant-metrics.ts` | `onCallCompleted()` | Wraps `trackMetricEvent()` |
| `src/lib/services/grant-metrics.ts` | `trackMetricEvent()` | Core metric tracking logic |
| `src/lib/services/grant-metrics.ts` | `findApplicableDeliverables()` | Finds matching grants |
| `src/lib/services/grant-metrics.ts` | `incrementDeliverable()` | Increments and audits |
| `src/lib/services/goals.ts` | `onGrantProgressUpdated()` | Triggers goal recalc |
| `src/lib/services/goals.ts` | `recalculateGoalProgress()` | Weighted average calc |

### MetricType Mapping

Calls auto-track `CLIENT_CONTACTS`. Other metrics require different triggers:

| MetricType | Auto-Tracked From | Manual Entry |
|------------|-------------------|--------------|
| `CLIENT_CONTACTS` | Phone calls | No |
| `CLIENTS_HOUSED` | N/A | Yes (outcome) |
| `CASE_HOURS` | N/A | Yes (timesheet) |
| `ASSESSMENTS_COMPLETED` | Form submissions | Planned |
| `REFERRALS_MADE` | N/A | Yes |

---

## Action Items Flow

```
┌──────────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│ processCompletedCall │────▶│ generateCallSummary │────▶│ aiSummary JSON  │
│ ()                   │     │ ()                  │     │ .actionItems[]  │
└──────────────────────┘     └─────────────────────┘     └────────┬────────┘
                                                                  │
                                                                  ▼
                                                    ┌─────────────────────────┐
                                                    │ processCallActionItems()│
                                                    │ - Parse action items    │
                                                    │ - Match assignees       │
                                                    │ - Create reminders      │
                                                    └────────────┬────────────┘
                                                                 │
                                                                 ▼
                                                    ┌─────────────────────────┐
                                                    │ CallActionItem records  │
                                                    │ - description           │
                                                    │ - assigneeUserId        │
                                                    │ - dueDate               │
                                                    │ - status: OPEN          │
                                                    │ - source: CALL_TRANSCRIPT│
                                                    │ - aiConfidence: 0.0-1.0 │
                                                    └─────────────────────────┘
```

### Files Involved

| File | Function | Purpose |
|------|----------|---------|
| `src/lib/services/call-processing.ts` | `processCompletedCall()` | Orchestrates AI pipeline |
| `src/lib/ai/summary.ts` | `generateCallSummary()` | Extracts action items |
| `src/lib/ai/call-action-items.ts` | `processCallActionItems()` | Saves to database |

### Action Item Schema

```typescript
interface CallActionItem {
  id: string;
  callId: string;
  orgId: string;
  description: string;           // "Follow up on housing application"
  assigneeUserId: string | null; // Matched from transcript mentions
  dueDate: Date | null;          // Parsed from "by Friday" etc.
  status: ActionItemStatus;      // OPEN, IN_PROGRESS, COMPLETED, CANCELLED
  source: ActionItemSource;      // CALL_TRANSCRIPT, MANUAL
  aiConfidence: number;          // 0.0 to 1.0
  completedAt: Date | null;
  completedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Edge Cases and Failure Handling

| Scenario | Grant Metrics | Action Items | Notes |
|----------|---------------|--------------|-------|
| Call ends normally | Tracked | Created | Happy path |
| Recording upload fails | Tracked | None | Call happened, just no recording |
| Transcription fails | Tracked | None | Metrics don't need transcript |
| AI extraction fails | Tracked | None | Metrics independent of AI |
| AI summary fails | Tracked | None | Can't extract items without summary |
| AI returns empty action items | Tracked | None (expected) | Not all calls have action items |
| Client not linked to call | Skipped | Skipped | No clientId = no tracking |
| Duplicate call end | Idempotent | Idempotent | sourceId prevents duplicates |
| Grant metric tracking fails | N/A (caught) | Unaffected | Logged, doesn't block return |
| Action item creation fails | Unaffected | N/A (caught) | Logged, doesn't block return |

### Idempotency

Grant metrics use `sourceId` to prevent duplicate tracking:

```typescript
// DeliverableProgress records the source
{
  deliverableId: "del_123",
  sourceType: "call",
  sourceId: "call_456",  // Unique per call
  delta: 1,
  notes: "Auto-tracked from call completion"
}
```

If `endCall()` is called multiple times for the same call:
1. First call: Creates DeliverableProgress record
2. Subsequent calls: `findExisting` check prevents duplicates

---

## Database Schema

```
Call                      Grant                    Goal
├── id                    ├── id                   ├── id
├── clientId ─────────────┤                        ├── progress (0-100)
├── status (COMPLETED)    │                        ├── status
├── aiSummary ───────┐    │                        │
│   └── actionItems[]│    │                        │
└────────────────────┘    │                        │
                          │                        │
CallActionItem            GrantDeliverable         GoalGrant (junction)
├── id                    ├── id                   ├── goalId ─────────▶ Goal
├── callId ───────────────├── grantId ◀───────────├── grantId ─────────▶ Grant
├── description           ├── metricType           ├── weight (0.0-1.0)
├── status (OPEN/DONE)    ├── targetValue          └───────────────────────
├── source                ├── currentValue
├── aiConfidence          │
└─────────────────────────DeliverableProgress (audit)
                          ├── deliverableId
                          ├── sourceType: "call"
                          ├── sourceId: callId
                          └── delta: +1
```

### Junction Tables for Goals

Goals can aggregate progress from multiple sources:

| Junction Table | Links To | Weight Field |
|----------------|----------|--------------|
| `GoalGrant` | Grant deliverables | `weight` |
| `GoalObjective` | Custom objectives | `weight` |
| `GoalKpi` | KPI metrics | `weight` |

Progress calculation:
```
goal.progress = sum(source.progress * source.weight) / sum(weights)
```

---

## Configuration & Monitoring

### Metrics That Auto-Track

| Source | MetricType | Deliverable Field |
|--------|------------|-------------------|
| Phone calls | `CLIENT_CONTACTS` | `currentValue += 1` |
| Form submissions | `ASSESSMENTS_COMPLETED` | Planned |

### Metrics Requiring Manual Entry

- `CLIENTS_HOUSED` - Outcome-based, requires verification
- `CASE_HOURS` - Timesheet integration planned
- `REFERRALS_MADE` - Manual entry or integration

### Logs to Monitor

```bash
# Grant metric errors
grep "Failed to track grant metrics" logs/app.log

# Action item errors
grep "Failed to create action items" logs/app.log

# Processing pipeline
grep "\[CallProcessing\]" logs/app.log
```

### Health Check Queries

```sql
-- Compare completed calls vs tracked progress
SELECT
  (SELECT COUNT(*) FROM "Call" WHERE status = 'COMPLETED') as completed_calls,
  (SELECT COUNT(*) FROM "DeliverableProgress" WHERE "sourceType" = 'call') as tracked_calls;

-- Calls without grant tracking (potential issues)
SELECT c.id, c."createdAt", c."clientId"
FROM "Call" c
LEFT JOIN "DeliverableProgress" dp ON dp."sourceId" = c.id AND dp."sourceType" = 'call'
WHERE c.status = 'COMPLETED'
  AND c."clientId" IS NOT NULL
  AND dp.id IS NULL
ORDER BY c."createdAt" DESC
LIMIT 20;
```

---

## Testing

### Test Grant Metrics

1. Create a test call with a client linked
2. End the call via `endCall(callId)`
3. Verify:
   - `DeliverableProgress` record created with `sourceType = 'call'`
   - `GrantDeliverable.currentValue` incremented
   - Linked `Goal.progress` recalculated

### Test Action Items

1. Process a call with AI: `processCompletedCall(callId)`
2. Verify AI summary contains `actionItems` array
3. Check `CallActionItem` records created in database
4. Verify action items visible in Action Items tab

### Test Failure Isolation

1. Simulate AI failure (disconnect API key)
2. End a call and verify:
   - Grant metrics tracked
   - No action items (expected)
   - Error logged but call completes

---

## Troubleshooting

### Grant metrics not updating

1. **Check client linkage**: Call must have `clientId`
2. **Check grant deliverables**: Must have `metricType = CLIENT_CONTACTS`
3. **Check org match**: Client's org must match grant's org
4. **Check logs**: Look for "Failed to track grant metrics"

### Action items not created

1. **Check AI processing**: `aiProcessingStatus` must be `COMPLETED`
2. **Check summary**: `aiSummary.actionItems` must be non-empty array
3. **Check logs**: Look for "Failed to create action items"

### Goals not updating

1. **Check GoalGrant links**: Goal must be linked to grants
2. **Check weights**: Sum of weights should be > 0
3. **Check recalculation**: `onGrantProgressUpdated()` triggers recalc

---

## Code Locations

| Feature | File | Function |
|---------|------|----------|
| End call + grant metrics | `src/lib/services/calls.ts:266` | `endCall()` |
| Grant metric tracking | `src/lib/services/grant-metrics.ts:132` | `onCallCompleted()` |
| Core metric logic | `src/lib/services/grant-metrics.ts:35` | `trackMetricEvent()` |
| Call processing pipeline | `src/lib/services/call-processing.ts:63` | `processCompletedCall()` |
| Action item extraction | `src/lib/ai/call-action-items.ts` | `processCallActionItems()` |
| Goal recalculation | `src/lib/services/goals.ts` | `recalculateGoalProgress()` |
