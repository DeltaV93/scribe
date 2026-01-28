# Scrybe User Flows

A complete breakdown of the application organized by user type and their journeys through the system.

---

## User Types Overview

| Role | Description | Primary Activities |
|------|-------------|-------------------|
| **Super Admin** | Platform-level administrator | System configuration, org management |
| **Admin** | Organization administrator | User management, settings, billing, phone numbers |
| **Program Manager** | Manages programs and staff | Programs, enrollments, reports, form creation |
| **Case Manager** | Direct client interaction | Calls, forms, clients, attendance, messaging |
| **Viewer** | Read-only access | View clients, submissions, reports |
| **Client (Portal)** | External client access | Messages, programs, attendance, settings |

---

## Super Admin / Admin Flows

### Flow A1: Initial Organization Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORGANIZATION SETUP                                   │
└─────────────────────────────────────────────────────────────────────────────┘

1. CREATE ACCOUNT
   └→ Sign up with email/password
   └→ Verify email address
   └→ Organization automatically created

2. CONFIGURE ORGANIZATION SETTINGS
   ├→ Navigate to Admin → Settings
   ├→ Set preferred area code for phone numbers
   ├→ Configure recording retention period (days)
   ├→ Select consent mode:
   │   ├─ AUTO_RECORDING (automated consent message)
   │   ├─ CASE_MANAGER_SCRIPT (manual consent)
   │   └─ DISABLED (no recording)
   └→ Configure webhook URLs (optional)

3. SET UP BILLING
   ├→ Navigate to Admin → Billing
   ├→ Select subscription tier:
   │   ├─ FREE (limited features)
   │   ├─ STARTER (small teams)
   │   ├─ PROFESSIONAL (full features)
   │   └─ ENTERPRISE (custom)
   ├→ Choose billing cycle (monthly/yearly)
   ├→ Complete Stripe checkout
   └→ (Optional) Purchase form packs for additional capacity

4. CREATE TEAMS
   ├→ Navigate to Admin → Teams
   ├→ Create team (name, description)
   └→ Define team permissions
```

### Flow A2: User Onboarding

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER ONBOARDING                                   │
└─────────────────────────────────────────────────────────────────────────────┘

1. INVITE USER
   ├→ Navigate to Admin → Users
   ├→ Click "Invite User"
   ├→ Enter user email
   ├→ Select role:
   │   ├─ ADMIN
   │   ├─ PROGRAM_MANAGER
   │   ├─ CASE_MANAGER
   │   └─ VIEWER
   ├→ Assign to team (optional)
   ├→ Set caseload limit (optional)
   └→ Send invitation

2. BULK INVITE (alternative)
   ├→ Click "Bulk Invite"
   ├→ Upload CSV with emails and roles
   └→ Send all invitations

3. USER RECEIVES INVITATION
   ├→ Email with secure invitation link
   ├→ Link expires in 7 days
   └→ Reminder emails sent if not accepted

4. USER ACCEPTS INVITATION
   ├→ Click invitation link
   ├→ System validates token
   ├→ User creates password
   ├→ Account activated
   └→ Redirected to dashboard

5. POST-ONBOARDING SETUP
   ├→ Admin assigns user to additional teams
   ├→ Admin sets specific form permissions
   └→ (If case manager) Admin assigns phone number
```

### Flow A3: Phone Number Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PHONE NUMBER MANAGEMENT                                │
└─────────────────────────────────────────────────────────────────────────────┘

1. PURCHASE PHONE NUMBERS
   ├→ Navigate to Admin → Phone Numbers
   ├→ Click "Purchase Number"
   ├→ Select area code (uses org default or specify)
   ├→ View available numbers from Twilio
   ├→ Select number to purchase
   ├→ Confirm purchase
   └→ Number added to pool

2. CASE MANAGER REQUESTS NUMBER
   ├→ Case manager clicks "Request Phone Number"
   ├→ Optionally specifies preferred area code
   ├→ Request submitted
   └→ Admin notified

3. ADMIN PROCESSES REQUEST
   ├→ View pending requests
   ├→ Review requester details
   ├→ Approve or reject request
   │   ├─ If approved: Assign number from pool
   │   └─ If rejected: Provide reason
   └→ Case manager notified

4. DIRECT ASSIGNMENT (alternative)
   ├→ Admin selects unassigned number
   ├→ Clicks "Assign"
   ├→ Selects case manager
   └→ Number assigned immediately

