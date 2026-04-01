# Sensitivity Detection — AI Context Document

> Quick reference for AI assistants working on this feature.

**Linear Ticket:** PX-878
**Full PRD:** [PX-878-sensitivity-detection-prd.md](../specs/PX-878-sensitivity-detection-prd.md)
**Technical Spec:** [sensitivity-detection.md](./sensitivity-detection.md)

---

## Overview

Sensitivity Detection is a 3-tier content classifier that analyzes transcript segments:
- **REDACT**: Personal/off-topic content → Block pipeline, require human review, permanently remove after confirmation
- **RESTRICT**: Sensitive business content (HR, legal, M&A) → Access-controlled by role
- **STANDARD**: Normal work content → Flows to workflows unchanged

---

## Key Files

### Python NLP Service (`packages/nlp-service/`)

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI entrypoint, routes registration |
| `app/api/classify.py` | `/v1/classify` endpoint — main classification logic |
| `app/api/train.py` | `/v1/train`, `/v1/rollback` — retraining endpoints |
| `app/models/classifier.py` | TierClassifier class — combines signals → tier + confidence |
| `app/models/ner.py` | spaCy entity extraction wrapper |
| `app/models/sentiment.py` | VADER sentiment analysis + workplace context |
| `app/models/model_registry.py` | Load/save model versions from S3 |
| `app/training/pipeline.py` | Retraining orchestration |
| `app/training/validation.py` | Validation gates (accuracy, calibration, drift) |
| `app/monitoring/bias.py` | Fairness testing and bias detection |
| `app/utils/taxonomy.py` | TF-IDF patterns for REDACT/RESTRICT detection |
| `app/schemas/sensitivity.py` | Pydantic request/response models |

### Node.js Integration (`apps/web/src/lib/services/sensitivity/`)

| File | Purpose |
|------|---------|
| `client.ts` | HTTP client to Python NLP service |
| `types.ts` | TypeScript types for sensitivity results |
| `classify.ts` | Main `classifySensitivity()` function |
| `audit.ts` | Internal audit logging (NOT customer-facing) |
| `resume-processing.ts` | Resume pipeline after human review |
| `retraining-scheduler.ts` | Check trigger conditions daily |
| `retraining-job.ts` | Execute retraining via Python service |

### API Routes (`apps/web/src/app/api/`)

| File | Purpose |
|------|---------|
| `calls/[callId]/sensitivity/route.ts` | GET sensitivity results |
| `calls/[callId]/sensitivity/review/route.ts` | POST human review decision |
| `admin/sensitivity/models/route.ts` | GET model versions |
| `admin/sensitivity/retrain/route.ts` | POST trigger retraining |
| `admin/sensitivity/rollback/route.ts` | POST rollback to previous version |

### Database Schema (`prisma/schema.prisma`)

| Model | Purpose |
|-------|---------|
| `Call` (extended) | `sensitivityAnalysis`, `sensitivityTier`, `pendingSensitivityReview` fields |
| `SensitivityAuditLog` | Internal audit trail — segment text encrypted |
| `SensitivityModel` | Model version tracking, metrics history |
| `SensitivityRetrainingJob` | Retraining job status tracking |

---

## Integration Points

### Call Processing Pipeline

**Location:** `apps/web/src/lib/services/call-processing.ts:127` (approx)

Sensitivity detection runs **after transcription** (Step 2) and **before field extraction** (Step 3):

```typescript
// After Step 2 (transcription)
const sensitivityResult = await classifySensitivity(
  transcription.segments,
  call.client.orgId
);

// If REDACT detected OR low confidence, BLOCK pipeline
if (sensitivityResult.requiresReview) {
  await prisma.call.update({
    where: { id: callId },
    data: { pendingSensitivityReview: true },
  });
  return { success: true, blockedForReview: true, ... };
}

// Continue with Step 3 (field extraction)
```

### Event Tracking

Use existing event tracking pattern:

```typescript
await trackEvent('sensitivity.detected', {
  callId,
  orgId,
  tier: sensitivityResult.overallTier,
  confidence: sensitivityResult.confidence,
  segmentsRequiringReview: sensitivityResult.segments.filter(s => s.needsReview).length,
});
```

### Audit Logging

**IMPORTANT:** Sensitivity audit logs are **internal only** — never expose to customers.

```typescript
// apps/web/src/lib/services/sensitivity/audit.ts
export async function logSensitivityDecision(input: {
  orgId: string;
  callId: string;
  segmentIndex: number;
  segmentText: string; // Will be encrypted
  originalTier: SensitivityTier;
  finalTier: SensitivityTier;
  action: 'CONFIRMED' | 'DISPUTED';
  confidence: number;
  modelVersion: string;
  reviewedById?: string;
}): Promise<void> {
  // Encrypt segment text before storage
  const encryptedText = await encrypt(input.segmentText);

  await prisma.sensitivityAuditLog.create({
    data: {
      ...input,
      segmentText: encryptedText,
    },
  });
}
```

