// Audit log types for hash-chain ledger

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "EXPORT"
  | "PUBLISH"
  | "UNPUBLISH"
  | "SUBMIT"
  | "APPROVE"
  | "REJECT"
  | "ASSIGN"
  | "UNASSIGN"
  | "LOGIN"
  | "LOGOUT"
  | "UPLOAD"
  | "DOWNLOAD"
  | "SCAN"
  | "EXTRACT"
  | "GENERATE_SHEET"
  | "PROCESS_ATTENDANCE"
  | "CONFIRM_ATTENDANCE"
  | "OVERRIDE_ATTENDANCE"
  | "QUICK_ENROLL"
  | "SHARE"
  | "REVOKE"
  | "ARCHIVE";

export type AuditResource =
  | "FORM"
  | "FORM_VERSION"
  | "FORM_FIELD"
  | "SUBMISSION"
  | "CLIENT"
  | "CLIENT_SHARE"
  | "CLIENT_GOAL"
  | "USER"
  | "ORGANIZATION"
  | "FILE"
  | "CALL"
  | "NOTE"
  | "MESSAGE"
  | "REPORT"
  | "SETTING"
  | "ATTENDANCE_UPLOAD"
  | "ATTENDANCE_RECORD"
  | "ATTENDANCE_SHEET"
  | "EMAIL"
  | "IN_PERSON_RECORDING"
  | "GOAL"
  | "KPI";

export interface AuditLogEntry {
  id: string;
  orgId: string;
  userId: string | null;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  resourceName?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  previousHash: string;
  hash: string;
  timestamp: Date;
}

export interface AuditLogCreateInput {
  orgId: string;
  userId?: string | null;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilter {
  orgId: string;
  userId?: string;
  action?: AuditAction;
  resource?: AuditResource;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditChainVerification {
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenAt?: {
    entryId: string;
    position: number;
    expectedHash: string;
    actualHash: string;
  };
}

export interface ComplianceReport {
  id: string;
  orgId: string;
  reportType: ComplianceReportType;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  generatedById: string;
  data: ComplianceReportData;
  hash: string;
}

export type ComplianceReportType =
  | "ACTIVITY_SUMMARY"
  | "DATA_ACCESS"
  | "USER_ACTIVITY"
  | "FORM_SUBMISSIONS"
  | "FILE_AUDIT"
  | "CHAIN_INTEGRITY";

export interface ComplianceReportData {
  summary: Record<string, unknown>;
  details: unknown[];
  metadata: {
    generatedAt: string;
    reportVersion: string;
    filters: Record<string, unknown>;
  };
}

// Compliance standards
export type ComplianceStandard = "HIPAA" | "SOC2" | "GDPR" | "CCPA" | "FERPA";

export interface ComplianceConfig {
  standard: ComplianceStandard;
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  category: string;
  checkFunction: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

// Data retention policies
export interface RetentionPolicy {
  resource: AuditResource;
  retentionDays: number;
  archiveAfterDays?: number;
  deleteAfterDays?: number;
}

export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  { resource: "SUBMISSION", retentionDays: 2555, archiveAfterDays: 365 }, // 7 years
  { resource: "FILE", retentionDays: 2555, archiveAfterDays: 365 },
  { resource: "CALL", retentionDays: 2555, archiveAfterDays: 365 },
  { resource: "IN_PERSON_RECORDING", retentionDays: 2555, archiveAfterDays: 365 }, // Same as calls
  { resource: "FORM", retentionDays: 2555 },
  { resource: "USER", retentionDays: 2555 },
  { resource: "CLIENT", retentionDays: 2555 },
];
