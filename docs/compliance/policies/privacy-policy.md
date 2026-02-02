# Privacy Policy - PHI Handling Procedures

**Document ID:** PRIV-POL-001
**Version:** 1.0
**Effective Date:** February 1, 2026
**Review Date:** February 1, 2027
**Owner:** Privacy Officer

---

## 1. Purpose

This policy establishes procedures for the proper handling, use, and disclosure of Protected Health Information (PHI) in compliance with the HIPAA Privacy Rule (45 CFR Part 164, Subpart E).

## 2. Scope

This policy applies to all PHI:
- Collected through intake forms
- Captured during client calls
- Stored in the Scrybe platform
- Transmitted to or from the platform
- Disclosed to authorized parties

## 3. Definitions

| Term | Definition |
|------|------------|
| **PHI** | Individually identifiable health information transmitted or maintained in any form |
| **ePHI** | PHI in electronic format |
| **Covered Entity** | Healthcare providers, health plans, clearinghouses using Scrybe |
| **Business Associate** | Scrybe, as a service provider handling PHI on behalf of Covered Entities |
| **Minimum Necessary** | Limiting PHI access to the minimum needed for the intended purpose |

## 4. PHI Categories in Scrybe

### 4.1 Data Collected

| Category | Examples | Encrypted |
|----------|----------|-----------|
| **Identifiers** | Name, SSN, DOB, address, phone, email | Yes |
| **Health Information** | Diagnoses, conditions, medications, treatment | Yes |
| **Financial** | Insurance info, income, benefits | Yes |
| **Service Records** | Case notes, form submissions, call transcripts | Yes |

### 4.2 Encrypted Fields

The following fields are encrypted at the application layer using AES-256-GCM:

```
FormSubmission.data         - Form field values with PHI
FormSubmission.aiExtractedData - AI-extracted data from calls
Note.content                - Rich text HTML content
Call.transcriptRaw          - Raw call transcript
Call.transcriptJson         - Structured transcript
Call.extractedFields        - AI-extracted form fields
Call.aiSummary              - AI-generated summary
Message.content             - Message text
```

## 5. PHI Handling Requirements

### 5.1 Collection

- Collect only PHI necessary for the intended purpose
- Obtain consent when required
- Provide privacy notices to clients
- Document the purpose for collection

### 5.2 Access

| Role | Access Level |
|------|--------------|
| **Admin** | Full access to organization data |
| **Program Manager** | Program-level access |
| **Case Manager** | Assigned clients only |
| **Viewer** | Read-only, assigned clients |

### 5.3 Use

PHI may only be used for:
- Treatment, payment, and healthcare operations (TPO)
- Purposes authorized by the individual
- Purposes required or permitted by law
- Public health activities
- Research (with proper authorization/waiver)

### 5.4 Disclosure

Before disclosing PHI:
1. Verify the requestor's identity and authority
2. Confirm minimum necessary applies
3. Document the disclosure in the audit log
4. Obtain authorization if required

### 5.5 Minimum Necessary Standard

| Situation | Requirement |
|-----------|-------------|
| **Routine requests** | Follow established policies for role-based access |
| **Non-routine requests** | Individual review for each request |
| **Research** | Limited data set or de-identified when possible |

## 6. Individual Rights

Scrybe must support Covered Entities in honoring these rights:

| Right | Implementation |
|-------|----------------|
| **Access** | Export functionality for client records |
| **Amendment** | Edit capability with audit trail |
| **Accounting of Disclosures** | Audit log reports |
| **Restriction Request** | Configurable access controls |
| **Confidential Communications** | Secure messaging, encrypted calls |

## 7. Business Associate Obligations

As a Business Associate, Scrybe will:

1. **Use PHI only as permitted** by the BAA or required by law
2. **Implement safeguards** to prevent unauthorized use/disclosure
3. **Report breaches** to the Covered Entity within 24 hours
4. **Ensure subcontractors** agree to the same restrictions (sub-BAAs)
5. **Return or destroy PHI** upon contract termination
6. **Make records available** for HHS compliance investigations
7. **Maintain audit logs** for 6 years

## 8. De-identification

When PHI must be shared for analytics or research:

### 8.1 Safe Harbor Method

Remove all 18 HIPAA identifiers:
1. Names
2. Geographic data smaller than state
3. Dates (except year) related to individual
4. Phone numbers
5. Fax numbers
6. Email addresses
7. Social Security numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers
13. Device identifiers
14. Web URLs
15. IP addresses
16. Biometric identifiers
17. Full-face photographs
18. Any other unique identifying characteristic

### 8.2 Expert Determination

Statistical/scientific methods certified by an expert that risk of re-identification is very small.

## 9. Retention and Disposal

| Data Type | Retention Period | Disposal Method |
|-----------|------------------|-----------------|
| **Active Client Records** | Duration of service + 6 years | Secure deletion |
| **Audit Logs** | 6 years | Secure archival then deletion |
| **Backups** | 30 days (daily), 1 year (weekly) | Automated rotation |

### 9.1 Secure Disposal

- Electronic: Cryptographic erasure (delete DEK)
- Paper: Cross-cut shredding (if any printed)
- Media: Certified destruction

## 10. Training

All workforce members must complete:
- Initial HIPAA privacy training within 30 days of hire
- Annual refresher training
- Role-specific training for PHI handlers

## 11. Violations

Report suspected privacy violations immediately to:
- Privacy Officer
- Security Lead
- Through the incident reporting system

---

**Approval:**

| Name | Title | Signature | Date |
|------|-------|-----------|------|
| _________________ | Privacy Officer | _________________ | ________ |
| _________________ | CEO | _________________ | ________ |
