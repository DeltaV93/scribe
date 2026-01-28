# Admin Phone Number Management System

## Overview

This document describes the phone number management system that allows administrators to control Twilio phone number assignments to case managers. The system was designed to give organizations cost control over phone number provisioning ($1.15/month per number).

## Problem Statement

Case managers need dedicated phone numbers to make calls to clients. The original auto-provisioning approach would automatically purchase numbers on first call, leading to:
- Uncontrolled costs as numbers accumulated
- No visibility into phone number inventory
- Difficulty managing number assignments across the organization

## Solution

An admin-controlled phone number management system where:
1. Case managers request phone numbers
2. Admins review and approve/reject requests
3. Admins can pre-purchase numbers to a pool or buy on-demand
4. Full visibility into costs and assignments

---

## Architecture Decisions

### 1. Single Admin Page vs. Multiple Pages

**Decision**: Single page with tabs at `/dashboard/admin`

**Options Considered**:
- Multiple separate pages (`/admin/phones`, `/admin/users`, `/admin/settings`)
- Single page with tabs

**Trade-offs**:
| Single Page (Chosen) | Multiple Pages |
|---------------------|----------------|
| Faster navigation between sections | Better URL sharing/bookmarking |
| Simpler routing | Cleaner separation of concerns |
| All context loaded at once | Lazy loading per page |
| Better for MVP scope | Better for large admin surfaces |

**Rationale**: For MVP with only 3 sections (Phone Numbers, Users, Settings), a tabbed interface reduces complexity and provides faster admin workflows.

### 2. Phone Number Assignment Flow

**Decision**: Hybrid model - pool numbers OR on-demand purchase

**Options Considered**:
1. Pool-only: Admin must pre-purchase all numbers
2. On-demand only: Purchase when assigning
3. Hybrid: Either pool or purchase at assignment time

**Trade-offs**:
| Approach | Pros | Cons |
|----------|------|------|
| Pool-only | Predictable inventory, bulk management | Requires planning, delays for urgent needs |
| On-demand only | Immediate fulfillment | No inventory visibility, can't reserve area codes |
| Hybrid (Chosen) | Flexibility, supports both workflows | More complex UI, two code paths |

**Rationale**: Different organizations have different needs. Some want to pre-purchase for specific area codes, others want just-in-time provisioning.

### 3. Request Workflow vs. Direct Assignment

**Decision**: Support both request workflow AND direct admin assignment

**Options Considered**:
1. Request-only: Case managers must always request
2. Direct-only: Admin assigns without requests
3. Both workflows supported

**Trade-offs**:
| Approach | Pros | Cons |
|----------|------|------|
| Request-only | Audit trail, user-initiated | Slower for new employees |
| Direct-only | Fast admin control | No user agency, admin must track needs |
| Both (Chosen) | Flexible | More UI states to handle |

**Rationale**: Admins may want to proactively assign numbers to new hires, while existing staff can request as needed.

### 4. Notification System

**Decision**: Email stubs (console.log) ready for AWS SES

**Options Considered**:
1. Full AWS SES integration now
2. In-app notifications only
3. Email stubs with console logging
4. Third-party service (SendGrid, Postmark)

**Trade-offs**:
| Approach | Pros | Cons |
|----------|------|------|
| AWS SES now | Production-ready | Requires AWS setup, SES verification, delays MVP |
| In-app only | Simple, no external deps | Users miss notifications when not logged in |
| Stubs (Chosen) | Fast MVP, easy to upgrade | No actual notifications yet |
| Third-party | Quick integration | Another vendor, ongoing costs |

**Rationale**: MVP priority. The stub pattern (`email-notifications.ts`) logs all notifications to console and is structured for easy AWS SES drop-in later.

### 5. Access Control Model

**Decision**: ADMIN and SUPER_ADMIN roles only

**Options Considered**:
1. New "PHONE_ADMIN" role
2. Permission-based (`canManagePhones`)
3. Existing ADMIN/SUPER_ADMIN roles

**Trade-offs**:
| Approach | Pros | Cons |
|----------|------|------|
| New role | Granular control | Schema change, role proliferation |
| Permission-based | Most flexible | Complex, over-engineered for MVP |
| Existing roles (Chosen) | No schema changes, simple | Less granular |

