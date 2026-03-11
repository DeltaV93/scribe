/**
 * PHI (Protected Health Information) Access Logging
 * HIPAA-compliant logging for all PHI access events
 */

import { logEnhancedAudit } from "./enhanced-logger";
import { AuditEventType, AuditSeverity, PHIAccessAction, AuditGeolocation } from "./events";

interface PHIAccessParams {
  orgId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  geolocation?: AuditGeolocation;
  sessionId?: string;
}

interface SubmissionAccessParams extends PHIAccessParams {
  submissionId: string;
  formId: string;
  formName?: string;
  fieldsAccessed?: string[];
  sensitiveFieldsAccessed?: string[];
  clientId?: string;
}

interface ClientAccessParams extends PHIAccessParams {
  clientId: string;
  clientName?: string;
  fieldsAccessed?: string[];
}

interface CallRecordingParams extends PHIAccessParams {
  callId: string;
  clientId?: string;
  durationSeconds?: number;
}

interface ReportParams extends PHIAccessParams {
  reportId: string;
  reportType: string;
  recordCount?: number;
  format?: string;
}

interface BulkExportParams extends PHIAccessParams {
  exportType: string;
  recordCount: number;
  format: string;
  filters?: Record<string, unknown>;
}

export const PHILogger = {
  // Form Submission Access
  async submissionViewed(params: SubmissionAccessParams) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.FORM_SUBMISSION_VIEW,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "FormSubmission",
      resourceId: params.submissionId,
      resourceName: params.formName,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        formId: params.formId,
        fieldsAccessed: params.fieldsAccessed,
        sensitiveFieldsAccessed: params.sensitiveFieldsAccessed,
        clientId: params.clientId,
      },
    });
  },

  async submissionEdited(params: SubmissionAccessParams & { changedFields?: string[] }) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.FORM_SUBMISSION_EDIT,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "FormSubmission",
      resourceId: params.submissionId,
      resourceName: params.formName,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        formId: params.formId,
        changedFields: params.changedFields,
        sensitiveFieldsAccessed: params.sensitiveFieldsAccessed,
        clientId: params.clientId,
      },
    });
  },

  async submissionExported(params: SubmissionAccessParams & { format: string }) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.FORM_SUBMISSION_EXPORT,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "FormSubmission",
      resourceId: params.submissionId,
      resourceName: params.formName,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        formId: params.formId,
        exportFormat: params.format,
        fieldsAccessed: params.fieldsAccessed,
        sensitiveFieldsAccessed: params.sensitiveFieldsAccessed,
        clientId: params.clientId,
      },
    });
  },

  // Client Record Access
  async clientRecordViewed(params: ClientAccessParams) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.CLIENT_RECORD_VIEW,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "Client",
      resourceId: params.clientId,
      resourceName: params.clientName,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        fieldsAccessed: params.fieldsAccessed,
      },
    });
  },

  async clientRecordEdited(params: ClientAccessParams & { changedFields?: string[] }) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.CLIENT_RECORD_EDIT,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "Client",
      resourceId: params.clientId,
      resourceName: params.clientName,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        changedFields: params.changedFields,
      },
    });
  },

  async clientRecordExported(params: ClientAccessParams & { format: string; recordCount?: number }) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.CLIENT_RECORD_EXPORT,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "Client",
      resourceId: params.clientId,
      resourceName: params.clientName,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        format: params.format,
        recordCount: params.recordCount,
      },
    });
  },

  // Call Recording Access
  async callRecordingPlayed(params: CallRecordingParams) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.CALL_RECORDING_PLAY,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "CallRecording",
      resourceId: params.callId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        clientId: params.clientId,
        playbackDurationSeconds: params.durationSeconds,
      },
    });
  },

  async callRecordingDownloaded(params: CallRecordingParams) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.CALL_RECORDING_DOWNLOAD,
      severity: AuditSeverity.CRITICAL,
      orgId: params.orgId,
      userId: params.userId,
      resource: "CallRecording",
      resourceId: params.callId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        clientId: params.clientId,
      },
    });
  },

  // Transcript Access
  async transcriptViewed(params: CallRecordingParams) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.TRANSCRIPT_VIEW,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "Transcript",
      resourceId: params.callId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        clientId: params.clientId,
      },
    });
  },

  // Report Access
  async reportGenerated(params: ReportParams) {
    return logEnhancedAudit({
      eventType: AuditEventType.PHI_ACCESS,
      action: PHIAccessAction.REPORT_GENERATE,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "Report",
      resourceId: params.reportId,
      resourceName: params.reportType,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        reportType: params.reportType,
        recordCount: params.recordCount,
        format: params.format,
      },
    });
  },

  // Bulk Export
  async bulkExport(params: BulkExportParams) {
    return logEnhancedAudit({
      eventType: AuditEventType.DATA_EXPORT,
      action: PHIAccessAction.BULK_EXPORT,
      severity: AuditSeverity.CRITICAL,
      orgId: params.orgId,
      userId: params.userId,
      resource: "BulkExport",
      resourceId: `export-${Date.now()}`,
      resourceName: params.exportType,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
      metadata: {
        exportType: params.exportType,
        recordCount: params.recordCount,
        format: params.format,
        filters: params.filters,
      },
    });
  },
};
