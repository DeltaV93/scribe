# Scrybe API Documentation

This document describes the API endpoints for Scrybe's new features including Meetings, Knowledge Base, Exports, Imports, Document Extraction, Mass Notes, Reports, Admin Locations, Meeting Integrations, and Webhooks.

## Table of Contents

1. [Authentication](#authentication)
2. [Meetings API](#meetings-api)
3. [Knowledge API](#knowledge-api)
4. [Exports API](#exports-api)
5. [Imports API](#imports-api)
6. [Document Extraction API](#document-extraction-api)
7. [Mass Notes API](#mass-notes-api)
8. [Reports API](#reports-api)
9. [Admin Locations API](#admin-locations-api)
10. [Meeting Integrations API](#meeting-integrations-api)
11. [Webhooks](#webhooks)

---

## Authentication

All API endpoints require authentication via Supabase Auth JWT token. Include the token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

The API uses organization-level isolation. Users can only access resources belonging to their organization.

---

## Meetings API

Endpoints for managing meeting recordings, transcripts, summaries, and action items.

### List Meetings

```
GET /api/meetings
```

List meetings with optional filters and pagination.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Search query for meeting title/description |
| `status` | string | Filter by status: `SCHEDULED`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `source` | string | Filter by source: `UPLOAD`, `TEAMS`, `ZOOM`, `GOOGLE_MEET` |
| `locationId` | string | Filter by location ID |
| `locationIds` | string | Comma-separated list of location IDs |
| `fromDate` | string | Filter meetings after this ISO date |
| `toDate` | string | Filter meetings before this ISO date |
| `participantEmail` | string | Filter by participant email |
| `tags` | string | Comma-separated list of tags |
| `limit` | number | Max results (default: 20, max: 100) |
| `offset` | number | Pagination offset (default: 0) |
| `filterByAccessibleLocations` | boolean | Filter by user's accessible locations (default: true) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Team Meeting",
      "description": "Weekly sync",
      "status": "COMPLETED",
      "source": "UPLOAD",
      "recordingPath": "path/to/recording.mp4",
      "scheduledStartAt": "2024-01-15T10:00:00Z",
      "participants": ["email1@example.com"],
      "tags": ["weekly", "team"],
      "createdAt": "2024-01-15T09:00:00Z"
    }
  ],
  "total": 42
}
```

### Create Meeting

```
POST /api/meetings
```

Create a new meeting record.

**Request Body:**

```json
{
  "title": "Team Standup",
  "description": "Daily standup meeting",
  "source": "UPLOAD",
  "scheduledStartAt": "2024-01-15T10:00:00Z",
  "scheduledEndAt": "2024-01-15T10:30:00Z",
  "participants": ["user@example.com"],
  "locationId": "uuid",
  "tags": ["daily", "standup"],
  "externalMeetingId": "external-123",
  "externalJoinUrl": "https://meet.example.com/123"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Team Standup",
    "status": "SCHEDULED",
    ...
  }
}
```

### Get Meeting

```
GET /api/meetings/{meetingId}
```

Get meeting details by ID. Requires location-based access.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Team Meeting",
    "status": "COMPLETED",
    "summary": { ... },
    "transcript": { ... },
    "actionItems": [ ... ]
  }
}
```

### Update Meeting

```
PUT /api/meetings/{meetingId}
```

Update meeting details. Requires EDIT access level.

**Request Body:**

```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "scheduledStartAt": "2024-01-15T11:00:00Z",
  "participants": ["new@example.com"],
  "locationId": "uuid",
  "tags": ["updated"]
}
```

**Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

### Delete Meeting

```
DELETE /api/meetings/{meetingId}
```

Delete a meeting and all related records. Requires MANAGE access level.

**Response:**

```json
{
  "success": true
}
```

### Upload Meeting Recording

```
POST /api/meetings/{meetingId}/upload
```

Upload a meeting recording file. Supports multipart/form-data.

**Request Body (Form Data):**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Recording file (mp3, mp4, wav, webm, m4a, mov) |
| `autoProcess` | string | Set to "false" to skip automatic processing (default: true) |

**Constraints:**
- Max file size: 500MB
- Allowed formats: MP3, MP4, WAV, WebM, M4A, MOV

**Response:**

```json
{
  "success": true,
  "message": "Recording uploaded and processing started",
  "data": {
    "meetingId": "uuid",
    "recordingPath": "/path/to/recording.mp4",
    "fileSize": 52428800,
    "fileName": "recording.mp4",
    "mimeType": "video/mp4",
    "jobProgressId": "uuid",
    "processing": true
  }
}
```

### Get Upload Constraints

```
GET /api/meetings/{meetingId}/upload
```

Get allowed file types and size limits for uploads.

**Response:**

```json
{
  "allowedMimeTypes": ["audio/mpeg", "video/mp4", ...],
  "allowedExtensions": [".mp3", ".mp4", ...],
  "maxFileSize": 524288000,
  "maxFileSizeMB": 500
}
```

### Start Meeting Processing

```
POST /api/meetings/{meetingId}/process
```

Start async processing of a meeting recording.

**Request Body:**

```json
{
  "recordingPath": "/path/to/recording.mp4",
  "skipTranscription": false,
  "skipSummarization": false,
  "skipEmailDistribution": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Processing started",
  "data": {
    "jobProgressId": "uuid",
    "meetingId": "uuid"
  }
}
```

### Get Meeting Transcript

```
GET /api/meetings/{meetingId}/transcript
```

Get the transcript for a meeting.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | Set to "text" to return plain text instead of JSON |

**Response (JSON):**

```json
{
  "success": true,
  "data": {
    "meetingId": "uuid",
    "fullText": "...",
    "segments": [ ... ],
    "language": "en",
    "confidence": 0.95
  }
}
```

### Get Meeting Action Items

```
GET /api/meetings/{meetingId}/action-items
```

Get action items for a specific meeting.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "description": "Follow up with client",
      "status": "OPEN",
      "assignee": "John Doe",
      "assigneeUser": { "id": "uuid", "name": "John Doe", "email": "john@example.com" },
      "dueDate": "2024-01-20"
    }
  ]
}
```

### Update Action Item

```
PUT /api/meetings/{meetingId}/action-items
```

Update an action item's status.

**Request Body:**

```json
{
  "actionItemId": "uuid",
  "status": "COMPLETED"
}
```

**Valid status values:** `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`

**Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

### Get User Action Items

```
GET /api/meetings/action-items
```

Get action items assigned to the current user across all meetings.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "description": "Follow up with client",
      "status": "OPEN",
      "meeting": { "id": "uuid", "title": "Team Meeting" }
    }
  ]
}
```

### Resend Meeting Summary

```
POST /api/meetings/{meetingId}/resend-summary
```

Resend the meeting summary email to specified recipients.

**Request Body:**

```json
{
  "recipientEmails": ["user1@example.com", "user2@example.com"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sent": true,
    "recipientCount": 2
  }
}
```

---

## Knowledge API

Endpoints for managing the organization's knowledge base, including semantic search capabilities.

### Search Knowledge

```
GET /api/knowledge
```

Search knowledge entries with text or semantic search.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Search query |
| `semantic` | boolean | Use semantic/vector search (default: false) |
| `source` | string | Filter by source: `MEETING`, `DOCUMENT`, `MANUAL` |
| `category` | string | Filter by category |
| `tags` | string | Comma-separated list of tags |
| `meetingId` | string | Filter by meeting ID |
| `includeArchived` | boolean | Include archived entries (default: false) |
| `minScore` | number | Minimum semantic similarity score (default: 0.5) |
| `limit` | number | Max results (default: 20, max: 100) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Client Onboarding Process",
      "content": "...",
      "summary": "...",
      "source": "MEETING",
      "tags": ["onboarding", "process"],
      "category": "Procedures"
    }
  ],
  "total": 25,
  "searchType": "text"
}
```

### Create Knowledge Entry

```
POST /api/knowledge
```

Create a new knowledge entry.

**Request Body:**

```json
{
  "title": "Quarterly Goals",
  "content": "Full content here...",
  "summary": "Brief summary",
  "source": "MANUAL",
  "meetingId": "uuid",
  "documentPath": "/path/to/doc.pdf",
  "tags": ["goals", "Q1"],
  "category": "Planning"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Quarterly Goals",
    ...
  }
}
```

### Get Knowledge Entry

```
GET /api/knowledge/{id}
```

Get a knowledge entry by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Client Onboarding Process",
    "content": "...",
    ...
  }
}
```

