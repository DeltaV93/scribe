# Scrybe Feature Catalog

A comprehensive list of all features in the Scrybe platform, organized by category.

---

## 1. Authentication & User Management

### Authentication
- Email/password login and signup
- Password reset flow with secure token-based reset
- Email verification for new accounts
- Supabase JWT authentication with SSR session middleware
- Auto-sync between Supabase auth and Prisma database

### User Invitation System
- Token-based invitation with secure invite links
- Single and bulk user invitation
- Invitation status tracking (pending, accepted, expired, revoked)
- Resend invitation emails
- 7-day invitation expiry with reminders

### User Management
- Role-based access control: SUPER_ADMIN, ADMIN, PROGRAM_MANAGER, CASE_MANAGER, VIEWER
- Granular form permissions (create, read, update, delete, publish)
- User activation/deactivation with tracking
- User data transfer between case managers
- User audit trails and activity tracking

### Team Management
- Create and manage teams within organization
- Team-based form access controls
- Team member management

---

## 2. Form Builder & Management

### Form Builder Wizard
7-step creation process:
1. **Setup** - Basic form info (name, description)
2. **Fields** - Add and configure form fields
3. **Organize** - Sections and field reordering
4. **Logic** - Conditional show/hide rules
5. **Preview** - Test form before publishing
6. **AI Config** - Configure AI extraction settings
7. **Publish** - Final publishing workflow

### Field Types
| Type | Description |
|------|-------------|
| TEXT_SHORT | Single line text input |
| TEXT_LONG | Multi-line textarea |
| NUMBER | Numeric input with validation |
| DATE | Date picker |
| PHONE | Phone number with validation |
| EMAIL | Email with validation |
| ADDRESS | Structured address fields |
| DROPDOWN | Single select from options |
| CHECKBOX | Multi-select checkboxes |
| YES_NO | Boolean toggle |
| FILE | File upload |
| SIGNATURE | Digital signature capture |

### Field Configuration
- Required/optional validation
- Help text and custom labels
- Sensitive data flagging for encryption
- AI extractability toggle
- Purpose tracking (grant requirement, compliance, outcomes)
- Validation rules and default values
- i18n translation support

### Conditional Logic
- Visual flow-based logic editor (React Flow)
- Show/hide fields based on conditions
- Complex condition chaining
- Field dependency tracking

### Form Management
- Create, read, update, delete forms
- Form status: DRAFT, PUBLISHED, ARCHIVED
- Version history with rollback capability
- Form duplication
- Import/export (JSON format)
- User and team-based access control

### Form Templates
- Save forms as reusable templates
- Create forms from templates
- System-wide and org-specific templates
- Template library with search/filter
- Template preview and usage tracking

---

## 3. AI-Powered Features

### Form Data Extraction
- Claude-powered extraction from call transcripts
- Per-field confidence scoring
- Extraction validation against field constraints
- Support for all field types with type-specific parsing
- Reasoning and source snippets for transparency
- Flagged fields for low-confidence extractions
- AI extraction tester UI

### Few-Shot Learning
- User-provided extraction examples
- Vector embeddings for semantic matching (pgvector ready)
- Example-based extraction improvement

### Form Generation
- Generate entire forms from natural language requirements
- AI-generated form review UI
- Smart field type detection
- Automatic purpose inference

### Attendance Recognition (Claude Vision)
- Handwritten attendance sheet reading
- QR code detection from photos
- Printed code OCR
- Handwriting recognition for times and notes
- Signature detection
- Confidence scoring and review flagging

### Syllabus Extraction
- Extract program sessions from uploaded PDFs
- Session detection with dates and topics
- Auto-population of program structure

---

## 4. Client Management

### Client Data
- Full CRUD operations
- Status tracking: ACTIVE, ON_HOLD, CLOSED, PENDING
- Primary contact (name, phone, email)
- Multiple phone numbers with labels
- Structured address with geocoding support
- Internal ID for external system sync
- Custom fields support
- Soft delete with restoration

