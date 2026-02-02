# Vendor Security Assessment Template

**Vendor Name:** _______________________
**Assessment Date:** _______________________
**Assessor:** _______________________
**Next Review Date:** _______________________

---

## 1. Vendor Information

| Field | Information |
|-------|-------------|
| **Company Name** | |
| **Primary Contact** | |
| **Contact Email** | |
| **Service Provided** | |
| **Contract Start Date** | |
| **Contract End Date** | |
| **BAA Required** | Yes / No |
| **BAA Signed** | Yes / No / N/A |

---

## 2. Data Handling

### 2.1 Data Access

| Question | Response | Notes |
|----------|----------|-------|
| Will vendor access PHI? | Yes / No | |
| Will vendor store PHI? | Yes / No | |
| Will vendor process PHI? | Yes / No | |
| Will vendor transmit PHI? | Yes / No | |

### 2.2 Data Categories Accessed

- [ ] Names
- [ ] Social Security Numbers
- [ ] Dates of Birth
- [ ] Addresses
- [ ] Phone Numbers
- [ ] Email Addresses
- [ ] Health Information
- [ ] Insurance Information
- [ ] Financial Information
- [ ] Other: _______

### 2.3 Data Flow

Describe how data flows to/from vendor:
```
[Your system] → [Vendor API] → [Vendor storage] → [Return]
```

---

## 3. Security Controls Assessment

### 3.1 Compliance & Certifications

| Certification | Status | Expiration | Evidence |
|---------------|--------|------------|----------|
| SOC 2 Type II | ☐ Yes ☐ No ☐ In Progress | | |
| ISO 27001 | ☐ Yes ☐ No ☐ In Progress | | |
| HIPAA Compliant | ☐ Yes ☐ No ☐ N/A | | |
| PCI DSS | ☐ Yes ☐ No ☐ N/A | | |
| FedRAMP | ☐ Yes ☐ No ☐ N/A | | |

### 3.2 Access Control

| Control | Implemented | Notes |
|---------|-------------|-------|
| Unique user accounts | ☐ Yes ☐ No | |
| Multi-factor authentication | ☐ Yes ☐ No | |
| Role-based access control | ☐ Yes ☐ No | |
| Access logging | ☐ Yes ☐ No | |
| Regular access reviews | ☐ Yes ☐ No | |
| Privileged access management | ☐ Yes ☐ No | |

### 3.3 Data Protection

| Control | Implemented | Notes |
|---------|-------------|-------|
| Encryption at rest | ☐ Yes ☐ No | Algorithm: |
| Encryption in transit | ☐ Yes ☐ No | Protocol: |
| Key management | ☐ Yes ☐ No | |
| Data masking/tokenization | ☐ Yes ☐ No | |
| Data retention policy | ☐ Yes ☐ No | |
| Secure deletion | ☐ Yes ☐ No | |

### 3.4 Infrastructure Security

| Control | Implemented | Notes |
|---------|-------------|-------|
| Firewall protection | ☐ Yes ☐ No | |
| Intrusion detection/prevention | ☐ Yes ☐ No | |
| DDoS protection | ☐ Yes ☐ No | |
| Vulnerability scanning | ☐ Yes ☐ No | Frequency: |
| Penetration testing | ☐ Yes ☐ No | Last test: |
| Security patching | ☐ Yes ☐ No | SLA: |

### 3.5 Business Continuity

| Control | Implemented | Notes |
|---------|-------------|-------|
| Documented DR plan | ☐ Yes ☐ No | |
| Regular backups | ☐ Yes ☐ No | Frequency: |
| Backup testing | ☐ Yes ☐ No | Last test: |
| Geographic redundancy | ☐ Yes ☐ No | |
| Defined RTO | ☐ Yes ☐ No | RTO: |
| Defined RPO | ☐ Yes ☐ No | RPO: |
| Uptime SLA | ☐ Yes ☐ No | SLA: |

### 3.6 Incident Response

| Control | Implemented | Notes |
|---------|-------------|-------|
| Incident response plan | ☐ Yes ☐ No | |
| Breach notification process | ☐ Yes ☐ No | Timeline: |
| 24/7 security monitoring | ☐ Yes ☐ No | |
| Security incident reporting | ☐ Yes ☐ No | |

### 3.7 Personnel Security

| Control | Implemented | Notes |
|---------|-------------|-------|
| Background checks | ☐ Yes ☐ No | |
| Security training | ☐ Yes ☐ No | Frequency: |
| Confidentiality agreements | ☐ Yes ☐ No | |
| Termination procedures | ☐ Yes ☐ No | |

---

## 4. Risk Assessment

### 4.1 Risk Rating

| Category | Rating (1-5) | Justification |
|----------|--------------|---------------|
| Data Sensitivity | | |
| Access Level | | |
| Business Criticality | | |
| Security Posture | | |
| **Overall Risk** | | |

**Rating Scale:**
1 = Minimal Risk
2 = Low Risk
3 = Moderate Risk
4 = High Risk
5 = Critical Risk

### 4.2 Identified Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| | High/Med/Low | High/Med/Low | |
| | | | |
| | | | |

### 4.3 Risk Acceptance

If overall risk > 3, requires approval:

| Approver | Signature | Date |
|----------|-----------|------|
| Security Lead | | |
| CTO (if risk > 4) | | |

---

## 5. Contractual Requirements

### 5.1 Required Agreements

| Document | Required | Signed | Date |
|----------|----------|--------|------|
| Business Associate Agreement | ☐ Yes ☐ No | ☐ Yes ☐ No | |
| Data Processing Agreement | ☐ Yes ☐ No | ☐ Yes ☐ No | |
| Non-Disclosure Agreement | ☐ Yes ☐ No | ☐ Yes ☐ No | |
| Master Service Agreement | ☐ Yes ☐ No | ☐ Yes ☐ No | |

### 5.2 Contract Terms Review

| Clause | Present | Acceptable | Notes |
|--------|---------|------------|-------|
| Breach notification timeline | ☐ | ☐ | |
| Data return/deletion | ☐ | ☐ | |
| Subcontractor restrictions | ☐ | ☐ | |
| Audit rights | ☐ | ☐ | |
| Liability/indemnification | ☐ | ☐ | |
| Termination procedures | ☐ | ☐ | |

---

## 6. Ongoing Monitoring

### 6.1 Monitoring Activities

| Activity | Frequency | Owner | Last Completed |
|----------|-----------|-------|----------------|
| Review SOC 2 report | Annual | | |
| Verify BAA currency | Annual | | |
| Review access logs | Quarterly | | |
| Security questionnaire | Annual | | |
| Contract review | Annual | | |

### 6.2 Automated Monitoring

| Metric | Monitoring Method | Alert Threshold |
|--------|-------------------|-----------------|
| Service availability | | |
| API response time | | |
| Error rates | | |
| Data access patterns | | |

---

## 7. Assessment Decision

### 7.1 Recommendation

☐ **Approved** - Vendor meets security requirements
☐ **Approved with Conditions** - See conditions below
☐ **Not Approved** - Security gaps too significant
☐ **More Information Required** - See questions below

### 7.2 Conditions (if applicable)

1.
2.
3.

### 7.3 Outstanding Questions

1.
2.
3.

---

## 8. Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Assessor | | | |
| Security Lead | | | |
| Legal (if BAA) | | | |
| Budget Owner | | | |

---

## Attachments

- [ ] SOC 2 Report
- [ ] Signed BAA
- [ ] Security questionnaire responses
- [ ] Architecture diagram
- [ ] Data flow diagram
- [ ] Certificate of insurance