### Update Knowledge Entry

```
PUT /api/knowledge/{id}
```

Update a knowledge entry.

**Request Body:**

```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "summary": "Updated summary",
  "tags": ["updated"],
  "category": "New Category",
  "isArchived": false
}
```

**Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

### Delete Knowledge Entry

```
DELETE /api/knowledge/{id}
```

Delete a knowledge entry.

**Response:**

```json
{
  "success": true
}
```

### Get Knowledge Stats

```
GET /api/knowledge/stats
```

Get knowledge base statistics.

**Response:**

```json
{
  "success": true,
  "data": {
    "totalEntries": 150,
    "bySource": {
      "MEETING": 75,
      "DOCUMENT": 50,
      "MANUAL": 25
    },
    "byCategory": { ... },
    "availableTags": ["tag1", "tag2"],
    "availableCategories": ["Category1", "Category2"]
  }
}
```

### Extract Knowledge from Meeting

```
POST /api/knowledge/extract
```

Extract knowledge entries from a completed meeting.

**Request Body:**

```json
{
  "meetingId": "uuid"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "entriesCreated": 3,
    "entryIds": ["uuid1", "uuid2", "uuid3"]
  }
}
```

---

## Exports API

Endpoints for managing funder export templates, generating exports, and scheduling.

### Export Dashboard

```
GET /api/exports/dashboard
```

Get export dashboard overview with status for all exports.

**Response:**

```json
{
  "summary": {
    "totalTemplates": 5,
    "totalExports": 42,
    "successRate": 95,
    "statusCounts": {
      "PENDING": 2,
      "PROCESSING": 1,
      "COMPLETED": 38,
      "FAILED": 1,
      "VALIDATION_REQUIRED": 0
    },
    "scheduledTemplates": 3
  },
  "templates": [ ... ],
  "byExportType": { ... },
  "recentExports": [ ... ],
  "needsAttention": [ ... ],
  "upcomingScheduled": [ ... ]
}
```

### List Export Templates

```
GET /api/exports/templates
```

List export templates.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `DRAFT`, `ACTIVE`, `ARCHIVED` |
| `exportType` | string | Filter by type: `CAP60`, `DOL_WIPS`, `CALI_GRANTS`, `HUD_HMIS`, `CUSTOM` |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**

```json
{
  "templates": [ ... ],
  "total": 10
}
```

### Create Export Template

```
POST /api/exports/templates
```

Create a new export template. Requires ADMIN, SUPER_ADMIN, or PROGRAM_MANAGER role.

**Request Body:**