### Client Search
- Duplicate detection on creation
- Search by name, phone, email
- Filter by status and assigned case manager
- Inline multi-select for bulk operations

### Client Activity
- Activity feed showing all interactions
- Calls, notes, form submissions, program enrollments
- Timeline view of client history

### Client Notes
- Internal and shareable notes
- Rich text editor support
- Note tagging system
- Draft notes capability
- Optional call linkage

---

## 5. VoIP Call System

### Call Management
- Browser-based VoIP calling via Twilio
- Outbound calls to clients
- Status tracking: INITIATING, RINGING, IN_PROGRESS, COMPLETED, ABANDONED, FAILED
- Real-time call controls UI
- Call timer display
- Active calls tracking

### Call Recording
- Automatic call recording
- S3 storage with retention policies
- Recording URL webhooks
- Playback capability

### Consent Management
- Multiple consent modes:
  - AUTO_RECORDING
  - CASE_MANAGER_SCRIPT
  - DISABLED
- Pre-recorded consent messages
- TwiML consent flow generation

### Call Processing Pipeline
1. Twilio webhook receives call
2. Recording uploaded to S3
3. Deepgram transcription
4. Claude AI extraction
5. FormSubmission creation
6. Review and finalization

### Call Features
- Form selection before/during call
- Real-time notes panel
- Conversation guide based on form fields
- Review workflow for AI extractions
- Manual corrections tracking

### Phone Number Management
- Admin-managed phone number pool
- Purchase numbers from Twilio
- Assign numbers to case managers
- Phone number request/approval workflow
- Cost tracking and statistics

---

## 6. Program Management

### Program Configuration
- Create, view, edit, archive programs
- Status: DRAFT, ACTIVE, COMPLETED, CANCELLED, ARCHIVED
- Flexible labels: PROGRAM, COURSE, CLASS, WORKSHOP, TRAINING, GROUP
- Required hours for completion
- Start and end dates
- Flexible schedule (days, times, frequency)
- Location tracking
- Maximum enrollment capacity
- Facilitator assignment

### Session Management
- Create/edit program sessions
- Session numbering and ordering
- Titles, topics, dates, duration
- Session notes

### Enrollment Management
- Enroll clients in programs
- Status: ENROLLED, IN_PROGRESS, COMPLETED, WITHDRAWN, FAILED, ON_HOLD
- Quick enroll from attendance sheet
- Hours override capability
- Completion/withdrawal tracking with reasons

### Program Materials
- Upload materials (syllabus, handouts, presentations, worksheets, assessments, certificate templates)
- Session-specific or program-level materials
- AI syllabus extraction from PDFs

### Program Analytics
- Enrollment counts
- Attendance rates
- Completion rates
- Hours tracked

---

## 7. Attendance Tracking

### Attendance Sheet System
- Configurable attendance sheet generation
- Printable PDF sheets per session
- Batch generation for multiple sessions
- QR code per enrollment
- Attendance code system (e.g., BK2847)
- Customizable columns (time in/out, signature, notes)

### Photo Upload Workflow
- Upload attendance sheet photos
- Image enhancement preprocessing
- S3 storage with metadata tracking
- Rate limiting per user/session

### AI Processing
- Automatic recognition of uploaded photos
- QR code detection and decoding
- Printed code OCR
- Handwriting recognition
- Signature detection
- Attendance status extraction (PRESENT, EXCUSED, ABSENT)
- Confidence scoring per field

### Review Workflow
- Review pending extractions
- Flag low-confidence records
- Manual verification
- Approve or correct AI extractions

### Override System
- Submit override requests for special cases
- Admin review and approval
- Override reasons tracking

### Manual Attendance
- Direct attendance recording
- Bulk entry support
- Time in/out tracking
- Notes and hours override

### Attendance Reports
- Session attendance summaries
- Enrollment attendance history
- Program-wide statistics
- Per-client attendance view
- Attendance rate calculations
- Hours tracking

---

