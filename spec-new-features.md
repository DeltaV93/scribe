# Scrybe Solutions
## New Features Technical Specification
### Mass Notes | Photo-to-Form Conversion | Automated Reporting
**Version 1.0 | January 2025**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Discovery Interview Summary](#discovery-interview-summary)
3. [Shared Infrastructure](#shared-infrastructure)
4. [Feature 1: Mass Notes on Attendance Upload](#feature-1-mass-notes-on-attendance-upload)
5. [Feature 2: Photo/PDF to Form Conversion](#feature-2-photopdf-to-form-conversion)
6. [Feature 3: Automated Report Generation](#feature-3-automated-report-generation)
7. [Database Schema Changes](#database-schema-changes)
8. [API Endpoints](#api-endpoints)
9. [Security Implementation](#security-implementation)
10. [Testing Strategy](#testing-strategy)
11. [Deferred to V2](#deferred-to-v2)
12. [Lessons Learned](#lessons-learned)

---

## Executive Summary

This specification details three new features identified during the ONH discovery meeting with Carly, Director of Reentry Services. These features address critical pain points around data entry burden, legacy form migration, and reporting overhead.

| Feature | Core Value | Priority | Infrastructure Dependencies |
|---------|------------|----------|----------------------------|
| Mass Notes | Apply one case note to hundreds of clients after group sessions | 1 (Highest) | Job Queue, Notification System |
| Photo/PDF to Form | Convert existing paper forms and PDFs into digital forms | 2 | Job Queue, PDF Processing, Claude Vision |
| Automated Reporting | Generate funder reports with AI-assisted narratives | 3 | Job Queue, Report Engine, Claude API |

### Key Architectural Decisions

Based on extensive discovery interviews, the following cross-cutting decisions apply:

- **Job Queue**: BullMQ + AWS ElastiCache (Redis) for all async processing
- **Permissions**: Role + Feature Toggles (org-level feature flags with existing role hierarchy)
- **Notifications**: Toast-based for V1, Notification Center deferred to V2
- **Build Order**: Infrastructure first (job queue + base systems), then features incrementally

---

## Discovery Interview Summary

### Decisions Made

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Mass Note Storage | Individual Note per client | Maintains existing Note model integrity, simpler queries per client |
| Batch Write Strategy | Async job with batching + retry queue | Handles scale (400+ clients), resilient to failures |
| Variable Substitution | Resolve at write time | Immutable audit trail, compliance-friendly |
| Variable Preview | Sample preview (1-3 clients) | Simpler UI, scales to 400+ clients |
| Job Notifications | In-app only (V1) | Toast when job completes if user online |
| Exception Notes | Both during creation and after batch | Maximum flexibility for staff |
| Session Linkage | FK on Note model (sessionId) | Optimized queries, referential integrity |
| Note Templates | Hierarchical (org → program → user) | Scales for multiple industries |
| Template Inheritance | Variable inheritance only | Templates don't inherit text, only variable definitions |
| Template Conflicts | Show all with scope prefix | '[Org] Template', '[Program] Template' |
| Note Typing | Add isMassNote boolean | Preserves internal/shareable distinction |
| Duplicate Notes | Skip duplicates | Check for existing session notes, only create for clients without |
| Error Handling | Retry queue with exponential backoff | Most resilient for async jobs |
| Form Field Detection | Map + flag unsupported | Map to closest existing type, flag limitations |
| OCR Engine | Hybrid (Claude for photos, native for clean PDFs) | Optimize per input type |
| Multi-Page Handling | AI-detected sections | Headers define sections, not page boundaries |
| Validation Inference | Tiered confidence | Auto-apply >90%, flag 70-90% for review, skip <70% |
| Source Retention | Keep for exportable forms, delete others | 30 days for non-exportable |
| Layout Fidelity | Semantic only | Extract fields in order, ignore positioning |
| Export Requirement | Critical V1 - Form overlay | Overlay filled data onto original PDF |
| Duplicate Detection | Hybrid fingerprint + Jaccard | Exact match + similar form detection |
| PDF Security | Full defense in depth | Sanitize + sandbox + flatten |
| Low Confidence Handling | Require review for publish | Can save as draft, must review before publish |
| Report Templates | Built-in + custom + AI-assisted | Maximum flexibility |
| Data Source | Live database queries | Always current, no stale data |
| Cross-Org Access | Fiscal agent sees all (with full audit) | ONH use case, transparent logging |
| Narrative Style | Fixed professional tone | Consistent grant-writing voice |
| Failure Handling | Retry + alert admin | 3x retry with backoff, then alert |
| Mapping Drift | Break loudly + offer suggestions | Force human fix with AI assistance |
| API Submission | One integration for V1 | Proof of concept, learn patterns |
| Report Archives | 7-year retention with tiered storage | Recent: full PDF, older: data snapshot |
| Calculation Complexity | Full engine + pre-built metrics library | HUD metrics as quick-add, extensible |
| Metrics Maintenance | Scribe-maintained, clonable | Official metrics locked, can clone to customize |
| Report Generation | AI-driven with goal-based questionnaire | Not field-by-field mapping |
| Explanation Depth | Goal-connected | Explain how metrics connect to stated goals |
| User Edits | Full edit capability | Add/modify/remove metrics |
| Preview Data | Anonymized real data | Realistic without exposing specifics |
| Template Sharing | Publish workflow | Drafts private, publish to make org-wide |
| Built-in Templates | AI-generated from funder docs | Always up-to-date with regulations |
| Funder Doc Input | All approaches | Upload, Scribe-curated library, URL fetch |
| Partner Notification | No notification (backlog) | Fiscal agent access contractually agreed |

### Tradeoffs Accepted

1. **Individual Notes vs Junction Table**: Chose N writes over schema complexity. Accepted DB write implications for large batches (400+ inserts).

2. **Toast-only Notifications**: Deferred notification center to V2. Users may miss notifications if offline during job completion.

3. **Semantic-only Layout**: Won't match original form appearance. Acceptable for digital use, may not satisfy users wanting pixel-perfect recreation.

4. **Live Database Queries**: May be slow for complex aggregations. Accepted for guaranteed data freshness; will revisit if performance issues arise.

5. **Single Funder Integration V1**: Limited direct submission capability. Users manually upload to most funder portals initially.

6. **Tiered Report Storage**: Old reports may look different if regenerated due to template changes. Accepted for storage efficiency.

---

## Shared Infrastructure

### Job Queue System (BullMQ + Redis)

All three features rely on async processing. Build unified job infrastructure first.

```typescript
// src/lib/jobs/queue.ts
import { Queue, Worker, QueueScheduler } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Job types for all features
export type JobType =
  | 'mass-note-batch'
  | 'form-conversion'
  | 'report-generation'
  | 'report-narrative';

export interface JobData {
  type: JobType;
  orgId: string;
  userId: string;
  payload: unknown;
}

export const mainQueue = new Queue<JobData>('scrybe-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Scheduler for delayed/recurring jobs
export const scheduler = new QueueScheduler('scrybe-jobs', { connection });

// Worker setup in separate process
export function createWorker() {
  return new Worker<JobData>('scrybe-jobs', async (job) => {
    switch (job.data.type) {
      case 'mass-note-batch':
        return processMassNoteBatch(job);
      case 'form-conversion':
        return processFormConversion(job);
      case 'report-generation':
        return processReportGeneration(job);
      case 'report-narrative':
        return processReportNarrative(job);
      default:
        throw new Error(`Unknown job type: ${job.data.type}`);
    }
  }, {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // 10 jobs per second
    },
  });
}
```

### Job Progress & Notification System

```typescript
// src/lib/jobs/progress.ts
import { prisma } from '@/lib/db';

export interface JobProgress {
  id: string;
  type: JobType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  total: number;
  completed: number;
  failed: number;
  result?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function updateJobProgress(
  jobId: string,
  update: Partial<JobProgress>
) {
  await prisma.jobProgress.update({
    where: { id: jobId },
    data: {
      ...update,
      updatedAt: new Date(),
    },
  });

  // If job completed or failed, create notification
  if (update.status === 'completed' || update.status === 'failed') {
    await createJobNotification(jobId, update.status);
  }
}

async function createJobNotification(jobId: string, status: 'completed' | 'failed') {
  const job = await prisma.jobProgress.findUnique({
    where: { id: jobId },
    include: { user: true },
  });

  if (!job) return;

  await prisma.notification.create({
    data: {
      userId: job.userId,
      type: 'JOB_COMPLETE',
      title: getJobTitle(job.type, status),
      message: getJobMessage(job),
      metadata: { jobId, jobType: job.type },
      read: false,
    },
  });
}

function getJobTitle(type: JobType, status: 'completed' | 'failed'): string {
  const titles: Record<JobType, Record<string, string>> = {
    'mass-note-batch': {
      completed: 'Mass notes created',
      failed: 'Mass notes failed',
    },
    'form-conversion': {
      completed: 'Form conversion complete',
      failed: 'Form conversion failed',
    },
    'report-generation': {
      completed: 'Report generated',
      failed: 'Report generation failed',
    },
    'report-narrative': {
      completed: 'Narrative generated',
      failed: 'Narrative generation failed',
    },
  };
  return titles[type][status];
}
```

### Feature Flags System

```typescript
// src/lib/features/flags.ts
export interface FeatureFlags {
  massNotes: boolean;
  photoToForm: boolean;
  automatedReporting: boolean;
  crossOrgReporting: boolean; // Fiscal agent only
}

export const DEFAULT_FLAGS: FeatureFlags = {
  massNotes: false,
  photoToForm: false,
  automatedReporting: false,
  crossOrgReporting: false,
};

export async function getFeatureFlags(orgId: string): Promise<FeatureFlags> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { featureFlags: true },
  });

  return {
    ...DEFAULT_FLAGS,
    ...(org?.featureFlags as Partial<FeatureFlags> ?? {}),
  };
}

export async function checkFeatureAccess(
  orgId: string,
  feature: keyof FeatureFlags
): Promise<boolean> {
  const flags = await getFeatureFlags(orgId);
  return flags[feature];
}

// Middleware helper
export function requireFeature(feature: keyof FeatureFlags) {
  return async (req: NextRequest) => {
    const session = await getSession(req);
    const hasAccess = await checkFeatureAccess(session.orgId, feature);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Feature not enabled for your organization' },
        { status: 403 }
      );
    }
  };
}
```

---

## Feature 1: Mass Notes on Attendance Upload

### Overview

Extend the existing attendance system to allow users to apply a single case note template to all present clients from a session. The system creates individual Note records per client with resolved template variables.

### User Workflow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Upload Attendance│ ──► │ Review Detected  │ ──► │ Select Template │
│ Sheet Photo      │     │ Attendance       │     │ or Write Custom │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ View Progress   │ ◄── │ Async Job Creates│ ◄── │ Preview Sample  │
│ Toast on Done   │     │ Individual Notes │     │ + Flag Exceptions│
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Template System

#### Template Model

```typescript
interface NoteTemplate {
  id: string;
  orgId: string;
  programId?: string;        // null = org-level
  userId?: string;           // null = not user-level
  scope: 'org' | 'program' | 'user';
  name: string;
  content: string;           // Template with {{variables}}
  availableVariables: string[];  // Inherited + custom
  sessionType?: string;      // e.g., 'career_planning', 'isp'
  isDefault: boolean;        // Default for this session type
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Available template variables (inherited by all scopes)
const BASE_VARIABLES = [
  '{{client_name}}',
  '{{client_first_name}}',
  '{{date}}',
  '{{session_type}}',
  '{{session_name}}',
  '{{facilitator}}',
  '{{location}}',
  '{{duration}}',
  '{{program_name}}',
];
```

#### Template Resolution

```typescript
// src/lib/services/note-templates.ts
export async function getTemplatesForSession(
  orgId: string,
  programId: string,
  userId: string,
  sessionType?: string
): Promise<NoteTemplate[]> {
  const templates = await prisma.noteTemplate.findMany({
    where: {
      OR: [
        { orgId, scope: 'org' },
        { programId, scope: 'program' },
        { userId, scope: 'user' },
      ],
    },
    orderBy: [
      { scope: 'asc' }, // org first, then program, then user
      { name: 'asc' },
    ],
  });

  // Add scope prefix for display
  return templates.map(t => ({
    ...t,
    displayName: `[${t.scope.charAt(0).toUpperCase() + t.scope.slice(1)}] ${t.name}`,
  }));
}

export function resolveTemplateVariables(
  template: string,
  context: TemplateContext,
  client: Client
): string {
  const variables: Record<string, string> = {
    '{{client_name}}': `${client.firstName} ${client.lastName}`,
    '{{client_first_name}}': client.firstName,
    '{{date}}': format(context.sessionDate, 'MMMM d, yyyy'),
    '{{session_type}}': context.sessionType ?? '',
    '{{session_name}}': context.sessionName,
    '{{facilitator}}': context.facilitatorName,
    '{{location}}': context.location ?? '',
    '{{duration}}': context.duration ? `${context.duration} minutes` : '',
    '{{program_name}}': context.programName,
  };

  let resolved = template;
  for (const [key, value] of Object.entries(variables)) {
    resolved = resolved.replace(new RegExp(key, 'g'), value);
  }
  return resolved;
}
```

### Mass Note Creation Flow

```typescript
// src/lib/services/mass-notes.ts
export interface MassNoteInput {
  sessionId: string;
  attendanceUploadId: string;
  templateId?: string;
  customContent?: string;
  presentClientIds: string[];
  exceptionNotes: Record<string, string>; // clientId -> custom note
}

export async function createMassNoteJob(
  input: MassNoteInput,
  userId: string,
  orgId: string
): Promise<string> {
  // Create job progress record
  const jobProgress = await prisma.jobProgress.create({
    data: {
      type: 'mass-note-batch',
      userId,
      orgId,
      status: 'pending',
      progress: 0,
      total: input.presentClientIds.length,
      completed: 0,
      failed: 0,
      metadata: {
        sessionId: input.sessionId,
        templateId: input.templateId,
      },
    },
  });

  // Queue the job
  await mainQueue.add('mass-note-batch', {
    type: 'mass-note-batch',
    orgId,
    userId,
    payload: {
      ...input,
      jobProgressId: jobProgress.id,
    },
  });

  return jobProgress.id;
}

// Worker processor
async function processMassNoteBatch(job: Job<JobData>) {
  const { payload, userId, orgId } = job.data;
  const {
    sessionId,
    templateId,
    customContent,
    presentClientIds,
    exceptionNotes,
    jobProgressId,
  } = payload as MassNoteInput & { jobProgressId: string };

  // Get template and session context
  const template = templateId
    ? await prisma.noteTemplate.findUnique({ where: { id: templateId } })
    : null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      program: true,
      facilitator: true,
    },
  });

  const context: TemplateContext = {
    sessionId,
    sessionDate: session.scheduledAt,
    sessionType: session.type,
    sessionName: session.name,
    facilitatorName: `${session.facilitator.firstName} ${session.facilitator.lastName}`,
    location: session.location,
    duration: session.durationMinutes,
    programName: session.program.name,
  };

  const noteContent = customContent ?? template?.content ?? '';

  // Check for existing notes (skip duplicates)
  const existingNotes = await prisma.note.findMany({
    where: {
      sessionId,
      clientId: { in: presentClientIds },
    },
    select: { clientId: true },
  });
  const existingClientIds = new Set(existingNotes.map(n => n.clientId));

  // Filter out clients who already have notes
  const clientsToProcess = presentClientIds.filter(id => !existingClientIds.has(id));
  const skippedCount = presentClientIds.length - clientsToProcess.length;

  // Get client details for variable resolution
  const clients = await prisma.client.findMany({
    where: { id: { in: clientsToProcess } },
  });

  // Process in batches of 50
  const BATCH_SIZE = 50;
  let completedCount = 0;
  let failedCount = 0;
  const failedClientIds: string[] = [];

  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    const batch = clients.slice(i, i + BATCH_SIZE);

    try {
      await prisma.$transaction(async (tx) => {
        for (const client of batch) {
          // Check for exception note
          const content = exceptionNotes[client.id]
            ? exceptionNotes[client.id]
            : resolveTemplateVariables(noteContent, context, client);

          await tx.note.create({
            data: {
              clientId: client.id,
              authorId: userId,
              sessionId,
              type: 'INTERNAL',
              content,
              isMassNote: true,
              tags: ['mass-note', session.type ?? ''].filter(Boolean),
              isDraft: false,
            },
          });
        }
      });

      completedCount += batch.length;
    } catch (error) {
      // Log failed batch, continue with others
      failedCount += batch.length;
      failedClientIds.push(...batch.map(c => c.id));
      console.error(`Mass note batch failed:`, error);
    }

    // Update progress
    const progress = Math.round(((completedCount + failedCount) / clients.length) * 100);
    await updateJobProgress(jobProgressId, {
      status: 'processing',
      progress,
      completed: completedCount,
      failed: failedCount,
    });

    // Report progress to BullMQ
    await job.updateProgress(progress);
  }

  // Handle failed records - add to retry queue
  if (failedClientIds.length > 0) {
    await mainQueue.add('mass-note-batch', {
      type: 'mass-note-batch',
      orgId,
      userId,
      payload: {
        sessionId,
        templateId,
        customContent,
        presentClientIds: failedClientIds,
        exceptionNotes,
        jobProgressId,
        isRetry: true,
      },
    }, {
      delay: 5000, // 5 second delay for retry
      attempts: 2, // Reduced attempts for retries
    });
  }

  // Final status
  const finalStatus = failedClientIds.length > 0 ? 'completed' : 'completed';
  await updateJobProgress(jobProgressId, {
    status: finalStatus,
    progress: 100,
    completed: completedCount,
    failed: failedCount,
    result: {
      created: completedCount,
      skipped: skippedCount,
      failed: failedCount,
      retriesQueued: failedClientIds.length,
    },
  });

  return {
    created: completedCount,
    skipped: skippedCount,
    failed: failedCount,
  };
}
```

### UI Components

```typescript
// src/components/attendance/mass-note-dialog.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MassNoteDialogProps {
  sessionId: string;
  attendanceUploadId: string;
  presentClients: Array<{ id: string; name: string }>;
  onClose: () => void;
}

export function MassNoteDialog({
  sessionId,
  attendanceUploadId,
  presentClients,
  onClose,
}: MassNoteDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customContent, setCustomContent] = useState('');
  const [exceptionClients, setExceptionClients] = useState<Set<string>>(new Set());
  const [exceptionNotes, setExceptionNotes] = useState<Record<string, string>>({});

  // Fetch available templates
  const { data: templates } = useQuery({
    queryKey: ['note-templates', sessionId],
    queryFn: () => fetchTemplates(sessionId),
  });

  // Fetch session context for preview
  const { data: sessionContext } = useQuery({
    queryKey: ['session-context', sessionId],
    queryFn: () => fetchSessionContext(sessionId),
  });

  const createMassNote = useMutation({
    mutationFn: (data: MassNoteInput) =>
      fetch('/api/mass-notes', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (data) => {
      toast.success(`Creating notes for ${presentClients.length} clients...`, {
        description: 'You\'ll be notified when complete.',
      });
      onClose();
    },
  });

  const selectedTemplateContent = templates?.find(t => t.id === selectedTemplate)?.content ?? '';
  const noteContent = customContent || selectedTemplateContent;

  // Generate sample preview (first 3 clients)
  const samplePreviews = presentClients.slice(0, 3).map(client => ({
    client,
    preview: sessionContext
      ? resolveTemplateVariables(noteContent, sessionContext, client)
      : noteContent,
  }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Mass Note</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Apply a note to {presentClients.length} present clients
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Selection */}
          <div>
            <label className="text-sm font-medium">Select Template</label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template or write custom" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Note */}
          <div>
            <label className="text-sm font-medium">
              {selectedTemplate ? 'Or write custom note' : 'Write note'}
            </label>
            <Textarea
              value={customContent}
              onChange={(e) => setCustomContent(e.target.value)}
              placeholder="Enter note content... Use {{client_name}}, {{date}}, etc."
              rows={4}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {BASE_VARIABLES.map(v => (
                <Badge
                  key={v}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setCustomContent(prev => prev + ' ' + v)}
                >
                  {v}
                </Badge>
              ))}
            </div>
          </div>

          {/* Sample Preview */}
          <div>
            <label className="text-sm font-medium">Preview (sample)</label>
            <div className="mt-2 space-y-2">
              {samplePreviews.map(({ client, preview }) => (
                <div key={client.id} className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">{client.name}</p>
                  <p className="text-sm text-muted-foreground">{preview}</p>
                </div>
              ))}
              {presentClients.length > 3 && (
                <p className="text-sm text-muted-foreground">
                  ...and {presentClients.length - 3} more clients
                </p>
              )}
            </div>
          </div>

          {/* Exception Notes */}
          <div>
            <label className="text-sm font-medium">Exception Notes (optional)</label>
            <p className="text-sm text-muted-foreground mb-2">
              Flag clients who need individual notes
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {presentClients.map(client => (
                <div key={client.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={exceptionClients.has(client.id)}
                    onChange={(e) => {
                      const next = new Set(exceptionClients);
                      if (e.target.checked) {
                        next.add(client.id);
                      } else {
                        next.delete(client.id);
                        const nextNotes = { ...exceptionNotes };
                        delete nextNotes[client.id];
                        setExceptionNotes(nextNotes);
                      }
                      setExceptionClients(next);
                    }}
                  />
                  <span className="text-sm flex-1">{client.name}</span>
                  {exceptionClients.has(client.id) && (
                    <Textarea
                      value={exceptionNotes[client.id] ?? ''}
                      onChange={(e) => setExceptionNotes(prev => ({
                        ...prev,
                        [client.id]: e.target.value,
                      }))}
                      placeholder="Custom note for this client..."
                      rows={2}
                      className="flex-1"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => createMassNote.mutate({
                sessionId,
                attendanceUploadId,
                templateId: selectedTemplate || undefined,
                customContent: customContent || undefined,
                presentClientIds: presentClients.map(c => c.id),
                exceptionNotes,
              })}
              disabled={!noteContent || createMassNote.isPending}
            >
              Create {presentClients.length} Notes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Feature 2: Photo/PDF to Form Conversion

### Overview

AI-powered conversion system that accepts photos of paper forms or PDF documents and automatically generates corresponding digital forms within Scrybe. Uses hybrid OCR approach: Claude Vision for photos, native PDF text extraction for clean PDFs.

### Processing Pipeline

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Upload PDF  │ ──► │ Security Check   │ ──► │ Determine Type  │
│ or Photo    │     │ Sanitize+Sandbox │     │ Photo vs PDF    │
└─────────────┘     └──────────────────┘     └─────────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    │                                 │                                 │
                    ▼                                 ▼                                 ▼
           ┌─────────────┐                   ┌─────────────┐                   ┌─────────────┐
           │ Photo: Use  │                   │ Clean PDF:  │                   │ Scanned PDF:│
           │ Claude Vision│                   │ Native Text │                   │ Claude Vision│
           │ for OCR+Fields│                  │ Extraction  │                   │ per page    │
           └─────────────┘                   └─────────────┘                   └─────────────┘
                    │                                 │                                 │
                    └─────────────────────────────────┼─────────────────────────────────┘
                                                      ▼
                                              ┌─────────────┐
                                              │ AI Field    │
                                              │ Detection   │
                                              └─────────────┘
                                                      │
                                                      ▼
                                              ┌─────────────┐
                                              │ Confidence  │
                                              │ Scoring     │
                                              └─────────────┘
                                                      │
                                                      ▼
                                              ┌─────────────┐
                                              │ Duplicate   │
                                              │ Detection   │
                                              └─────────────┘
                                                      │
                                                      ▼
                                              ┌─────────────┐
                                              │ Review UI   │
                                              │ Side-by-Side│
                                              └─────────────┘
```

### Security Pipeline (Defense in Depth)

```typescript
// src/lib/services/form-conversion/security.ts
import { PDFDocument } from 'pdf-lib';
import { spawn } from 'child_process';

export async function processUploadSecurely(
  buffer: Buffer,
  mimeType: string
): Promise<{ sanitizedBuffer: Buffer; metadata: DocumentMetadata }> {
  // Step 1: Sanitize PDF (remove JavaScript, embedded files, macros)
  let sanitizedBuffer = buffer;
  if (mimeType === 'application/pdf') {
    sanitizedBuffer = await sanitizePdf(buffer);
  }

  // Step 2: Process in sandboxed container
  const result = await processInSandbox(sanitizedBuffer, mimeType);

  // Step 3: Flatten for storage (convert to images if needed for archive)
  const flattenedBuffer = await flattenDocument(result.buffer, mimeType);

  return {
    sanitizedBuffer: flattenedBuffer,
    metadata: result.metadata,
  };
}

async function sanitizePdf(buffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer, {
    ignoreEncryption: true,
  });

  // Remove JavaScript
  const catalog = pdfDoc.catalog;
  if (catalog.has(PDFName.of('Names'))) {
    const names = catalog.lookup(PDFName.of('Names'));
    if (names instanceof PDFDict && names.has(PDFName.of('JavaScript'))) {
      names.delete(PDFName.of('JavaScript'));
    }
  }

  // Remove embedded files
  if (catalog.has(PDFName.of('Names'))) {
    const names = catalog.lookup(PDFName.of('Names'));
    if (names instanceof PDFDict && names.has(PDFName.of('EmbeddedFiles'))) {
      names.delete(PDFName.of('EmbeddedFiles'));
    }
  }

  // Remove OpenAction (auto-execute on open)
  if (catalog.has(PDFName.of('OpenAction'))) {
    catalog.delete(PDFName.of('OpenAction'));
  }

  // Remove AA (additional actions)
  if (catalog.has(PDFName.of('AA'))) {
    catalog.delete(PDFName.of('AA'));
  }

  return Buffer.from(await pdfDoc.save());
}

async function processInSandbox(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; metadata: DocumentMetadata }> {
  // Use AWS Lambda or Docker container for isolation
  // This prevents any malicious code from affecting the main process

  if (process.env.USE_LAMBDA_SANDBOX === 'true') {
    return processViaLambda(buffer, mimeType);
  }

  // Fallback: process locally but with restricted permissions
  return processLocally(buffer, mimeType);
}
```

### AI Field Detection

```typescript
// src/lib/services/form-conversion/field-detection.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface DetectedField {
  label: string;
  suggestedType: FieldType;
  originalType?: string;  // If detected type doesn't map to our types
  suggestedValidation: {
    required: boolean;
    format?: string;
  };
  confidence: number;
  position: {
    section?: string;
    order: number;
  };
  flags: string[];  // e.g., ['unsupported_type:table']
}

interface ConversionResult {
  fields: DetectedField[];
  sections: Array<{ name: string; fieldCount: number }>;
  overallConfidence: number;
  warnings: string[];
  originalDocument: {
    pageCount: number;
    hasImages: boolean;
    textLength: number;
  };
}

export async function detectFormFields(
  documentContent: string | Buffer,
  isImage: boolean
): Promise<ConversionResult> {
  const prompt = buildDetectionPrompt();

  let response;
  if (isImage) {
    // Use Claude Vision for images
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: (documentContent as Buffer).toString('base64'),
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      }],
    });
  } else {
    // Use text-based detection for extracted PDF text
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${prompt}\n\nDocument text:\n${documentContent}`,
      }],
    });
  }

  const result = JSON.parse(response.content[0].text);
  return processDetectionResult(result);
}

function buildDetectionPrompt(): string {
  return `Analyze this form document and extract all fields with their properties.

For each field, determine:
1. Field label/name
2. Field type (map to one of: TEXT_SHORT, TEXT_LONG, NUMBER, DATE, PHONE, EMAIL, ADDRESS, DROPDOWN, CHECKBOX, YES_NO, FILE, SIGNATURE)
3. If the field type doesn't map to our types (e.g., TABLE, GRID, BARCODE), use the closest match and flag it
4. Whether the field appears required (asterisk, "required" label, etc.)
5. Any format hints (date format, phone format, etc.)
6. Confidence score (0-100) for your detection
7. Logical section grouping based on headers or visual proximity

Also identify:
- Section headers and their fields
- Any fields that may need special attention (low confidence, complex types)

Return JSON in this format:
{
  "fields": [
    {
      "label": "string",
      "suggestedType": "FieldType",
      "originalType": "string or null if perfect match",
      "suggestedValidation": {
        "required": boolean,
        "format": "string or null"
      },
      "confidence": number,
      "position": {
        "section": "string or null",
        "order": number
      },
      "flags": ["array of warning flags"]
    }
  ],
  "sections": [
    { "name": "string", "fieldCount": number }
  ],
  "overallConfidence": number,
  "warnings": ["array of general warnings"]
}`;
}

function processDetectionResult(result: any): ConversionResult {
  // Apply tiered confidence rules
  const fields = result.fields.map((field: DetectedField) => {
    // High confidence (>90%): auto-apply validation
    // Medium confidence (70-90%): flag for review
    // Low confidence (<70%): skip validation, require manual

    if (field.confidence < 70) {
      field.flags.push('low_confidence_requires_review');
      field.suggestedValidation = { required: false };
    } else if (field.confidence < 90) {
      field.flags.push('medium_confidence_review_recommended');
    }

    return field;
  });

  return {
    ...result,
    fields,
  };
}
```

### Duplicate Detection (Fingerprint + Jaccard)

```typescript
// src/lib/services/form-conversion/duplicate-detection.ts
import crypto from 'crypto';

interface DuplicateCheckResult {
  exactMatch?: { formId: string; formName: string };
  similarForms: Array<{
    formId: string;
    formName: string;
    similarity: number;
  }>;
}

export async function checkForDuplicates(
  detectedFields: DetectedField[],
  orgId: string
): Promise<DuplicateCheckResult> {
  // Generate fingerprint for exact match
  const fingerprint = generateFingerprint(detectedFields);

  // Check for exact match
  const exactMatch = await prisma.form.findFirst({
    where: {
      orgId,
      fieldFingerprint: fingerprint,
      status: { not: 'ARCHIVED' },
    },
    select: { id: true, name: true },
  });

  if (exactMatch) {
    return {
      exactMatch: { formId: exactMatch.id, formName: exactMatch.name },
      similarForms: [],
    };
  }

  // Check for similar forms using Jaccard similarity
  const existingForms = await prisma.form.findMany({
    where: {
      orgId,
      status: { not: 'ARCHIVED' },
    },
    include: {
      fields: {
        select: { name: true, type: true },
      },
    },
  });

  const newFieldSet = new Set(
    detectedFields.map(f => `${f.label.toLowerCase()}:${f.suggestedType}`)
  );

  const similarForms = existingForms
    .map(form => {
      const existingFieldSet = new Set(
        form.fields.map(f => `${f.name.toLowerCase()}:${f.type}`)
      );
      const similarity = jaccardSimilarity(newFieldSet, existingFieldSet);
      return {
        formId: form.id,
        formName: form.name,
        similarity,
      };
    })
    .filter(f => f.similarity > 0.8)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  return { similarForms };
}

function generateFingerprint(fields: DetectedField[]): string {
  const normalized = fields
    .map(f => `${f.label.toLowerCase().trim()}:${f.suggestedType}`)
    .sort()
    .join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}
```

### PDF Overlay Export

```typescript
// src/lib/services/form-conversion/pdf-export.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface FieldPosition {
  fieldId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function exportFilledPdfOverlay(
  originalPdfBuffer: Buffer,
  formSubmission: FormSubmission,
  fieldPositions: FieldPosition[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const position of fieldPositions) {
    const page = pages[position.page];
    const value = formSubmission.data[position.fieldId];

    if (value === undefined || value === null) continue;

    const text = String(value);
    const fontSize = calculateFontSize(text, position.width, position.height, font);

    page.drawText(text, {
      x: position.x,
      y: position.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: position.width,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

function calculateFontSize(
  text: string,
  maxWidth: number,
  maxHeight: number,
  font: PDFFont
): number {
  // Start with a reasonable font size and shrink to fit
  let fontSize = 12;
  const minFontSize = 6;

  while (fontSize > minFontSize) {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    if (textWidth <= maxWidth && textHeight <= maxHeight) {
      return fontSize;
    }

    fontSize -= 0.5;
  }

  return minFontSize;
}
```

### Source Document Retention

```typescript
// src/lib/services/form-conversion/retention.ts
export async function handleSourceRetention(
  formId: string,
  sourceBuffer: Buffer,
  requiresOriginalExport: boolean
): Promise<void> {
  if (requiresOriginalExport) {
    // Store permanently for forms needing original-format export
    await uploadToS3(
      `forms/${formId}/source-document`,
      sourceBuffer,
      { retention: 'permanent' }
    );
  } else {
    // Store for 30 days, then auto-delete
    await uploadToS3(
      `forms/${formId}/source-document`,
      sourceBuffer,
      {
        retention: 'temporary',
        expiresAt: addDays(new Date(), 30),
      }
    );

    // Schedule deletion job
    await mainQueue.add('delete-source-document', {
      type: 'delete-source-document',
      orgId: form.orgId,
      userId: 'system',
      payload: { formId },
    }, {
      delay: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }
}
```

---

## Feature 3: Automated Report Generation

### Overview

AI-driven report generation system where users describe their reporting goals through a questionnaire, and the system proposes appropriate metrics and data mappings. Includes pre-built HUD APR metrics as quick-add options.

### AI-Driven Report Builder Workflow

```
┌─────────────────────┐
│ 1. Select Report    │
│ Type or Describe    │
│ Goal                │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│ 2. Answer Questions │
│ - Purpose/Audience  │
│ - Time Period       │
│ - Specific Metrics  │
│ - Geographic Scope  │
│ - What Success Looks│
│   Like              │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│ 3. AI Follow-up     │
│ Questions (if needed)│
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│ 4. Review Screen:   │
│ - Proposed Metrics  │
│ - Goal-Connected    │
│   Explanations      │
│ - User Can Edit     │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│ 5. Preview with     │
│ Anonymized Data     │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│ 6. Save as Template │
│ (Draft or Publish)  │
└─────────────────────┘
```

### Questionnaire System

```typescript
// src/lib/services/reports/questionnaire.ts
export interface ReportQuestionnaire {
  // Base questions (always asked)
  base: Question[];
  // Per-report-type questions
  byType: Record<string, Question[]>;
  // AI can add follow-up questions
  aiFollowUps?: Question[];
}

export interface Question {
  id: string;
  text: string;
  type: 'dropdown' | 'multi-select' | 'text' | 'date-range';
  options?: Array<{ value: string; label: string }>;
  required: boolean;
  category: 'purpose' | 'audience' | 'period' | 'metrics' | 'scope' | 'outcome';
}

export const BASE_QUESTIONS: Question[] = [
  {
    id: 'report_purpose',
    text: 'What is the primary purpose of this report?',
    type: 'dropdown',
    options: [
      { value: 'funder_compliance', label: 'Funder/Grant Compliance' },
      { value: 'board_update', label: 'Board of Directors Update' },
      { value: 'impact_measurement', label: 'Impact Measurement' },
      { value: 'internal_operations', label: 'Internal Operations Review' },
      { value: 'other', label: 'Other (describe below)' },
    ],
    required: true,
    category: 'purpose',
  },
  {
    id: 'audience',
    text: 'Who is the primary audience for this report?',
    type: 'dropdown',
    options: [
      { value: 'funder', label: 'Funder/Grant Agency' },
      { value: 'board', label: 'Board of Directors' },
      { value: 'executive', label: 'Executive Leadership' },
      { value: 'program_staff', label: 'Program Staff' },
      { value: 'public', label: 'Public/Donors' },
    ],
    required: true,
    category: 'audience',
  },
  {
    id: 'reporting_period',
    text: 'What time period should this report cover?',
    type: 'date-range',
    required: true,
    category: 'period',
  },
  {
    id: 'success_definition',
    text: 'What does success look like? What story are you trying to tell?',
    type: 'text',
    required: true,
    category: 'outcome',
  },
  {
    id: 'specific_metrics',
    text: 'Are there specific metrics you need to include? (optional)',
    type: 'text',
    required: false,
    category: 'metrics',
  },
  {
    id: 'geographic_scope',
    text: 'What geographic scope should the report cover?',
    type: 'dropdown',
    options: [
      { value: 'all', label: 'All Locations' },
      { value: 'county', label: 'Specific County' },
      { value: 'region', label: 'Specific Region' },
      { value: 'site', label: 'Specific Site/Location' },
    ],
    required: true,
    category: 'scope',
  },
  {
    id: 'demographic_breakdowns',
    text: 'What demographic breakdowns do you need?',
    type: 'multi-select',
    options: [
      { value: 'age', label: 'Age Groups' },
      { value: 'gender', label: 'Gender' },
      { value: 'race_ethnicity', label: 'Race/Ethnicity' },
      { value: 'veteran_status', label: 'Veteran Status' },
      { value: 'housing_status', label: 'Housing Status' },
      { value: 'none', label: 'No demographic breakdowns needed' },
    ],
    required: true,
    category: 'metrics',
  },
];

export const HUD_APR_QUESTIONS: Question[] = [
  {
    id: 'hud_program_type',
    text: 'What type of HUD program is this report for?',
    type: 'dropdown',
    options: [
      { value: 'es', label: 'Emergency Shelter (ES)' },
      { value: 'th', label: 'Transitional Housing (TH)' },
      { value: 'psh', label: 'Permanent Supportive Housing (PSH)' },
      { value: 'rrh', label: 'Rapid Re-Housing (RRH)' },
      { value: 'sso', label: 'Street Outreach (SSO)' },
    ],
    required: true,
    category: 'metrics',
  },
];
```

### AI Metric Suggestion

```typescript
// src/lib/services/reports/metric-suggestion.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface SuggestedMetric {
  id: string;
  name: string;
  description: string;
  goalConnection: string;  // How this metric connects to user's stated goal
  calculation: MetricCalculation;
  source: 'ai_suggested' | 'pre_built' | 'user_added';
  confidence: number;
}

export interface MetricCalculation {
  type: 'count' | 'sum' | 'average' | 'percentage' | 'custom';
  field?: string;
  filters?: Array<{ field: string; operator: string; value: any }>;
  numerator?: MetricCalculation;
  denominator?: MetricCalculation;
  formula?: string;  // For complex calculations
}

export async function suggestMetrics(
  questionnaireAnswers: Record<string, any>,
  orgId: string,
  funderDocs?: string  // Optional funder requirements document
): Promise<SuggestedMetric[]> {
  // Get available data fields from org's forms
  const availableFields = await getAvailableDataFields(orgId);

  // Get pre-built metrics if applicable
  const preBuiltMetrics = await getPreBuiltMetrics(questionnaireAnswers.report_purpose);

  const prompt = buildMetricSuggestionPrompt(
    questionnaireAnswers,
    availableFields,
    preBuiltMetrics,
    funderDocs
  );

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: prompt,
    }],
  });

  const suggestions = JSON.parse(response.content[0].text);

  // Add goal connections
  return suggestions.metrics.map((metric: any) => ({
    ...metric,
    goalConnection: generateGoalConnection(metric, questionnaireAnswers.success_definition),
    source: metric.isPreBuilt ? 'pre_built' : 'ai_suggested',
  }));
}

function buildMetricSuggestionPrompt(
  answers: Record<string, any>,
  availableFields: string[],
  preBuiltMetrics: PreBuiltMetric[],
  funderDocs?: string
): string {
  return `Based on the user's reporting goals, suggest appropriate metrics.

## User's Reporting Goals

Purpose: ${answers.report_purpose}
Audience: ${answers.audience}
Success Definition: "${answers.success_definition}"
Specific Metrics Requested: ${answers.specific_metrics || 'None specified'}
Geographic Scope: ${answers.geographic_scope}
Demographic Breakdowns: ${answers.demographic_breakdowns?.join(', ') || 'None'}

## Available Data Fields
${availableFields.join('\n')}

## Pre-Built Metrics Available
${preBuiltMetrics.map(m => `- ${m.name}: ${m.description}`).join('\n')}

${funderDocs ? `## Funder Requirements Document\n${funderDocs}` : ''}

## Instructions
1. Suggest 5-15 metrics that align with the user's stated goals
2. For each metric, explain how it connects to their success definition
3. Prioritize pre-built metrics when they match the need
4. Include the calculation formula using available fields
5. For percentage metrics, include both numerator and denominator calculations

Return JSON:
{
  "metrics": [
    {
      "id": "unique_id",
      "name": "Metric Name",
      "description": "What this metric measures",
      "goalConnection": "How this helps achieve their stated success definition",
      "calculation": {
        "type": "count|sum|average|percentage|custom",
        "field": "field_name (for simple)",
        "filters": [{"field": "x", "operator": "=", "value": "y"}],
        "numerator": {...},
        "denominator": {...},
        "formula": "custom formula if needed"
      },
      "isPreBuilt": boolean,
      "preBuiltId": "if isPreBuilt"
    }
  ]
}`;
}

function generateGoalConnection(metric: any, successDefinition: string): string {
  // AI already generates this, but we format it nicely
  return `To demonstrate ${successDefinition.toLowerCase()}, we're tracking ${metric.name.toLowerCase()} because ${metric.goalConnection}`;
}
```

### Pre-Built Metrics Library (HUD APR)

```typescript
// src/lib/services/reports/pre-built-metrics.ts
export interface PreBuiltMetric {
  id: string;
  category: 'hud_apr' | 'dol' | 'cali_grants' | 'general';
  name: string;
  description: string;
  calculation: MetricCalculation;
  version: string;  // For tracking when regulations change
  lastUpdated: Date;
  isMandatory: boolean;  // For compliance reports
}

export const HUD_APR_METRICS: PreBuiltMetric[] = [
  {
    id: 'hud_apr_total_persons_served',
    category: 'hud_apr',
    name: 'Total Persons Served',
    description: 'Count of all individuals who received services during the reporting period',
    calculation: {
      type: 'count',
      field: 'clients',
      filters: [
        { field: 'service_date', operator: 'between', value: '{{reporting_period}}' },
      ],
    },
    version: '2024.1',
    lastUpdated: new Date('2024-01-15'),
    isMandatory: true,
  },
  {
    id: 'hud_apr_exits_to_permanent_housing',
    category: 'hud_apr',
    name: 'Exits to Permanent Housing (%)',
    description: 'Percentage of clients who exited to permanent housing destinations',
    calculation: {
      type: 'percentage',
      numerator: {
        type: 'count',
        field: 'clients',
        filters: [
          { field: 'exit_destination', operator: 'in', value: ['permanent_housing', 'rental', 'owned'] },
          { field: 'exit_date', operator: 'between', value: '{{reporting_period}}' },
        ],
      },
      denominator: {
        type: 'count',
        field: 'clients',
        filters: [
          { field: 'exit_date', operator: 'between', value: '{{reporting_period}}' },
          { field: 'exit_destination', operator: 'not_in', value: ['deceased', 'unknown'] },
        ],
      },
    },
    version: '2024.1',
    lastUpdated: new Date('2024-01-15'),
    isMandatory: true,
  },
  {
    id: 'hud_apr_income_increase',
    category: 'hud_apr',
    name: 'Income Increase Rate',
    description: 'Percentage of adult stayers/leavers who increased income',
    calculation: {
      type: 'percentage',
      numerator: {
        type: 'count',
        field: 'clients',
        filters: [
          { field: 'age', operator: '>=', value: 18 },
          { field: 'income_at_exit', operator: '>', value: '{{income_at_entry}}' },
        ],
      },
      denominator: {
        type: 'count',
        field: 'clients',
        filters: [
          { field: 'age', operator: '>=', value: 18 },
          { field: 'enrollment_days', operator: '>=', value: 365 },
        ],
      },
    },
    version: '2024.1',
    lastUpdated: new Date('2024-01-15'),
    isMandatory: true,
  },
];

// Clone pre-built metric for customization
export async function cloneMetric(
  metricId: string,
  orgId: string,
  customizations: Partial<PreBuiltMetric>
): Promise<string> {
  const original = HUD_APR_METRICS.find(m => m.id === metricId);
  if (!original) throw new Error('Metric not found');

  const cloned = await prisma.customMetric.create({
    data: {
      orgId,
      baseMetricId: metricId,
      name: customizations.name ?? `${original.name} (Custom)`,
      description: customizations.description ?? original.description,
      calculation: customizations.calculation ?? original.calculation,
      version: '1.0',
    },
  });

  return cloned.id;
}
```

### Narrative Generation with Prior Context

```typescript
// src/lib/services/reports/narrative.ts
export async function generateNarrative(
  reportId: string,
  sectionId: string,
  metrics: Record<string, number>,
  priorReport?: { narrative: string; metrics: Record<string, number> }
): Promise<string> {
  const prompt = buildNarrativePrompt(metrics, priorReport);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: prompt,
    }],
  });

  return response.content[0].text;
}

function buildNarrativePrompt(
  currentMetrics: Record<string, number>,
  priorReport?: { narrative: string; metrics: Record<string, number> }
): string {
  let prompt = `Generate a professional grant-writing narrative based on these metrics.

## Current Period Metrics
${Object.entries(currentMetrics)
  .map(([name, value]) => `- ${name}: ${value}`)
  .join('\n')}
`;

  if (priorReport) {
    prompt += `
## Prior Period (for comparison)
### Metrics
${Object.entries(priorReport.metrics)
  .map(([name, value]) => `- ${name}: ${value}`)
  .join('\n')}

### Previous Narrative (for tone/style consistency)
"${priorReport.narrative}"
`;
  }

  prompt += `
## Instructions
- Write in professional grant-writing voice
- Be concise (2-3 paragraphs)
- Include specific numbers
${priorReport ? '- Reference changes from prior period (e.g., "up 12% from last quarter")' : ''}
- Focus on impact and outcomes
- Do not use superlatives or marketing language
`;

  return prompt;
}
```

### Funder Document Processing

```typescript
// src/lib/services/reports/funder-docs.ts
export type FunderDocSource = 'upload' | 'url' | 'library';

export async function processFunderDocument(
  source: FunderDocSource,
  input: string | Buffer,
  orgId: string
): Promise<FunderRequirements> {
  let documentText: string;

  switch (source) {
    case 'upload':
      // Process uploaded PDF/Word document
      documentText = await extractTextFromDocument(input as Buffer);
      break;
    case 'url':
      // Fetch from URL
      const response = await fetch(input as string);
      const buffer = Buffer.from(await response.arrayBuffer());
      documentText = await extractTextFromDocument(buffer);
      break;
    case 'library':
      // Get from Scribe-curated library
      const libraryDoc = await prisma.funderDocumentLibrary.findUnique({
        where: { id: input as string },
      });
      documentText = libraryDoc!.extractedText;
      break;
  }

  // Use AI to extract requirements
  const requirements = await extractFunderRequirements(documentText);

  return requirements;
}

async function extractFunderRequirements(documentText: string): Promise<FunderRequirements> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Extract reporting requirements from this funder document.

Document:
${documentText}

Return JSON:
{
  "funderName": "string",
  "reportType": "string",
  "frequency": "quarterly|biannual|annual|custom",
  "requiredFields": [
    {
      "name": "Field Name",
      "description": "What data is needed",
      "dataType": "count|percentage|currency|date|text",
      "isMandatory": boolean
    }
  ],
  "requiredSections": [
    {
      "name": "Section Name",
      "description": "What should be covered",
      "isNarrative": boolean
    }
  ],
  "submissionFormat": "pdf|excel|online_portal|other",
  "deadline": "string description of deadline",
  "additionalNotes": "any other relevant requirements"
}`,
    }],
  });

  return JSON.parse(response.content[0].text);
}
```

### Report Storage (Tiered Retention)

```typescript
// src/lib/services/reports/storage.ts
export async function storeGeneratedReport(
  reportId: string,
  pdfBuffer: Buffer,
  dataSnapshot: ReportDataSnapshot
): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
  });

  // Store full PDF
  await uploadToS3(`reports/${reportId}/report.pdf`, pdfBuffer);

  // Store data snapshot (always, for potential regeneration)
  await prisma.reportSnapshot.create({
    data: {
      reportId,
      dataSnapshot: JSON.stringify(dataSnapshot),
      metricsVersion: await getCurrentMetricsVersion(),
      generatedAt: new Date(),
    },
  });

  // Schedule tiered storage migration after 2 years
  await mainQueue.add('migrate-report-storage', {
    type: 'migrate-report-storage',
    orgId: report!.orgId,
    userId: 'system',
    payload: { reportId },
  }, {
    delay: 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
  });
}

// Migrate old reports to compressed storage
async function migrateReportStorage(reportId: string): Promise<void> {
  // Delete full PDF, keep only data snapshot
  await deleteFromS3(`reports/${reportId}/report.pdf`);

  // Mark as migrated
  await prisma.report.update({
    where: { id: reportId },
    data: { storageTier: 'compressed' },
  });
}

// Regenerate PDF from snapshot on demand
export async function regenerateReport(reportId: string): Promise<Buffer> {
  const snapshot = await prisma.reportSnapshot.findFirst({
    where: { reportId },
    orderBy: { generatedAt: 'desc' },
  });

  if (!snapshot) {
    throw new Error('No snapshot available for regeneration');
  }

  const template = await prisma.reportTemplate.findUnique({
    where: { id: snapshot.templateId },
  });

  // Note: regenerated report may look different if template changed
  const pdfBuffer = await generatePdfFromSnapshot(
    JSON.parse(snapshot.dataSnapshot as string),
    template!
  );

  return pdfBuffer;
}
```

### Cross-Org Audit Logging

```typescript
// src/lib/services/reports/cross-org-audit.ts
export async function logCrossOrgAccess(
  fiscalAgentOrgId: string,
  partnerOrgIds: string[],
  reportId: string,
  userId: string,
  action: 'view' | 'generate' | 'export'
): Promise<void> {
  // Create audit entry for fiscal agent
  await createAuditEntry({
    orgId: fiscalAgentOrgId,
    action: 'CROSS_ORG_REPORT_ACCESS',
    resourceType: 'report',
    resourceId: reportId,
    actorId: userId,
    metadata: {
      partnerOrgIds,
      accessType: action,
      dataIncluded: partnerOrgIds.map(id => ({ orgId: id })),
    },
  });

  // Create audit entries for each partner org (for their audit trail)
  for (const partnerOrgId of partnerOrgIds) {
    await createAuditEntry({
      orgId: partnerOrgId,
      action: 'DATA_INCLUDED_IN_CROSS_ORG_REPORT',
      resourceType: 'report',
      resourceId: reportId,
      actorId: userId,
      metadata: {
        fiscalAgentOrgId,
        accessType: action,
      },
    });
  }
}
```

---

## Database Schema Changes

```prisma
// Add to prisma/schema.prisma

// ============================================
// FEATURE 1: Mass Notes
// ============================================

model NoteTemplate {
  id                String    @id @default(uuid())
  orgId             String    @db.Uuid
  programId         String?   @db.Uuid
  userId            String?   @db.Uuid
  scope             NoteTemplateScope
  name              String
  content           String    @db.Text
  availableVariables String[]
  sessionType       String?
  isDefault         Boolean   @default(false)
  createdBy         String    @db.Uuid
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  organization      Organization @relation(fields: [orgId], references: [id])
  program           Program?     @relation(fields: [programId], references: [id])
  user              User?        @relation(fields: [userId], references: [id])

  @@index([orgId, scope])
  @@index([programId])
  @@index([sessionType])
}

enum NoteTemplateScope {
  ORG
  PROGRAM
  USER
}

// Update existing Note model
model Note {
  // ... existing fields ...
  sessionId         String?   @db.Uuid
  isMassNote        Boolean   @default(false)

  session           Session?  @relation(fields: [sessionId], references: [id])

  @@index([sessionId])
}

// ============================================
// SHARED INFRASTRUCTURE
// ============================================

model JobProgress {
  id                String    @id @default(uuid())
  type              String
  userId            String    @db.Uuid
  orgId             String    @db.Uuid
  status            JobStatus @default(PENDING)
  progress          Int       @default(0)
  total             Int       @default(0)
  completed         Int       @default(0)
  failed            Int       @default(0)
  result            Json?
  error             String?
  metadata          Json?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user              User      @relation(fields: [userId], references: [id])
  organization      Organization @relation(fields: [orgId], references: [id])

  @@index([userId, status])
  @@index([orgId, type])
}

enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model Notification {
  id                String    @id @default(uuid())
  userId            String    @db.Uuid
  type              String
  title             String
  message           String
  metadata          Json?
  read              Boolean   @default(false)
  createdAt         DateTime  @default(now())

  user              User      @relation(fields: [userId], references: [id])

  @@index([userId, read])
}

// ============================================
// FEATURE 2: Photo/PDF to Form Conversion
// ============================================

model FormConversion {
  id                String    @id @default(uuid())
  orgId             String    @db.Uuid
  sourceType        ConversionSourceType
  sourcePath        String    // S3 path
  status            ConversionStatus @default(PENDING)
  detectedFields    Json?     // DetectedField[]
  fieldPositions    Json?     // For PDF overlay export
  confidence        Float?
  warnings          String[]
  requiresOriginalExport Boolean @default(false)
  resultFormId      String?   @db.Uuid
  createdBy         String    @db.Uuid
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  expiresAt         DateTime? // For source document cleanup

  organization      Organization @relation(fields: [orgId], references: [id])
  resultForm        Form?     @relation(fields: [resultFormId], references: [id])

  @@index([orgId, status])
}

enum ConversionSourceType {
  PHOTO
  PDF_CLEAN
  PDF_SCANNED
}

enum ConversionStatus {
  PENDING
  PROCESSING
  REVIEW_REQUIRED
  COMPLETED
  FAILED
}

// Add fingerprint to Form for duplicate detection
model Form {
  // ... existing fields ...
  fieldFingerprint  String?   // SHA-256 hash of normalized field names+types

  conversions       FormConversion[]

  @@index([orgId, fieldFingerprint])
}

// ============================================
// FEATURE 3: Automated Reporting
// ============================================

model ReportTemplate {
  id                String    @id @default(uuid())
  orgId             String    @db.Uuid
  name              String
  description       String?
  type              ReportType
  status            ReportTemplateStatus @default(DRAFT)
  questionnaireAnswers Json  // User's questionnaire responses
  metrics           Json      // SuggestedMetric[]
  sections          Json      // Report sections
  funderRequirements Json?   // Extracted funder requirements
  aiGeneratedAt     DateTime?
  createdBy         String    @db.Uuid
  publishedBy       String?   @db.Uuid
  publishedAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  organization      Organization @relation(fields: [orgId], references: [id])
  reports           Report[]

  @@index([orgId, status])
  @@index([type])
}

enum ReportType {
  HUD_APR
  DOL_WORKFORCE
  CALI_GRANTS
  BOARD_REPORT
  IMPACT_REPORT
  CUSTOM
}

enum ReportTemplateStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Report {
  id                String    @id @default(uuid())
  templateId        String    @db.Uuid
  orgId             String    @db.Uuid
  reportingPeriodStart DateTime
  reportingPeriodEnd DateTime
  status            ReportStatus @default(GENERATING)
  storageTier       StorageTier @default(FULL)
  pdfPath           String?   // S3 path
  generatedData     Json?     // Computed metrics
  narrativeSections Json?     // Generated narratives
  generatedBy       String    @db.Uuid
  generatedAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  template          ReportTemplate @relation(fields: [templateId], references: [id])
  organization      Organization @relation(fields: [orgId], references: [id])
  snapshots         ReportSnapshot[]

  @@index([orgId, status])
  @@index([templateId])
}

enum ReportStatus {
  GENERATING
  REVIEW_REQUIRED
  COMPLETED
  FAILED
}

enum StorageTier {
  FULL
  COMPRESSED
}

model ReportSnapshot {
  id                String    @id @default(uuid())
  reportId          String    @db.Uuid
  dataSnapshot      Json      // All computed data for regeneration
  metricsVersion    String    // Version of metrics definitions used
  generatedAt       DateTime  @default(now())

  report            Report    @relation(fields: [reportId], references: [id])

  @@index([reportId])
}

model CustomMetric {
  id                String    @id @default(uuid())
  orgId             String    @db.Uuid
  baseMetricId      String?   // If cloned from pre-built
  name              String
  description       String
  calculation       Json      // MetricCalculation
  version           String
  createdBy         String    @db.Uuid
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  organization      Organization @relation(fields: [orgId], references: [id])

  @@index([orgId])
}

model FunderDocumentLibrary {
  id                String    @id @default(uuid())
  name              String
  funderName        String
  documentType      String
  sourcePath        String    // S3 path
  extractedText     String    @db.Text
  extractedRequirements Json
  lastUpdated       DateTime
  curatedBy         String    @db.Uuid
  createdAt         DateTime  @default(now())

  @@index([funderName])
}

// Update Organization for feature flags
model Organization {
  // ... existing fields ...
  featureFlags      Json      @default("{}")

  noteTemplates     NoteTemplate[]
  jobProgress       JobProgress[]
  formConversions   FormConversion[]
  reportTemplates   ReportTemplate[]
  reports           Report[]
  customMetrics     CustomMetric[]
}
```

---

## API Endpoints

### Mass Notes

```
POST   /api/mass-notes                    Create mass note job
GET    /api/mass-notes/jobs/:jobId        Get job progress
GET    /api/mass-notes/templates          List templates for session
POST   /api/mass-notes/templates          Create template
PUT    /api/mass-notes/templates/:id      Update template
DELETE /api/mass-notes/templates/:id      Delete template
```

### Form Conversion

```
POST   /api/form-conversion/upload        Upload document for conversion
GET    /api/form-conversion/:id           Get conversion status/result
POST   /api/form-conversion/:id/review    Submit reviewed field mappings
POST   /api/form-conversion/:id/create-form  Create form from conversion
GET    /api/form-conversion/:id/preview   Preview generated form
DELETE /api/form-conversion/:id           Cancel/delete conversion
```

### Reports

```
POST   /api/reports/questionnaire         Submit questionnaire answers
GET    /api/reports/questionnaire/:type   Get questions for report type
POST   /api/reports/suggest-metrics       Get AI metric suggestions
POST   /api/reports/templates             Create report template
GET    /api/reports/templates             List report templates
GET    /api/reports/templates/:id         Get template details
PUT    /api/reports/templates/:id         Update template
POST   /api/reports/templates/:id/publish Publish template
POST   /api/reports/generate              Generate report from template
GET    /api/reports/:id                   Get generated report
GET    /api/reports/:id/download          Download report PDF
POST   /api/reports/:id/regenerate        Regenerate from snapshot
GET    /api/reports/metrics/pre-built     List pre-built metrics
POST   /api/reports/metrics/clone         Clone pre-built metric
POST   /api/reports/funder-docs           Upload/process funder document
GET    /api/reports/funder-docs/library   List Scribe-curated docs
```

### Job Management

```
GET    /api/jobs                          List user's jobs
GET    /api/jobs/:id                      Get job details
DELETE /api/jobs/:id                      Cancel job
```

---

## Security Implementation

### Encryption for Sensitive Fields

```typescript
// src/lib/security/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export async function encryptSensitiveData(
  data: Record<string, any>,
  sensitiveFields: string[],
  orgKeyId: string
): Promise<Record<string, any>> {
  const key = await getOrgEncryptionKey(orgKeyId);
  const result = { ...data };

  for (const field of sensitiveFields) {
    if (result[field] !== undefined) {
      result[field] = encrypt(String(result[field]), key);
    }
  }

  return result;
}

function encrypt(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encrypted: string, key: Buffer): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Permission Checks

```typescript
// src/lib/auth/permissions.ts
import { Role } from '@prisma/client';

export const FEATURE_PERMISSIONS: Record<string, Role[]> = {
  // Mass Notes
  'mass-notes.create': [Role.CASE_MANAGER, Role.PROGRAM_MANAGER, Role.ADMIN],
  'mass-notes.templates.create': [Role.PROGRAM_MANAGER, Role.ADMIN],
  'mass-notes.templates.edit': [Role.PROGRAM_MANAGER, Role.ADMIN],

  // Form Conversion
  'form-conversion.upload': [Role.PROGRAM_MANAGER, Role.ADMIN],
  'form-conversion.review': [Role.PROGRAM_MANAGER, Role.ADMIN],
  'form-conversion.create-form': [Role.PROGRAM_MANAGER, Role.ADMIN],

  // Reports
  'reports.generate': [Role.PROGRAM_MANAGER, Role.ADMIN],
  'reports.templates.create': [Role.PROGRAM_MANAGER, Role.ADMIN],
  'reports.templates.publish': [Role.ADMIN],
  'reports.cross-org': [Role.ADMIN], // Fiscal agent only
};

export async function checkPermission(
  userId: string,
  orgId: string,
  permission: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) return false;

  const allowedRoles = FEATURE_PERMISSIONS[permission];
  if (!allowedRoles) return false;

  return allowedRoles.includes(user.role);
}
```

---

## Testing Strategy

### Hybrid: Mocks + E2E

```typescript
// Unit/Integration tests: Mock externals
// tests/unit/mass-notes.test.ts
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    note: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    // ... other mocks
  },
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
  })),
}));

