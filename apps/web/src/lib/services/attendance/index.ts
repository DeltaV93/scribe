// Attendance Tracking Service
// Exports all attendance-related functionality

// Types
export * from "./types";

// Attendance Codes
export {
  getAttendanceCode,
  ensureAttendanceCode,
  generateAttendanceCodes,
  findEnrollmentByCode,
  getProgramAttendanceCodes,
  deleteAttendanceCode,
} from "./attendance-codes";

// Sheet Generation
export {
  getOrCreateSheetConfig,
  updateSheetConfig,
  generateAttendanceSheet,
  batchGenerateAttendanceSheets,
  regenerateAttendanceSheet,
  getAttendanceUpload,
  getSessionAttendanceUploads,
} from "./sheet-generation";

// Storage
export {
  getAttendanceSheetKey,
  getAttendancePhotoKey,
  getEnhancedPhotoKey,
  uploadAttendanceSheet,
  getAttendanceSheetUrl,
  uploadAttendancePhoto,
  uploadEnhancedPhoto,
  getAttendancePhotoUrl,
  downloadAttendancePhoto,
  deleteAttendanceFiles,
} from "./storage";

// Rate Limiting
export {
  checkUploadRateLimit,
  recordUploadForRateLimit,
  getRateLimitStatus,
  cleanupOldRateLimitRecords,
} from "./rate-limiting";

// Photo Upload
export {
  uploadAttendancePhotoForUpload,
  createUploadWithPhoto,
  getUploadWithUrls,
} from "./photo-upload";

// AI Recognition
export {
  extractAttendanceFromPhoto,
  processAttendanceUpload,
  retryFailedProcessing,
} from "./ai-recognition";

// Review Workflow
export {
  submitAttendanceReview,
  getUploadForReview,
  recordManualAttendance,
  skipAIProcessing,
} from "./review-workflow";

// Reports
export {
  getClientAttendanceReport,
  getSessionAttendanceReport,
  getProgramAttendanceReport,
  exportSessionAttendanceCSV,
  exportProgramAttendanceCSV,
} from "./reports";

// Override Workflow
export {
  requestAttendanceOverride,
  approveAttendanceOverride,
  rejectAttendanceOverride,
  getPendingOverrideRequests,
  editConfirmedAttendance,
} from "./override-workflow";

// Quick Enroll
export {
  quickEnrollClient,
  searchClientsForQuickEnroll,
  quickCreateAndEnroll,
} from "./quick-enroll";
