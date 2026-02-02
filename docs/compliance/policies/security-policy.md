# Information Security Policy

**Document ID:** SEC-POL-001
**Version:** 1.0
**Effective Date:** February 1, 2026
**Review Date:** February 1, 2027
**Owner:** Security Team

---

## 1. Purpose

This policy establishes the framework for protecting Scrybe's information assets, systems, and data from unauthorized access, disclosure, modification, or destruction. It ensures compliance with HIPAA Security Rule requirements and SOC 2 Trust Service Criteria.

## 2. Scope

This policy applies to:
- All employees, contractors, and third-party users
- All information systems, networks, and applications
- All data processed, stored, or transmitted by Scrybe
- All physical locations where Scrybe data is accessed

## 3. Policy Statements

### 3.1 Access Control

| Control | Requirement | HIPAA Reference |
|---------|-------------|-----------------|
| Unique User IDs | Every user must have a unique identifier | §164.312(a)(2)(i) |
| Authentication | Multi-factor authentication required for PHI access | §164.312(d) |
| Role-Based Access | Access granted based on job function (least privilege) | §164.312(a)(1) |
| Access Reviews | Quarterly review of all access permissions | §164.308(a)(4) |
| Automatic Logoff | 30-minute session timeout for PHI systems | §164.312(a)(2)(iii) |

### 3.2 Password Requirements

- Minimum 12 characters
- Must include uppercase, lowercase, numbers, and special characters
- Cannot reuse last 12 passwords
- Maximum age: 90 days
- Account lockout after 5 failed attempts (15-minute lockout)

### 3.3 Encryption

| Data State | Encryption Standard | Implementation |
|------------|---------------------|----------------|
| At Rest | AES-256-GCM | PHI fields encrypted at application layer |
| In Transit | TLS 1.3 | All API communications |
| Key Management | AWS KMS | Master key with per-org DEKs |

### 3.4 Audit Logging

All security-relevant events must be logged:
- Authentication events (success/failure)
- PHI access (view, edit, export)
- Administrative actions
- System configuration changes

Logs must be:
- Retained for 6 years (HIPAA requirement)
- Protected from modification (hash-chain integrity)
- Reviewed daily (automated alerts)

### 3.5 Network Security

- Web Application Firewall (WAF) enabled
- DDoS protection configured
- API rate limiting enforced
- Security headers implemented (CSP, HSTS, X-Frame-Options)

## 4. Roles and Responsibilities

| Role | Responsibilities |
|------|------------------|
| **Security Lead** | Policy oversight, risk assessment, incident response |
| **System Administrators** | Implement controls, maintain systems, monitor alerts |
| **Developers** | Secure coding practices, vulnerability remediation |
| **All Employees** | Follow policies, report incidents, complete training |

## 5. Compliance

### 5.1 HIPAA Security Rule Mapping

| HIPAA Requirement | Section |
|-------------------|---------|
| §164.308(a)(1) Security Management | 3.1, 3.4 |
| §164.308(a)(3) Workforce Security | 4.0 |
| §164.308(a)(4) Access Management | 3.1 |
| §164.308(a)(5) Security Training | Training Policy |
| §164.312(a)(1) Access Control | 3.1, 3.2 |
| §164.312(b) Audit Controls | 3.4 |
| §164.312(c)(1) Integrity | 3.3 |
| §164.312(d) Authentication | 3.1 |
| §164.312(e)(1) Transmission Security | 3.3 |

### 5.2 SOC 2 Trust Service Criteria Mapping

| Criteria | Section |
|----------|---------|
| CC6.1 Logical Access | 3.1, 3.2 |
| CC6.2 Access Provisioning | 3.1 |
| CC6.3 Access Removal | 3.1 |
| CC6.6 System Boundary Protection | 3.5 |
| CC6.7 Access Restrictions | 3.1 |
| CC7.2 System Monitoring | 3.4 |

## 6. Violations

Violations of this policy may result in:
- Disciplinary action up to termination
- Civil or criminal penalties under HIPAA
- Reporting to regulatory authorities

## 7. Review and Updates

This policy will be reviewed annually or when significant changes occur to:
- Regulations (HIPAA, state laws)
- Business operations
- Technology infrastructure
- Threat landscape

---

**Approval:**

| Name | Title | Signature | Date |
|------|-------|-----------|------|
| _________________ | CEO | _________________ | ________ |
| _________________ | Security Lead | _________________ | ________ |