```json
{
  "name": "CAP 60 Monthly Export",
  "description": "Monthly export for CAP 60 compliance",
  "exportType": "CAP60",
  "sourceFormIds": ["uuid1", "uuid2"],
  "fieldMappings": [
    {
      "sourceField": "client.firstName",
      "targetField": "FIRST_NAME",
      "transform": "uppercase"
    }
  ],
  "validationRules": [ ... ],
  "outputFormat": "CSV",
  "outputConfig": { ... },
  "usePredefined": true,
  "customizations": {
    "fieldMappingOverrides": { ... }
  }
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "name": "CAP 60 Monthly Export",
  "status": "DRAFT",
  ...
}
```

### Get Export Template

```
GET /api/exports/templates/{id}
```

Get export template details.

**Response:**

```json
{
  "id": "uuid",
  "name": "CAP 60 Monthly Export",
  "exportType": "CAP60",
  "fieldMappings": [ ... ],
  ...
}
```

### Update Export Template

```
PUT /api/exports/templates/{id}
```

Update an export template. Requires ADMIN, SUPER_ADMIN, or PROGRAM_MANAGER role.

**Request Body:**

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "fieldMappings": [ ... ],
  "action": "activate"
}
```

Special actions: `activate`, `archive`

**Response:**

```json
{
  "id": "uuid",
  "name": "Updated Name",
  ...
}
```

### Delete Export Template

```
DELETE /api/exports/templates/{id}
```

Delete or archive an export template. Requires ADMIN or SUPER_ADMIN role.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hard` | boolean | Set to "true" for permanent deletion (default: archive) |

**Response:**

```json
{
  "success": true
}
```

### Validate Export Template

```
POST /api/exports/templates/{id}/validate
```

Validate template configuration.

**Response:**

```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "field": "MIDDLE_NAME",
      "message": "No source mapping found"
    }
  ]
}
```

### Get Template Schedule

```
GET /api/exports/templates/{id}/schedule
```

Get schedule status for a template.

**Response:**

```json
{
  "templateId": "uuid",
  "templateName": "Monthly Export",
  "templateStatus": "ACTIVE",
  "schedule": {
    "enabled": true,
    "cronExpression": "0 0 1 * *",
    "description": "Monthly on the 1st",
    "timezone": "America/Los_Angeles",
    "lastRunAt": "2024-01-01T00:00:00Z",
    "nextRunAt": "2024-02-01T00:00:00Z",
    "failureCount": 0
  },
  "recentExports": [ ... ],
  "presets": { ... }
}
```

### Update Template Schedule

```
PUT /api/exports/templates/{id}/schedule
```

Update schedule for a template. Requires ADMIN, SUPER_ADMIN, or PROGRAM_MANAGER role.

**Request Body:**

```json
{
  "enabled": true,
  "cronExpression": "0 0 1 * *",
  "preset": "monthly",
  "timezone": "America/Los_Angeles"
}
```

**Response:**

```json
{
  "success": true,
  "schedule": {
    "enabled": true,
    "cronExpression": "0 0 1 * *",
    "description": "Monthly on the 1st",
    "timezone": "America/Los_Angeles",
    "nextRunAt": "2024-02-01T00:00:00Z"
  }
}
```

### Trigger Scheduled Export

```
POST /api/exports/templates/{id}/schedule
```

Trigger an immediate scheduled export run. Requires ADMIN, SUPER_ADMIN, or PROGRAM_MANAGER role.

**Response:**

```json
{
  "success": true,
  "exportId": "uuid",
  "message": "Export triggered successfully"
}
```

### Generate Export

```
POST /api/exports/generate
```

Generate an export.

**Request Body:**

```json
{
  "templateId": "uuid",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-31",
  "programIds": ["uuid1", "uuid2"],
  "clientIds": ["uuid1", "uuid2"]
}
```

**Response:** `202 Accepted`

```json
{
  "exportId": "uuid",
  "status": "PENDING",
  "jobProgressId": "uuid"
}
```

### Preview Export

```
POST /api/exports/preview
```

Preview export data before generating.

**Request Body:**

```json
{
  "templateId": "uuid",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-31",
  "limit": 10
}
```

**Response:**

```json
{
  "headers": ["FIRST_NAME", "LAST_NAME", "DOB"],
  "rows": [
    ["John", "Doe", "1990-01-15"],
    ...
  ],
  "totalCount": 150
}
```

### List Export History

```
GET /api/exports/history
```

List generated exports.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `templateId` | string | Filter by template |
| `status` | string | Filter by status: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `VALIDATION_REQUIRED` |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**

```json
{
  "exports": [ ... ],
  "total": 42
}
```

### Get Export

```
GET /api/exports/{id}
```

Get export details.

**Response:**

```json
{
  "id": "uuid",
  "status": "COMPLETED",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-31",
  "recordCount": 150,
  "template": { ... }
}
```

### Retry Export

```
POST /api/exports/{id}
```

Retry a failed export.

**Request Body:**

```json
{
  "action": "retry"
}
```

**Response:** `202 Accepted`

```json
{
  "exportId": "uuid",
  "status": "PENDING"
}
```

### Download Export

```
GET /api/exports/{id}/download
```

Get a signed download URL for a completed export.

**Response:**

```json
{
  "downloadUrl": "https://..."
}
```

### Get Field Mappings

```
GET /api/exports/field-mappings/{type}
```

Get suggested field mappings for an export type.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `formIds` | string | Comma-separated form IDs |

**Response:**

```json
{
  "exportType": "CAP60",
  "predefinedTemplate": {
    "name": "CAP 60 Reporting",
    "description": "...",
    "outputFormat": "CSV",
    "fieldCount": 45,
    "requiredFields": 20
  },
  "fields": [ ... ],
  "codeMappings": { ... },
  "suggestedMappings": [ ... ],
  "availableFields": [ ... ]
}
```