## 8. Client Portal

### Portal Access
- Magic link authentication (24hr token expiry)
- Secure session management with CSRF protection
- Optional PIN protection
- Failed attempt tracking and lockout
- Phone number verification for sensitive actions

### Portal Features
- View messages from case manager
- Reply to messages
- Mark messages as read
- View enrolled programs
- View program attendance history
- Settings management
- Help/FAQ page

### Portal Settings
- Update phone number with SMS verification
- SMS notification preferences
- Opt-in/opt-out of notifications

---

## 9. Messaging & Notifications

### Messaging System
- Two-way messaging between case managers and clients
- Message status: DRAFT, SENT, DELIVERED, READ, FAILED
- Content integrity verification (SHA-256 hash)
- 7-year retention policy
- Soft delete capability

### Message Attachments
- File attachments (PDF, images)
- 10MB size limit
- MIME type validation
- Encryption at rest (S3 AES-256)

### SMS Notifications
- Send via Twilio
- Delivery status tracking: QUEUED, SENT, DELIVERED, UNDELIVERED, FAILED
- Error tracking and retry
- Opt-in/opt-out management

### Email Notifications
- Case manager reply notifications
- Invitation emails
- Password reset emails
- Reminder emails

### SMS Templates
- Admin-configurable templates
- Variable support ({{portal_link}}, {{client_name}})
- Default template system

---

## 10. Form Submissions

### Submission Workflow
- Create from calls or manually
- Draft saving with auto-save
- Partial submission support
- Optional supervisor review
- Status: DRAFT, SUBMITTED, APPROVED, REJECTED
- Client and call linkage

### AI-Assisted Submissions
- Auto-populate from AI extraction
- Per-field confidence scores
- Flagged fields for review
- Manual corrections tracking
- Source snippets for transparency

### Submission Data
- Encrypted sensitive fields
- JSON-based flexible schema
- Field-level audit trail
- Edit history with reasons
- Form version tracking

### Digital Signatures
- Signature capture with metadata
- Image hash for integrity
- Timestamp and IP tracking
- Device fingerprinting
- Geolocation capture
- Consent recording

---

## 11. Resource Locking

- Pessimistic locking for form submissions
- 5-minute lock duration
- Heartbeat refresh mechanism
- Lock acquisition and release APIs
- Beacon API for reliable release on navigation
- Auto-expiry cleanup
- Lock status UI banner

---

## 12. File Management

### File Upload
- Multi-file upload support
- S3 storage with presigned URLs
- Virus scanning (ClamAV ready)
- Scan status: PENDING, SCANNING, CLEAN, INFECTED, ERROR
- MIME type validation
- Tier-based size limits

### File Operations
- File list view
- Details and download
- OCR text extraction from PDFs/images
- Organization and tagging
- Storage quota tracking

---

## 13. Audit & Compliance

### Audit Logging
- Immutable audit log with hash chain
- Actions: CREATE, UPDATE, DELETE, VIEW, EXPORT, PUBLISH
- Resources: FORM, SUBMISSION, CLIENT, USER, FILE
- User attribution and IP tracking
- User agent logging
- Detailed change tracking
- Hash chain verification

### Compliance Reports
- Report types:
  - ACTIVITY_SUMMARY
  - DATA_ACCESS
  - USER_ACTIVITY
- Date range filtering
- Report integrity hash
- Export capability

### Data Retention
- Configurable retention policies
- Auto-archive forms
- Recording retention per org
- 7-year message retention
- Automated cleanup jobs

### Compliance Standards
- HIPAA-ready logging
- SOC 2 compliance tracking

---

## 14. Billing & Subscriptions

### Subscription Tiers
| Tier | Description |
|------|-------------|
| FREE | Basic access with limited features |
| STARTER | Small teams |
| PROFESSIONAL | Full features for growing orgs |
| ENTERPRISE | Custom limits and support |

### Subscription Management
- Stripe integration
- Monthly and yearly billing
- Subscription checkout
- Customer portal access
- Cancel at period end
- Reactivation capability

