# Funder-Specific Data Export Implementation Specification

**Version:** 1.0
**Date:** January 2026
**Status:** Implemented

## Overview

This document describes the implementation of funder-specific data export templates (CAP60, DOL WIPS, CalGrants, HUD HMIS) for Scrybe. The feature enables organizations to export client data in exact formats required by external systems, eliminating redundant data entry.

**Core Principle:** Scrybe becomes the single point of data collection that feeds all required outputs. No forced migration—data exports work alongside existing systems.

---

## Architecture Decisions

### Decision: Template-Based Export System

**Chosen Approach:** Pre-defined templates with customizable field mappings

**Rationale:**
- Different funders require vastly different data formats (CSV, pipe-delimited TXT, Excel)
- Field names, codes, and validation rules vary significantly between funders
- Organizations need flexibility to map their existing forms to funder requirements

**Trade-offs:**
- (+) Users can customize mappings without code changes
- (+) Easy to add new funder types in the future
- (-) More complex initial setup for users
- (-) Validation rules must be maintained for each funder type

### Decision: Async Job Processing

**Chosen Approach:** BullMQ job queue with progress tracking

**Rationale:**
- Exports can involve thousands of records with complex transformations
- Users need visibility into export progress
- Failed exports should be retryable without re-entering parameters

**Trade-offs:**
- (+) Non-blocking UI during large exports
- (+) Built-in retry capability
- (+) Progress visibility for users
- (-) Additional infrastructure (Redis) required
- (-) More complex debugging of failed jobs

### Decision: S3 Storage with 7-Year Retention

**Chosen Approach:** Store export files in S3 with KMS encryption

**Rationale:**
- Compliance requirements mandate long-term retention
- Files can be large (especially Excel exports)
- Signed URLs provide secure, time-limited access

**Trade-offs:**
- (+) Compliant with HIPAA and audit requirements
- (+) Scalable storage
- (-) S3 costs for long retention
- (-) Requires AWS infrastructure

---

## What We Built

### Database Schema

Added to `prisma/schema.prisma`:

```prisma
enum ExportType {
  CAP60
  DOL_WIPS
  CALI_GRANTS
  HUD_HMIS
  CUSTOM
}

model ExportTemplate {
  id                String              @id @default(uuid())
  orgId             String
  name              String
  exportType        ExportType
  status            ExportTemplateStatus @default(DRAFT)
  fieldMappings     Json                // Array of field mapping definitions
  sourceFormIds     String[]            // Forms to extract data from
  validationRules   Json?
  outputFormat      String              @default("CSV")
  outputConfig      Json?               // delimiter, encoding, headers
  // ... relations
}

model FunderExport {
  id                String              @id @default(uuid())
  templateId        String
  status            ExportStatus        @default(PENDING)
  periodStart       DateTime
  periodEnd         DateTime
  filePath          String?
  recordCount       Int?
  validationErrors  Json?
  // ... relations
}
```

### Service Layer Structure

```
src/lib/services/exports/
├── index.ts                    # Main orchestration
├── types.ts                    # TypeScript interfaces
├── storage.ts                  # S3 file storage
├── templates/
│   ├── index.ts                # Template CRUD
│   └── predefined.ts           # Pre-built definitions (CAP60, DOL, etc.)
├── generators/
│   ├── index.ts                # Generator factory
│   ├── base.ts                 # Abstract base class
│   ├── csv-generator.ts        # CSV/HUD HMIS/CAP60
│   ├── txt-generator.ts        # DOL WIPS (pipe-delimited)
│   └── xlsx-generator.ts       # CalGrants (Excel)
├── data-extraction/
│   ├── index.ts                # Main extraction logic
│   ├── field-mapper.ts         # Map Scrybe → external fields
│   └── transformers.ts         # Date/code transformations
└── validation/
    └── index.ts                # Funder-specific validation
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/exports/templates` | GET, POST | List and create templates |
| `/api/exports/templates/[id]` | GET, PUT, DELETE | Template CRUD |
| `/api/exports/templates/[id]/validate` | POST | Validate template config |
| `/api/exports/generate` | POST | Trigger export generation |
| `/api/exports/[id]` | GET, POST | Get export, retry failed |
| `/api/exports/[id]/download` | GET | Get signed download URL |
| `/api/exports/preview` | POST | Preview first N rows |
| `/api/exports/history` | GET | List past exports |
| `/api/exports/field-mappings/[type]` | GET | Get suggested mappings |

