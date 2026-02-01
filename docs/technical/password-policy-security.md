# Password Policy & Security Headers - Technical Design

**Status:** Implemented
**Linear Issue:** PX-668
**Date:** January 31, 2026

## Overview

This document describes the HIPAA-compliant password policy and security headers implementation for Scribe.

## Architecture

### Component Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Login/Password UI]
        Forms[Form Components]
    end

    subgraph "API Layer"
        AuthAPI["/api/auth/*"]
        UnlockAPI["/api/auth/unlock"]
    end

    subgraph "Service Layer"
        PP[Password Policy Service]
        PH[Password History Service]
        AL[Account Lockout Service]
    end

    subgraph "Data Layer"
        Users[(User Table)]
        PWHistory[(PasswordHistory Table)]
        AuditLog[(AuditLog Table)]
    end

    UI --> AuthAPI
    Forms --> AuthAPI
    AuthAPI --> PP
    AuthAPI --> PH
    AuthAPI --> AL
    UnlockAPI --> AL

    PP --> Users
    PH --> PWHistory
    AL --> Users
    AL --> AuditLog
```

## User Flows

### Password Validation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Login UI
    participant API as Auth API
    participant PP as Password Policy
    participant PH as Password History
    participant DB as Database

    U->>UI: Enter new password
    UI->>API: Submit password change
    API->>PP: validatePassword(password)

    alt Password Invalid
        PP-->>API: {isValid: false, errors: [...]}
        API-->>UI: Show validation errors
    else Password Valid
        PP-->>API: {isValid: true}
        API->>PH: checkPasswordHistory(userId, password)

        alt Password Reused
            PH-->>API: {isReused: true}
            API-->>UI: "Cannot reuse recent passwords"
        else Password Not Reused
            PH-->>API: {isReused: false}
            API->>DB: Update password
            API->>PH: addPasswordToHistory(userId, password)
            API->>DB: Update passwordChangedAt
            API-->>UI: Success
        end
    end
```

### Account Lockout Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Login UI
    participant API as Auth API
    participant AL as Account Lockout
    participant Email as Email Service
    participant DB as Database

    U->>UI: Enter credentials
    UI->>API: Login attempt
    API->>AL: isAccountLocked(userId)

    alt Account Locked
        AL-->>API: true (locked)
        API-->>UI: "Account locked, try again later"
    else Account Not Locked
        AL-->>API: false
        API->>DB: Verify credentials

        alt Credentials Invalid
            API->>AL: recordFailedLoginAttempt(userId)
            AL->>DB: Increment failedLoginAttempts

            alt Max Attempts Reached
                AL->>DB: Set lockedUntil
                AL->>Email: Send lockout notification
                AL-->>API: {isLocked: true}
                API-->>UI: "Account locked"
            else Under Max Attempts
                AL-->>API: {isLocked: false, attempts: N}
                API-->>UI: "Invalid credentials"
            end
        else Credentials Valid
            API->>AL: clearFailedLoginAttempts(userId)
            API-->>UI: Login successful
        end
    end
```

### Admin Unlock Flow

```mermaid
sequenceDiagram
    participant A as Admin
    participant UI as Admin UI
    participant API as /api/auth/unlock
    participant AL as Account Lockout
    participant Audit as Audit Service
    participant Email as Email Service

    A->>UI: Click "Unlock Account"
    UI->>API: POST /api/auth/unlock {userId}
    API->>API: Verify admin role
    API->>AL: getLockoutStatus(userId)

    alt Not Locked
        AL-->>API: {isLocked: false}
        API-->>UI: "Account is not locked"
    else Is Locked
        AL-->>API: {isLocked: true}
        API->>AL: unlockAccount(userId, adminId)
        AL->>AL: Clear failed attempts
        AL->>Audit: Log unlock action
        AL->>Email: Notify user
        API-->>UI: "Account unlocked"
    end
```

### Password Expiration Check Flow

```mermaid
flowchart TD
    A[User Login] --> B{Check passwordChangedAt}
    B -->|Null| C[Force Password Change]
    B -->|Has Date| D[Calculate Days Until Expiry]
    D --> E{Days <= 0?}
    E -->|Yes| C
    E -->|No| F{Days <= 14?}
    F -->|Yes| G[Show Warning Banner]
    F -->|No| H[Normal Login]
    G --> H
    C --> I[Redirect to Change Password]
```

## Data Model

### User Fields (Password Security)

```mermaid
erDiagram
    User {
        string id PK
        string email
        datetime passwordChangedAt
        int failedLoginAttempts
        datetime lockedUntil
        boolean mustChangePassword
    }

    PasswordHistory {
        string id PK
        string userId FK
        string passwordHash
        datetime createdAt
    }

    User ||--o{ PasswordHistory : "has"
```

## Configuration

### Password Policy Defaults

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| MIN_LENGTH | 8 | - | Minimum password length |
| MAX_LENGTH | 128 | - | Maximum password length |
| DEFAULT_EXPIRATION_DAYS | 90 | 30-180 | Days until password expires |
| EXPIRATION_WARNING_DAYS | 14 | - | Days before expiry to warn |
| PASSWORD_HISTORY_COUNT | 12 | - | Passwords to remember |

### Account Lockout Defaults

| Setting | Default | Description |
|---------|---------|-------------|
| MAX_FAILED_ATTEMPTS | 5 | Attempts before lockout |
| LOCKOUT_DURATION_MINUTES | 30 | Lockout duration |

## Security Headers

### Implemented Headers

| Header | Value | Purpose |
|--------|-------|---------|
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload | Force HTTPS |
| Content-Security-Policy | default-src 'self'... | Prevent XSS |
| X-Frame-Options | DENY | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-XSS-Protection | 1; mode=block | XSS filter |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer |

## File Structure

```
src/lib/auth/
├── password-policy.ts      # Validation, expiration checking
├── password-history.ts     # History tracking, reuse prevention
├── account-lockout.ts      # Lockout logic, admin unlock
└── actions.ts              # Auth server actions (updated)

src/app/api/auth/
└── unlock/
    └── route.ts            # Admin unlock endpoint

next.config.js              # Security headers
prisma/schema.prisma        # PasswordHistory model
```

## API Endpoints

### POST /api/auth/unlock

Unlock a locked user account (admin only).

**Request:**
```json
{
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account has been unlocked"
}
```

### GET /api/auth/unlock?userId=uuid

Check lockout status for a user (admin only).

**Response:**
```json
{
  "isLocked": true,
  "failedAttempts": 5,
  "lockedUntil": "2026-01-31T12:00:00Z",
  "minutesRemaining": 25
}
```

## Testing Checklist

- [ ] Password validation rejects weak passwords
- [ ] Password validation rejects common passwords
- [ ] Password history prevents reuse of last 12 passwords
- [ ] Account locks after 5 failed attempts
- [ ] Account unlocks after 30 minutes
- [ ] Admin can manually unlock accounts
- [ ] Password expiration warning shows at 14 days
- [ ] Expired passwords force change
- [ ] Security headers present in responses
- [ ] Audit log records lockout/unlock events

## HIPAA Compliance Mapping

| Requirement | Implementation |
|-------------|----------------|
| §164.308(a)(5)(ii)(D) | Password expiration, complexity |
| §164.312(a)(2)(i) | Unique user identification |
| §164.312(d) | Account lockout, MFA |
| §164.312(b) | Audit logging of auth events |
