# SMS/Messaging System Implementation Plan

## Overview

This document outlines the implementation plan for the SMS/Messaging system in Scrybe. The system enables case managers to communicate with clients through a hybrid approach: SMS notifications alert clients to new messages, while actual message content is viewed and exchanged through a secure portal.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Portal Authentication | Magic links (24hr expiry) | Simpler for clients, no registration required |
| Attachment Storage | AWS S3 with AES-256 encryption | HIPAA-compliant, already used for recordings |
| SMS Delivery | Direct Twilio API | Simpler initial implementation, can add queue later |
| Message Retention | 7 years | HIPAA requires 6 years minimum, 7 provides safety margin |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Case Manager Dashboard                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ Client Profile  │  │ Message Composer│  │ Message History     │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
└───────────┼─────────────────────┼─────────────────────┼─────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           API Layer                                  │
│  /api/clients/[id]/messages  │  /api/messages  │  /api/portal       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
┌───────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│ Messaging Service │ │   SMS Service   │ │   Portal Auth Service   │
│  - CRUD messages  │ │  - Send SMS     │ │  - Generate magic links │
│  - Thread mgmt    │ │  - Track status │ │  - Validate tokens      │
└─────────┬─────────┘ └────────┬────────┘ └────────────┬────────────┘
          │                    │                       │
          ▼                    ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL (Prisma)                          │
│  Message │ MessageAttachment │ SmsNotification │ SmsPreference       │
└─────────────────────────────────────────────────────────────────────┘
                    │                              │
                    ▼                              ▼
            ┌───────────────┐              ┌───────────────┐
            │   AWS S3      │              │   Twilio      │
            │  Attachments  │              │  SMS Gateway  │
            └───────────────┘              └───────────────┘
```

## Implementation Phases

### Phase 1: Database Schema & Core Services (Foundation)
**Priority: P0**

#### 1.1 Database Models
Add to `prisma/schema.prisma`:

```prisma
model Message {
  id            String              @id @default(uuid())
  orgId         String
  clientId      String
  senderId      String              // User ID (case manager) or null for client replies
  senderType    MessageSenderType   // CASE_MANAGER or CLIENT
  content       String              @db.Text
  contentHash   String?             // For integrity verification
  status        MessageStatus       @default(SENT)
  sentAt        DateTime            @default(now())
  deliveredAt   DateTime?
  readAt        DateTime?
  expiresAt     DateTime?           // For retention policy
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  deletedAt     DateTime?

  // Relations
  organization  Organization        @relation(fields: [orgId], references: [id])
  client        Client              @relation(fields: [clientId], references: [id])
  sender        User?               @relation(fields: [senderId], references: [id])
  attachments   MessageAttachment[]
  smsNotification SmsNotification?

  @@index([clientId, sentAt])
  @@index([orgId, clientId])
  @@index([senderId])
}

enum MessageSenderType {
  CASE_MANAGER
  CLIENT
}

enum MessageStatus {
  DRAFT
  SENT
  DELIVERED
  READ
  FAILED
}

model MessageAttachment {
  id          String   @id @default(uuid())
  messageId   String
  filename    String
  fileUrl     String   // S3 URL
  mimeType    String
  fileSize    Int      // bytes
  uploadedAt  DateTime @default(now())

  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
}

model SmsNotification {
  id              String              @id @default(uuid())
  messageId       String              @unique
  phoneNumber     String              // E.164 format
  twilioSid       String?             @unique
  deliveryStatus  SmsDeliveryStatus   @default(QUEUED)
  sentAt          DateTime?
  deliveredAt     DateTime?
  errorCode       String?
  errorMessage    String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  message         Message             @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([twilioSid])
  @@index([deliveryStatus])
}

enum SmsDeliveryStatus {
  QUEUED
  SENT
  DELIVERED
  UNDELIVERED
  FAILED
}

model SmsPreference {
  id            String    @id @default(uuid())
  clientId      String    @unique
  optedIn       Boolean   @default(false)
  phoneNumber   String    // E.164 format
  optedInAt     DateTime?
  optedOutAt    DateTime?
  optInMethod   String?   // "portal", "verbal", "written"
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  client        Client    @relation(fields: [clientId], references: [id])

  @@index([clientId])
}

