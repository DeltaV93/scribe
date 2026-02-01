/**
 * Enhanced Audit Event Types and Definitions for HIPAA Compliance
 */

export enum AuditEventType {
  AUTH = "AUTH",
  PHI_ACCESS = "PHI_ACCESS",
  ADMIN = "ADMIN",
  SYSTEM = "SYSTEM",
  DATA_EXPORT = "DATA_EXPORT",
  SECURITY = "SECURITY",
}

export enum AuditSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

// Authentication Events
export enum AuthAction {
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILURE = "LOGIN_FAILURE",
  LOGOUT = "LOGOUT",
  SESSION_TIMEOUT = "SESSION_TIMEOUT",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST",
  PASSWORD_RESET_COMPLETE = "PASSWORD_RESET_COMPLETE",
  MFA_SETUP = "MFA_SETUP",
  MFA_VERIFY = "MFA_VERIFY",
  MFA_RESET = "MFA_RESET",
  MFA_FAILURE = "MFA_FAILURE",
  ACCOUNT_LOCKOUT = "ACCOUNT_LOCKOUT",
  ACCOUNT_UNLOCK = "ACCOUNT_UNLOCK",
}

// PHI Access Events
export enum PHIAccessAction {
  FORM_SUBMISSION_VIEW = "FORM_SUBMISSION_VIEW",
  FORM_SUBMISSION_EDIT = "FORM_SUBMISSION_EDIT",
  FORM_SUBMISSION_EXPORT = "FORM_SUBMISSION_EXPORT",
  CLIENT_RECORD_VIEW = "CLIENT_RECORD_VIEW",
  CLIENT_RECORD_EDIT = "CLIENT_RECORD_EDIT",
  CLIENT_RECORD_EXPORT = "CLIENT_RECORD_EXPORT",
  CALL_RECORDING_PLAY = "CALL_RECORDING_PLAY",
  CALL_RECORDING_DOWNLOAD = "CALL_RECORDING_DOWNLOAD",
  TRANSCRIPT_VIEW = "TRANSCRIPT_VIEW",
  REPORT_GENERATE = "REPORT_GENERATE",
  BULK_EXPORT = "BULK_EXPORT",
}

// Administrative Events
export enum AdminAction {
  USER_CREATE = "USER_CREATE",
  USER_UPDATE = "USER_UPDATE",
  USER_DELETE = "USER_DELETE",
  ROLE_ASSIGN = "ROLE_ASSIGN",
  PERMISSION_GRANT = "PERMISSION_GRANT",
  ORG_SETTINGS_UPDATE = "ORG_SETTINGS_UPDATE",
  AUDIT_EXPORT = "AUDIT_EXPORT",
}

// System Events
export enum SystemAction {
  SYSTEM_STARTUP = "SYSTEM_STARTUP",
  SYSTEM_SHUTDOWN = "SYSTEM_SHUTDOWN",
  BACKUP_CREATED = "BACKUP_CREATED",
  BACKUP_RESTORED = "BACKUP_RESTORED",
}

// Security Events
export enum SecurityAction {
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  UNAUTHORIZED_ACCESS_ATTEMPT = "UNAUTHORIZED_ACCESS_ATTEMPT",
  DATA_BREACH_DETECTED = "DATA_BREACH_DETECTED",
}

// Geolocation interface
export interface AuditGeolocation {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

// Metadata interfaces
export interface PHIAccessMetadata {
  fieldsAccessed?: string[];
  accessReason?: string;
  recordCount?: number;
  exportFormat?: string;
  sensitiveFieldsAccessed?: string[];
}

export interface AuthEventMetadata {
  failureReason?: string;
  failedAttempts?: number;
  mfaMethod?: string;
  lockoutDurationMinutes?: number;
}

export interface AdminEventMetadata {
  targetUserId?: string;
  targetEmail?: string;
  previousRole?: string;
  newRole?: string;
  changedFields?: string[];
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export interface EnhancedAuditEvent {
  eventType: AuditEventType;
  action: string;
  severity: AuditSeverity;
  orgId: string;
  userId?: string | null;
  resource: string;
  resourceId: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  geolocation?: AuditGeolocation;
  sessionId?: string;
}

// Determine severity based on event type and action
export function determineSeverity(eventType: AuditEventType, action: string): AuditSeverity {
  // Critical events
  if (
    action === AuthAction.ACCOUNT_LOCKOUT ||
    action === PHIAccessAction.CALL_RECORDING_DOWNLOAD ||
    action === PHIAccessAction.BULK_EXPORT ||
    action === SecurityAction.DATA_BREACH_DETECTED
  ) {
    return AuditSeverity.CRITICAL;
  }

  // High severity events
  if (
    eventType === AuditEventType.PHI_ACCESS ||
    action === AuthAction.LOGIN_FAILURE ||
    action === AuthAction.PASSWORD_CHANGE ||
    eventType === AuditEventType.ADMIN
  ) {
    return AuditSeverity.HIGH;
  }

  // Medium severity
  if (
    action === AuthAction.LOGIN_SUCCESS ||
    action === AuthAction.MFA_VERIFY
  ) {
    return AuditSeverity.MEDIUM;
  }

  return AuditSeverity.LOW;
}

// Check if event requires HIPAA retention
export function isHIPAARequired(eventType: AuditEventType): boolean {
  return [
    AuditEventType.AUTH,
    AuditEventType.PHI_ACCESS,
    AuditEventType.ADMIN,
    AuditEventType.DATA_EXPORT,
    AuditEventType.SECURITY,
  ].includes(eventType);
}

// HIPAA retention: 7 years
export const EVENT_RETENTION_YEARS: Record<AuditEventType, number> = {
  [AuditEventType.AUTH]: 7,
  [AuditEventType.PHI_ACCESS]: 7,
  [AuditEventType.ADMIN]: 7,
  [AuditEventType.SYSTEM]: 3,
  [AuditEventType.DATA_EXPORT]: 7,
  [AuditEventType.SECURITY]: 7,
};
