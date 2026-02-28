# Call Context for Goal Updates

## Problem Statement

Currently, goal history shows minimal context: "James Washington - call completed". This lacks the rich information needed for:
1. **Impact reporting** - Funders want to know *what happened*, not just that a call occurred
2. **Grant updates** - Progress narratives need client needs identified, actions taken, outcomes achieved
3. **Cross-industry application** - The same pattern applies to tech standups, sales calls, healthcare follow-ups

## Vision

When a call completes, capture the full context and create a draft goal update that surfaces:
- **Client/participant needs identified** during the conversation
- **Action items** the team member will take
- **Outcomes** achieved or progress made
- **Next steps** planned

### Social Services Example

> **Goal:** Q1 2026 Housing Placements
>
> **Call with Maria Garcia (Jan 15, 2026)**
>
> During this call, we identified Maria's housing needs:
> - Prefers downtown area for proximity to public transit
> - Needs pet-friendly unit (has emotional support animal)
> - Budget constraint: max $1,200/month
>
> **Action items:**
> - [ ] Submit application to Downtown Transitional Housing by Friday
> - [ ] Contact landlord about ESA documentation
>
> **Outcome:** Client moved to active housing search status

### Tech Company Example

> **Goal:** Q1 Auth System Refactor
>
> **Standup with Engineering Team (Jan 15, 2026)**
>
> Project update from the team: Testing phase completed successfully.
>
> **Key points:**
> - All 47 integration tests passing
> - Security review approved the new token rotation
> - Performance benchmarks show 40% improvement
>
> **Action items:**
> - [ ] Schedule production deployment for next sprint
> - [ ] Update documentation for new auth flow
>
> **Outcome:** Ready for production deployment

## Technical Approach

### Data Flow

```
Call Ends
    ↓
AI Processing (existing)
    ↓
aiSummary extracted:
  - overview
  - keyPoints
  - actionItems
  - nextSteps
  - sentiment
  - topics
    ↓
Find Applicable Goals:
  1. Client-linked (client → programs → grants → goals)
  2. Topic-matched (AI analyzes topics vs goal names)
    ↓
Generate Draft Updates:
  - Natural narrative per goal
  - Relevant action items filtered
  - Key points mapped
    ↓
CallGoalDraft created (status: PENDING)
    ↓
Case Manager Reviews
    ↓
Approve / Edit / Reject
    ↓
GoalProgress created with rich context
    ↓
History tab shows expandable details
```

### New Database Model

```prisma
model CallGoalDraft {
  id            String   @id @default(cuid())
  callId        String
  call          Call     @relation(fields: [callId], references: [id])
  goalId        String
  goal          Goal     @relation(fields: [goalId], references: [id])

  // Draft content
  narrative     String   // AI-generated natural language update
  actionItems   Json     // Action items relevant to this goal
  keyPoints     Json     // Key points relevant to this goal
  clientNeeds   Json?    // Identified client needs (if applicable)
  outcomes      Json?    // Outcomes or progress achieved
  sentiment     String?
  topics        Json

  // Mapping metadata
  mappingType   String   // "client_linked" | "topic_matched" | "manual"
  confidence    Float    // AI confidence (0-1)

  // Review workflow
  status        String   @default("PENDING")
  reviewedById  String?
  reviewedBy    User?    @relation(fields: [reviewedById], references: [id])
  reviewedAt    DateTime?
  editedContent String?

  createdAt     DateTime @default(now())

  @@unique([callId, goalId])
}
```

### Rich Goal History

When approved, the `GoalProgress.notes` field stores structured JSON:

```typescript
interface RichCallContext {
  type: "call_context";
  callId: string;
  participantName: string;  // Client name or team/meeting name
  narrative: string;
  clientNeeds?: string[];
  actionItems: string[];
  keyPoints: string[];
  outcomes?: string[];
  sentiment?: string;
  topics: string[];
}
```

## UI Design

### History Tab - Hybrid Display