5. MONITOR USAGE
   ├→ View phone cost statistics
   ├→ Track usage per number
   └→ Release unused numbers
```

### Flow A4: User Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER MANAGEMENT                                     │
└─────────────────────────────────────────────────────────────────────────────┘

1. VIEW USERS
   ├→ Navigate to Admin → Users
   ├→ Filter by role, status, team
   └→ Search by name or email

2. EDIT USER
   ├→ Select user
   ├→ Click "Edit"
   ├→ Modify:
   │   ├─ Role
   │   ├─ Team assignments
   │   ├─ Caseload limit
   │   └─ Form permissions
   └→ Save changes

3. DEACTIVATE USER
   ├→ Select user
   ├→ Click "Deactivate"
   ├→ Confirm action
   ├→ User can no longer log in
   └→ User's data preserved

4. TRANSFER USER DATA
   ├→ Select user to transfer FROM
   ├→ Click "Transfer Data"
   ├→ Select target user
   ├→ Choose what to transfer:
   │   ├─ Clients
   │   ├─ Active cases
   │   └─ Pending submissions
   └→ Execute transfer

5. REACTIVATE USER
   ├→ Filter to show deactivated users
   ├→ Select user
   ├→ Click "Reactivate"
   └→ User can log in again

6. RESEND INVITATION
   ├→ View pending invitations
   ├→ Select invitation
   └→ Click "Resend"
```

### Flow A5: Attendance Override Approval

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ATTENDANCE OVERRIDE APPROVAL                            │
└─────────────────────────────────────────────────────────────────────────────┘

1. VIEW PENDING OVERRIDES
   ├→ Navigate to Admin → Attendance Overrides
   └→ See list of pending override requests

2. REVIEW OVERRIDE REQUEST
   ├→ Select request
   ├→ View:
   │   ├─ Original attendance record
   │   ├─ Requested changes
   │   ├─ Reason provided
   │   ├─ Supporting documentation
   │   └─ Requester information
   └→ Review context

3. PROCESS REQUEST
   ├→ Approve with optional notes
   │   └→ Attendance record updated
   └→ OR Reject with required reason
       └→ Requester notified

4. VIEW OVERRIDE HISTORY
   ├→ Filter by status (approved/rejected)
   ├→ Filter by date range
   └→ Export for audit purposes
```

---

## Program Manager Flows

### Flow PM1: Create and Configure Program

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROGRAM CREATION                                     │
└─────────────────────────────────────────────────────────────────────────────┘

1. CREATE PROGRAM
   ├→ Navigate to Programs
   ├→ Click "New Program"
   ├→ Enter basic info:
   │   ├─ Name
   │   ├─ Description
   │   ├─ Label type (PROGRAM, COURSE, CLASS, WORKSHOP, TRAINING, GROUP)
   │   ├─ Start date
   │   ├─ End date
   │   └─ Required hours for completion
   └→ Save as draft

2. CONFIGURE SCHEDULE
   ├→ Set schedule pattern:
   │   ├─ Days of week
   │   ├─ Start time
   │   ├─ End time
   │   └─ Frequency
   └→ Set location

3. ADD SESSIONS
   ├→ Click "Add Session"
   ├→ Enter session details:
   │   ├─ Session number
   │   ├─ Title/topic
   │   ├─ Date
   │   ├─ Duration
   │   └─ Notes
   ├→ Repeat for all sessions
   └→ OR use "Auto-generate from schedule"

4. UPLOAD SYLLABUS (alternative)
   ├→ Upload PDF syllabus
   ├→ AI extracts sessions automatically:
   │   ├─ Detects dates
   │   ├─ Extracts topics
   │   └─ Creates session structure
   ├→ Review extracted sessions
   └→ Approve or modify

5. CONFIGURE ATTENDANCE SHEETS
   ├→ Navigate to Program → Attendance Config
   ├→ Configure sheet columns:
   │   ├─ Time in
   │   ├─ Time out
   │   ├─ Signature
   │   └─ Notes
   ├→ Enable/disable QR codes
   └→ Save configuration

6. UPLOAD MATERIALS
   ├→ Navigate to Program → Materials
   ├→ Upload files:
   │   ├─ SYLLABUS
   │   ├─ HANDOUT
   │   ├─ PRESENTATION
   │   ├─ WORKSHEET
   │   ├─ ASSESSMENT
   │   └─ CERTIFICATE_TEMPLATE
   ├→ Assign to specific session (optional)
   └→ Materials available to enrollees

7. ACTIVATE PROGRAM
   ├→ Review all settings
   ├→ Click "Activate"
   └→ Program status → ACTIVE
```