### Usage Tracking
- Forms, submissions, users, storage, AI extractions
- Tier-based limits enforcement
- Real-time quota checks
- Usage alerts and dashboard

### Form Packs
- One-time purchase of additional forms
- Bundles: 5, 10, 25 forms
- Auto-decrement on form creation

### Invoicing
- Invoice history
- PDF download
- Upcoming invoice preview
- Payment history

---

## 15. Admin Dashboard

### Organization Settings
- Preferred area code for phone numbers
- Recording retention days
- Consent mode configuration
- Webhook URL configuration

### User Administration
- User list with role filtering
- Invite/deactivate users
- Edit user roles and permissions
- Caseload limit assignment
- User audit trail

### Phone Management
- Phone number pool overview
- Purchase and assign numbers
- Request approval workflow
- Cost tracking

### Team Management
- Create and manage teams
- Team membership
- Team-based permissions

---

## 16. Infrastructure & System

### Health & Monitoring
- Application health endpoint
- Kubernetes readiness probe
- Database connectivity check
- External service status

### Background Processing
- Call processing jobs
- Expired session cleanup
- Recording cleanup based on retention
- Failed processing retry queue
- Scheduled compliance reports
- Email/SMS sending queues

### Multi-tenancy
- Organization-level data isolation
- Org-scoped API queries
- Per-org settings and limits

### Storage
- AWS S3 for files, recordings, photos
- Encryption at rest (AES-256)

### Analytics
- Fathom privacy-focused analytics
- Event tracking

---

## User Flows

### Case Manager Flows

1. **Client Intake via Call**
   - Select client or create new
   - Choose intake form
   - Initiate call → conversation guide displayed
   - Take notes during call
   - Call ends → recording uploaded
   - AI extracts form data
   - Review and approve extraction
   - Submit form

2. **Manual Form Submission**
   - Navigate to client
   - Select form
   - Fill out fields manually
   - Save as draft or submit
   - (Optional) Supervisor review

3. **Program Enrollment**
   - Create program with sessions
   - Search for clients
   - Enroll clients in program
   - Generate attendance sheets
   - Track attendance per session

4. **Attendance Tracking**
   - Print attendance sheet for session
   - Collect signatures/times in person
   - Upload photo of completed sheet
   - AI processes and extracts data
   - Review flagged entries
   - Approve attendance records

5. **Client Communication**
   - Send message to client
   - Client receives SMS notification
   - Client accesses portal via magic link
   - Client views and replies to message
   - Case manager sees reply notification

### Admin Flows

1. **User Onboarding**
   - Admin invites user via email
   - User receives invitation link
   - User creates password
   - User assigned to team
   - User assigned phone number (if needed)

2. **Phone Number Management**
   - Admin purchases phone numbers
   - Case manager requests number
   - Admin approves request
   - Number assigned to case manager
   - Case manager can make calls

3. **Organization Setup**
   - Configure consent mode
   - Set recording retention
   - Create teams
   - Set up billing/subscription
   - Configure SMS templates

### Client Portal Flows

1. **Access Portal**
   - Receive SMS with portal link
   - Click magic link
   - (Optional) Enter PIN
   - View dashboard

2. **View Messages**
   - Navigate to messages
   - Read message from case manager
   - Reply to message

3. **View Programs**
   - Navigate to programs
   - See enrolled programs
   - View attendance history

4. **Update Settings**
   - Change phone number
   - Verify via SMS code
   - Update notification preferences

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Page Routes | ~38 |
| API Endpoints | 100+ |
| React Components | 100+ |
| Database Models | 45+ |
| External Integrations | 6 |

### External Integrations
- **Anthropic Claude** - AI extraction, form generation, vision
- **Twilio** - VoIP calls, SMS, phone numbers
- **Deepgram** - Call transcription
- **Stripe** - Billing and subscriptions
- **Supabase** - Authentication
- **AWS S3** - File storage