---

## Imports API

Endpoints for importing client data from external files.

### Upload Import File

```
POST /api/imports/upload
```

Upload a file for import. Requires ADMIN, SUPER_ADMIN, or PROGRAM_MANAGER role.

**Request Body (Form Data):**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Import file (CSV, XLSX, XLS, JSON) |

**Constraints:**
- Max file size: 10MB
- Allowed formats: CSV, XLSX, XLS, JSON

**Response:**

```json
{
  "batchId": "uuid",
  "fileName": "clients.csv",
  "totalRows": 500,
  "columns": ["first_name", "last_name", "phone"],
  "preview": [ ... ],
  "suggestedMappings": [
    {
      "sourceColumn": "first_name",
      "targetField": "client.firstName",
      "confidence": 0.95
    }
  ],
  "warnings": []
}
```

### Preview Import

```
POST /api/imports/preview
```

Generate import preview with duplicate detection. Requires ADMIN, SUPER_ADMIN, or PROGRAM_MANAGER role.

**Request Body:**

```json
{
  "batchId": "uuid",
  "fieldMappings": [
    {
      "sourceColumn": "first_name",
      "targetField": "client.firstName"
    },
    {
      "sourceColumn": "last_name",
      "targetField": "client.lastName"
    },
    {
      "sourceColumn": "phone",
      "targetField": "client.phone"
    }
  ],
  "duplicateSettings": {
    "checkFields": ["firstName", "lastName", "phone"],
    "threshold": 0.85,
    "defaultAction": "SKIP"
  }
}
```

**Required field mappings:** `client.firstName`, `client.lastName`, `client.phone`

**Response:**

```json
{
  "validRows": 480,
  "invalidRows": 20,
  "duplicates": [
    {
      "rowIndex": 5,
      "sourceData": { ... },
      "matches": [
        {
          "clientId": "uuid",
          "name": "John Doe",
          "similarity": 0.92
        }
      ]
    }
  ],
  "preview": [ ... ],
  "errors": [ ... ]
}
```

### Execute Import

```
POST /api/imports/execute
```

Execute the import. Requires ADMIN, SUPER_ADMIN, or PROGRAM_MANAGER role.

**Request Body:**

```json
{
  "batchId": "uuid",
  "fieldMappings": [ ... ],
  "duplicateSettings": { ... },
  "duplicateResolutions": {
    "5": {
      "action": "MERGE",
      "selectedMatchId": "uuid"
    },
    "12": {
      "action": "CREATE_NEW"
    }
  }
}
```

**Duplicate actions:** `SKIP`, `MERGE`, `CREATE_NEW`, `OVERWRITE`

**Response:**

```json
{
  "success": true,
  "batchId": "uuid",
  "jobProgressId": "uuid",
  "message": "Import started. You can track progress using the job ID."
}
```

### List Import History

```
GET /api/imports/history
```

List import batches.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `PENDING`, `MAPPING`, `READY`, `PROCESSING`, `COMPLETED`, `FAILED`, `ROLLED_BACK` |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**

```json
{
  "batches": [ ... ],
  "total": 15
}
```

### Get Import Batch

```
GET /api/imports/{id}
```

Get import batch details.

**Response:**

```json
{
  "id": "uuid",
  "status": "COMPLETED",
  "fileName": "clients.csv",
  "totalRows": 500,
  "processedRows": 500,
  "createdClients": 480,
  "updatedClients": 15,
  "errorCount": 5,
  "rollbackAvailable": true,
  "rollbackAvailableUntil": "2024-01-22T00:00:00Z"
}
```

### Rollback Import

```
POST /api/imports/{id}/rollback
```

Rollback an import. Requires ADMIN or SUPER_ADMIN role.

**Response:**

```json
{
  "success": true,
  "batchId": "uuid",
  "rolledBackCount": 480,
  "message": "Successfully rolled back 480 records"
}
```

---

## Document Extraction API

Endpoints for extracting form data from documents (PDFs, photos).

### Upload and Extract

```
POST /api/document-extraction
```

Upload a document and start extraction for a form.

**Request Body (Form Data):**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Document file (PDF, image) |
| `formId` | string | Target form ID |
| `clientId` | string | Optional client ID |
| `async` | string | Set to "true" for async processing |

**Response (Sync):**

```json
{
  "success": true,
  "extractionId": "uuid",
  "status": "COMPLETED",
  "result": {
    "pageCount": 2,
    "isScanned": false,
    "fields": [
      {
        "fieldId": "uuid",
        "value": "John Doe",
        "confidence": 0.95
      }
    ],
    "overallConfidence": 0.92,
    "warnings": []
  }
}
```

**Response (Async):**

```json
{
  "success": true,
  "extractionId": "uuid",
  "status": "PENDING",
  "message": "Extraction started. Poll for status."
}
```

### List Extractions

```
GET /api/document-extraction
```

List extractions for the current user or a specific form.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `formId` | string | Filter by form ID |
| `status` | string | Filter by status |
| `myOnly` | boolean | Only show current user's extractions |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**

```json
{
  "items": [ ... ],
  "total": 25,
  "limit": 20,
  "offset": 0
}
```

### Get Extraction Status

```
GET /api/document-extraction/{extractionId}
```

Get extraction status and results.

**Response:**

```json
{
  "id": "uuid",
  "status": "COMPLETED",
  "progress": 100,
  "result": {
    "fields": [ ... ],
    "overallConfidence": 0.92
  },
  "error": null
}
```

