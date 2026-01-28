import { prisma } from "@/lib/db";
import {
  uploadAttendancePhoto,
  uploadEnhancedPhoto,
  getAttendancePhotoUrl,
} from "./storage";
import { enhanceAttendancePhoto, getImageQualityMetrics } from "@/lib/image/enhancement";
import { checkUploadRateLimit, recordUploadForRateLimit } from "./rate-limiting";
import { processAttendanceUpload } from "./ai-recognition";
import type { AttendanceUploadInfo } from "./types";

export interface UploadPhotoInput {
  uploadId: string;
  photoBuffer: Buffer;
  mimeType: string;
  userId: string;
  skipRateLimit?: boolean;
  skipEnhancement?: boolean;
  triggerProcessing?: boolean;
}

export interface UploadPhotoResult {
  success: boolean;
  uploadId: string;
  photoPath?: string;
  enhancedPhotoPath?: string;
  qualityMetrics?: {
    width: number;
    height: number;
    qualityScore: number;
    issues: string[];
  };
  processingTriggered?: boolean;
  error?: string;
}

/**
 * Upload a photo for an existing attendance upload record
 */
export async function uploadAttendancePhotoForUpload(
  input: UploadPhotoInput
): Promise<UploadPhotoResult> {
  const { uploadId, photoBuffer, mimeType, userId, skipRateLimit, skipEnhancement, triggerProcessing } = input;

  // Get the upload record
  const upload = await prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: { select: { orgId: true } },
        },
      },
    },
  });

  if (!upload) {
    return { success: false, uploadId, error: "Upload not found" };
  }

  // Verify user has permission (same org)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { orgId: true },
  });

  if (!user || user.orgId !== upload.session.program.orgId) {
    return { success: false, uploadId, error: "Unauthorized" };
  }

  // Check rate limit
  if (!skipRateLimit) {
    const rateLimit = await checkUploadRateLimit(userId, upload.sessionId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        uploadId,
        error: `Rate limit exceeded. You can upload again after ${rateLimit.windowResetAt.toLocaleTimeString()}`,
      };
    }
  }

  try {
    // Check image quality
    const qualityMetrics = await getImageQualityMetrics(photoBuffer);
    const issues: string[] = [];

    if (qualityMetrics.isTooSmall) {
      issues.push("Image resolution is low - text may be hard to read");
    }
    if (qualityMetrics.isBlurry) {
      issues.push("Image appears blurry - consider retaking the photo");
    }
    if (qualityMetrics.isTooDark) {
      issues.push("Image is too dark - try better lighting");
    }

    // Reject if quality is too poor
    if (qualityMetrics.qualityScore < 25) {
      return {
        success: false,
        uploadId,
        error: "Image quality is too poor for processing. Please retake the photo with better lighting and focus.",
        qualityMetrics: {
          width: qualityMetrics.width,
          height: qualityMetrics.height,
          qualityScore: qualityMetrics.qualityScore,
          issues,
        },
      };
    }

    // Upload original photo
    const photoPath = await uploadAttendancePhoto(
      upload.session.program.orgId,
      uploadId,
      photoBuffer,
      mimeType
    );

    // Enhance photo if not skipped
    let enhancedPhotoPath: string | undefined;
    if (!skipEnhancement) {
      try {
        const enhancedBuffer = await enhanceAttendancePhoto(photoBuffer);
        enhancedPhotoPath = await uploadEnhancedPhoto(
          upload.session.program.orgId,
          uploadId,
          enhancedBuffer
        );
      } catch (error) {
        console.error("Failed to enhance photo:", error);
        // Continue without enhancement
      }
    }

    // Update the upload record
    await prisma.attendanceUpload.update({
      where: { id: uploadId },
      data: {
        status: "PHOTO_UPLOADED",
        photoPath,
        photoUploadedAt: new Date(),
        photoMimeType: mimeType,
        photoSizeBytes: photoBuffer.length,
        enhancedPhotoPath,
        uploadedById: userId,
      },
    });

    // Record for rate limiting
    if (!skipRateLimit) {
      await recordUploadForRateLimit(userId, upload.sessionId);
    }

    // Trigger AI processing if requested
    let processingTriggered = false;
    if (triggerProcessing) {
      // Process asynchronously
      processAttendanceUpload(uploadId).catch((error) => {
        console.error("Background processing failed:", error);
      });
      processingTriggered = true;
    }

    return {
      success: true,
      uploadId,
      photoPath,
      enhancedPhotoPath,
      qualityMetrics: {
        width: qualityMetrics.width,
        height: qualityMetrics.height,
        qualityScore: qualityMetrics.qualityScore,
        issues,
      },
      processingTriggered,
    };
  } catch (error) {
    console.error("Error uploading photo:", error);
    return {
      success: false,
      uploadId,
      error: error instanceof Error ? error.message : "Failed to upload photo",
    };
  }
}

