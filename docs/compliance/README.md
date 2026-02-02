# Scrybe Compliance Documentation

**Last Updated:** February 1, 2026
**Version:** 1.0

---

## Overview

This directory contains all compliance documentation for Scrybe's HIPAA and SOC 2 compliance program. These documents establish the policies, procedures, and controls required to protect Protected Health Information (PHI) and maintain trust with our customers.

## Compliance Framework

### HIPAA Compliance

Scrybe operates as a **Business Associate** under HIPAA, providing services to Covered Entities (healthcare providers, social services agencies) that handle PHI. Our compliance program addresses:

- **Privacy Rule** (45 CFR Part 164, Subpart E) - PHI handling procedures
- **Security Rule** (45 CFR Part 164, Subpart C) - Technical, administrative, and physical safeguards
- **Breach Notification Rule** (45 CFR Part 164, Subpart D) - Incident response and notification

### SOC 2 Type II

We are preparing for SOC 2 Type II certification covering:

- **Security** (Common Criteria) - Protection against unauthorized access
- **Availability** - System uptime and disaster recovery
- **Confidentiality** - Protection of confidential information

---

## Document Structure

```
docs/compliance/
├── README.md                     # This file
├── policies/
│   ├── security-policy.md        # Information security framework
│   ├── privacy-policy.md         # PHI handling procedures
│   ├── breach-notification-policy.md  # Incident response
│   ├── access-control-policy.md  # Access management
│   ├── disaster-recovery-policy.md    # Business continuity
│   └── workforce-security-policy.md   # Employee security
├── runbooks/
│   ├── database-restore.md       # Database recovery procedures
│   ├── s3-failover.md            # S3 failover procedures
│   └── incident-response.md      # Incident handling
└── templates/
    ├── vendor-assessment.md      # Third-party security assessment
    └── security-training-record.md    # Employee training tracking
```

---

## Technical Controls Implementation

The following technical controls have been implemented to support our compliance program:

| Control | Implementation | Documentation |
|---------|----------------|---------------|
| Multi-Factor Authentication | TOTP with backup codes | [Technical Design](../technical/mfa-authentication.md) |
| PHI Encryption | AES-256-GCM with AWS KMS | [Technical Design](../technical/phi-encryption.md) |
| Session Management | 30-min timeout, concurrent limits | [Technical Design](../technical/session-management.md) |
| Password Policy | 12+ chars, history, expiration | `src/lib/auth/password-policy.ts` |
| Audit Logging | Hash-chain integrity | `src/lib/audit/` |
| Rate Limiting | Redis-based sliding window | `src/lib/rate-limiting/` |
| Security Logging | Pino + Sentry | `src/lib/logging/` |

---

## HIPAA Compliance Matrix

| HIPAA Requirement | Policy | Technical Implementation |
|-------------------|--------|-------------------------|
| §164.308(a)(1) Security Management | Security Policy | Risk assessment, audit logs |
| §164.308(a)(3) Workforce Security | Workforce Security Policy | Background checks, training |
| §164.308(a)(4) Access Management | Access Control Policy | RBAC, access reviews |
| §164.308(a)(5) Security Training | Workforce Security Policy | Training program |
| §164.308(a)(6) Security Incidents | Breach Notification Policy | Incident response |
| §164.308(a)(7) Contingency Plan | Disaster Recovery Policy | Backups, DR procedures |
| §164.310(a)(1) Facility Access | Access Control Policy | Physical security |
| §164.310(d)(1) Device Controls | Workforce Security Policy | Workstation security |
| §164.312(a)(1) Access Control | Access Control Policy | MFA, session management |
| §164.312(b) Audit Controls | Security Policy | Audit logging |
| §164.312(c)(1) Integrity | Security Policy | Hash-chain audit logs |
| §164.312(d) Authentication | Access Control Policy | MFA, password policy |
| §164.312(e)(1) Transmission Security | Security Policy | TLS 1.3, encrypted fields |

---

## SOC 2 Trust Service Criteria Matrix

| Criteria | Description | Policy/Control |
|----------|-------------|----------------|
| **CC1** | Control Environment | All policies |
| **CC2** | Communication | Training, policy acknowledgments |
| **CC3** | Risk Assessment | Security Policy, vendor assessment |
| **CC4** | Monitoring | Audit logging, security monitoring |
| **CC5** | Control Activities | All technical controls |
| **CC6** | Logical Access | Access Control Policy, MFA |
| **CC7** | System Operations | DR Policy, incident response |
| **CC8** | Change Management | Git-based deployments |
| **CC9** | Risk Mitigation | All policies |
| **A1** | Availability | Disaster Recovery Policy |
| **C1** | Confidentiality | Privacy Policy, encryption |

---

## Compliance Calendar

| Activity | Frequency | Owner | Month |
|----------|-----------|-------|-------|
| Access Reviews | Quarterly | Admin + Security | Mar, Jun, Sep, Dec |
| Vulnerability Scans | Monthly | DevOps | All |
| Penetration Testing | Annual | External Vendor | TBD |
| DR Testing | Quarterly | DevOps | Mar, Jun, Sep, Dec |
| Policy Review | Annual | Security + Legal | January |
| Security Training | Annual | All Staff | Hire date anniversary |
| Risk Assessment | Annual | Security Lead | January |
| Vendor Reviews | Annual | Security | Ongoing |
| Audit Log Review | Daily | Automated | All |

---

## Document Control

### Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-01 | Security Team | Initial release |

### Review and Approval

All policies must be:
1. Reviewed annually
2. Updated when significant changes occur
3. Approved by appropriate stakeholders
4. Communicated to affected personnel

### Document Retention

| Document Type | Retention Period |
|---------------|------------------|
| Policies | Current + 2 versions |
| Training Records | 6 years |
| Audit Logs | 6 years |
| Incident Reports | 6 years |
| BAAs | Duration of relationship + 6 years |

---

## Quick Reference Contacts

| Role | Responsibility |
|------|----------------|
| **Security Lead** | Security policy, incident response, risk assessment |
| **Privacy Officer** | PHI handling, breach notification, individual rights |
| **DevOps Lead** | Infrastructure security, DR, system monitoring |
| **HR Director** | Training, background checks, workforce security |
| **Legal Counsel** | BAAs, contracts, regulatory compliance |

---

## Getting Started

### For New Employees

1. Complete initial security training (within 30 days)
2. Acknowledge all policies
3. Set up MFA on your account
4. Review the Workforce Security Policy

### For Developers

1. Review the Security Policy
2. Understand PHI encryption implementation
3. Follow secure coding guidelines
4. Use the audit logging service

### For Administrators

1. Review Access Control Policy
2. Understand MFA enforcement rules
3. Know the incident response procedures
4. Conduct quarterly access reviews

---

## Questions or Concerns

For questions about compliance:
- Email: security@scrybe.app
- Slack: #security-questions

To report a security incident:
- See [Incident Response Runbook](./runbooks/incident-response.md)
- Emergency: Contact Security Lead directly