### UI Pages

| Page | Path | Purpose |
|------|------|---------|
| Export Center | `/exports` | Main dashboard |
| Templates List | `/exports/templates` | Manage templates |
| Create Template | `/exports/templates/new` | Multi-step wizard |
| Export History | `/exports/history` | View past exports |

---

## Pre-Built Funder Templates

### HUD HMIS
- **Format:** CSV
- **Fields:** 50+ including PersonalID, demographics, housing status, income
- **Code Mappings:** HMIS_YESNO, HMIS_VETERAN, HMIS_LIVING_SITUATION, HMIS_DESTINATION
- **Validation:** Entry/exit date logic, gender/race selection requirements

### DOL WIPS
- **Format:** Pipe-delimited TXT
- **Fields:** SSN, demographics, education, employment outcomes, credentials
- **Code Mappings:** WIPS_GENDER, WIPS_RACE, WIPS_EDUCATION, WIPS_PROGRAM_TYPE
- **Validation:** SSN format (9 digits), credential type when attained

### CAP60
- **Format:** CSV
- **Fields:** Household composition, income, poverty level, service types
- **Code Mappings:** CAP_YESNO, CAP_GENDER, CAP_RACE, CAP_HOUSING, CAP_SERVICE
- **Validation:** Household size ≥ 1, non-negative income

### CalGrants
- **Format:** Excel (XLSX)
- **Fields:** California-specific demographics, program outcomes, hours
- **Code Mappings:** CALGRANTS_COUNTY, CALGRANTS_LANGUAGE, CALGRANTS_EMPLOYMENT
- **Validation:** California residency, enrollment/completion date order

---

## What We Learned

### Data Extraction Complexity

**Finding:** Form submissions store data as JSON with field slugs. Extracting and aggregating across multiple submissions per client requires careful handling.

**Solution:** The extraction service aggregates data from all matching submissions, with later submissions overriding earlier ones for the same field.

### Code Mapping Challenges

**Finding:** Funder codes often don't match user-friendly labels exactly. "Yes" might be "1", "Y", or "true" depending on context.

**Solution:** Implemented fuzzy matching in code transformer—exact match first, then case-insensitive, then partial match.

### Validation Trade-offs

**Finding:** Strict validation blocks exports with minor issues. Users prefer warnings over hard failures.

**Solution:** Implemented two-tier validation:
- **Errors:** Block export (e.g., missing required PersonalID)
- **Warnings:** Allow export with notice (e.g., missing optional wage data)

### Excel Generation

**Finding:** ExcelJS provides good Excel generation but increases bundle size significantly.

**Solution:** Dynamic import of exceljs only when needed:
```typescript
async function getExcelJS() {
  const ExcelJS = await import("exceljs");
  return ExcelJS.default || ExcelJS;
}
```

---

## Deferred for Future Implementation

### Scheduled Exports (P2)

**What:** Automatic export generation on a schedule (daily, weekly, monthly)

**Why Deferred:**
- Requires cron job infrastructure
- Need to define notification strategy for scheduled exports
- Complex UX for schedule configuration

**Schema Ready:** `scheduleEnabled` and `scheduleCron` fields exist on ExportTemplate

### Real-Time Field Mapping UI (P2)

**What:** Drag-and-drop interface to map Scrybe fields to export fields

**Why Deferred:**
- Current wizard with predefined templates covers 80% use case
- Custom mapping UI is complex to build well
- Users can still edit JSON mappings directly

### Export Diff/Comparison (P3)

**What:** Compare two exports to see what changed between periods

**Why Deferred:**
- Nice-to-have, not core functionality
- Would require storing record-level data for comparison
- Complex UI to visualize differences

### Bulk Export for Multiple Programs (P3)

**What:** Single export spanning multiple programs with program breakdowns

**Why Deferred:**
- Current implementation supports filtering by program
- Multi-program aggregation requires careful handling of duplicates
- Most funders want program-specific reports

### Import/Sync from External Systems (P4)

