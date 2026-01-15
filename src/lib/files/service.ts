import { prisma } from "@/lib/db";
import { uploadFile, generateStoragePath, getFileContent, deleteFile, getDownloadUrl } from "./storage";
import { performFullScan, calculateFileHash } from "./scanner";
import { extractText } from "./extractor";
import {
  validateFileType,
  validateFileSize,
  type FileUploadResult,
  type ScanStatus,
} from "./types";

/**
 * Process and upload a file
 *
 * This function handles the complete file upload pipeline:
 * 1. Validate file type and size
 * 2. Upload to storage
 * 3. Create database record
 * 4. Queue for scanning
 */
export async function processFileUpload(
  file: Buffer,
  originalName: string,
  mimeType: string,
  orgId: string,
  uploadedById: string
): Promise<{
  success: boolean;
  file?: FileUploadResult;
  error?: string;
}> {
  // Step 1: Validate file type
  const typeValidation = validateFileType(mimeType, originalName);
  if (!typeValidation.valid) {
    return { success: false, error: typeValidation.error };
  }

  // Step 2: Validate file size
  const sizeValidation = validateFileSize(file.length, typeValidation.config!);
  if (!sizeValidation.valid) {
    return { success: false, error: sizeValidation.error };
  }

  // Step 3: Generate storage path and upload
  const storagePath = generateStoragePath(orgId, originalName);
  const uploadResult = await uploadFile(file, storagePath, mimeType);

  if (!uploadResult.success) {
    return { success: false, error: uploadResult.error };
  }

  // Step 4: Create database record
  try {
    const fileRecord = await prisma.fileUpload.create({
      data: {
        orgId,
        originalName,
        storagePath,
        mimeType,
        sizeBytes: file.length,
        scanStatus: "PENDING",
        uploadedById,
      },
    });

    // Step 5: Trigger async scanning (non-blocking)
    scanFileAsync(fileRecord.id, file, mimeType).catch((err) => {
      console.error("Async scan error:", err);
    });

    return {
      success: true,
      file: {
        id: fileRecord.id,
        originalName: fileRecord.originalName,
        storagePath: fileRecord.storagePath,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
        scanStatus: fileRecord.scanStatus as ScanStatus,
        uploadedAt: fileRecord.uploadedAt,
      },
    };
  } catch (error) {
    // Clean up uploaded file on database error
    await deleteFile(storagePath);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Database error",
    };
  }
}

/**
 * Scan a file asynchronously and update the database
 */
async function scanFileAsync(
  fileId: string,
  content: Buffer,
  mimeType: string
): Promise<void> {
  try {
    // Update status to scanning
    await prisma.fileUpload.update({
      where: { id: fileId },
      data: { scanStatus: "SCANNING" },
    });

    // Perform the scan
    const scanResult = await performFullScan(content, mimeType);

    // Extract text if applicable and scan passed
    let extractedText: string | null = null;
    if (scanResult.status === "CLEAN") {
      const extraction = await extractText(content, mimeType);
      if (extraction.success && extraction.text) {
        extractedText = extraction.text;
      }
    }

    // Update database with results
    await prisma.fileUpload.update({
      where: { id: fileId },
      data: {
        scanStatus: scanResult.status,
        scanResult: {
          threats: scanResult.threats,
          error: scanResult.error,
          scannerVersion: scanResult.scannerVersion,
        },
        scannedAt: scanResult.scannedAt,
        extractedText,
      },
    });
  } catch (error) {
    console.error("Scan async error:", error);
    await prisma.fileUpload.update({
      where: { id: fileId },
      data: {
        scanStatus: "ERROR",
        scanResult: {
          error: error instanceof Error ? error.message : "Scan failed",
        },
        scannedAt: new Date(),
      },
    });
  }
}

/**
 * Get a file by ID
 */
export async function getFileById(
  fileId: string,
  orgId: string
): Promise<FileUploadResult | null> {
  const file = await prisma.fileUpload.findFirst({
    where: {
      id: fileId,
      orgId,
    },
  });

  if (!file) return null;

  return {
    id: file.id,
    originalName: file.originalName,
    storagePath: file.storagePath,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    scanStatus: file.scanStatus as ScanStatus,
    uploadedAt: file.uploadedAt,
  };
}

/**
 * Get download URL for a file
 */
export async function getFileDownloadUrl(
  fileId: string,
  orgId: string
): Promise<{ url?: string; error?: string }> {
  const file = await prisma.fileUpload.findFirst({
    where: {
      id: fileId,
      orgId,
    },
  });

  if (!file) {
    return { error: "File not found" };
  }

  // Don't allow download of infected files
  if (file.scanStatus === "INFECTED") {
    return { error: "File is quarantined due to security concerns" };
  }

  return getDownloadUrl(file.storagePath);
}

/**
 * Delete a file
 */
export async function deleteFileById(
  fileId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const file = await prisma.fileUpload.findFirst({
    where: {
      id: fileId,
      orgId,
    },
  });

  if (!file) {
    return { success: false, error: "File not found" };
  }

  // Delete from storage
  const storageResult = await deleteFile(file.storagePath);
  if (!storageResult.success) {
    return { success: false, error: storageResult.error };
  }

  // Delete from database
  await prisma.fileUpload.delete({
    where: { id: fileId },
  });

  return { success: true };
}

/**
 * List files for an organization
 */
export async function listFiles(
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
    scanStatus?: ScanStatus;
  } = {}
): Promise<{
  files: FileUploadResult[];
  total: number;
}> {
  const { limit = 50, offset = 0, scanStatus } = options;

  const where = {
    orgId,
    ...(scanStatus && { scanStatus }),
  };

  const [files, total] = await Promise.all([
    prisma.fileUpload.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.fileUpload.count({ where }),
  ]);

  return {
    files: files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      storagePath: f.storagePath,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      scanStatus: f.scanStatus as ScanStatus,
      uploadedAt: f.uploadedAt,
    })),
    total,
  };
}

/**
 * Get extracted text from a file
 */
export async function getFileExtractedText(
  fileId: string,
  orgId: string
): Promise<{ text?: string; error?: string }> {
  const file = await prisma.fileUpload.findFirst({
    where: {
      id: fileId,
      orgId,
    },
    select: {
      extractedText: true,
      scanStatus: true,
    },
  });

  if (!file) {
    return { error: "File not found" };
  }

  if (file.scanStatus !== "CLEAN") {
    return { error: "File has not been scanned or is not clean" };
  }

  return { text: file.extractedText || undefined };
}

/**
 * Re-scan a file
 */
export async function rescanFile(
  fileId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const file = await prisma.fileUpload.findFirst({
    where: {
      id: fileId,
      orgId,
    },
  });

  if (!file) {
    return { success: false, error: "File not found" };
  }

  // Get file content from storage
  const contentResult = await getFileContent(file.storagePath);
  if (!contentResult.data) {
    return { success: false, error: contentResult.error };
  }

  // Trigger async scan
  scanFileAsync(fileId, contentResult.data, file.mimeType).catch((err) => {
    console.error("Rescan error:", err);
  });

  return { success: true };
}
