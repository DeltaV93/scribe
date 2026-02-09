// File processing module exports
export {
  processFileUpload,
  getFileById,
  getFileDownloadUrl,
  deleteFileById,
  listFiles,
  getFileExtractedText,
  rescanFile,
} from "./service";

export {
  uploadFile,
  getDownloadUrl,
  getFileContent,
  deleteFile,
  fileExists,
  getFileMetadata,
  generateStoragePath,
} from "./storage";

export {
  performFullScan,
  scanFile,
  quickHashScan,
  verifyFileSignature,
  calculateFileHash,
  SCAN_CONFIG,
} from "./scanner";

export {
  extractText,
  extractTextFromPDF,
  extractTextFromDOCX,
  extractTextFromPlainText,
  extractTextFromCSV,
} from "./extractor";

export {
  type FileUploadResult,
  type ScanStatus,
  type ScanResult,
  type TextExtractionResult,
  type FileTypeConfig,
  FILE_TYPE_CONFIGS,
  getAllowedMimeTypes,
  getAllowedExtensions,
  getMaxFileSize,
  validateFileType,
  validateFileSize,
  formatFileSize,
} from "./types";

// Virus scanning with quarantine
export {
  uploadWithQuarantine,
  scanFile as virusScanFile,
  processQuarantinedFile,
  getQuarantineStatus,
  listQuarantinedFiles,
  retryFailedScans,
  cleanupOldQuarantinedFiles,
  getVirusScanStatus,
  isVirusScanEnabled,
  isScannerAvailable,
  QuarantineStatus,
  VIRUS_SCAN_CONFIG,
  type FileMetadata,
  type QuarantinedFile,
  type VirusScanResult,
  type QuarantineRecord,
} from "./virus-scan";
