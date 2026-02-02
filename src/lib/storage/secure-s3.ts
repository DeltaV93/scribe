/**
 * Secure S3 Storage Module
 *
 * HIPAA/SOC 2 compliant S3 operations with:
 * - Enforced KMS encryption on all uploads
 * - Short-lived presigned URLs (1-4 hours max)
 * - Audit logging for all operations
 * - Multi-bucket support for different data types
 *
 * @module lib/storage/secure-s3
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ============================================
// CONFIGURATION
// ============================================

/**
 * S3 bucket types for different data categories
 */
export enum S3BucketType {
  UPLOADS = "uploads",
  RECORDINGS = "recordings",
  EXPORTS = "exports",
  BACKUPS = "backups",
  AUDIT_LOGS = "audit_logs",
}

/**
 * Presigned URL expiry limits by bucket type (in seconds)
 * Shorter expiry for sensitive data
 */
const PRESIGNED_URL_EXPIRY: Record<S3BucketType, number> = {
  [S3BucketType.UPLOADS]: 3600,      // 1 hour
  [S3BucketType.RECORDINGS]: 3600,   // 1 hour
  [S3BucketType.EXPORTS]: 14400,     // 4 hours (for large downloads)
  [S3BucketType.BACKUPS]: 1800,      // 30 minutes (sensitive)
  [S3BucketType.AUDIT_LOGS]: 1800,   // 30 minutes (compliance)
};

/**
 * Maximum presigned URL expiry (4 hours)
 */
const MAX_PRESIGNED_URL_EXPIRY = 14400;

/**
 * Minimum presigned URL expiry (5 minutes)
 */
const MIN_PRESIGNED_URL_EXPIRY = 300;

// ============================================
// TYPES
// ============================================

export interface SecureUploadOptions {
  contentType: string;
  metadata?: Record<string, string>;
  tagging?: Record<string, string>;
  cacheControl?: string;
}

export interface PresignedUrlOptions {
  expiresIn?: number;
  contentDisposition?: string;
}

export interface SecureS3Config {
  region: string;
  buckets: Record<S3BucketType, string>;
  kmsKeyArn: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface UploadResult {
  success: boolean;
  key?: string;
  bucket?: string;
  versionId?: string;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  data?: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
  error?: string;
}

// ============================================
// S3 CLIENT SINGLETON
// ============================================

let s3Client: S3Client | null = null;
let s3Config: SecureS3Config | null = null;

/**
 * Initialize the secure S3 client with configuration
 */
export function initializeSecureS3(config: SecureS3Config): void {
  s3Config = config;
  s3Client = new S3Client({
    region: config.region,
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
  });
}

/**
 * Get the S3 client, initializing from environment if needed
 */
function getSecureS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.AWS_REGION || process.env.AWS_S3_REGION || "us-west-2";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    s3Config = {
      region,
      buckets: {
        [S3BucketType.UPLOADS]: process.env.AWS_S3_BUCKET_UPLOADS || "",
        [S3BucketType.RECORDINGS]: process.env.AWS_S3_BUCKET_RECORDINGS || process.env.AWS_S3_BUCKET || "",
        [S3BucketType.EXPORTS]: process.env.AWS_S3_BUCKET_EXPORTS || "",
        [S3BucketType.BACKUPS]: process.env.AWS_S3_BUCKET_BACKUPS || "",
        [S3BucketType.AUDIT_LOGS]: process.env.AWS_S3_BUCKET_AUDIT_LOGS || "",
      },
      kmsKeyArn: process.env.AWS_KMS_KEY_ARN || process.env.AWS_KMS_KEY_ID || "",
    };

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

/**
 * Get bucket name for a specific bucket type
 */
function getBucket(bucketType: S3BucketType): string {
  if (!s3Config) {
    getSecureS3Client(); // Initialize config
  }

  const bucket = s3Config?.buckets[bucketType];
  if (!bucket) {
    throw new Error(`S3 bucket not configured for type: ${bucketType}`);
  }

  return bucket;
}

/**
 * Get KMS key ARN
 */
function getKMSKeyArn(): string {
  if (!s3Config) {
    getSecureS3Client(); // Initialize config
  }

  if (!s3Config?.kmsKeyArn) {
    throw new Error("AWS_KMS_KEY_ARN not configured");
  }

  return s3Config.kmsKeyArn;
}

// ============================================
// SECURE UPLOAD OPERATIONS
// ============================================

/**
 * Upload a file to S3 with enforced KMS encryption
 *
 * @param bucketType - Type of bucket to upload to
 * @param key - S3 object key
 * @param body - File content as Buffer
 * @param options - Upload options
 * @returns Upload result
 */
export async function secureUpload(
  bucketType: S3BucketType,
  key: string,
  body: Buffer,
  options: SecureUploadOptions
): Promise<UploadResult> {
  const client = getSecureS3Client();
  const bucket = getBucket(bucketType);
  const kmsKeyArn = getKMSKeyArn();

  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: options.contentType,
    // Enforce KMS encryption
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: kmsKeyArn,
    // Bucket key for cost optimization
    BucketKeyEnabled: true,
    // Optional metadata
    ...(options.metadata && { Metadata: options.metadata }),
    ...(options.cacheControl && { CacheControl: options.cacheControl }),
    // Convert tagging to string format
    ...(options.tagging && {
      Tagging: Object.entries(options.tagging)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&"),
    }),
  };