### Delete Extraction

```
DELETE /api/document-extraction/{extractionId}
```

Delete an extraction.

**Response:**

```json
{
  "success": true
}
```

### Apply Extraction to Form

```
POST /api/document-extraction/{extractionId}/apply
```

Apply extracted data to a form submission.

**Request Body:**

```json
{
  "minConfidence": 0.8,
  "overwriteExisting": false,
  "includeFieldIds": ["uuid1", "uuid2"],
  "excludeFieldIds": ["uuid3"]
}
```

**Response:**

```json
{
  "success": true,
  "submissionId": "uuid",
  "appliedFields": 15,
  "skippedFields": 3,
  "details": [
    {
      "fieldId": "uuid",
      "status": "applied",
      "value": "John Doe"
    }
  ]
}
```

### Update Extracted Field

```
PATCH /api/document-extraction/{extractionId}/fields
```

Update extracted field values (for manual corrections).

**Request Body:**

```json
{
  "fieldId": "uuid",
  "value": "Corrected Value",
  "confidence": 1.0
}
```

**Response:**

```json
{
  "success": true,
  "field": {
    "fieldId": "uuid",
    "value": "Corrected Value",
    "confidence": 1.0
  }
}
```

---

## Mass Notes API

Endpoints for creating notes for multiple clients at once.

### Create Mass Notes

```
POST /api/mass-notes
```

Create a mass note job.

**Request Body:**

```json
{
  "sessionId": "uuid",
  "templateId": "uuid",
  "templateContent": "{{client.firstName}} attended the session on {{session.date}}. Notes: {{customNote}}",
  "noteType": "PROGRESS",
  "tags": ["group-session", "attendance"],
  "clientIds": ["uuid1", "uuid2", "uuid3"],
  "customVariables": {
    "customNote": "Additional observations"
  }
}
```

**Note types:** `PROGRESS`, `CASE_NOTE`, `INTAKE`, `ASSESSMENT`, `DISCHARGE`, `GENERAL`

**Response:** `202 Accepted`

```json
{
  "success": true,
  "data": {
    "jobId": "uuid"
  },
  "message": "Mass note creation started for 3 clients"
}
```

### Get Session Attendees or List Batches

```
GET /api/mass-notes
```

Get attendees for mass note creation OR list mass note batches.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Get attendees for this session |
| `batches` | boolean | Set to "true" to list batches instead |
| `allUsers` | boolean | Include batches from all users (admin) |
| `limit` | number | Max results (default: 20, max: 100) |
| `offset` | number | Pagination offset (default: 0) |

**Response (Attendees):**

```json
{
  "success": true,
  "data": {
    "session": { ... },
    "attendees": [
      {
        "clientId": "uuid",
        "name": "John Doe",
        "attendanceStatus": "PRESENT"
      }
    ]
  }
}
```

**Response (Batches):**

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0
  }
}
```

### Preview Mass Notes

```
POST /api/mass-notes/preview
```

Preview mass notes for clients before creating.

**Request Body:**

```json
{
  "sessionId": "uuid",
  "templateContent": "{{client.firstName}} attended...",
  "clientIds": ["uuid1", "uuid2"],
  "customVariables": { ... }
}
```

**Constraints:** Max 10 clients for preview

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "clientId": "uuid",
      "clientName": "John Doe",
      "renderedContent": "John attended..."
    }
  ]
}
```

### List Note Templates

```
GET /api/mass-notes/templates
```

List note templates available for mass notes.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `programId` | string | Filter by program ID |
| `scope` | string | Filter by scope: `ORGANIZATION`, `PROGRAM`, `USER` |

