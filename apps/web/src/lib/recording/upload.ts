/**
 * Recording Upload Service (PX-865)
 * Handles S3 presigned URL upload for recordings
 *
 * Security: Uses secure-s3 module for KMS encryption (PX-953, PX-981)
 */

import {
  S3BucketType,
  secureUpload,
  getSecureUploadUrl,
  getSecureDownloadUrl,
  generateRecordingKey as generateSecureRecordingKey,
} from "@/lib/storage/secure-s3";

export interface PresignedUploadUrl {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

export interface PresignedDownloadUrl {
  downloadUrl: string;
  expiresAt: Date;
}

/**
 * Generate S3 key for conversation recording
 * Uses secure-s3 key format with date partitioning
 */
export function generateRecordingKey(
  orgId: string,
  conversationId: string,
  extension: string = "webm"
): string {
  return generateSecureRecordingKey(orgId, conversationId, extension);
}

/**
 * Get a presigned URL for uploading a recording directly to S3
 * Uses KMS encryption via secure-s3 module (PX-953, PX-981)
 */
export async function getPresignedUploadUrl(
  orgId: string,
  conversationId: string,
  contentType: string = "audio/webm",
  expiresIn: number = 3600 // 1 hour default
): Promise<PresignedUploadUrl> {
  // Strip codec suffix (e.g., "webm;codecs=opus" → "webm")
  const extension = contentType.split("/")[1]?.split(";")[0] || "webm";
  const key = generateRecordingKey(orgId, conversationId, extension);

  // Uses KMS encryption via secure-s3 module
  const uploadUrl = await getSecureUploadUrl(
    S3BucketType.RECORDINGS,
    key,
    contentType,
    { expiresIn }
  );

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    uploadUrl,
    key,
    expiresAt,
  };
}

/**
 * Get a presigned URL for downloading/streaming a recording
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<PresignedDownloadUrl> {
  const downloadUrl = await getSecureDownloadUrl(
    S3BucketType.RECORDINGS,
    key,
    { expiresIn }
  );

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    downloadUrl,
    expiresAt,
  };
}

/**
 * Upload recording blob directly (server-side)
 * Uses KMS encryption via secure-s3 module (PX-953, PX-981)
 */
export async function uploadRecording(
  orgId: string,
  conversationId: string,
  blob: Blob | Buffer,
  contentType: string = "audio/webm"
): Promise<string> {
  // Strip codec suffix (e.g., "webm;codecs=opus" → "webm")
  const extension = contentType.split("/")[1]?.split(";")[0] || "webm";
  const key = generateRecordingKey(orgId, conversationId, extension);

  const body = blob instanceof Blob ? Buffer.from(await blob.arrayBuffer()) : blob;

  // Uses KMS encryption (ServerSideEncryption: "aws:kms")
  const result = await secureUpload(
    S3BucketType.RECORDINGS,
    key,
    body,
    { contentType }
  );

  if (!result.success) {
    throw new Error(`Failed to upload recording: ${result.error}`);
  }

  return key;
}

/**
 * Client-side upload using presigned URL
 * This function is designed to be called from the browser
 */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  blob: Blob,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.send(blob);
  });
}

/**
 * Calculate retention date based on org policy
 */
export function calculateRetentionDate(retentionDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + retentionDays);
  return date;
}