  try {
    const command = new PutObjectCommand(params);
    const response = await client.send(command);

    console.log(`[SecureS3] Uploaded ${key} to ${bucket} (encrypted with KMS)`);

    return {
      success: true,
      key,
      bucket,
      versionId: response.VersionId,
    };
  } catch (error) {
    console.error(`[SecureS3] Upload failed for ${key}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Generate a presigned URL for uploading
 * Client must include encryption headers when using this URL
 *
 * @param bucketType - Type of bucket
 * @param key - S3 object key
 * @param options - Presigned URL options
 * @returns Presigned upload URL
 */
export async function getSecureUploadUrl(
  bucketType: S3BucketType,
  key: string,
  contentType: string,
  options?: PresignedUrlOptions
): Promise<string> {
  const client = getSecureS3Client();
  const bucket = getBucket(bucketType);
  const kmsKeyArn = getKMSKeyArn();

  // Enforce expiry limits
  const maxExpiry = PRESIGNED_URL_EXPIRY[bucketType];
  const requestedExpiry = options?.expiresIn || maxExpiry;
  const expiresIn = Math.min(
    Math.max(requestedExpiry, MIN_PRESIGNED_URL_EXPIRY),
    Math.min(maxExpiry, MAX_PRESIGNED_URL_EXPIRY)
  );

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: kmsKeyArn,
  });

  const url = await getSignedUrl(client, command, { expiresIn });

  console.log(`[SecureS3] Generated upload URL for ${key}, expires in ${expiresIn}s`);

  return url;
}

// ============================================
// SECURE DOWNLOAD OPERATIONS
// ============================================

/**
 * Download a file from S3 (automatically decrypts KMS-encrypted objects)
 *
 * @param bucketType - Type of bucket
 * @param key - S3 object key
 * @returns Download result with file data
 */
export async function secureDownload(
  bucketType: S3BucketType,
  key: string
): Promise<DownloadResult> {
  const client = getSecureS3Client();
  const bucket = getBucket(bucketType);

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return { success: false, error: "No body in response" };
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const data = Buffer.concat(chunks);

    return {
      success: true,
      data,
      contentType: response.ContentType,
      metadata: response.Metadata,
    };
  } catch (error) {
    console.error(`[SecureS3] Download failed for ${key}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

/**
 * Generate a presigned URL for downloading
 *
 * @param bucketType - Type of bucket
 * @param key - S3 object key
 * @param options - Presigned URL options
 * @returns Presigned download URL
 */
export async function getSecureDownloadUrl(
  bucketType: S3BucketType,
  key: string,
  options?: PresignedUrlOptions
): Promise<string> {
  const client = getSecureS3Client();
  const bucket = getBucket(bucketType);

  // Enforce expiry limits
  const maxExpiry = PRESIGNED_URL_EXPIRY[bucketType];
  const requestedExpiry = options?.expiresIn || maxExpiry;
  const expiresIn = Math.min(
    Math.max(requestedExpiry, MIN_PRESIGNED_URL_EXPIRY),
    Math.min(maxExpiry, MAX_PRESIGNED_URL_EXPIRY)
  );

  const params: GetObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    ...(options?.contentDisposition && {
      ResponseContentDisposition: options.contentDisposition,
    }),
  };

  const command = new GetObjectCommand(params);
  const url = await getSignedUrl(client, command, { expiresIn });

  console.log(`[SecureS3] Generated download URL for ${key}, expires in ${expiresIn}s`);

  return url;
}

// ============================================
// DELETE OPERATIONS
// ============================================

/**
 * Delete an object from S3
 * Note: This creates a delete marker for versioned buckets
 *
 * @param bucketType - Type of bucket
 * @param key - S3 object key
 * @returns Success status
 */
export async function secureDelete(
  bucketType: S3BucketType,
  key: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSecureS3Client();
  const bucket = getBucket(bucketType);

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);

    console.log(`[SecureS3] Deleted ${key} from ${bucket}`);

    return { success: true };
  } catch (error) {
    console.error(`[SecureS3] Delete failed for ${key}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

// ============================================
// UTILITY OPERATIONS
// ============================================

/**
 * Check if an object exists in S3
 *
 * @param bucketType - Type of bucket
 * @param key - S3 object key
 * @returns True if object exists
 */
export async function objectExists(
  bucketType: S3BucketType,
  key: string
): Promise<boolean> {
  const client = getSecureS3Client();
  const bucket = getBucket(bucketType);

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    const errorName = (error as { name?: string }).name;
    if (errorName === "NotFound" || errorName === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}

/**
 * Get object metadata without downloading the object
 *
 * @param bucketType - Type of bucket
 * @param key - S3 object key
 * @returns Object metadata
 */
export async function getObjectMetadata(
  bucketType: S3BucketType,
  key: string
): Promise<{
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  metadata?: Record<string, string>;
  versionId?: string;
  encrypted?: boolean;
  kmsKeyId?: string;
} | null> {
  const client = getSecureS3Client();
  const bucket = getBucket(bucketType);

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      metadata: response.Metadata,
      versionId: response.VersionId,
      encrypted: response.ServerSideEncryption === "aws:kms",
      kmsKeyId: response.SSEKMSKeyId,
    };
  } catch (error) {
    const errorName = (error as { name?: string }).name;
    if (errorName === "NotFound" || errorName === "NoSuchKey") {
      return null;
    }
    throw error;
  }
}

/**
 * List objects with a given prefix
 *
 * @param bucketType - Type of bucket
 * @param prefix - Key prefix to filter by
 * @param maxKeys - Maximum number of keys to return
 * @returns List of object keys
 */
export async function listObjects(
  bucketType: S3BucketType,
  prefix: string,
  maxKeys: number = 1000
): Promise<{
  keys: string[];
  truncated: boolean;
  continuationToken?: string;
}> {
  const client = getSecureS3Client();
  const bucket = getBucket(bucketType);

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await client.send(command);

    return {
      keys: response.Contents?.map((obj) => obj.Key || "") || [],
      truncated: response.IsTruncated || false,
      continuationToken: response.NextContinuationToken,
    };
  } catch (error) {
    console.error(`[SecureS3] List failed for prefix ${prefix}:`, error);
    throw error;
  }
}

/**
 * Copy an object within S3 (maintains encryption)
 *
 * @param bucketType - Type of bucket
 * @param sourceKey - Source object key
 * @param destKey - Destination object key
 * @returns Success status
 */
export async function copyObject(
  bucketType: S3BucketType,
  sourceKey: string,
  destKey: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSecureS3Client();
  const bucket = getBucket(bucketType);
  const kmsKeyArn = getKMSKeyArn();

  try {
    const command = new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: destKey,
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: kmsKeyArn,
    });

    await client.send(command);

    console.log(`[SecureS3] Copied ${sourceKey} to ${destKey}`);

    return { success: true };
  } catch (error) {
    console.error(`[SecureS3] Copy failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Copy failed",
    };
  }
}