**What:** Two-way sync with funder systems

**Why Deferred:**
- Each funder has different API (or none)
- Security implications of storing external credentials
- Maintenance burden of API changes

---

## Phase 4: Scheduling & Dashboard (Implemented)

### Scheduled Exports

Added automatic scheduled export functionality:

**Schema Changes:**
```prisma
// Added to ExportTemplate model
scheduleTimezone      String              @default("America/Los_Angeles")
lastScheduledRunAt    DateTime?
nextScheduledRunAt    DateTime?
scheduleFailureCount  Int                 @default(0)
```

**New Files:**
- `src/lib/services/exports/scheduling.ts` - Cron parsing, next run calculation, schedule management
- `src/lib/jobs/processors/scheduled-export-runner.ts` - BullMQ repeatable job for checking due exports
- `src/app/api/exports/templates/[id]/schedule/route.ts` - Schedule CRUD API
- `src/app/api/exports/dashboard/route.ts` - Dashboard aggregation API
- `src/app/(dashboard)/exports/dashboard/page.tsx` - Integration Dashboard UI
- `src/components/exports/schedule/schedule-config.tsx` - Schedule configuration dialog

**Schedule Features:**
- Preset schedules: Daily, Weekly, Monthly
- Custom cron expressions (5-field standard format)
- Timezone support (PT, MT, CT, ET, UTC)
- Automatic next-run calculation
- Failure tracking with 3-strike disabling
- Human-readable schedule descriptions

**Dashboard Features:**
- Summary cards: Total exports, success rate, scheduled count, attention needed
- Alerts for failed/validation-required exports
- Template status table with one-click export trigger
- Upcoming scheduled exports list
- Recent exports history

**Cron Presets:**
```typescript
SCHEDULE_PRESETS = {
  DAILY_6AM: "0 6 * * *",
  DAILY_MIDNIGHT: "0 0 * * *",
  WEEKLY_MONDAY_6AM: "0 6 * * 1",
  WEEKLY_FRIDAY_5PM: "0 17 * * 5",
  MONTHLY_1ST_6AM: "0 6 1 * *",
  MONTHLY_LAST_DAY: "0 6 L * *",
  QUARTERLY_1ST: "0 6 1 1,4,7,10 *",
}
```

**Reporting Period Logic:**
- Daily schedule → exports yesterday's data
- Weekly schedule → exports last 7 days
- Monthly schedule → exports previous month

**Trade-offs:**
- (+) No external cron dependency - uses BullMQ repeatable jobs
- (+) Timezone-aware scheduling
- (+) Self-healing with failure count reset on manual intervention
- (-) Every-minute polling adds some overhead
- (-) Custom cron UI is technical for non-power users

---

## Phase 3: Smart Import (Implemented)

### Overview

Optional import functionality for pre-populating Scrybe with existing client data. Key safeguards prevent "Apricot nightmare" scenarios with full transparency, preview mode, and 24-hour rollback capability.

**Core Principle:** Import is optional - organizations can use Scrybe's export features without ever importing anything. When import makes sense, the system provides AI-assisted field mapping and fuzzy duplicate detection.

### Database Schema

```prisma
enum ImportStatus {
  PENDING, PARSING, MAPPING, READY, PROCESSING, COMPLETED, FAILED, ROLLED_BACK
}

enum ImportRecordStatus {
  PENDING, CREATED, UPDATED, SKIPPED, FAILED, ROLLED_BACK
}

enum DuplicateAction {
  SKIP, UPDATE, CREATE_NEW, MERGE
}

model ImportTemplate {
  id, orgId, name, sourceSystem, fileFormat
  fieldMappings, duplicateSettings, defaultAction
  // ... relations
}

model ImportBatch {
  id, orgId, templateId?, status
  fileName, filePath, fileSize, totalRows
  processedRows, createdCount, updatedCount, skippedCount, failedCount
  fieldMappings, duplicateSettings, previewData
  detectedColumns, suggestedMappings, validationErrors
  rollbackAvailableUntil, rollbackExecutedAt
  // ... relations
}

model ImportRecord {
  id, batchId, rowNumber, status, action
  sourceData, mappedData, duplicateMatches
  createdClientId?, updatedClientId?
  validationErrors, processingNotes
  // ... relations
}
```