### Flow PM2: Manage Enrollments

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENROLLMENT MANAGEMENT                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. ENROLL CLIENTS
   ├→ Navigate to Program → Enrollments
   ├→ Click "Enroll Clients"
   ├→ Search for clients:
   │   ├─ By name
   │   ├─ By phone
   │   └─ By email
   ├→ Select multiple clients (inline multi-select)
   ├→ Set enrollment date
   └→ Confirm enrollment

2. QUICK ENROLL FROM ATTENDANCE
   ├→ During attendance review
   ├→ Identify unrecognized attendee
   ├→ Click "Quick Enroll"
   ├→ Search/create client
   └→ Enroll and record attendance simultaneously

3. TRACK ENROLLMENT STATUS
   ├→ View enrollment list
   ├→ Status indicators:
   │   ├─ ENROLLED (not started)
   │   ├─ IN_PROGRESS (attending)
   │   ├─ COMPLETED (met requirements)
   │   ├─ WITHDRAWN (left program)
   │   ├─ FAILED (did not complete)
   │   └─ ON_HOLD (temporarily paused)
   └→ Filter by status

4. UPDATE ENROLLMENT
   ├→ Select enrollment
   ├→ Update status
   ├→ Override hours (if needed)
   ├→ Add completion/withdrawal reason
   └→ Save changes

5. VIEW ENROLLMENT ANALYTICS
   ├→ Navigate to Program → Stats
   ├→ View metrics:
   │   ├─ Total enrolled
   │   ├─ Currently active
   │   ├─ Completion rate
   │   ├─ Average attendance rate
   │   └─ Total hours delivered
   └→ Export reports
```

### Flow PM3: Form Creation and Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FORM CREATION                                      │
└─────────────────────────────────────────────────────────────────────────────┘

1. START NEW FORM
   ├→ Navigate to Forms
   ├→ Click "New Form"
   └→ Choose creation method:
       ├─ From scratch
       ├─ From template
       └─ AI-generated

2. AI-GENERATED FORM (option)
   ├→ Describe form requirements in natural language
   ├→ AI generates complete form structure
   ├→ Review generated form:
   │   ├─ Field types auto-detected
   │   ├─ Validation rules suggested
   │   └─ Sections organized
   ├→ Accept, modify, or regenerate
   └→ Continue to wizard

3. FORM BUILDER WIZARD

   STEP 1: SETUP
   ├→ Enter form name
   ├→ Enter description
   ├→ Select category
   └→ Next

   STEP 2: FIELDS
   ├→ Add fields from palette:
   │   ├─ TEXT_SHORT
   │   ├─ TEXT_LONG
   │   ├─ NUMBER
   │   ├─ DATE
   │   ├─ PHONE
   │   ├─ EMAIL
   │   ├─ ADDRESS
   │   ├─ DROPDOWN
   │   ├─ CHECKBOX
   │   ├─ YES_NO
   │   ├─ FILE
   │   └─ SIGNATURE
   ├→ Configure each field:
   │   ├─ Label
   │   ├─ Help text
   │   ├─ Required/optional
   │   ├─ Validation rules
   │   ├─ Default value
   │   ├─ Options (for dropdown/checkbox)
   │   ├─ Sensitive data flag
   │   ├─ AI extractable toggle
   │   └─ Purpose (grant, compliance, outcomes)
   └→ Next

   STEP 3: ORGANIZE
   ├→ Create sections
   ├→ Drag-and-drop to reorder fields
   ├→ Assign fields to sections
   └→ Next

   STEP 4: LOGIC
   ├→ Open visual logic editor (React Flow)
   ├→ Create conditions:
   │   ├─ Field A = value → Show Field B
   │   ├─ Field C contains text → Hide Field D
   │   └─ Complex condition chains
   ├→ Test logic in preview
   └→ Next

   STEP 5: PREVIEW
   ├→ Test form as it will appear
   ├→ Verify conditional logic
   ├→ Check validation rules
   └→ Next

   STEP 6: AI CONFIG
   ├→ Review AI extractability per field
   ├→ Add extraction examples (few-shot learning)
   ├→ Test extraction with sample transcript
   └→ Next

   STEP 7: PUBLISH
   ├→ Review summary
   ├→ Set access permissions:
   │   ├─ Specific users
   │   └─ Teams
   ├→ Publish form
   └→ Form status → PUBLISHED

4. MANAGE EXISTING FORMS
   ├→ View all forms
   ├→ Filter by status (DRAFT, PUBLISHED, ARCHIVED)
   ├→ Edit form (creates new version)
   ├→ Duplicate form
   ├→ Archive form
   ├→ Export as JSON
   └→ Import from JSON

5. FORM VERSIONING
   ├→ View version history
   ├→ Compare versions
   ├→ Rollback to previous version
   └→ Track which submissions use which version

6. SAVE AS TEMPLATE
   ├→ Select published form
   ├→ Click "Save as Template"
   ├→ Enter template name and description
   ├→ Choose visibility:
   │   ├─ Organization only
   │   └─ System-wide (admin only)
   └→ Template available for reuse
```