**Rationale**: Phone management is an admin function. Creating new roles adds complexity without clear benefit for current use cases.

### 6. Cost Display

**Decision**: Simple count × $1.15 calculation displayed in UI

**Options Considered**:
1. Real-time Twilio billing API integration
2. Stored cost per number with monthly aggregation
3. Simple calculation based on number count

**Trade-offs**:
| Approach | Pros | Cons |
|----------|------|------|
| Twilio API | Accurate, includes usage | API complexity, rate limits, latency |
| Stored costs | Historical tracking | Schema changes, sync issues |
| Simple calc (Chosen) | Fast, predictable | Doesn't reflect actual Twilio bill |

**Rationale**: For MVP, showing estimated monthly cost based on number count is sufficient. The `monthlyCost` field in `PhoneNumberPool` allows future per-number cost tracking if Twilio pricing changes.

### 7. Area Code Handling

**Decision**: Organization-level preferred area code setting

**Options Considered**:
1. Per-request area code preference
2. Organization default only
3. Both (org default + per-request override)

**Trade-offs**:
| Approach | Pros | Cons |
|----------|------|------|
| Per-request | User flexibility | Complicated UI, users may not know area codes |
| Org default only | Simple, consistent | No flexibility |
| Both (Chosen) | Best of both | Slightly more complex |

**Rationale**: Organization sets a default (e.g., local area code), but admin can override when purchasing specific numbers.

---

## Database Schema

### New Models

```prisma
enum PhoneNumberRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

model PhoneNumberPool {
  id            String   @id @default(uuid())
  orgId         String
  phoneNumber   String   @unique  // E.164 format
  twilioSid     String   @unique
  areaCode      String
  purchasedAt   DateTime @default(now())
  monthlyCost   Decimal  @default(1.15)
  organization  Organization @relation(...)
}

model PhoneNumberRequest {
  id              String   @id @default(uuid())
  userId          String
  orgId           String
  status          PhoneNumberRequestStatus @default(PENDING)
  requestedAt     DateTime @default(now())
  resolvedAt      DateTime?
  resolvedBy      String?
  rejectionReason String?
  user            User @relation("PhoneRequests", ...)
  resolver        User? @relation("ResolvedRequests", ...)
  organization    Organization @relation(...)
}
```

### Modified Models

- **User**: Added `phoneRequests` and `resolvedRequests` relations
- **Organization**: Added `phoneNumberPool` and `phoneNumberRequests` relations

---

## API Endpoints

### Admin Endpoints (require ADMIN role)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/users` | List users with phone status |
| GET | `/api/admin/phone-numbers/pool` | List pool numbers |
| POST | `/api/admin/phone-numbers/pool` | Purchase number to pool |
| DELETE | `/api/admin/phone-numbers/pool/[id]` | Release pool number |
| POST | `/api/admin/phone-numbers/assign` | Assign number to user |
| DELETE | `/api/admin/phone-numbers/assign/[userId]` | Unassign number |
| GET | `/api/admin/phone-numbers/stats` | Get costs & stats |
| GET | `/api/admin/phone-requests` | List pending requests |
| PATCH | `/api/admin/phone-requests/[id]` | Approve/reject request |
| GET | `/api/admin/settings` | Get org settings |
| PATCH | `/api/admin/settings` | Update org settings |

### User Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/phone-numbers/my-status` | Check own phone status |
| POST | `/api/phone-requests` | Submit request for number |
| DELETE | `/api/phone-requests/[id]` | Cancel own pending request |

---

## UI Components

### Admin Components (`src/components/admin/`)

| Component | Purpose |
|-----------|---------|
| `phone-numbers-tab.tsx` | Pool table + assigned numbers table |
| `phone-cost-card.tsx` | Cost summary display |
| `purchase-number-dialog.tsx` | Modal to buy numbers |
| `assign-number-dialog.tsx` | Modal to assign to user (pool or purchase) |
| `users-tab.tsx` | User list with pending requests |
| `settings-tab.tsx` | Area code preference |

### Client Components (`src/components/clients/`)

| Component | Purpose |
|-----------|---------|
| `request-phone-button.tsx` | Request/cancel phone number button |