---

## Common Patterns

### Service Client Pattern

Follow existing service client pattern from `apps/web/src/lib/deepgram/client.ts`:

```typescript
// apps/web/src/lib/services/sensitivity/client.ts

let sensitivityClient: SensitivityClient | null = null;

export function getSensitivityClient(): SensitivityClient {
  if (!sensitivityClient) {
    const baseUrl = process.env.SENSITIVITY_SERVICE_URL;
    const apiKey = process.env.SENSITIVITY_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error('Sensitivity service not configured');
    }
    sensitivityClient = new SensitivityClient(baseUrl, apiKey);
  }
  return sensitivityClient;
}

export function isSensitivityConfigured(): boolean {
  return !!(process.env.SENSITIVITY_SERVICE_URL && process.env.SENSITIVITY_API_KEY);
}
```

### Classification Confidence Pattern

Follow existing confidence scoring from `apps/web/src/lib/ai/confidence.ts`:

- Confidence scores are 0-100 (percentage)
- Threshold for human review: <70%
- `needsReview` flag set when confidence is low OR tier is REDACT

### Processing Result Pattern

Follow `ProcessingResult` interface from call-processing.ts:

```typescript
interface ProcessingResult {
  success: boolean;
  callId: string;
  blockedForReview?: boolean;  // NEW: indicates pipeline blocked
  // ... existing fields
}
```

---

## Common Tasks

### Add new sensitivity category

1. Edit `packages/nlp-service/app/utils/taxonomy.py`
2. Add patterns to appropriate tier (REDACT/RESTRICT)
3. Update unit tests in `packages/nlp-service/tests/test_taxonomy.py`
4. No Node.js changes needed — patterns are server-side only

### Adjust confidence threshold

1. Environment variable: `SENSITIVITY_CONFIDENCE_THRESHOLD` (default: 70)
2. Used in `packages/nlp-service/app/models/classifier.py`
3. Also in `apps/web/src/lib/services/sensitivity/classify.ts` for review flagging

### Add new event tracking

1. Follow existing pattern in `apps/web/src/lib/services/sensitivity/classify.ts`
2. Event names: `sensitivity.{action}` (detected, confirmed, disputed, etc.)
3. Include: callId, orgId, tier, confidence

### Trigger manual retraining

```bash
curl -X POST https://api.example.com/api/admin/sensitivity/retrain \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "MANUAL", "orgId": null}'
```

---

## Gotchas & Edge Cases

### 1. Audit logs are internal-only
- `SensitivityAuditLog` contains PHI-adjacent content (encrypted segment text)
- **Never** expose via customer-facing APIs
- Use standard `AuditLog` for customer-visible events (view, export)

### 2. Pipeline blocking is critical
- REDACT content **must** block pipeline until human review
- Don't skip this — it's the core privacy guarantee
- Check `pendingSensitivityReview` before resuming processing

### 3. Model versioning
- Always log `modelVersion` with classifications
- Enables debugging and rollback decisions
- Stored on Call record: `sensitivityModelVersion`

### 4. Empty transcripts
- Handle gracefully — return STANDARD with 100% confidence
- Don't throw errors for empty segment arrays

### 5. Service unavailable fallback
- If NLP service is down, **do not block the pipeline**
- Log warning, skip sensitivity detection, continue processing
- Track these events: `sensitivity.service_unavailable`

### 6. Retraining race conditions
- Only one retraining job per org should run at a time
- Check `SensitivityRetrainingJob` for RUNNING status before starting
- Use database lock or Redis lock for production

### 7. Segment text in logs
- Always encrypt segment text before storage
- Use field-level encryption from `apps/web/src/lib/encryption/`
- Decrypt only for human review display, never in bulk exports

---

## Testing

### Unit tests (Python)
```bash
cd packages/nlp-service
pytest tests/ -v
```

### Integration tests (Node.js)
```bash
cd apps/web
npm run test:e2e -- --grep "sensitivity"
```

### Manual testing
1. Create a call with mixed content (personal + work)
2. Trigger processing via `/api/calls/[callId]/process`
3. Check call record for `sensitivityAnalysis` field
4. If blocked, use review endpoint to unblock

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SENSITIVITY_SERVICE_URL` | NLP service base URL | Required |
| `SENSITIVITY_API_KEY` | Service-to-service auth | Required |
| `SENSITIVITY_CONFIDENCE_THRESHOLD` | Review threshold (0-100) | 70 |
| `SENSITIVITY_ENABLED` | Feature flag | true |

---

## Quick Reference: Tier Definitions

**REDACT** — Block pipeline, require confirmation, then permanently remove:
- Personal struggles (divorce, health, finances)
- Gossip about others
- Off-topic banter (sports, TV, weekend plans)

**RESTRICT** — Access-controlled by role:
- HR discussions (terminations, performance, salary)
- Legal matters
- Strategic/confidential business

**STANDARD** — Normal workflow content:
- Service delivery
- Client intake
- Follow-ups
- Program coordination