---

## Case Manager Flows

### Flow CM1: Client Intake via Phone Call

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CLIENT INTAKE VIA CALL                                  │
└─────────────────────────────────────────────────────────────────────────────┘

1. PREPARE FOR CALL
   ├→ Navigate to Calls
   ├→ Click "New Call"
   ├→ Search for existing client
   │   ├─ Found → Select client
   │   └─ Not found → Create new client
   │       ├─ Enter name
   │       ├─ Enter phone number
   │       ├─ System checks for duplicates
   │       └─ Save client
   └→ Select intake form for call

2. INITIATE CALL
   ├→ Click "Start Call"
   ├→ Browser requests microphone permission
   ├→ Twilio initiates outbound call
   ├→ Call status: INITIATING → RINGING
   ├→ Client answers
   └→ Call status: IN_PROGRESS

3. CONSENT HANDLING
   (Based on org consent mode)
   ├─ AUTO_RECORDING:
   │   └→ Automated message plays consent script
   ├─ CASE_MANAGER_SCRIPT:
   │   ├→ Conversation guide shows consent script
   │   └→ Case manager reads script verbally
   └─ DISABLED:
       └→ No recording occurs

4. DURING CALL
   ├→ Conversation guide displays:
   │   ├─ Form fields as prompts
   │   ├─ Required fields highlighted
   │   └─ Help text for complex fields
   ├→ Call timer shows duration
   ├→ Real-time notes panel:
   │   ├─ Take freeform notes
   │   ├─ Tag important moments
   │   └─ Notes auto-save
   └→ Call controls available:
       ├─ Mute
       └─ End call

5. END CALL
   ├→ Click "End Call" or client hangs up
   ├→ Call status: COMPLETED
   ├→ Recording uploaded to S3
   └→ Call enters processing queue

6. BACKGROUND PROCESSING
   ├→ Recording sent to Deepgram
   ├→ Transcript generated
   ├→ Transcript sent to Claude AI
   ├→ AI extracts form field values:
   │   ├─ Per-field confidence scores
   │   ├─ Source snippets from transcript
   │   └─ Reasoning for each extraction
   └→ Form submission created (DRAFT)

7. REVIEW EXTRACTION
   ├→ Navigate to call → Review
   ├→ View AI extractions:
   │   ├─ High confidence: Green ✓
   │   ├─ Medium confidence: Yellow ⚠
   │   └─ Low confidence: Red ✗ (flagged)
   ├→ Listen to recording
   ├→ Read transcript
   ├→ For each flagged field:
   │   ├─ View AI reasoning
   │   ├─ View source snippet
   │   └─ Correct value if needed
   ├→ Manual corrections tracked
   └→ Click "Approve"

8. SUBMIT FORM
   ├→ Review complete form
   ├→ Add digital signature (if required)
   ├→ Submit form
   ├→ Status: SUBMITTED
   └→ (Optional) Routes to supervisor for review
```

### Flow CM2: Manual Form Submission

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MANUAL FORM SUBMISSION                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. SELECT CLIENT
   ├→ Navigate to Clients
   ├→ Search for client
   └→ Click on client profile

2. START NEW SUBMISSION
   ├→ Click "New Form Submission"
   ├→ Select form from available forms
   └→ Form opens in edit mode

3. FILL OUT FORM
   ├→ Complete required fields (marked with *)
   ├→ Conditional fields show/hide based on logic
   ├→ Sensitive fields encrypted on save
   ├→ File uploads:
   │   ├─ Drag-and-drop
   │   ├─ Virus scanning
   │   └─ Progress indicator
   └→ Auto-save as draft

4. RESOURCE LOCKING
   ├→ Form automatically locked for editing
   ├→ Lock duration: 5 minutes
   ├→ Heartbeat refreshes lock
   ├→ Other users see "locked" banner
   └→ Lock released on navigation away

5. SAVE OR SUBMIT
   ├─ Save as Draft:
   │   ├→ All data preserved
   │   └→ Can return later
   └─ Submit:
       ├→ Validation runs
       ├→ All required fields checked
       ├→ Status: SUBMITTED
       └→ Routes to supervisor (if configured)

6. SUPERVISOR REVIEW (optional)
   ├→ Supervisor notified
   ├→ Supervisor reviews submission
   ├→ Approve → Status: APPROVED
   └→ Reject → Status: REJECTED (with reason)
```