model PortalToken {
  id          String    @id @default(uuid())
  clientId    String
  token       String    @unique
  messageId   String?   // Optional: link to specific message
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())

  client      Client    @relation(fields: [clientId], references: [id])

  @@index([token])
  @@index([clientId])
  @@index([expiresAt])
}
```

#### 1.2 Update Client Model
Add relations to existing Client model:
```prisma
model Client {
  // ... existing fields ...

  messages      Message[]
  smsPreference SmsPreference?
  portalTokens  PortalToken[]
}
```

### Phase 2: Core Services
**Priority: P0**

#### 2.1 Messaging Service
**File: `src/lib/services/messaging.ts`**

```typescript
// Core functions:
- createMessage(orgId, clientId, senderId, content, attachments?)
- getClientMessages(orgId, clientId, options: { limit, offset, since })
- getMessage(messageId, orgId)
- markMessageAsRead(messageId)
- getUnreadCount(clientId)
- deleteMessage(messageId, orgId) // Soft delete
```

#### 2.2 SMS Notification Service
**File: `src/lib/services/sms-notifications.ts`**

```typescript
// Core functions:
- sendSmsNotification(messageId, clientId)
- handleDeliveryWebhook(twilioSid, status, errorCode?)
- getClientSmsPreference(clientId)
- updateSmsPreference(clientId, optedIn, phoneNumber, method)
- canSendSms(clientId) // Check opt-in status
```

#### 2.3 Portal Token Service
**File: `src/lib/services/portal-tokens.ts`**

```typescript
// Core functions:
- generatePortalToken(clientId, messageId?) // 24hr expiry
- validatePortalToken(token) // Returns client if valid
- revokePortalToken(token)
- cleanupExpiredTokens() // Cron job
```

#### 2.4 Attachment Service
**File: `src/lib/services/message-attachments.ts`**

```typescript
// Core functions:
- uploadAttachment(file, messageId) // Upload to S3 with encryption
- getAttachmentUrl(attachmentId) // Signed URL with expiry
- deleteAttachment(attachmentId)
- validateFileType(mimeType) // Allowed: PDF, images
- validateFileSize(size) // Max 10MB
```

### Phase 3: API Routes
**Priority: P0**

#### 3.1 Message Routes
```
POST   /api/clients/[clientId]/messages     - Send message to client
GET    /api/clients/[clientId]/messages     - Get message history
GET    /api/messages/[messageId]            - Get single message
DELETE /api/messages/[messageId]            - Soft delete message
POST   /api/messages/[messageId]/attachments - Upload attachment
GET    /api/messages/[messageId]/attachments/[attachmentId] - Download
```

#### 3.2 SMS Preference Routes
```
GET    /api/clients/[clientId]/sms-preference  - Get preference
PUT    /api/clients/[clientId]/sms-preference  - Update preference
```

#### 3.3 Webhook Routes
```
POST   /api/webhooks/twilio/sms-status   - Delivery status callback
```

#### 3.4 Portal Routes (Client-facing)
```
GET    /api/portal/validate              - Validate magic link token
GET    /api/portal/messages              - Get client's messages
GET    /api/portal/messages/[messageId]  - Get single message
POST   /api/portal/messages/[messageId]/reply - Send reply
POST   /api/portal/messages/[messageId]/read  - Mark as read
```

### Phase 4: UI Components
**Priority: P0**

#### 4.1 Case Manager Components
```
src/components/messaging/
├── message-composer.tsx       - Rich text editor with attachments
├── message-thread.tsx         - Conversation view
├── message-list.tsx           - List of messages for a client
├── message-status-badge.tsx   - Delivery/read status indicator
├── attachment-upload.tsx      - File upload component
└── sms-preference-toggle.tsx  - Opt-in/out management
```

#### 4.2 Client Profile Integration
Update `src/components/clients/client-profile.tsx`:
- Add "Messages" tab
- Add "Send Message" button to header
- Show SMS preference status

### Phase 5: Client Portal
**Priority: P0**

#### 5.1 Portal Pages
```
src/app/(portal)/
├── layout.tsx                 - Portal layout (no dashboard nav)
├── m/[token]/page.tsx         - Magic link entry point
├── messages/page.tsx          - Message list
├── messages/[id]/page.tsx     - View single message
└── messages/[id]/reply/page.tsx - Reply form
```

#### 5.2 Portal Components
```
src/components/portal/
├── portal-header.tsx          - Simple header with org branding
├── message-view.tsx           - Message display
├── reply-form.tsx             - Text area for replies
└── attachment-viewer.tsx      - View/download attachments
```

### Phase 6: Admin Configuration
**Priority: P1**

#### 6.1 SMS Templates
```prisma
model SmsTemplate {
  id          String    @id @default(uuid())
  orgId       String
  name        String
  content     String    // Template with placeholders
  isDefault   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  organization Organization @relation(fields: [orgId], references: [id])

  @@unique([orgId, name])
}
```

#### 6.2 Admin Routes
```
GET    /api/admin/sms-templates          - List templates
POST   /api/admin/sms-templates          - Create template
PUT    /api/admin/sms-templates/[id]     - Update template
DELETE /api/admin/sms-templates/[id]     - Delete template
```

---

## File Structure Summary

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── clients/[clientId]/
│   │       └── messages/           # Case manager message views
│   ├── (portal)/
│   │   ├── layout.tsx
│   │   ├── m/[token]/page.tsx      # Magic link entry
│   │   └── messages/               # Client portal views
│   └── api/
│       ├── clients/[clientId]/
│       │   ├── messages/route.ts
│       │   └── sms-preference/route.ts
│       ├── messages/
│       │   ├── [messageId]/route.ts
│       │   └── [messageId]/attachments/route.ts
│       ├── portal/
│       │   ├── validate/route.ts
│       │   └── messages/route.ts
│       └── webhooks/twilio/
│           └── sms-status/route.ts
├── components/
│   ├── messaging/
│   │   ├── message-composer.tsx
│   │   ├── message-thread.tsx
│   │   ├── message-list.tsx
│   │   └── message-status-badge.tsx
│   └── portal/
│       ├── portal-header.tsx
│       ├── message-view.tsx
│       └── reply-form.tsx
└── lib/
    ├── services/
    │   ├── messaging.ts
    │   ├── sms-notifications.ts
    │   ├── portal-tokens.ts
    │   └── message-attachments.ts
    └── twilio/
        └── sms.ts                  # SMS-specific Twilio functions
```

