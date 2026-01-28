import {
  getS3Client,
  getBucketName,
  isS3Configured,
} from "@/lib/storage/s3";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ============================================
// KEY GENERATION
// ============================================

/**
 * Generate S3 key for attendance sheet PDF
 */
export function getAttendanceSheetKey(
  orgId: string,
  uploadId: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `attendance/sheets/${orgId}/${year}/${month}/${uploadId}.pdf`;
}

/**
 * Generate S3 key for attendance photo
 */
export function getAttendancePhotoKey(
  orgId: string,
  uploadId: string,
  extension: string = "jpg"
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `attendance/photos/${orgId}/${year}/${month}/${uploadId}.${extension}`;
}

/**
 * Generate S3 key for enhanced attendance photo
 */
export function getEnhancedPhotoKey(
  orgId: string,
  uploadId: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `attendance/photos/${orgId}/${year}/${month}/${uploadId}-enhanced.jpg`;
}

// ============================================
// SHEET STORAGE
// ============================================

/**
 * Upload attendance sheet PDF to S3
 */
export async function uploadAttendanceSheet(
  orgId: string,
  uploadId: string,
  pdfBuffer: Buffer,
  fileName: string
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const client = getS3Client();
  const bucket = getBucketName();
  const key = getAttendanceSheetKey(orgId, uploadId);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      ContentDisposition: `inline; filename="${fileName}"`,
      // Server-side encryption with AWS KMS for HIPAA compliance
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
      Metadata: {
        "upload-id": uploadId,
        "org-id": orgId,
        "upload-time": new Date().toISOString(),
        type: "attendance-sheet",
      },
    })
  );

  return key;
}

/**
 * Get signed URL for downloading attendance sheet
 */
export async function getAttendanceSheetUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const client = getS3Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// ============================================
// PHOTO STORAGE
// ============================================

/**
 * Upload attendance photo to S3
 */
export async function uploadAttendancePhoto(
  orgId: string,
  uploadId: string,
  photoBuffer: Buffer,
  mimeType: string
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const client = getS3Client();
  const bucket = getBucketName();

  // Determine extension from mime type
  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const extension = extensionMap[mimeType] || "jpg";
  const key = getAttendancePhotoKey(orgId, uploadId, extension);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: photoBuffer,
      ContentType: mimeType,
      // Server-side encryption with AWS KMS for HIPAA compliance
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
      Metadata: {
        "upload-id": uploadId,
        "org-id": orgId,
        "upload-time": new Date().toISOString(),
        type: "attendance-photo",
      },
    })
  );

  return key;
}

/**
 * Upload enhanced attendance photo to S3
 */
export async function uploadEnhancedPhoto(
  orgId: string,
  uploadId: string,
  photoBuffer: Buffer
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const client = getS3Client();
  const bucket = getBucketName();
  const key = getEnhancedPhotoKey(orgId, uploadId);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: photoBuffer,
      ContentType: "image/jpeg",
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
      Metadata: {
        "upload-id": uploadId,
        "org-id": orgId,
        "upload-time": new Date().toISOString(),
        type: "attendance-photo-enhanced",
      },
    })
  );

  return key;
}

/**
 * Get signed URL for viewing attendance photo
 */
export async function getAttendancePhotoUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const client = getS3Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Download attendance photo from S3
 */
export async function downloadAttendancePhoto(key: string): Promise<Buffer> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const client = getS3Client();
  const bucket = getBucketName();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error("No body in S3 response");
  }

  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Delete attendance files from S3
 */
export async function deleteAttendanceFiles(
  sheetKey?: string | null,
  photoKey?: string | null,
  enhancedPhotoKey?: string | null
): Promise<void> {
  if (!isS3Configured()) {
    return;
  }

  const client = getS3Client();
  const bucket = getBucketName();

  const keys = [sheetKey, photoKey, enhancedPhotoKey].filter(Boolean) as string[];

  await Promise.all(
    keys.map((key) =>
      client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      )
    )
  );
}
