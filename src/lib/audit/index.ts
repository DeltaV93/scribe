// Audit module exports

export {
  createAuditLog,
  queryAuditLogs,
  verifyAuditChain,
  getIntegrityProof,
  getAuditStats,
  AuditLogger,
} from "./service";

export {
  calculateEntryHash,
  verifyEntry,
  verifyChain,
  getGenesisHash,
  createSignedEntry,
  generateIntegrityProof,
  verifyIntegrityProof,
} from "./hash-chain";

export {
  generateComplianceReport,
  getComplianceReport,
  listComplianceReports,
  verifyReportIntegrity,
  exportReportToCSV,
} from "./reports";

export type {
  AuditAction,
  AuditResource,
  AuditLogEntry,
  AuditLogCreateInput,
  AuditLogFilter,
  AuditChainVerification,
  ComplianceReport,
  ComplianceReportType,
  ComplianceReportData,
  ComplianceStandard,
  ComplianceConfig,
  ComplianceRequirement,
  RetentionPolicy,
} from "./types";

export { DEFAULT_RETENTION_POLICIES } from "./types";