describe('Mass Note Service', () => {
  it('should skip clients with existing notes', async () => {
    // Test with mocked prisma
  });
});

// E2E tests: Use real services
// tests/e2e/form-conversion.test.ts
import { test, expect } from '@playwright/test';

test.describe('Form Conversion E2E', () => {
  test('should convert PDF to form', async ({ page }) => {
    // Uses real Claude API, real S3, real database
    await page.goto('/forms/convert');
    await page.setInputFiles('input[type="file"]', 'fixtures/sample-form.pdf');
    await page.click('button:has-text("Convert")');

    // Wait for async processing
    await expect(page.locator('.conversion-complete')).toBeVisible({ timeout: 60000 });
  });
});
```

### AI Response Snapshots

```typescript
// tests/snapshots/form-detection.test.ts
import { detectFormFields } from '@/lib/services/form-conversion/field-detection';

describe('Form Detection Snapshots', () => {
  it('should detect fields consistently', async () => {
    const result = await detectFormFields(
      readFileSync('fixtures/sample-intake-form.png'),
      true
    );

    // Compare against saved snapshot
    expect(result.fields.map(f => ({
      label: f.label,
      type: f.suggestedType,
    }))).toMatchSnapshot();
  });
});
```

---

## Deferred to V2

Based on interview decisions, the following items are explicitly deferred:

| Item | Reason | V2 Priority |
|------|--------|-------------|
| Notification Center | Toast-only for V1 to ship faster | High |
| Partner Notification | Contractually agreed access doesn't require notification | Medium |
| Multiple Funder API Integrations | Build one (Cali Grants) as proof of concept | High |
| AI Rate Limits | Monitor usage first, add limits if costs become problematic | Medium |
| Custom Narrative Styles | Fixed professional tone sufficient for V1 | Low |
| Pixel-Perfect PDF Recreation | Semantic layout + overlay export covers most cases | Low |

---

## Lessons Learned

### From Discovery Process

1. **Variable Substitution Timing Matters for Compliance**: Write-time resolution ensures immutable audit trail. If client name changes later, old notes retain original value - critical for compliance.

2. **Async Jobs Need Graceful Degradation**: Retry queue with exponential backoff handles transient failures without losing user's work.

3. **Duplicate Detection Doesn't Need AI**: Fingerprint + Jaccard is faster, cheaper, and deterministic. Reserve AI for complex tasks.

4. **Funder Reports Are More Complex Than Expected**: HUD APR requires percentage calculations with exclusion rules. Built calculation engine to handle this complexity from the start.

5. **Cross-Org Data Access Requires Transparency**: Full audit logging for fiscal agent access, even if partners aren't notified in V1.

### Architectural Decisions

1. **Individual Notes vs Junction Table**: Chose N writes for integrity. Trade-off: more DB writes, simpler queries and data model.

2. **Unified Job Queue**: BullMQ + Redis for all async work. Investment upfront pays off across all three features.

3. **Role + Feature Toggles**: Avoided permission explosion by using existing role hierarchy with feature flags.

4. **Live Database Queries**: Accepted potential performance impact for guaranteed data freshness. Will revisit if issues arise.

5. **Tiered Report Storage**: Balances compliance (7-year retention) with storage costs (compress after 2 years).

---

## Implementation Order

1. **Week 1-2: Shared Infrastructure**
   - BullMQ + AWS ElastiCache setup
   - Job progress tracking
   - Feature flags system
   - Toast notification system

2. **Week 3-4: Mass Notes**
   - Note template system
   - Mass note creation flow
   - Batch processing with retries
   - UI components

3. **Week 5-8: Photo/PDF to Form**
   - Security pipeline
   - Claude Vision integration
   - Field detection
   - Duplicate detection
   - Review UI
   - PDF overlay export

4. **Week 9-16: Automated Reporting**
   - Questionnaire system
   - AI metric suggestion
   - Pre-built metrics library
   - Narrative generation
   - Report storage/retention
   - One funder API integration

---

*End of Technical Specification*

*Prepared for Scrybe Solutions | Phoenixing LLC | January 2025*