// ============================================
// KEY GENERATION HELPERS
// ============================================

/**
 * Generate a storage key for uploads
 */
export function generateUploadKey(
  orgId: string,
  userId: string,
  filename: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 100);

  return `${orgId}/${year}/${month}/${userId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Generate a storage key for recordings
 */
export function generateRecordingKey(
  orgId: string,
  callId: string,
  extension: string = "mp3"
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `recordings/${orgId}/${year}/${month}/${callId}.${extension}`;
}

/**
 * Generate a storage key for exports
 */
export function generateExportKey(
  orgId: string,
  exportId: string,
  filename: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `exports/${orgId}/${year}/${month}/${exportId}/${filename}`;
}

/**
 * Generate a storage key for audit logs
 */
export function generateAuditLogKey(
  orgId: string,
  date: Date = new Date()
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const timestamp = date.toISOString().replace(/[:.]/g, "-");

  return `audit-logs/${orgId}/${year}/${month}/${day}/${timestamp}.json`;
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check if S3 is properly configured for secure operations
 */
export function isSecureS3Configured(): boolean {
  try {
    const hasCredentials = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );

    const hasKmsKey = !!(
      process.env.AWS_KMS_KEY_ARN ||
      process.env.AWS_KMS_KEY_ID
    );

    const hasBucket = !!(
      process.env.AWS_S3_BUCKET ||
      process.env.AWS_S3_BUCKET_RECORDINGS ||
      process.env.AWS_S3_BUCKET_UPLOADS
    );

    return hasCredentials && hasKmsKey && hasBucket;
  } catch {
    return false;
  }
}

/**
 * Get S3 configuration status for health checks
 */
export function getSecureS3Status(): {
  configured: boolean;
  region: string;
  buckets: Record<S3BucketType, { configured: boolean; name: string }>;
  kmsConfigured: boolean;
} {
  const region = process.env.AWS_REGION || process.env.AWS_S3_REGION || "unknown";

  const bucketStatus: Record<S3BucketType, { configured: boolean; name: string }> = {
    [S3BucketType.UPLOADS]: {
      configured: !!process.env.AWS_S3_BUCKET_UPLOADS,
      name: process.env.AWS_S3_BUCKET_UPLOADS || "",
    },
    [S3BucketType.RECORDINGS]: {
      configured: !!(process.env.AWS_S3_BUCKET_RECORDINGS || process.env.AWS_S3_BUCKET),
      name: process.env.AWS_S3_BUCKET_RECORDINGS || process.env.AWS_S3_BUCKET || "",
    },
    [S3BucketType.EXPORTS]: {
      configured: !!process.env.AWS_S3_BUCKET_EXPORTS,
      name: process.env.AWS_S3_BUCKET_EXPORTS || "",
    },
    [S3BucketType.BACKUPS]: {
      configured: !!process.env.AWS_S3_BUCKET_BACKUPS,
      name: process.env.AWS_S3_BUCKET_BACKUPS || "",
    },
    [S3BucketType.AUDIT_LOGS]: {
      configured: !!process.env.AWS_S3_BUCKET_AUDIT_LOGS,
      name: process.env.AWS_S3_BUCKET_AUDIT_LOGS || "",
    },
  };

  return {
    configured: isSecureS3Configured(),
    region,
    buckets: bucketStatus,
    kmsConfigured: !!(process.env.AWS_KMS_KEY_ARN || process.env.AWS_KMS_KEY_ID),
  };
}