/**
 * Create a new upload record and upload photo in one step
 */
export async function createUploadWithPhoto(input: {
  sessionId: string;
  photoBuffer: Buffer;
  mimeType: string;
  userId: string;
  isOverride?: boolean;
  overrideReason?: string;
}): Promise<UploadPhotoResult> {
  const { sessionId, photoBuffer, mimeType, userId, isOverride, overrideReason } = input;

  // Get session to find org
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: { select: { orgId: true } },
    },
  });

  if (!session) {
    return { success: false, uploadId: "", error: "Session not found" };
  }

  // Check rate limit
  const rateLimit = await checkUploadRateLimit(userId, sessionId);
  if (!rateLimit.allowed) {
    return {
      success: false,
      uploadId: "",
      error: `Rate limit exceeded. You can upload again after ${rateLimit.windowResetAt.toLocaleTimeString()}`,
    };
  }

  // Check for existing confirmed upload if this is an override
  if (isOverride) {
    const existingConfirmed = await prisma.attendanceUpload.findFirst({
      where: {
        sessionId,
        status: "CONFIRMED",
      },
    });

    if (!existingConfirmed) {
      return {
        success: false,
        uploadId: "",
        error: "No confirmed attendance to override",
      };
    }
  }

  // Create upload record
  const upload = await prisma.attendanceUpload.create({
    data: {
      sessionId,
      orgId: session.program.orgId,
      status: "IN_PROGRESS",
      uploadedById: userId,
      isOverride: isOverride || false,
      overrideReason: overrideReason || null,
    },
  });

  // Upload the photo
  return uploadAttendancePhotoForUpload({
    uploadId: upload.id,
    photoBuffer,
    mimeType,
    userId,
    skipRateLimit: true, // Already checked above
    triggerProcessing: true,
  });
}

/**
 * Get upload status with signed URLs for photos
 */
export async function getUploadWithUrls(uploadId: string): Promise<{
  upload: AttendanceUploadInfo | null;
  photoUrl?: string;
  enhancedPhotoUrl?: string;
}> {
  const upload = await prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: { select: { id: true, name: true } },
        },
      },
      extractedRecords: {
        include: {
          enrollment: {
            include: {
              client: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  if (!upload) {
    return { upload: null };
  }

  let photoUrl: string | undefined;
  let enhancedPhotoUrl: string | undefined;

  if (upload.photoPath) {
    try {
      photoUrl = await getAttendancePhotoUrl(upload.photoPath);
    } catch (error) {
      console.error("Failed to generate photo URL:", error);
    }
  }

  if (upload.enhancedPhotoPath) {
    try {
      enhancedPhotoUrl = await getAttendancePhotoUrl(upload.enhancedPhotoPath);
    } catch (error) {
      console.error("Failed to generate enhanced photo URL:", error);
    }
  }

  return {
    upload: {
      ...upload,
      extractedRecords: upload.extractedRecords.map((r) => ({
        ...r,
        enrollment: r.enrollment
          ? {
              id: r.enrollment.id,
              client: r.enrollment.client,
            }
          : null,
      })),
    } as AttendanceUploadInfo,
    photoUrl,
    enhancedPhotoUrl,
  };
}
