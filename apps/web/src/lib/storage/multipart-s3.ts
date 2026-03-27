/**
 * Multipart S3 Upload Module (PX-RECOVERY Phase 2)
 *
 * Provides resumable multipart uploads for large recordings.
 * Uses AWS S3 multipart upload API for:
 * - Resumable uploads (can continue from last successful part)
 * - Better reliability for large files (>100MB)
 * - Individual part failures don't lose entire upload
 *
 * @module lib/storage/multipart-s3
 */

import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  type CompletedPart,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ============================================================================
// Configuration
// ============================================================================

const RECORDINGS_BUCKET = process.env.AWS_S3_RECORDINGS_BUCKET || process.env.AWS_S3_BUCKET;
const KMS_KEY_ARN = process.env.AWS_KMS_KEY_ARN;

// Part size: 5MB minimum for S3, using 5MB for frequent uploads
export const PART_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Presigned URL expiry for part uploads (15 minutes)
const PART_URL_EXPIRY_SECONDS = 15 * 60;

// ============================================================================
// S3 Client
// ============================================================================

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.AWS_REGION || process.env.AWS_S3_REGION || "us-west-2";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials not configured");
    }

    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return s3Client;
}

function getBucket(): string {
  if (!RECORDINGS_BUCKET) {
    throw new Error("AWS_S3_RECORDINGS_BUCKET or AWS_S3_BUCKET not configured");
  }
  return RECORDINGS_BUCKET;
}

// ============================================================================
// Multipart Upload Types
// ============================================================================

export interface MultipartUploadInit {
  uploadId: string;
  key: string;
  bucket: string;
}

export interface PartUploadUrl {
  presignedUrl: string;
  partNumber: number;
  expiresAt: Date;
}

export interface CompletedPartInfo {
  partNumber: number;
  etag: string;
}

// ============================================================================
// Multipart Upload Functions
// ============================================================================

/**
 * Initiate a new multipart upload
 */
export async function initiateMultipartUpload(
  key: string,
  contentType: string = "audio/webm"
): Promise<MultipartUploadInit> {
  const client = getS3Client();
  const bucket = getBucket();

  const command = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    // KMS encryption for HIPAA compliance
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: KMS_KEY_ARN,
    Metadata: {
      "upload-type": "multipart",
      "initiated-at": new Date().toISOString(),
    },
  });

  const response = await client.send(command);

  if (!response.UploadId) {
    throw new Error("Failed to initiate multipart upload: no UploadId returned");
  }

  console.log(`[MultipartS3] Initiated upload: key=${key}, uploadId=${response.UploadId}`);

  return {
    uploadId: response.UploadId,
    key,
    bucket,
  };
}

/**
 * Get a presigned URL for uploading a specific part
 */
export async function getPartUploadUrl(
  key: string,
  uploadId: string,
  partNumber: number
): Promise<PartUploadUrl> {
  const client = getS3Client();
  const bucket = getBucket();

  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  const presignedUrl = await getSignedUrl(client, command, {
    expiresIn: PART_URL_EXPIRY_SECONDS,
  });

  const expiresAt = new Date(Date.now() + PART_URL_EXPIRY_SECONDS * 1000);

  return {
    presignedUrl,
    partNumber,
    expiresAt,
  };
}

/**
 * Complete a multipart upload
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPartInfo[]
): Promise<{ location: string; key: string }> {
  const client = getS3Client();
  const bucket = getBucket();

  // Sort parts by part number (required by S3)
  const sortedParts: CompletedPart[] = parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((p) => ({
      PartNumber: p.partNumber,
      ETag: p.etag,
    }));

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  });

  const response = await client.send(command);

  console.log(
    `[MultipartS3] Completed upload: key=${key}, uploadId=${uploadId}, parts=${parts.length}`
  );

  return {
    location: response.Location || `s3://${bucket}/${key}`,
    key,
  };
}

/**
 * Abort a multipart upload (cleanup failed uploads)
 */
export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const client = getS3Client();
  const bucket = getBucket();

  const command = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
  });

  await client.send(command);

  console.log(`[MultipartS3] Aborted upload: key=${key}, uploadId=${uploadId}`);
}

/**
 * List parts that have been uploaded for a multipart upload
 * Useful for resuming interrupted uploads
 */
export async function listUploadedParts(
  key: string,
  uploadId: string
): Promise<CompletedPartInfo[]> {
  const client = getS3Client();
  const bucket = getBucket();

  const parts: CompletedPartInfo[] = [];
  let partNumberMarker: string | undefined;

  // Paginate through all parts
  do {
    const command = new ListPartsCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumberMarker: partNumberMarker,
    });

    const response = await client.send(command);

    if (response.Parts) {
      for (const part of response.Parts) {
        if (part.PartNumber && part.ETag) {
          parts.push({
            partNumber: part.PartNumber,
            etag: part.ETag,
          });
        }
      }
    }

    if (response.IsTruncated && response.NextPartNumberMarker) {
      partNumberMarker = response.NextPartNumberMarker;
    } else {
      break;
    }
  } while (true);

  return parts;
}

/**
 * Calculate number of parts needed for a given size
 */
export function calculatePartCount(totalBytes: number): number {
  return Math.ceil(totalBytes / PART_SIZE_BYTES);
}

/**
 * Get byte range for a specific part
 */
export function getPartByteRange(
  partNumber: number,
  totalBytes: number
): { start: number; end: number } {
  const start = (partNumber - 1) * PART_SIZE_BYTES;
  const end = Math.min(start + PART_SIZE_BYTES, totalBytes);
  return { start, end };
}
