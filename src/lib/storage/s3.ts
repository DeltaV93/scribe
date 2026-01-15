import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;

/**
 * Get the S3 client instance (singleton)
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.AWS_REGION || "us-east-1";
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

/**
 * Check if S3 is configured
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );
}

/**
 * Get the S3 bucket name
 */
export function getBucketName(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }
  return bucket;
}

/**
 * Generate S3 key for a recording
 */
export function getRecordingKey(
  orgId: string,
  callId: string,
  extension: string = "mp3"
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  // Structure: recordings/{orgId}/{year}/{month}/{callId}.{ext}
  return `recordings/${orgId}/${year}/${month}/${callId}.${extension}`;
}

/**
 * Upload a recording to S3
 */
export async function uploadRecording(
  orgId: string,
  callId: string,
  audioBuffer: Buffer,
  contentType: string = "audio/mpeg"
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();
  const key = getRecordingKey(orgId, callId);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: audioBuffer,
      ContentType: contentType,
      // Server-side encryption with AWS KMS for HIPAA compliance
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
      // Metadata for tracking
      Metadata: {
        "call-id": callId,
        "org-id": orgId,
        "upload-time": new Date().toISOString(),
      },
    })
  );

  return key;
}

/**
 * Get a signed URL for accessing a recording
 */
export async function getSignedRecordingUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Download a recording from S3
 */
export async function downloadRecording(key: string): Promise<Buffer> {
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

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Delete a recording from S3
 */
export async function deleteRecording(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucketName();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Check if a recording exists
 */
export async function recordingExists(key: string): Promise<boolean> {
  const client = getS3Client();
  const bucket = getBucketName();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    if ((error as { name?: string }).name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Download recording from a URL (e.g., Twilio) and upload to S3
 */
export async function transferRecordingToS3(
  sourceUrl: string,
  orgId: string,
  callId: string
): Promise<string> {
  // Download from source URL
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download recording: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to S3
  const key = await uploadRecording(orgId, callId, buffer);

  return key;
}