### Flow CM3: Client Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT MANAGEMENT                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. CREATE NEW CLIENT
   ├→ Navigate to Clients → New
   ├→ Enter information:
   │   ├─ First name, Last name
   │   ├─ Primary phone (required)
   │   ├─ Additional phones (optional, with labels)
   │   ├─ Email
   │   ├─ Address (structured)
   │   └─ Internal ID (for external system sync)
   ├→ System checks for duplicates
   ├→ Save client
   └→ Status: ACTIVE

2. VIEW CLIENT PROFILE
   ├→ Search/select client
   ├→ Profile displays:
   │   ├─ Contact information
   │   ├─ Status badge
   │   ├─ Assigned case manager
   │   ├─ Quick actions
   │   └─ Tabbed content:
   │       ├─ Activity feed
   │       ├─ Form submissions
   │       ├─ Calls
   │       ├─ Notes
   │       ├─ Programs
   │       └─ Attendance

3. ACTIVITY FEED
   ├→ Timeline of all interactions:
   │   ├─ Calls (with duration, status)
   │   ├─ Form submissions
   │   ├─ Notes added
   │   ├─ Program enrollments
   │   ├─ Attendance records
   │   └─ Messages sent/received
   └→ Filter by type, date range

4. ADD CLIENT NOTE
   ├→ Click "Add Note"
   ├→ Enter note content (rich text)
   ├→ Add tags (optional)
   ├→ Mark as:
   │   ├─ Internal (staff only)
   │   └─ Shareable (visible in portal)
   ├→ Link to call (optional)
   ├→ Save as draft or publish
   └→ Note appears in activity feed

5. UPDATE CLIENT STATUS
   ├→ Edit client
   ├→ Change status:
   │   ├─ ACTIVE
   │   ├─ ON_HOLD
   │   ├─ CLOSED
   │   └─ PENDING
   └→ Status change logged in audit trail

6. ARCHIVE/RESTORE CLIENT
   ├→ Archive: Soft delete (data preserved)
   └→ Restore: Reactivate archived client
```

### Flow CM4: Program Attendance Tracking

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ATTENDANCE TRACKING                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. GENERATE ATTENDANCE SHEET
   ├→ Navigate to Program → Session
   ├→ Click "Generate Attendance Sheet"
   ├→ Sheet generated with:
   │   ├─ Program name, session info
   │   ├─ Enrolled clients listed
   │   ├─ QR code per enrollment
   │   ├─ Attendance code (e.g., BK2847)
   │   └─ Configured columns (time in/out, signature, notes)
   ├→ Download PDF
   └→ Print for in-person session

2. BATCH SHEET GENERATION
   ├→ Navigate to Program → Attendance
   ├→ Click "Generate Batch"
   ├→ Select multiple sessions
   ├→ Generate all sheets
   └→ Download as ZIP

3. COLLECT ATTENDANCE (in person)
   ├→ Distribute sheets to attendees
   ├→ Attendees:
   │   ├─ Find their name/code
   │   ├─ Write time in
   │   ├─ Write time out
   │   ├─ Sign
   │   └─ Add notes (optional)
   └→ Collect completed sheets

4. UPLOAD ATTENDANCE PHOTO
   ├→ Navigate to Session → Attendance
   ├→ Click "Upload Photo"
   ├→ Take photo or select from device
   ├→ Image enhanced automatically
   ├→ Uploaded to S3
   └→ Enters AI processing queue

5. AI PROCESSING
   ├→ Claude Vision analyzes photo:
   │   ├─ Detects QR codes
   │   ├─ Reads printed attendance codes
   │   ├─ Recognizes handwritten times
   │   ├─ Detects signatures
   │   └─ Extracts notes
   ├→ Each row extracted with:
   │   ├─ Enrollment identification
   │   ├─ Time in/out
   │   ├─ Attendance status (PRESENT, EXCUSED, ABSENT)
   │   └─ Confidence scores
   └→ Records created (pending review)

6. REVIEW ATTENDANCE
   ├→ Navigate to Session → Review Attendance
   ├→ View extracted records:
   │   ├─ High confidence: Auto-approved
   │   ├─ Low confidence: Flagged for review
   │   └─ Unmatched: Requires manual matching
   ├→ For flagged records:
   │   ├─ View original photo region
   │   ├─ Correct values if needed
   │   └─ Approve or reject
   └→ Bulk approve remaining

7. HANDLE UNRECOGNIZED ATTENDEES
   ├→ AI couldn't match to enrollment
   ├→ Options:
   │   ├─ Match to existing enrollment manually
   │   ├─ Quick enroll new client
   │   └─ Mark as visitor (no credit)
   └→ Record saved

8. SUBMIT OVERRIDE REQUEST
   ├→ For special circumstances:
   │   ├─ Client forgot to sign
   │   ├─ Incorrect time recorded
   │   └─ Technical issues
   ├→ Click "Request Override"
   ├→ Select record to override
   ├→ Enter new values
   ├→ Provide reason
   ├→ Attach documentation (optional)
   └→ Submit for admin approval

9. MANUAL ATTENDANCE ENTRY
   ├→ Alternative to photo upload
   ├→ Navigate to Session → Attendance
   ├→ Click "Manual Entry"
   ├→ For each attendee:
   │   ├─ Select client
   │   ├─ Enter time in/out
   │   ├─ Set status
   │   └─ Add notes
   └→ Save attendance records
```

