/**
 * Storage Module - Unified exports for S3 and local storage
 *
 * Provides HIPAA/SOC 2 compliant storage operations with:
 * - KMS encryption for all uploads
 * - Short-lived presigned URLs
 * - Multi-bucket support for different data types
 * - Audit logging integration
 *
 * @module lib/storage
 */

// =============================================================================
// SECURE S3 OPERATIONS (Recommended for new code)
// =============================================================================

export {
  // Upload/Download operations
  secureUpload,
  secureDownload,
  secureDelete,
  getSecureUploadUrl,
  getSecureDownloadUrl,

  // Utility operations
  objectExists,
  getObjectMetadata,
  listObjects,
  copyObject,

  // Key generation helpers
  generateUploadKey,
  generateRecordingKey,
  generateExportKey,
  generateAuditLogKey,

  // Configuration and health checks
  initializeSecureS3,
  isSecureS3Configured,
  getSecureS3Status,

  // Types
  S3BucketType,
  type SecureUploadOptions,
  type PresignedUrlOptions,
  type UploadResult,
  type DownloadResult,
  type SecureS3Config,
} from "./secure-s3";

// =============================================================================
// LEGACY S3 OPERATIONS (For backward compatibility)
// =============================================================================

export {
  // Client access
  getS3Client,
  getBucketName,
  isS3Configured,

  // Recording-specific operations
  getRecordingKey,
  uploadRecording,
  getSignedRecordingUrl,
  downloadRecording,
  deleteRecording,
  recordingExists,
  transferRecordingToS3,
} from "./s3";
