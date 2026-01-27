# Programs Feature - Comprehensive Test Plan

## Table of Contents
1. [Program Management](#1-program-management)
2. [Session Management](#2-session-management)
3. [Client Enrollment](#3-client-enrollment)
4. [Attendance Tracking](#4-attendance-tracking)
5. [Materials Management](#5-materials-management)
6. [Hours & Progress Tracking](#6-hours--progress-tracking)
7. [Statistics & Reporting](#7-statistics--reporting)
8. [Permissions & Access Control](#8-permissions--access-control)
9. [Edge Cases & Error Handling](#9-edge-cases--error-handling)

---

## Prerequisites

- [ ] App is running (local or deployed)
- [ ] Test user accounts exist for each role:
  - [ ] SUPER_ADMIN
  - [ ] ADMIN
  - [ ] PROGRAM_MANAGER
  - [ ] CASE_MANAGER
  - [ ] VIEWER
- [ ] At least 5-10 test clients exist in the system
- [ ] Database is seeded or has test data

---

## 1. Program Management

### 1.1 Create Program
- [ ] Navigate to Programs list page
- [ ] Click "Create Program" / "New Program" button
- [ ] **Required Fields:**
  - [ ] Enter program name (verify max 200 chars)
  - [ ] Select label type (PROGRAM, COURSE, CLASS, WORKSHOP, TRAINING, GROUP)
- [ ] **Optional Fields:**
  - [ ] Enter description (verify max 5000 chars)
  - [ ] Set required hours (integer)
  - [ ] Set start date
  - [ ] Set end date
  - [ ] Enter location (verify max 500 chars)
  - [ ] Set max enrollment (integer)
  - [ ] Select facilitator
  - [ ] Set status (DRAFT, ACTIVE, COMPLETED, CANCELLED, ARCHIVED)
  - [ ] Configure schedule (days of week, start time, end time, frequency, notes)
- [ ] Submit form
- [ ] Verify success message/toast
- [ ] Verify redirected to program detail or list page
- [ ] Verify program appears in programs list

### 1.2 View Program
- [ ] Navigate to Programs list
- [ ] Click on a program to view details
- [ ] Verify all program information displays correctly:
  - [ ] Name
  - [ ] Label type badge
  - [ ] Status badge
  - [ ] Description
  - [ ] Schedule
  - [ ] Start/End dates
  - [ ] Location
  - [ ] Required hours
  - [ ] Max enrollment
  - [ ] Facilitator name
  - [ ] Creator name
- [ ] Verify tabs are visible (Sessions, Enrollments, Materials, etc.)
- [ ] Verify statistics card shows metrics

### 1.3 Update Program
- [ ] Open program detail page
- [ ] Click "Edit" button
- [ ] Modify program name
- [ ] Modify description
- [ ] Change status
- [ ] Update schedule
- [ ] Change required hours
- [ ] Submit changes
- [ ] Verify success message
- [ ] Verify changes persist on reload

### 1.4 List & Filter Programs
- [ ] View programs list page
- [ ] Verify pagination works (if >20 programs)
- [ ] Filter by status (ACTIVE, DRAFT, etc.)
- [ ] Filter by label type
- [ ] Search by program name
- [ ] Verify filters can be combined
- [ ] Verify "Clear filters" works

### 1.5 Archive Program (Soft Delete)
- [ ] Open program detail page
- [ ] Click "Archive" or "Delete" button
- [ ] Confirm action in dialog
- [ ] Verify program no longer appears in default list
- [ ] Verify program appears when filtering by ARCHIVED status

### 1.6 Delete Program (Hard Delete - Admin Only)
- [ ] As ADMIN/SUPER_ADMIN, open archived program
- [ ] Click "Permanently Delete" (if available)
- [ ] Confirm action
- [ ] Verify program is completely removed
- [ ] Verify related sessions, enrollments, materials are deleted

---

## 2. Session Management

### 2.1 Create Single Session
- [ ] Open program detail page
- [ ] Navigate to Sessions tab
- [ ] Click "Add Session" button
- [ ] Fill in session details:
  - [ ] Session number (required, min 1)
  - [ ] Title (required, max 200 chars)
  - [ ] Topic (optional, max 2000 chars)
  - [ ] Date (optional)
  - [ ] Duration in minutes (optional)
  - [ ] Notes (optional, max 5000 chars)
- [ ] Submit form
- [ ] Verify session appears in sessions list
- [ ] Verify session number is unique

### 2.2 Create Multiple Sessions (Bulk)
- [ ] Click "Add Multiple Sessions" or similar
- [ ] Enter multiple sessions at once
- [ ] Submit
- [ ] Verify all sessions created
- [ ] Verify session numbers are sequential/unique

### 2.3 View Session
- [ ] Click on a session in the list
- [ ] Verify all session details display:
  - [ ] Session number
  - [ ] Title
  - [ ] Topic
  - [ ] Date
  - [ ] Duration
  - [ ] Notes
  - [ ] Attendance count (if any)

### 2.4 Update Session
- [ ] Click edit on a session
- [ ] Modify title
- [ ] Change date
- [ ] Update duration
- [ ] Save changes
- [ ] Verify changes persist

### 2.5 Delete Session
- [ ] Click delete on a session
- [ ] Confirm deletion
- [ ] Verify session removed from list
- [ ] Verify associated attendance records are deleted

### 2.6 Session Ordering
- [ ] Verify sessions display in order by session number
- [ ] Verify sessions display in order by date (if sorted that way)

---

## 3. Client Enrollment

### 3.1 Enroll Single Client
- [ ] Open program detail page
- [ ] Navigate to Enrollments tab
- [ ] Click "Enroll Client" button
- [ ] Search for client by name
- [ ] Search for client by phone number
- [ ] Verify 300ms debounce on search
- [ ] Verify spinner shows while searching
- [ ] Select a client from results
- [ ] Click Enroll button
- [ ] Verify success message
- [ ] Verify client appears in enrollments list

### 3.2 Enroll Multiple Clients (Bulk)
- [ ] Click "Enroll Client" button
- [ ] Search for clients
- [ ] Select multiple clients using checkboxes
- [ ] Verify button shows count: "Enroll 3 Clients"
- [ ] Click Enroll button
- [ ] Verify success message with count
- [ ] Verify all clients appear in enrollments list

### 3.3 Already Enrolled Handling
- [ ] Open enroll dialog
- [ ] Search for a client already enrolled
- [ ] Verify client row is grayed out
- [ ] Verify "Enrolled" badge displays
- [ ] Verify checkbox is disabled
- [ ] Verify clicking row does nothing

### 3.4 View Enrollments List
- [ ] Verify enrollments table displays:
  - [ ] Client name
  - [ ] Phone number
  - [ ] Enrolled date
  - [ ] Status badge
  - [ ] Hours progress bar
  - [ ] Actions column

### 3.5 Update Enrollment Status
- [ ] Click on status dropdown for an enrollment
- [ ] Change status to IN_PROGRESS
- [ ] Verify status updates
- [ ] Change status to COMPLETED
- [ ] Verify status updates
- [ ] Change status to ON_HOLD
- [ ] Verify status updates

### 3.6 Withdraw Client
- [ ] Click withdraw button on an enrollment
- [ ] Confirm withdrawal in dialog
- [ ] (Optional) Enter withdrawal reason
- [ ] Verify status changes to WITHDRAWN
- [ ] Verify withdrawal date is recorded

### 3.7 Delete Enrollment (Admin Only)
- [ ] As ADMIN, find delete option for enrollment
- [ ] Delete enrollment
- [ ] Verify enrollment removed from list

### 3.8 Empty State
- [ ] View program with no enrollments
- [ ] Verify "No enrollments yet" message displays
- [ ] Verify call-to-action to enroll clients

### 3.9 Last Activity Date
- [ ] Verify clients with recent calls/notes show activity date
- [ ] Verify clients without activity show "No activity"

---

## 4. Attendance Tracking

### 4.1 Generate Attendance Sheet
- [ ] Open a session
- [ ] Click "Generate Attendance Sheet"
- [ ] Configure sheet options:
  - [ ] Include time in/out
  - [ ] Include signature line
  - [ ] Include notes field
  - [ ] Add custom instructions
- [ ] Generate sheet
- [ ] Verify PDF downloads or link provided
- [ ] Verify sheet contains all enrolled clients
- [ ] Verify attendance codes are printed (if enabled)

### 4.2 Manual Attendance Entry
- [ ] Open a session
- [ ] Navigate to attendance section
- [ ] For each enrolled client:
  - [ ] Mark as Present/Absent/Excused
  - [ ] Enter hours attended
  - [ ] Add notes (optional)
- [ ] Save attendance
- [ ] Verify attendance records saved
- [ ] Verify enrollment hours updated

### 4.3 Bulk Attendance Recording
- [ ] Open session attendance
- [ ] Select multiple students
- [ ] Mark all as present
- [ ] Enter uniform hours
- [ ] Save
- [ ] Verify all records created

### 4.4 Photo-Based Attendance Upload
- [ ] Open session attendance
- [ ] Click "Upload Photo"
- [ ] Select photo file (JPEG, PNG, WebP, HEIC, HEIF)
- [ ] Verify file size limit (max 10MB)
- [ ] Upload photo
- [ ] Verify upload progress
- [ ] Verify photo stored and thumbnail displays

### 4.5 Process Attendance Photo
- [ ] After upload, click "Process"
- [ ] Verify processing indicator shows
- [ ] Wait for AI processing to complete
- [ ] Verify extracted records display:
  - [ ] Client matches
  - [ ] Time in/out (if detected)
  - [ ] Signatures (if detected)
  - [ ] Confidence scores

### 4.6 Review Extracted Attendance
- [ ] View extracted attendance records
- [ ] Verify each record shows:
  - [ ] Client name (matched or "Unknown")
  - [ ] Attendance type detected
  - [ ] Confidence score
  - [ ] Time in/out (if extracted)
- [ ] Correct any mismatched clients
- [ ] Approve accurate records
- [ ] Reject/fix inaccurate records
- [ ] Submit review
- [ ] Verify attendance finalized

### 4.7 Attendance Override Request
- [ ] As CASE_MANAGER, request override with reason
- [ ] Verify request submitted
- [ ] As ADMIN/PM, view override request
- [ ] Approve or reject override
- [ ] Verify final attendance reflects decision

### 4.8 View Attendance Summary
- [ ] View session attendance summary:
  - [ ] Total enrolled
  - [ ] Present count
  - [ ] Absent count
  - [ ] Attendance rate percentage
  - [ ] Total hours

### 4.9 Attendance Sheet Configuration
- [ ] Open program settings or attendance config
- [ ] Toggle "Include Time In/Out"
- [ ] Toggle "Include Signature Line"
- [ ] Toggle "Include Notes"
- [ ] Add custom instructions
- [ ] Save config
- [ ] Verify config persists
- [ ] Verify generated sheets reflect config

---

## 5. Materials Management

### 5.1 Upload Material
- [ ] Open program detail page
- [ ] Navigate to Materials tab
- [ ] Click "Upload Material"
- [ ] Select file
- [ ] Verify auto-detected material type
- [ ] (Optional) Assign to specific session
- [ ] Upload file
- [ ] Verify success message
- [ ] Verify material appears in list

### 5.2 Material Types
- [ ] Upload a syllabus file → verify type = SYLLABUS
- [ ] Upload a presentation → verify type = PRESENTATION
- [ ] Upload a worksheet → verify type = WORKSHEET
- [ ] Upload other document → verify type = OTHER or manual selection

### 5.3 View Materials List
- [ ] Verify materials table shows:
  - [ ] Filename
  - [ ] Material type icon/badge
  - [ ] Session assignment (if any)
  - [ ] Upload date
  - [ ] File size
  - [ ] Actions

### 5.4 Download Material
- [ ] Click on material to download
- [ ] Verify file downloads correctly
- [ ] Verify correct filename

### 5.5 Update Material
- [ ] Edit a material
- [ ] Change material type
- [ ] Assign/unassign to session
- [ ] Save changes
- [ ] Verify changes persist

### 5.6 Delete Material
- [ ] Click delete on a material
- [ ] Confirm deletion
- [ ] Verify material removed from list

### 5.7 AI Syllabus Extraction
- [ ] Upload a syllabus PDF
- [ ] Click "Extract Data" or similar
- [ ] Wait for AI processing
- [ ] Verify extracted data displays:
  - [ ] Program name suggestion
  - [ ] Session topics
  - [ ] Learning objectives
  - [ ] Hours estimates
- [ ] (Optional) Apply extracted data to program
- [ ] (Optional) Auto-create sessions from extraction
- [ ] Verify sessions created match extraction

### 5.8 Extraction Status Tracking
- [ ] Verify status shows: PENDING → PROCESSING → COMPLETED
- [ ] If extraction fails, verify FAILED status and error message

---

## 6. Hours & Progress Tracking

### 6.1 Automatic Hours Calculation
- [ ] Record attendance for a client (e.g., 2 hours)
- [ ] View enrollment
- [ ] Verify hoursCompleted = 2
- [ ] Record another session (e.g., 3 hours)
- [ ] Verify hoursCompleted = 5

### 6.2 Manual Hours Override
- [ ] Open enrollment details
- [ ] Set hours override (e.g., 10 hours)
- [ ] Save
- [ ] Verify effectiveHours = 10 (override)
- [ ] Verify progress bar uses override value

### 6.3 Progress Bar Display
- [ ] For program with requiredHours = 20
- [ ] Client with 10 effective hours
- [ ] Verify progress bar shows 50%
- [ ] Client with 20+ hours
- [ ] Verify progress bar shows 100% (capped)

### 6.4 Hours Summary
- [ ] View enrollment detail
- [ ] Verify hours summary shows:
  - [ ] Hours completed (from attendance)
  - [ ] Hours override (if set)
  - [ ] Effective hours
  - [ ] Required hours (from program)
  - [ ] Remaining hours

---

## 7. Statistics & Reporting

### 7.1 Program Statistics Card
- [ ] View program detail page
- [ ] Verify stats card displays:
  - [ ] Total sessions
  - [ ] Total enrolled
  - [ ] Average attendance rate
  - [ ] Total hours tracked

### 7.2 Attendance Statistics
- [ ] View attendance by session breakdown
- [ ] Verify each session shows:
  - [ ] Date
  - [ ] Attendance count
  - [ ] Attendance rate

### 7.3 Enrollment Statistics
- [ ] View enrollment breakdown by status:
  - [ ] Enrolled count
  - [ ] In Progress count
  - [ ] Completed count
  - [ ] Withdrawn count

---

## 8. Permissions & Access Control

### 8.1 SUPER_ADMIN / ADMIN

| Action | Expected |
|--------|----------|
| Create programs | ✅ Allowed |
| Update programs | ✅ Allowed |
| Delete programs | ✅ Allowed |
| Manage sessions | ✅ Allowed |
| Enroll clients | ✅ Allowed |
| Record attendance | ✅ Allowed |
| Upload materials | ✅ Allowed |
| Review attendance | ✅ Allowed |
| Approve overrides | ✅ Allowed |

### 8.2 PROGRAM_MANAGER

| Action | Expected |
|--------|----------|
| Create programs | ✅ Allowed |
| Update programs | ✅ Allowed |
| Delete programs | ❌ Denied |
| Manage sessions | ✅ Allowed |
| Enroll clients | ✅ Allowed |
| Record attendance | ✅ Allowed |
| Upload materials | ✅ Allowed |
| Review attendance | ✅ Allowed |

### 8.3 CASE_MANAGER

| Action | Expected |
|--------|----------|
| Create programs | ❌ Denied |
| Update programs | ❌ Denied |
| Delete programs | ❌ Denied |
| Manage sessions | ❌ Denied |
| Enroll clients | ✅ Allowed |
| Record attendance | ✅ Allowed |
| Upload materials | ❌ Denied |
| Review attendance | ❌ Denied (can request override) |

### 8.4 VIEWER

| Action | Expected |
|--------|----------|
| Create programs | ❌ Denied |
| Update programs | ❌ Denied |
| Delete programs | ❌ Denied |
| Manage sessions | ❌ Denied |
| Enroll clients | ❌ Denied |
| Record attendance | ❌ Denied |
| Upload materials | ❌ Denied |
| View all program data | ✅ Allowed |

---

## 9. Edge Cases & Error Handling

### 9.1 Validation Errors
- [ ] Submit empty program name → error displayed
- [ ] Enter negative hours → error displayed
- [ ] Duplicate session number → error displayed
- [ ] Enroll already enrolled client → 409 Conflict handled

### 9.2 Network Errors
- [ ] Simulate network failure during save
- [ ] Verify error toast displays
- [ ] Verify data not corrupted
- [ ] Verify retry works

### 9.3 Concurrent Editing
- [ ] Two users edit same program
- [ ] Verify last save wins or conflict resolution

### 9.4 Large Data Sets
- [ ] Program with 100+ enrollments
- [ ] Verify pagination works
- [ ] Verify search performance acceptable
- [ ] Program with 50+ sessions
- [ ] Verify list loads correctly

### 9.5 File Upload Errors
- [ ] Upload file > 10MB → error displayed
- [ ] Upload unsupported file type → error displayed
- [ ] Upload interrupted → graceful failure

---

## Sign-off

| Module | Tester | Date | Environment | Pass/Fail | Notes |
|--------|--------|------|-------------|-----------|-------|
| Program CRUD | | | | | |
| Sessions | | | | | |
| Enrollments | | | | | |
| Attendance | | | | | |
| Materials | | | | | |
| Hours Tracking | | | | | |
| Statistics | | | | | |
| Permissions | | | | | |

---

## Test Environment

| Field | Value |
|-------|-------|
| Browser | |
| OS | |
| App Version/Commit | |
| Test Date | |
| Tester Name | |
