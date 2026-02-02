# Access Control Policy

**Document ID:** ACC-POL-001
**Version:** 1.0
**Effective Date:** February 1, 2026
**Review Date:** February 1, 2027
**Owner:** Security Lead

---

## 1. Purpose

This policy establishes requirements for controlling access to Scrybe systems and PHI to ensure only authorized users can access information necessary for their job functions.

## 2. Scope

This policy applies to:
- All user accounts and access credentials
- All systems containing PHI
- All workforce members, contractors, and third parties
- Physical and logical access controls

## 3. Access Control Principles

### 3.1 Least Privilege

Users receive only the minimum access necessary to perform their job functions.

### 3.2 Need-to-Know

Access to PHI is granted only when required for a specific, legitimate purpose.

### 3.3 Separation of Duties

Critical functions are divided among multiple individuals to prevent fraud and errors.

## 4. Role-Based Access Control (RBAC)

### 4.1 User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| **ADMIN** | Organization administrators | Full organization access, user management, settings |
| **PROGRAM_MANAGER** | Program-level managers | All clients/forms in assigned programs |
| **CASE_MANAGER** | Client-facing staff | Assigned clients only |
| **VIEWER** | Read-only users | Read access to assigned clients |

### 4.2 Permission Matrix

| Permission | Admin | Program Manager | Case Manager | Viewer |
|------------|-------|-----------------|--------------|--------|
| View clients | All | Program | Assigned | Assigned |
| Edit clients | All | Program | Assigned | None |
| Create forms | Yes | Yes | No | No |
| View form submissions | All | Program | Assigned | Assigned |
| Edit form submissions | All | Program | Assigned | None |
| Export data | Yes | Yes | Limited | None |
| Manage users | Yes | No | No | No |
| View audit logs | Yes | Yes | No | No |
| System settings | Yes | No | No | No |

### 4.3 MFA Requirements

| Role | MFA Required |
|------|--------------|
| Admin | **Always** |
| Program Manager | **Always** |
| Case Manager | Organization setting |
| Viewer | Organization setting |

## 5. Account Management

### 5.1 Account Provisioning

1. Access request submitted by supervisor
2. Approval by system administrator
3. Role assigned based on job function
4. Account created with temporary password
5. User completes security training
6. MFA enrollment required before PHI access

### 5.2 Account Modification

- Role changes require written approval
- Access changes logged in audit trail
- Effective immediately upon approval

### 5.3 Account Deprovisioning

| Event | Timeline | Action |
|-------|----------|--------|
| Termination (involuntary) | Immediate | Disable account, revoke all sessions |
| Termination (voluntary) | Last day | Disable account at end of shift |
| Role change | Same day | Adjust permissions |
| Leave of absence | Day of leave | Suspend account |

### 5.4 Access Reviews

| Review Type | Frequency | Reviewer |
|-------------|-----------|----------|
| User access audit | Quarterly | Admin + Security |
| Privileged access | Monthly | Security Lead |
| Inactive accounts | Monthly | System (automated) |
| Terminated users | Daily | HR + IT (automated) |

## 6. Authentication

### 6.1 Password Requirements

| Requirement | Value |
|-------------|-------|
| Minimum length | 12 characters |
| Complexity | Upper, lower, number, special |
| History | Cannot reuse last 12 |
| Maximum age | 90 days |
| Lockout threshold | 5 failed attempts |
| Lockout duration | 15 minutes |

### 6.2 Multi-Factor Authentication

**Supported Methods:**
- TOTP authenticator apps (Google Authenticator, Authy, 1Password)
- Backup codes (10 single-use codes)

**MFA Triggers:**
- Initial login
- Login from new device
- Login from new location
- Sensitive operations (export, delete)

### 6.3 Session Management

| Setting | Value |
|---------|-------|
| Session timeout | 30 minutes (configurable 15-60) |
| Maximum concurrent sessions | 3 per user |
| Session extension | User can extend before timeout |
| Password change | Invalidates all other sessions |

## 7. Emergency Access

### 7.1 Break-Glass Procedure

For emergency access when normal procedures cannot be followed:

1. Verbal authorization from CEO or Security Lead
2. Access logged with emergency flag
3. Incident documented within 24 hours
4. Review within 7 days
5. Access removed immediately after emergency

### 7.2 Audit Requirements

All emergency access must be:
- Logged with timestamp and reason
- Reviewed by Security Lead
- Documented in incident log
- Reported in quarterly access review

## 8. Third-Party Access

### 8.1 Requirements

- Valid Business Associate Agreement
- Background check completed
- Security training completed
- Dedicated accounts (no shared credentials)
- Access limited to specific resources
- Time-limited access when possible

### 8.2 Monitoring

- Real-time alerts for third-party access
- Weekly access reports
- Quarterly access reviews
- Annual vendor security assessment

## 9. Physical Access

### 9.1 Workstation Security

- Automatic screen lock after 5 minutes
- Workstations positioned away from public view
- Clean desk policy for PHI
- Device encryption required

### 9.2 Mobile Devices

- MDM enrollment required for PHI access
- Remote wipe capability
- Device encryption mandatory
- Approved apps only

## 10. Technical Implementation

### 10.1 Access Control Features

```
src/lib/auth/
├── session/
│   ├── timeout.ts           # 30-min inactivity timeout
│   └── concurrent-sessions.ts # Max 3 sessions per user
├── mfa/
│   ├── service.ts           # MFA enforcement by role
│   └── totp.ts              # TOTP verification
└── password-policy.ts       # Password requirements
```

### 10.2 Audit Logging

All access events are logged:
- `LOGIN_SUCCESS` / `LOGIN_FAILURE`
- `MFA_VERIFIED` / `MFA_FAILED`
- `SESSION_CREATED` / `SESSION_TIMEOUT`
- `PASSWORD_CHANGED`
- `ACCESS_DENIED`

## 11. Compliance Mapping

### HIPAA

| Requirement | Section |
|-------------|---------|
| §164.312(a)(1) Access Control | 4, 5, 6 |
| §164.312(a)(2)(i) Unique User ID | 5.1 |
| §164.312(a)(2)(ii) Emergency Access | 7 |
| §164.312(a)(2)(iii) Automatic Logoff | 6.3 |
| §164.312(a)(2)(iv) Encryption | 6 |
| §164.312(d) Authentication | 6.1, 6.2 |

### SOC 2

| Criteria | Section |
|----------|---------|
| CC6.1 Logical Access Security | 4, 6 |
| CC6.2 Provisioning | 5.1 |
| CC6.3 Deprovisioning | 5.3 |
| CC6.4 Restrictions | 4.2 |
| CC6.5 Account Management | 5 |

---

**Approval:**

| Name | Title | Signature | Date |
|------|-------|-----------|------|
| _________________ | Security Lead | _________________ | ________ |
| _________________ | CEO | _________________ | ________ |