**Collapsed view (default):**
```
┌─────────────────────────────────────────────────────────┐
│ 🔵 Auto                                      Jan 15     │
│                                                         │
│ During this call with Maria Garcia, we identified her   │
│ housing needs and created a plan to submit application  │
│ to Downtown Transitional Housing.                       │
│                                                         │
│ [▼ Show details]                                        │
└─────────────────────────────────────────────────────────┘
```

**Expanded view:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔵 Auto                                      Jan 15     │
│                                                         │
│ During this call with Maria Garcia, we identified her   │
│ housing needs and created a plan to submit application  │
│ to Downtown Transitional Housing.                       │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ 📋 Client Needs                                         │
│ • Downtown area (public transit access)                 │
│ • Pet-friendly unit (ESA)                               │
│ • Budget: max $1,200/month                              │
│                                                         │
│ ✅ Action Items                                         │
│ • Submit application to Downtown Transitional Housing   │
│ • Contact landlord about ESA documentation              │
│                                                         │
│ 🏷️ Topics                                               │
│ [Housing] [Documentation] [Budget]                      │
│                                                         │
│ [▲ Hide details]                                        │
└─────────────────────────────────────────────────────────┘
```

### Draft Review UI

New section in goal detail page or dedicated `/goals/[goalId]/drafts` route:

```
┌─────────────────────────────────────────────────────────┐
│ 📝 Pending Updates (2)                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Call with Maria Garcia - Jan 15, 2026                   │
│ ───────────────────────────────────────────────────     │
│ During this call, we identified Maria's housing needs   │
│ and created a plan to submit application...             │
│                                                         │
│ Action Items: 2 | Key Points: 3 | Topics: Housing       │
│                                                         │
│        [Edit]    [Reject]    [✓ Approve]                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Industry Adaptability

The system works across industries because:

| Component | Social Services | Tech/Engineering | Sales | Healthcare |
|-----------|-----------------|------------------|-------|------------|
| **Participant** | Client | Team member | Prospect | Patient |
| **Goals** | Housing placements, enrollments | Sprint goals, OKRs | Pipeline targets | Treatment outcomes |
| **Needs** | Housing, employment, benefits | Resources, blockers | Budget, timeline | Symptoms, concerns |
| **Action Items** | Applications, referrals | Tasks, tickets | Follow-ups, demos | Appointments, prescriptions |
| **Outcomes** | Status changes, milestones | Completions, launches | Deals, stages | Improvements, diagnoses |

The AI generates narratives appropriate to the context based on:
1. Goal name and description
2. Call content and extracted data
3. Organizational context (nonprofit vs tech vs sales)

## Implementation Phases

### Phase 1: Draft Creation Pipeline
- Add `CallGoalDraft` model
- Create draft service with goal mapping logic
- Hook into `call-processing.ts` after AI summary

### Phase 2: Review Workflow
- API endpoints for draft CRUD
- Basic review UI in goal detail page
- Approve/edit/reject actions

### Phase 3: Rich History Display
- Enhanced history tab component
- Collapsible detail sections
- Backward compatible with plain text notes

### Phase 4: Polish
- Pending drafts badge/notification
- Batch review capability
- Topic vocabulary customization

## Impact on Reporting

With rich context captured per goal, impact reports can aggregate:

> **Q1 2026 Housing Placements**
>
> **Summary:** 47 client contacts, 23 housing applications submitted
>
> **Key Themes:**
> - 65% of clients need pet-friendly housing
> - Transportation access is top priority
> - Average time from first contact to application: 2.3 weeks
>
> **Notable Outcomes:**
> - Maria Garcia: Placed in Downtown Transitional (Jan 22)
> - James Wilson: Application pending at Riverside Apartments
> - ...

This enables funders to see not just numbers, but the story of how those numbers were achieved.

## Success Criteria

1. **For case managers:** Drafts save time vs. manual goal updates
2. **For supervisors:** Rich context aids in understanding team work
3. **For funders:** Impact reports tell compelling stories with evidence
4. **For product:** Same system works for social services AND tech teams