**Response:**

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "availableVariables": [
      {
        "key": "client.firstName",
        "description": "Client's first name"
      }
    ],
    "variablePreviews": { ... },
    "variableKeys": ["client.firstName", "client.lastName", ...]
  }
}
```

### Get Mass Note Batch

```
GET /api/mass-notes/{batchId}
```

Get mass note batch status and details.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeNotes` | boolean | Include created notes in response |
| `notesLimit` | number | Max notes to include (default: 50, max: 100) |
| `notesOffset` | number | Offset for notes pagination |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "COMPLETED",
    "totalClients": 25,
    "completedCount": 25,
    "errorCount": 0,
    "createdAt": "2024-01-15T10:00:00Z",
    "completedAt": "2024-01-15T10:01:30Z",
    "notes": [ ... ]
  }
}
```

---

## Reports API

Endpoints for automated report generation and scheduling.

### List Reports

```
GET /api/reports
```

List generated reports.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `PENDING`, `GENERATING`, `COMPLETED`, `FAILED` |
| `templateId` | string | Filter by template ID |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Report Types

```
GET /api/reports/questionnaire
```

Get available report types.

**Response:**

```json
{
  "data": [
    {
      "type": "HUD_APR",
      "name": "HUD Annual Performance Report",
      "description": "..."
    },
    {
      "type": "DOL_WORKFORCE",
      "name": "DOL Workforce Report",
      "description": "..."
    }
  ]
}
```

### Get Questionnaire

```
GET /api/reports/questionnaire/{type}
```

Get questionnaire for a specific report type.

**Valid types:** `HUD_APR`, `DOL_WORKFORCE`, `CALI_GRANTS`, `BOARD_REPORT`, `IMPACT_REPORT`, `CUSTOM`

**Response:**

```json
{
  "data": {
    "sections": [
      {
        "title": "Program Information",
        "questions": [
          {
            "id": "program_type",
            "type": "select",
            "label": "What type of program?",
            "options": [ ... ],
            "required": true
          }
        ]
      }
    ]
  }
}
```

### Submit Questionnaire

```
POST /api/reports/questionnaire
```

Submit questionnaire answers and get metric suggestions.

**Request Body:**

```json
{
  "reportType": "HUD_APR",
  "answers": {
    "program_type": "emergency_shelter",
    "reporting_period": "annual"
  },
  "getSuggestions": true,
  "funderRequirements": "Optional text with specific funder requirements"
}
```

**Response:**

```json
{
  "data": {
    "valid": true,
    "suggestions": {
      "required": [
        {
          "metricId": "bed_utilization",
          "name": "Bed Utilization Rate",
          "reason": "Required for emergency shelter reporting"
        }
      ],
      "recommended": [ ... ]
    }
  }
}
```

### Get Pre-built Metrics

```
GET /api/reports/metrics/pre-built
```

Get pre-built metrics for reports.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by report type |
| `category` | string | Filter by category |

**Response:**

```json
{
  "data": {
    "metrics": [
      {
        "id": "bed_utilization",
        "name": "Bed Utilization Rate",
        "description": "...",
        "category": "Housing",
        "calculation": { ... }
      }
    ],
    "categories": ["Housing", "Employment", "Demographics"]
  }
}
```

### Clone Metric

```
POST /api/reports/metrics/clone
```

Clone a pre-built metric for customization.

**Request Body:**

```json
{
  "baseMetricId": "bed_utilization",
  "name": "Custom Bed Utilization",
  "description": "Modified calculation for our program",
  "calculation": { ... }
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "name": "Custom Bed Utilization",
    ...
  }
}
```

### Suggest Metrics

```
POST /api/reports/suggest-metrics
```

Get AI-powered metric suggestions.

**Request Body:**

```json
{
  "reportType": "HUD_APR",
  "questionnaireAnswers": { ... },
  "funderRequirements": "...",
  "existingMetricIds": ["metric1", "metric2"]
}
```

**Response:**

```json
{
  "data": {
    "required": [ ... ],
    "recommended": [ ... ],
    "optional": [ ... ]
  }
}
```

### List Report Templates

```
GET /api/reports/templates
```

List report templates.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `type` | string | Filter by report type |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 10,
    "limit": 20,
    "offset": 0
  }
}
```

### Create Report Template

```
POST /api/reports/templates
```

Create a new report template.

**Request Body:**

```json
{
  "name": "Q1 Funder Report",
  "description": "Quarterly report for main funder",
  "type": "HUD_APR",
  "questionnaireAnswers": { ... },
  "selectedMetricIds": ["metric1", "metric2"],
  "sections": [
    {
      "type": "demographics",
      "title": "Client Demographics",
      "order": 1
    }
  ],
  "funderRequirements": { ... }
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "name": "Q1 Funder Report",
    "status": "DRAFT",
    ...
  }
}
```

### Get Report Template

```
GET /api/reports/templates/{id}
```

Get a report template.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "name": "Q1 Funder Report",
    "type": "HUD_APR",
    "status": "PUBLISHED",
    "metrics": [ ... ],
    "sections": [ ... ],
    "createdBy": { ... },
    "_count": {
      "reports": 5
    }
  }
}
```

### Update Report Template

```
PUT /api/reports/templates/{id}
```

Update a report template. Cannot edit published templates.

**Request Body:**

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "questionnaireAnswers": { ... },
  "metrics": [ ... ],
  "sections": [ ... ],
  "funderRequirements": { ... }
}
```

**Response:**

```json
{
  "data": { ... }
}
```

### Archive Report Template

```
DELETE /api/reports/templates/{id}
```

Archive a report template (soft delete).

**Response:**

```json
{
  "success": true
}
```

### Publish Report Template

```
POST /api/reports/templates/{id}/publish
```

Publish a report template.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "status": "PUBLISHED",
    "publishedAt": "2024-01-15T10:00:00Z",
    ...
  }
}
```

### Generate Report

```
POST /api/reports/generate
```

Generate a report from a template.

**Request Body:**

```json
{
  "templateId": "uuid",
  "reportingPeriod": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-03-31T23:59:59Z"
  },
  "programIds": ["uuid1", "uuid2"],
  "async": true
}
```

**Response:** `202 Accepted`

```json
{
  "data": {
    "reportId": "uuid",
    "status": "PENDING",
    "jobProgressId": "uuid"
  }
}
```

### Get Report

```
GET /api/reports/{id}
```

Get a report with download URL.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "status": "COMPLETED",
    "template": { ... },
    "reportingPeriod": { ... },
    "metrics": [ ... ],
    "downloadUrl": "https://..."
  }
}
```

### Download Report

```
GET /api/reports/{id}/download
```

Get a download URL for the report PDF.

**Response:**

```json
{
  "data": {
    "downloadUrl": "https://...",
    "filename": "Q1_Funder_Report_abc12345.pdf",
    "expiresIn": 3600
  }
}
```

### List Report Schedules

```
GET /api/reports/schedules
```

List scheduled reports.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `preset` | string | Set to "options" to get schedule presets and timezone options |

**Response:**

```json
{
  "data": [ ... ],
  "total": 5
}
```

**Response (preset=options):**

```json
{
  "data": {
    "schedulePresets": {
      "weekly": "0 9 * * 1",
      "monthly": "0 9 1 * *",
      "quarterly": "0 9 1 1,4,7,10 *"
    },
    "timezoneOptions": [ ... ]
  }
}
```

### Create/Update Report Schedule

```
POST /api/reports/schedules
```

Create or update a report schedule.

**Request Body:**

