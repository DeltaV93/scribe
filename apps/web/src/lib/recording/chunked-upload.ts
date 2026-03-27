/**
 * Chunked Upload Client (PX-RECOVERY Phase 2)
 *
 * Client-side module for multipart uploads with:
 * - Automatic chunking of large files
 * - Resumable uploads (can continue from last successful part)
 * - Progress tracking
 * - Retry logic for failed parts
 *
 * @module lib/recording/chunked-upload
 */

// Part size must match server-side config (5MB)
const PART_SIZE_BYTES = 5 * 1024 * 1024;

// Max retries per part
const MAX_PART_RETRIES = 3;

// ============================================================================
// Types
// ============================================================================

export interface ChunkedUploadConfig {
  conversationId: string;
  blob: Blob;
  contentType?: string;
  onProgress?: (progress: ChunkedUploadProgress) => void;
  onPartComplete?: (partNumber: number, etag: string) => void;
  signal?: AbortSignal;
}

export interface ChunkedUploadProgress {
  totalParts: number;
  completedParts: number;
  uploadedBytes: number;
  totalBytes: number;
  percentComplete: number;
  currentPartNumber: number;
}

export interface ChunkedUploadResult {
  success: boolean;
  key?: string;
  location?: string;
  error?: string;
}

interface UploadState {
  uploadId: string;
  key: string;
  completedParts: Array<{ partNumber: number; etag: string }>;
}

// ============================================================================
// Chunked Upload Functions
// ============================================================================

/**
 * Upload a blob using multipart upload
 */
export async function chunkedUpload(
  config: ChunkedUploadConfig
): Promise<ChunkedUploadResult> {
  const {
    conversationId,
    blob,
    contentType = blob.type || "audio/webm",
    onProgress,
    onPartComplete,
    signal,
  } = config;

  const totalBytes = blob.size;
  const totalParts = Math.ceil(totalBytes / PART_SIZE_BYTES);

  let state: UploadState | null = null;

  try {
    // Step 1: Initiate multipart upload
    const initResponse = await fetch(
      `/api/conversations/${conversationId}/multipart-upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType }),
        signal,
      }
    );

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.error?.message || "Failed to initiate upload");
    }

    const initData = await initResponse.json();
    state = {
      uploadId: initData.uploadId,
      key: initData.key,
      completedParts: [],
    };

    // Step 2: Upload each part
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      if (signal?.aborted) {
        throw new Error("Upload aborted");
      }

      const start = (partNumber - 1) * PART_SIZE_BYTES;
      const end = Math.min(start + PART_SIZE_BYTES, totalBytes);
      const partBlob = blob.slice(start, end);

      // Upload with retries
      const etag = await uploadPartWithRetry(
        conversationId,
        state.uploadId,
        state.key,
        partNumber,
        partBlob,
        signal
      );

      state.completedParts.push({ partNumber, etag });
      onPartComplete?.(partNumber, etag);

      // Report progress
      onProgress?.({
        totalParts,
        completedParts: partNumber,
        uploadedBytes: end,
        totalBytes,
        percentComplete: Math.round((end / totalBytes) * 100),
        currentPartNumber: partNumber,
      });
    }

    // Step 3: Complete multipart upload
    const completeResponse = await fetch(
      `/api/conversations/${conversationId}/complete-upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: state.uploadId,
          key: state.key,
          parts: state.completedParts,
        }),
        signal,
      }
    );

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      throw new Error(error.error?.message || "Failed to complete upload");
    }

    const completeData = await completeResponse.json();

    return {
      success: true,
      key: completeData.key,
      location: completeData.location,
    };
  } catch (error) {
    // Attempt to abort the multipart upload on failure
    if (state) {
      try {
        await fetch(`/api/conversations/${conversationId}/complete-upload`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId: state.uploadId,
            key: state.key,
          }),
        });
      } catch {
        // Ignore abort errors
      }
    }

    const errorMessage = error instanceof Error ? error.message : "Upload failed";
    console.error("[ChunkedUpload] Failed:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Upload a single part with retry logic
 */
async function uploadPartWithRetry(
  conversationId: string,
  uploadId: string,
  key: string,
  partNumber: number,
  partBlob: Blob,
  signal?: AbortSignal
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_PART_RETRIES; attempt++) {
    try {
      // Get presigned URL for this part
      const urlResponse = await fetch(
        `/api/conversations/${conversationId}/upload-part`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId, key, partNumber }),
          signal,
        }
      );

      if (!urlResponse.ok) {
        const error = await urlResponse.json();
        throw new Error(error.error?.message || "Failed to get part URL");
      }

      const { presignedUrl } = await urlResponse.json();

      // Upload part directly to S3
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: partBlob,
        signal,
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed with status ${uploadResponse.status}`);
      }

      // Get ETag from response headers
      const etag = uploadResponse.headers.get("ETag");
      if (!etag) {
        throw new Error("No ETag in upload response");
      }

      return etag;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (signal?.aborted) {
        throw lastError;
      }

      console.warn(
        `[ChunkedUpload] Part ${partNumber} attempt ${attempt} failed:`,
        lastError.message
      );

      if (attempt < MAX_PART_RETRIES) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  throw lastError || new Error(`Failed to upload part ${partNumber}`);
}

/**
 * Resume an interrupted upload
 */
export async function resumeUpload(
  conversationId: string,
  uploadId: string,
  key: string,
  blob: Blob,
  onProgress?: (progress: ChunkedUploadProgress) => void
): Promise<ChunkedUploadResult> {
  const totalBytes = blob.size;
  const totalParts = Math.ceil(totalBytes / PART_SIZE_BYTES);

  try {
    // Get already uploaded parts
    const partsResponse = await fetch(
      `/api/conversations/${conversationId}/multipart-upload?uploadId=${uploadId}&key=${key}`
    );

    if (!partsResponse.ok) {
      throw new Error("Failed to list uploaded parts");
    }

    const { parts: existingParts } = await partsResponse.json();
    const existingPartNumbers = new Set(
      existingParts.map((p: { partNumber: number }) => p.partNumber)
    );

    const completedParts = [...existingParts];

    // Upload missing parts
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      if (existingPartNumbers.has(partNumber)) {
        continue; // Skip already uploaded parts
      }

      const start = (partNumber - 1) * PART_SIZE_BYTES;
      const end = Math.min(start + PART_SIZE_BYTES, totalBytes);
      const partBlob = blob.slice(start, end);

      const etag = await uploadPartWithRetry(
        conversationId,
        uploadId,
        key,
        partNumber,
        partBlob
      );

      completedParts.push({ partNumber, etag });

      onProgress?.({
        totalParts,
        completedParts: completedParts.length,
        uploadedBytes: end,
        totalBytes,
        percentComplete: Math.round((completedParts.length / totalParts) * 100),
        currentPartNumber: partNumber,
      });
    }

    // Complete upload
    const completeResponse = await fetch(
      `/api/conversations/${conversationId}/complete-upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          key,
          parts: completedParts,
        }),
      }
    );

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      throw new Error(error.error?.message || "Failed to complete upload");
    }

    const completeData = await completeResponse.json();

    return {
      success: true,
      key: completeData.key,
      location: completeData.location,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Resume failed";
    console.error("[ChunkedUpload] Resume failed:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if chunked upload should be used based on file size
 */
export function shouldUseChunkedUpload(blobSize: number): boolean {
  // Use chunked upload for files > 10MB
  return blobSize > 10 * 1024 * 1024;
}

/**
 * Get the number of parts for a given blob size
 */
export function getPartCount(blobSize: number): number {
  return Math.ceil(blobSize / PART_SIZE_BYTES);
}