### Flow CM5: Client Communication (Messaging)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT COMMUNICATION                                  │
└─────────────────────────────────────────────────────────────────────────────┘

1. SEND MESSAGE TO CLIENT
   ├→ Navigate to Client → Messages
   ├→ Click "New Message"
   ├→ Compose message:
   │   ├─ Subject (optional)
   │   ├─ Body text
   │   └─ Attachments (optional):
   │       ├─ Max 10MB per file
   │       ├─ PDF, images supported
   │       └─ Encrypted at rest
   ├→ Preview message
   └→ Send

2. MESSAGE DELIVERY
   ├→ Message saved with SHA-256 hash
   ├→ Status: SENT
   ├→ SMS notification sent to client:
   │   ├─ Uses configured SMS template
   │   ├─ Includes magic portal link
   │   └─ Tracks delivery status
   └→ SMS status: QUEUED → SENT → DELIVERED

3. TRACK MESSAGE STATUS
   ├→ View message list
   ├→ Status indicators:
   │   ├─ SENT (message sent)
   │   ├─ DELIVERED (SMS delivered)
   │   ├─ READ (client opened in portal)
   │   └─ FAILED (delivery failed)
   └→ Click for details

4. RECEIVE CLIENT REPLY
   ├→ Client replies via portal
   ├→ Case manager notified:
   │   ├─ In-app notification
   │   └─ Email notification
   ├→ Reply appears in message thread
   └→ Case manager can continue conversation

5. VIEW MESSAGE HISTORY
   ├→ Full conversation thread
   ├→ Timestamps for each message
   ├→ Read receipts
   └→ Attachment downloads
```

---

## Client Portal Flows

### Flow CP1: Access Portal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PORTAL ACCESS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

1. RECEIVE PORTAL LINK
   ├→ Case manager sends message
   ├→ Client receives SMS:
   │   "You have a new message from [Org Name].
   │    View it here: [magic link]"
   └→ Link contains secure token (24hr expiry)

2. ACCESS PORTAL
   ├→ Click magic link
   ├→ Token validated
   ├→ If expired:
   │   └→ Redirect to "Link Expired" page
   │       └→ Instructions to contact case manager
   └→ If valid:
       └→ Continue to portal

3. PIN VERIFICATION (if enabled)
   ├→ First visit:
   │   ├→ Prompted to create 4-6 digit PIN
   │   ├→ Confirm PIN
   │   └→ PIN saved (hashed)
   └→ Return visits:
       ├→ Enter PIN
       ├→ Failed attempts tracked
       └→ Lockout after 5 failures

4. PORTAL DASHBOARD
   ├→ Welcome message
   ├→ Quick stats:
   │   ├─ Unread messages
   │   ├─ Enrolled programs
   │   └─ Upcoming sessions
   └→ Bottom navigation:
       ├─ Home
       ├─ Messages
       ├─ Programs
       └─ Settings
```