---

## Implementation Status

### Completed (Phase 1 - MVP)

#### Database Layer
- [x] Added Message, MessageAttachment, SmsNotification, SmsPreference, PortalToken, SmsTemplate models to Prisma schema
- [x] Added relations to Client, User, and Organization models
- [x] Generated Prisma client

#### Services Layer
- [x] `src/lib/services/messaging.ts` - Message CRUD operations
- [x] `src/lib/services/sms-notifications.ts` - Twilio SMS sending and delivery tracking
- [x] `src/lib/services/portal-tokens.ts` - Magic link token generation and validation

#### API Routes
- [x] `POST/GET /api/clients/[clientId]/messages` - Send and list messages
- [x] `GET/DELETE /api/messages/[messageId]` - Individual message operations
- [x] `GET/PUT /api/clients/[clientId]/sms-preference` - SMS opt-in management
- [x] `POST /api/webhooks/twilio/sms-status` - Delivery status webhooks
- [x] `POST /api/portal/validate` - Magic link validation
- [x] `GET/POST /api/portal/messages` - Portal message access
- [x] `GET/POST /api/portal/messages/[messageId]` - Individual message + read receipts

#### UI Components
- [x] `MessageComposer` - Message composition dialog
- [x] `MessageList` - Threaded message display
- [x] `MessageStatusBadge` - Delivery/read status indicators
- [x] `SmsPreferenceCard` - SMS opt-in management
- [x] Integrated Messages tab into client profile

#### Client Portal
- [x] Portal layout (`src/app/(portal)/layout.tsx`)
- [x] Magic link entry page (`src/app/(portal)/m/[token]/page.tsx`)
- [x] Message viewing and reply functionality

### Remaining (Future Enhancements)
- [ ] File attachment uploads to S3
- [ ] Attachment viewer in portal
- [ ] Admin SMS template management UI
- [ ] Message search functionality
- [ ] Batch messaging
- [ ] Message scheduling
- [ ] Analytics dashboard for messaging metrics

---

## Security Considerations

1. **No PHI in SMS**: SMS notifications contain only generic text and portal link
2. **Magic Links**:
   - 24-hour expiry
   - Single-use token invalidation optional
   - Secure random token generation (crypto.randomBytes)
3. **Encryption**:
   - Messages encrypted at rest (Prisma/PostgreSQL)
   - Attachments encrypted in S3 (AES-256)
4. **Access Control**:
   - Portal tokens scoped to specific client
   - Case managers can only access clients in their org
   - Role-based permissions for message sending

---

## Testing Strategy

### Unit Tests
- Message creation with validation
- Magic link generation and validation
- SMS opt-in/out logic
- Attachment upload/validation

### Integration Tests
- Full message send flow (compose → SMS → portal → read)
- Twilio webhook handling
- Portal authentication flow

### Security Tests
- Expired token rejection
- Cross-client access prevention
- Input sanitization
- SQL injection prevention

---

## Environment Variables Required

```env
# Existing Twilio (already configured)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# New: SMS-specific (may use existing)
TWILIO_MESSAGING_SERVICE_SID=...  # Optional: for high-volume

# Portal
PORTAL_BASE_URL=https://app.scrybe.com/portal  # Or separate domain
PORTAL_TOKEN_SECRET=...  # For signing magic links

# S3 (for attachments - may already exist for recordings)
AWS_S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
```