### Service Layer

```
src/lib/services/imports/
├── index.ts                    # Main orchestration
├── types.ts                    # TypeScript interfaces
├── file-parser.ts              # CSV, Excel, JSON parsing
├── ai-field-mapper.ts          # AI-powered mapping suggestions
└── duplicate-detector.ts       # Fuzzy matching with Levenshtein/Soundex
```

### Key Features

**1. File Parsing**
- CSV with quoted values and configurable delimiter
- Excel (XLSX) with multi-sheet support
- JSON arrays
- Column detection and type inference

**2. AI Field Mapping**
- Uses Claude to suggest column-to-field mappings
- Considers column names, sample values, and data types
- Falls back to rule-based matching if AI unavailable
- Confidence scores for each suggestion

**3. Duplicate Detection**
- Configurable match fields with weights
- Match types: exact, fuzzy (Levenshtein), phonetic (Soundex), normalized
- Threshold-based matching (default 80%)
- Actions: SKIP, UPDATE, CREATE_NEW, MERGE

**4. Rollback Capability**
- 24-hour window after import completion
- Soft-deletes created clients (sets deletedAt)
- Updates ImportRecord status to ROLLED_BACK
- Full audit trail preserved

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/imports/upload` | POST | Upload file, parse, get AI mappings |
| `/api/imports/preview` | POST | Generate preview with duplicate detection |
| `/api/imports/execute` | POST | Start import job |
| `/api/imports/[id]` | GET | Get batch details |
| `/api/imports/[id]/rollback` | POST | Rollback import |
| `/api/imports/history` | GET | List import batches |

### UI Pages

- `/imports` - Import Center with file upload and history

### Trade-offs

- (+) AI mapping reduces manual configuration
- (+) Fuzzy matching catches spelling variations
- (+) 24-hour rollback provides safety net
- (+) Full preview before execution
- (-) Large files require background processing
- (-) AI mapping costs API tokens
- (-) Rollback only soft-deletes (preserves audit trail)

---

## Dependencies Required

```bash
# Required for CalGrants Excel exports
npm install exceljs
```

**Note:** The xlsx-generator will throw a helpful error if exceljs is not installed when a CalGrants export is attempted.

ExcelJS is used for generating properly formatted Excel files for CalGrants exports, including:
- Multiple worksheets (Data, Summary, Info)
- Styled headers with freeze pane
- Auto-filter capability
- Date and number formatting

---

## Verification Checklist

1. **Schema:** Run `npm run db:push` - verify new tables created
2. **Template Creation:**
   - Create HUD HMIS template via API
   - Verify field mappings stored correctly
3. **Data Extraction:**
   - Create test clients with form submissions
   - Run export preview - verify fields extracted
4. **Export Generation:**
   - Generate export for date range
   - Verify file in S3
   - Download and verify format
5. **Validation:**
   - Generate export with missing required fields
   - Verify validation errors reported
6. **UI Flow:**
   - Navigate to Export Center
   - Create template using wizard
   - Generate and download export
7. **Scheduling:**
   - Configure schedule via template settings
   - Verify next run time calculated
   - Check dashboard shows upcoming exports
8. **Dashboard:**
   - View summary statistics
   - Check attention-needed alerts
   - Trigger one-click export
9. **Import:**
   - Upload CSV/Excel/JSON file
   - Review AI-suggested field mappings
   - Preview duplicate detection results
   - Execute import
   - Verify rollback available for 24 hours

---

## Files Created/Modified

### New Files (35 files)

**Schema:**
- `prisma/schema.prisma` - Added ExportTemplate, FunderExport models

**Services:**
- `src/lib/services/exports/types.ts`
- `src/lib/services/exports/index.ts`
- `src/lib/services/exports/storage.ts`
- `src/lib/services/exports/templates/index.ts`
- `src/lib/services/exports/templates/predefined.ts`
- `src/lib/services/exports/generators/base.ts`
- `src/lib/services/exports/generators/index.ts`
- `src/lib/services/exports/generators/csv-generator.ts`
- `src/lib/services/exports/generators/txt-generator.ts`
- `src/lib/services/exports/generators/xlsx-generator.ts`
- `src/lib/services/exports/data-extraction/index.ts`
- `src/lib/services/exports/data-extraction/field-mapper.ts`
- `src/lib/services/exports/data-extraction/transformers.ts`
- `src/lib/services/exports/validation/index.ts`

**Job Processor:**
- `src/lib/jobs/processors/funder-export.ts`

**API Routes:**
- `src/app/api/exports/templates/route.ts`
- `src/app/api/exports/templates/[id]/route.ts`
- `src/app/api/exports/templates/[id]/validate/route.ts`
- `src/app/api/exports/generate/route.ts`
- `src/app/api/exports/[id]/route.ts`
- `src/app/api/exports/[id]/download/route.ts`
- `src/app/api/exports/preview/route.ts`
- `src/app/api/exports/history/route.ts`
- `src/app/api/exports/field-mappings/[type]/route.ts`

**UI Pages:**
- `src/app/(dashboard)/exports/page.tsx`
- `src/app/(dashboard)/exports/templates/page.tsx`
- `src/app/(dashboard)/exports/templates/new/page.tsx`
- `src/app/(dashboard)/exports/history/page.tsx`
- `src/app/(dashboard)/exports/dashboard/page.tsx`

**Scheduling (Phase 4):**
- `src/lib/services/exports/scheduling.ts`
- `src/lib/jobs/processors/scheduled-export-runner.ts`
- `src/app/api/exports/templates/[id]/schedule/route.ts`
- `src/app/api/exports/dashboard/route.ts`
- `src/components/exports/schedule/schedule-config.tsx`
- `src/components/exports/schedule/index.ts`

**Import (Phase 3):**
- `src/lib/services/imports/index.ts`
- `src/lib/services/imports/types.ts`
- `src/lib/services/imports/file-parser.ts`
- `src/lib/services/imports/ai-field-mapper.ts`
- `src/lib/services/imports/duplicate-detector.ts`
- `src/lib/jobs/processors/import.ts`
- `src/app/api/imports/upload/route.ts`
- `src/app/api/imports/preview/route.ts`
- `src/app/api/imports/execute/route.ts`
- `src/app/api/imports/[id]/route.ts`
- `src/app/api/imports/[id]/rollback/route.ts`
- `src/app/api/imports/history/route.ts`
- `src/app/(dashboard)/imports/page.tsx`

### Modified Files

- `src/lib/jobs/queue.ts` - Added FunderExportJobData, ScheduledExportRunnerData, ImportJobData types
- `src/lib/jobs/processors/index.ts` - Registered all processors
- `src/lib/jobs/worker.ts` - Added type guards for all job types
- `prisma/schema.prisma` - Added ExportTemplate, FunderExport, ImportTemplate, ImportBatch, ImportRecord models

---

## Security Considerations

1. **Data Access:** All exports scoped to user's organization via orgId checks
2. **File Storage:** S3 server-side encryption with KMS
3. **Download URLs:** Time-limited signed URLs (1 hour expiry)
4. **Permissions:** Only ADMIN, SUPER_ADMIN, PROGRAM_MANAGER can create/edit templates
5. **Audit Trail:** Export records track who generated them and when
6. **PII Handling:** SSN transformer supports masked output for non-production use

---

## Performance Considerations

1. **Pagination:** Client queries use limit/offset to avoid loading all records
2. **Async Processing:** Large exports processed in background jobs
3. **Lazy Loading:** ExcelJS imported dynamically only when needed
4. **Streaming:** S3 downloads use streaming for large files
5. **Indexing:** Database indexes on orgId, status, templateId for common queries

---

## Monitoring & Observability

- **Job Progress:** Real-time progress via JobProgress table
- **Console Logging:** Key milestones logged during export generation
- **Error Tracking:** Failed jobs store error message in validationErrors field
- **Metrics Ready:** Queue metrics available via `getQueueMetrics()`

---

## Future Considerations

1. **XML Export Format:** Some funders require XML. Base generator architecture supports this.
2. **Field-Level Encryption:** Some fields (SSN) may need encryption even in exports.
3. **Export Templates Marketplace:** Share templates between organizations.
4. **AI-Assisted Mapping:** Use LLM to suggest field mappings from form labels.