### Flow CP2: View and Reply to Messages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PORTAL MESSAGING                                     │
└─────────────────────────────────────────────────────────────────────────────┘

1. VIEW MESSAGES
   ├→ Navigate to Messages tab
   ├→ See message list:
   │   ├─ Unread highlighted
   │   ├─ Sender name
   │   ├─ Preview text
   │   └─ Timestamp
   └→ Click to open message

2. READ MESSAGE
   ├→ Full message displayed
   ├→ Attachments downloadable
   ├→ Message marked as READ
   └→ Read status synced to case manager

3. REPLY TO MESSAGE
   ├→ Click "Reply"
   ├→ Type response
   ├→ Send
   ├→ Reply appears in thread
   └→ Case manager notified

4. DIRECT MESSAGE ACCESS
   ├→ If link was message-specific (/portal/m/[token])
   ├→ Opens directly to that message
   └→ Full portal access from there
```

### Flow CP3: View Programs and Attendance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PORTAL PROGRAMS VIEW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. VIEW ENROLLED PROGRAMS
   ├→ Navigate to Programs tab
   ├→ List of enrolled programs:
   │   ├─ Program name
   │   ├─ Enrollment status
   │   ├─ Progress indicator
   │   └─ Hours completed / required
   └→ Click for details

2. PROGRAM DETAILS
   ├→ Program description
   ├→ Schedule information
   ├→ Facilitator name
   ├→ Location
   └→ Session list

3. VIEW ATTENDANCE HISTORY
   ├→ Navigate to Attendance tab (within program)
   ├→ See all sessions:
   │   ├─ Date
   │   ├─ Attendance status (PRESENT, EXCUSED, ABSENT)
   │   ├─ Hours credited
   │   └─ Time in/out
   └→ Total hours summary

4. DOWNLOAD MATERIALS
   ├→ View available program materials
   ├→ Click to download:
   │   ├─ Syllabus
   │   ├─ Handouts
   │   └─ Worksheets
   └→ Secure download via presigned URL
```

### Flow CP4: Update Settings

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PORTAL SETTINGS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

1. ACCESS SETTINGS
   ├→ Navigate to Settings tab
   └→ View current settings

2. UPDATE PHONE NUMBER
   ├→ Click "Change Phone Number"
   ├→ Enter new phone number
   ├→ Request verification
   ├→ SMS code sent to new number
   ├→ Enter verification code
   ├→ If correct:
   │   └→ Phone number updated
   └→ If incorrect:
       └→ Retry (max 3 attempts)

3. SMS NOTIFICATION PREFERENCES
   ├→ View current preference
   ├→ Toggle options:
   │   ├─ Receive SMS for new messages
   │   ├─ Receive appointment reminders
   │   └─ Receive program updates
   └→ Save preferences

4. CHANGE PIN
   ├→ Click "Change PIN"
   ├→ Enter current PIN
   ├→ Enter new PIN
   ├→ Confirm new PIN
   └→ PIN updated

5. VIEW HELP/FAQ
   ├→ Navigate to Help
   ├→ Common questions answered
   └→ Contact information for case manager
```

---

## Viewer Flows

### Flow V1: View-Only Access

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VIEWER ACCESS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

1. DASHBOARD ACCESS
   ├→ Login with credentials
   ├→ View-only dashboard
   └→ No edit capabilities

2. VIEW CLIENTS
   ├→ Navigate to Clients
   ├→ Search and filter
   ├→ View client profiles:
   │   ├─ Contact information
   │   ├─ Activity feed (read-only)
   │   ├─ Form submissions (read-only)
   │   └─ Notes (read-only)
   └→ Cannot edit or create

3. VIEW FORMS
   ├→ Navigate to Forms
   ├→ View published forms
   ├→ View submissions
   └→ Cannot create or edit

4. VIEW PROGRAMS
   ├→ Navigate to Programs
   ├→ View program details
   ├→ View enrollments
   ├→ View attendance records
   └→ Cannot modify

5. VIEW REPORTS
   ├→ Access available reports
   ├→ Filter by date range
   ├→ Export data (if permitted)
   └→ Cannot generate compliance reports

6. AUDIT LOG ACCESS
   ├→ View audit log (if permitted)
   ├→ Search and filter entries
   └→ Cannot modify or delete entries
```

---

## Cross-Cutting Flows

### Flow X1: Authentication

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION                                       │
└─────────────────────────────────────────────────────────────────────────────┘