### Layout Changes (`src/components/layout/`)

| Component | Change |
|-----------|--------|
| `sidebar.tsx` | Added Admin link with pending request badge |

---

## User Flows

### Case Manager Requests Phone Number

```
1. Case manager visits client profile
2. Sees "Request Phone Number" button (no number assigned)
3. Clicks button → confirmation dialog
4. Submits request
5. Button changes to "Request Pending" with cancel option
6. Admin receives notification (currently console.log)
7. Admin approves → number assigned
8. Case manager can now make calls
```

### Admin Approves Request

```
1. Admin sees badge count in sidebar
2. Navigates to /admin
3. Users tab shows pending requests panel
4. Clicks approve (checkmark)
5. Dialog appears: choose from pool OR purchase new
6. Selects option → number assigned
7. User notified (currently console.log)
```

### Admin Pre-purchases Numbers

```
1. Admin navigates to /admin → Phone Numbers tab
2. Clicks "Purchase Number"
3. Enters optional area code (or uses org default)
4. Number purchased from Twilio → added to pool
5. Available for future assignments
```

---

## Security Considerations

1. **Role-based access**: All `/api/admin/*` endpoints verify ADMIN/SUPER_ADMIN role
2. **Org isolation**: All queries filter by user's organizationId
3. **Request ownership**: Users can only cancel their own pending requests
4. **Audit trail**: PhoneNumberRequest tracks who resolved and when

---

## Future Improvements

### Short-term
- [ ] Implement AWS SES email notifications
- [ ] Add request rejection reason UI
- [ ] Bulk number purchase
- [ ] Number search/filter in pool

### Medium-term
- [ ] Number recycling (unassigned numbers return to pool)
- [ ] Usage tracking per number
- [ ] Area code availability check before purchase
- [ ] Request priority/urgency levels

### Long-term
- [ ] Twilio billing API integration for accurate costs
- [ ] Number porting support
- [ ] Multiple numbers per user
- [ ] Number sharing/rotation for teams

---

## File Structure

```
src/
├── app/
│   ├── (dashboard)/admin/page.tsx
│   └── api/
│       ├── admin/
│       │   ├── users/route.ts
│       │   ├── phone-numbers/
│       │   │   ├── pool/route.ts
│       │   │   ├── pool/[id]/route.ts
│       │   │   ├── assign/route.ts
│       │   │   ├── assign/[userId]/route.ts
│       │   │   └── stats/route.ts
│       │   ├── phone-requests/
│       │   │   ├── route.ts
│       │   │   └── [id]/route.ts
│       │   └── settings/route.ts
│       ├── phone-numbers/
│       │   └── my-status/route.ts
│       └── phone-requests/
│           ├── route.ts
│           └── [id]/route.ts
├── components/
│   ├── admin/
│   │   ├── phone-numbers-tab.tsx
│   │   ├── phone-cost-card.tsx
│   │   ├── purchase-number-dialog.tsx
│   │   ├── assign-number-dialog.tsx
│   │   ├── users-tab.tsx
│   │   └── settings-tab.tsx
│   ├── clients/
│   │   ├── client-profile.tsx (modified)
│   │   └── request-phone-button.tsx
│   ├── layout/
│   │   └── sidebar.tsx (modified)
│   └── ui/
│       └── radio-group.tsx (added)
└── lib/
    ├── services/
    │   ├── phone-number-management.ts
    │   ├── phone-requests.ts
    │   └── email-notifications.ts
    └── twilio/
        └── call-manager.ts (modified)
```

---

## Testing Checklist

- [ ] Case manager can request phone number
- [ ] Case manager can cancel pending request
- [ ] Admin sees pending request count in sidebar
- [ ] Admin can approve request (assign from pool)
- [ ] Admin can approve request (purchase new)
- [ ] Admin can reject request
- [ ] Admin can purchase number to pool
- [ ] Admin can release pool number
- [ ] Admin can directly assign number to user
- [ ] Admin can unassign number from user
- [ ] Cost calculations display correctly
- [ ] Area code preference saves and applies
- [ ] Call button hidden when no number assigned
- [ ] Call works after number assigned