```json
{
  "templateId": "uuid",
  "enabled": true,
  "cronExpression": "0 9 1 * *",
  "timezone": "America/Los_Angeles",
  "distributionSettings": {
    "enabled": true,
    "recipients": [
      {
        "email": "funder@example.com",
        "name": "Funder Contact",
        "type": "to"
      }
    ],
    "subject": "Monthly Progress Report",
    "message": "Please find attached...",
    "attachPdf": true
  }
}
```

**Response:**

```json
{
  "data": {
    "success": true,
    "nextRunAt": "2024-02-01T09:00:00Z"
  }
}
```

### Upload Funder Document

```
POST /api/reports/funder-docs
```

Upload and process a funder document. Requires ADMIN or SUPER_ADMIN role.

**Request Body:**

```json
{
  "name": "2024 Reporting Guidelines",
  "funderName": "HUD",
  "documentType": "Guidelines",
  "extractedText": "...",
  "sourcePath": "/path/to/document.pdf"
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "name": "2024 Reporting Guidelines",
    "extractedRequirements": {
      "requiredMetrics": [ ... ],
      "requiredSections": [ ... ],
      "deadlines": [ ... ]
    }
  }
}
```

### List Funder Documents

```
GET /api/reports/funder-docs/library
```

Get curated funder documents.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `funderName` | string | Filter by funder name |
| `documentType` | string | Filter by document type |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**

```json
{
  "data": {
    "documents": [ ... ],
    "filters": {
      "funders": ["HUD", "DOL", "State"],
      "documentTypes": ["Guidelines", "Template", "Regulations"]
    }
  },
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0
  }
}
```

---

## Admin Locations API

Endpoints for managing the organization's location hierarchy.

### List Locations

```
GET /api/admin/locations
```

List all locations in the organization's hierarchy. Requires ADMIN role.

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Main Office",
      "type": "SITE",
      "code": "MAIN",
      "parentId": null,
      "children": [
        {
          "id": "uuid",
          "name": "North Wing",
          "type": "DEPARTMENT"
        }
      ]
    }
  ]
}
```

### Create Location

```
POST /api/admin/locations
```

Create a new location. Requires ADMIN role.

**Request Body:**

```json
{
  "name": "Downtown Office",
  "type": "SITE",
  "code": "DOWNTOWN",
  "parentId": "uuid",
  "address": "123 Main St",
  "timezone": "America/Los_Angeles"
}
```

**Location types:** `ORGANIZATION`, `REGION`, `DISTRICT`, `SITE`, `DEPARTMENT`, `TEAM`

**Response:** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "name": "Downtown Office",
    ...
  }
}
```

### Get Location

```
GET /api/admin/locations/{id}
```