1. SIGN UP (new organization)
   ├→ Navigate to /signup
   ├→ Enter email, password
   ├→ Submit
   ├→ Verification email sent
   ├→ Click verification link
   ├→ Email verified
   ├→ Organization created
   └→ Redirect to dashboard

2. LOGIN
   ├→ Navigate to /login
   ├→ Enter email, password
   ├→ Supabase validates credentials
   ├→ JWT token issued
   ├→ Session created
   └→ Redirect to dashboard

3. FORGOT PASSWORD
   ├→ Click "Forgot Password"
   ├→ Enter email
   ├→ Reset email sent
   ├→ Click reset link
   ├→ Enter new password
   ├→ Password updated
   └→ Redirect to login

4. SESSION MANAGEMENT
   ├→ JWT stored in secure cookie
   ├→ Middleware validates on each request
   ├→ Session refreshed automatically
   └→ Logout clears session
```

### Flow X2: Audit Trail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUDIT TRAIL                                        │
└─────────────────────────────────────────────────────────────────────────────┘

ALL USER ACTIONS LOGGED:

├→ CREATE actions:
│   ├─ Client created
│   ├─ Form created
│   ├─ Submission created
│   ├─ Note added
│   └─ Program created

├→ UPDATE actions:
│   ├─ Client updated
│   ├─ Form published
│   ├─ Submission edited
│   └─ Status changed

├→ DELETE actions:
│   ├─ Client archived
│   ├─ Note deleted
│   └─ Form archived

├→ VIEW actions:
│   ├─ Client profile viewed
│   ├─ Submission viewed
│   └─ Report accessed

├→ EXPORT actions:
│   ├─ Report exported
│   └─ Data exported

AUDIT ENTRY CONTAINS:
├─ Timestamp
├─ User ID and name
├─ Action type
├─ Resource type and ID
├─ IP address
├─ User agent
├─ Changes (before/after)
└─ Hash (for chain integrity)

HASH CHAIN:
├→ Each entry hashed with previous entry
├→ Immutable record
└→ Tampering detectable via verification API
```

### Flow X3: File Upload

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FILE UPLOAD                                        │
└─────────────────────────────────────────────────────────────────────────────┘

1. SELECT FILE
   ├→ Click upload area or drag-and-drop
   ├→ File selected
   └→ Validation:
       ├─ Size check (tier-based limit)
       └─ MIME type check

2. UPLOAD PROCESS
   ├→ Request presigned URL from API
   ├→ Upload directly to S3
   ├→ Progress indicator shown
   └→ Upload complete

3. VIRUS SCANNING
   ├→ Scan triggered automatically
   ├→ Status: PENDING → SCANNING
   ├→ ClamAV analyzes file
   ├→ Result:
   │   ├─ CLEAN → File available
   │   ├─ INFECTED → File quarantined
   │   └─ ERROR → Manual review needed
   └→ User notified of result

4. FILE ACCESS
   ├→ Presigned download URL generated
   ├→ URL expires after set time
   └→ File downloaded securely
```

---

## Summary: Features by User Type

| Feature | Super Admin | Admin | Program Mgr | Case Mgr | Viewer | Client Portal |
|---------|:-----------:|:-----:|:-----------:|:--------:|:------:|:-------------:|
| Org Settings | ✓ | ✓ | | | | |
| Billing | ✓ | ✓ | | | | |
| User Management | ✓ | ✓ | | | | |
| Team Management | ✓ | ✓ | | | | |
| Phone Numbers | ✓ | ✓ | | Request | | |
| Override Approval | ✓ | ✓ | | | | |
| Create Programs | | ✓ | ✓ | | | |
| Manage Enrollments | | ✓ | ✓ | ✓ | | |
| Create Forms | | ✓ | ✓ | | | |
| Publish Forms | | ✓ | ✓ | | | |
| Make Calls | | | | ✓ | | |
| Create Clients | | | | ✓ | | |
| Submit Forms | | | | ✓ | | |
| Track Attendance | | | ✓ | ✓ | | |
| Send Messages | | | | ✓ | | |
| View Clients | ✓ | ✓ | ✓ | ✓ | ✓ | |
| View Forms | ✓ | ✓ | ✓ | ✓ | ✓ | |
| View Reports | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Audit Log | ✓ | ✓ | ✓ | | | |
| Compliance Reports | ✓ | ✓ | | | | |
| View Messages | | | | | | ✓ |
| Reply Messages | | | | | | ✓ |
| View Programs | | | | | | ✓ |
| View Attendance | | | | | | ✓ |
| Update Settings | | | | | | ✓ |
