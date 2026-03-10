/**
 * Recording Module (PX-865)
 * Exports for web recording and upload functionality
 */

export {
  WebRecorder,
  getRecorder,
  resetRecorder,
  isRecordingSupported,
  getBestMimeType,
  requestMicrophonePermission,
  type WebRecorderConfig,
  type RecordingState,
  type RecorderResult,
} from "./web-recorder";

export {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  uploadRecording,
  uploadToPresignedUrl,
  generateRecordingKey,
  calculateRetentionDate,
  type PresignedUploadUrl,
  type PresignedDownloadUrl,
} from "./upload";
