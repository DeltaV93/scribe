/**
 * Recording Upload Service (PX-865)
 * Handles S3 presigned URL upload for recordings
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "inkra-recordings";

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
 */
export function generateRecordingKey(
  orgId: string,
  conversationId: string,
  extension: string = "webm"
): string {
  return `recordings/${orgId}/${conversationId}.${extension}`;
}

/**
 * Get a presigned URL for uploading a recording directly to S3
 */
export async function getPresignedUploadUrl(
  orgId: string,
  conversationId: string,
  contentType: string = "audio/webm",
  expiresIn: number = 3600 // 1 hour default
): Promise<PresignedUploadUrl> {
  const extension = contentType.split("/")[1] || "webm";
  const key = generateRecordingKey(orgId, conversationId, extension);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    // Note: Don't include ServerSideEncryption here for presigned URLs
    // The bucket's default encryption (SSE-S3) handles this automatically
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
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
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    downloadUrl,
    expiresAt,
  };
}

/**
 * Upload recording blob directly (server-side)
 */
export async function uploadRecording(
  orgId: string,
  conversationId: string,
  blob: Blob | Buffer,
  contentType: string = "audio/webm"
): Promise<string> {
  const extension = contentType.split("/")[1] || "webm";
  const key = generateRecordingKey(orgId, conversationId, extension);

  const body = blob instanceof Blob ? Buffer.from(await blob.arrayBuffer()) : blob;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  });

  await s3Client.send(command);

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