Get a specific location with its users. Requires VIEW access or ADMIN role.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "name": "Downtown Office",
    "type": "SITE",
    "parent": {
      "id": "uuid",
      "name": "West Region",
      "type": "REGION"
    },
    "children": [ ... ],
    "_count": {
      "meetings": 42,
      "userAccess": 15
    },
    "users": [ ... ]
  }
}
```

### Update Location

```
PUT /api/admin/locations/{id}
```

Update a location. Requires ADMIN role.

**Request Body:**

```json
{
  "name": "Updated Name",
  "code": "UPDATED",
  "parentId": "uuid",
  "address": "456 New St",
  "timezone": "America/New_York",
  "isActive": true
}
```

**Response:**

```json
{
  "data": {
    "success": true
  }
}
```

### Delete Location

```
DELETE /api/admin/locations/{id}
```

Delete a location (soft delete if has meetings). Requires ADMIN role.

**Response:**

```json
{
  "data": {
    "success": true
  }
}
```

### List Location Users

```
GET /api/admin/locations/{id}/users
```

List all users with access to a location. Requires MANAGE access or ADMIN role.

**Response:**

```json
{
  "data": [
    {
      "userId": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "accessLevel": "VIEW",
      "grantedAt": "2024-01-15T10:00:00Z",
      "grantedBy": { ... }
    }
  ]
}
```

### Assign Location Access

```
POST /api/admin/locations/{id}/users
```

Assign user access to a location.

**Request Body:**

```json
{
  "userId": "uuid",
  "accessLevel": "VIEW"
}
```

**Access levels:** `VIEW`, `EDIT`, `MANAGE`

**Response:** `201 Created`

```json
{
  "data": {
    "success": true
  }
}
```

### Get User Location Access

```
GET /api/admin/locations/{id}/users/{userId}
```

Get a specific user's access level for a location. Requires MANAGE access or ADMIN role.

**Response:**

```json
{
  "data": {
    "userId": "uuid",
    "locationId": "uuid",
    "accessLevel": "VIEW",
    "isDirectAssignment": true,
    "assignment": {
      "accessLevel": "VIEW",
      "grantedAt": "2024-01-15T10:00:00Z",
      "grantedBy": { ... }
    }
  }
}
```

### Update User Location Access

```
PUT /api/admin/locations/{id}/users/{userId}
```

Update a user's access level.

**Request Body:**

```json
{
  "accessLevel": "EDIT"
}
```

**Response:**

```json
{
  "data": {
    "success": true
  }
}
```

### Remove User Location Access

```
DELETE /api/admin/locations/{id}/users/{userId}
```

Remove a user's access to a location.

**Response:**

```json
{
  "data": {
    "success": true
  }
}
```

---

## Meeting Integrations API

Endpoints for managing meeting platform integrations (Teams, Zoom, Google Meet).

### List Integrations

```
GET /api/integrations/meetings
```

List all meeting platform integrations for the organization.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "platform": "ZOOM",
      "status": "CONNECTED",
      "autoRecordEnabled": true,
      "syncCalendarEnabled": true,
      "lastSyncAt": "2024-01-15T10:00:00Z",
      "lastError": null,
      "connectedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Initiate OAuth Flow

```
POST /api/integrations/meetings
```

Initiate OAuth flow for a meeting platform. Requires ADMIN role.

**Request Body:**

```json
{
  "platform": "ZOOM",
  "redirectUrl": "/settings/integrations"
}
```

**Platforms:** `TEAMS`, `ZOOM`, `GOOGLE_MEET`

**Response:**

```json
{
  "success": true,
  "data": {
    "authUrl": "https://zoom.us/oauth/authorize?...",
    "platform": "ZOOM"
  }
}
```

### Get Integration Details

```
GET /api/integrations/meetings/{platform}
```

Get details for a specific integration.

**Platforms:** `teams`, `zoom`, `google-meet`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "platform": "ZOOM",
    "status": "CONNECTED",
    "autoRecordEnabled": true,
    "syncCalendarEnabled": true,
    "settings": { ... },
    "lastSyncAt": "2024-01-15T10:00:00Z",
    "connectedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Update Integration Settings

```
PATCH /api/integrations/meetings/{platform}
```

Update integration settings. Requires ADMIN role.

**Request Body:**

```json
{
  "autoRecordEnabled": true,
  "syncCalendarEnabled": false,
  "settings": {
    "recordingQuality": "high"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "platform": "ZOOM",
    "autoRecordEnabled": true,
    "syncCalendarEnabled": false,
    "settings": { ... }
  }
}
```

### Disconnect Integration

```
DELETE /api/integrations/meetings/{platform}
```

Disconnect an integration. Requires ADMIN role.

**Response:**

```json
{
  "success": true,
  "message": "ZOOM integration disconnected"
}
```

### OAuth Callback

```
GET /api/integrations/meetings/callback/{platform}
```

Handle OAuth callback from meeting platforms. This endpoint is called by the OAuth provider after user authorization.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from OAuth provider |
| `state` | string | State parameter for CSRF protection |
| `error` | string | Error code (if authorization failed) |
| `error_description` | string | Error description |

**Response:** Redirects to `/settings/integrations` with success or error parameters.

---

## Webhooks

Webhook endpoints for receiving events from external meeting platforms.

### Microsoft Teams Webhook

```
POST /api/webhooks/meetings/teams
GET /api/webhooks/meetings/teams
```

Handle Microsoft Teams Graph API notifications.

**POST - Handle Notification:**

Teams sends notifications when:
- A meeting recording is created or updated
- Webhook subscription validation is required

**Query Parameters (Validation):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `validationToken` | string | Token for subscription validation |

**Request Headers:**

| Header | Description |
|--------|-------------|
| `x-ms-signature` | Signature for webhook validation |

**Response (Validation):** Returns the validation token as plain text.

**Response (Notification):** `202 Accepted`

```json
{
  "success": true,
  "processed": true
}
```

**GET - Health Check:**

```json
{
  "status": "ok",
  "platform": "teams",
  "endpoint": "/api/webhooks/meetings/teams"
}
```

### Zoom Webhook

```
POST /api/webhooks/meetings/zoom
GET /api/webhooks/meetings/zoom
```

Handle Zoom webhook events.

**POST - Handle Events:**

Zoom sends notifications for:
- `recording.completed` - Recording finished
- `recording.transcript_completed` - Transcript ready
- `endpoint.url_validation` - Endpoint validation

**Request Headers:**

| Header | Description |
|--------|-------------|
| `x-zm-signature` | Webhook signature |
| `x-zm-request-timestamp` | Request timestamp |

**Response (Validation):**

```json
{
  "plainToken": "...",
  "encryptedToken": "..."
}
```

**Response (Event):**

```json
{
  "success": true,
  "processed": true
}
```

**GET - Health Check:**

```json
{
  "status": "ok",
  "platform": "zoom",
  "endpoint": "/api/webhooks/meetings/zoom"
}
```

### Google Meet Webhook

```
POST /api/webhooks/meetings/google
GET /api/webhooks/meetings/google
```

Handle Google Calendar push notifications (Google Meet uses Calendar for recording events).

**POST - Handle Notifications:**

**Request Headers:**

| Header | Description |
|--------|-------------|
| `x-goog-channel-id` | Channel ID |
| `x-goog-resource-id` | Resource ID |
| `x-goog-resource-state` | Resource state (`sync`, `exists`, `update`) |
| `x-goog-channel-token` | Channel token for validation |
| `x-goog-channel-expiration` | Channel expiration time |
| `x-goog-message-number` | Message number |

**Response (Sync):**

```json
{
  "success": true,
  "message": "Sync acknowledged"
}
```

**Response (Event):**

```json
{
  "success": true,
  "processed": true
}
```

**GET - Health Check:**

```json
{
  "status": "ok",
  "platform": "google_meet",
  "endpoint": "/api/webhooks/meetings/google"
}
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

**Common Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required or invalid token |
| `FORBIDDEN` | 403 | User lacks required permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `CONFLICT` | 409 | Resource conflict (e.g., already processing) |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

API endpoints are subject to rate limiting. When rate limited, you will receive a `429 Too Many Requests` response with a `Retry-After` header indicating when you can retry.

---

## Pagination

Endpoints that return lists support pagination with `limit` and `offset` parameters:

- `limit`: Maximum number of items to return (default varies by endpoint)
- `offset`: Number of items to skip (default: 0)

Paginated responses include a `total` count for calculating pages.
