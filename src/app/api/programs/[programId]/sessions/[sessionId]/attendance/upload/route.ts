import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById, getSessionById } from "@/lib/services/programs";
import { createUploadWithPhoto, checkUploadRateLimit } from "@/lib/services/attendance";
import { createAuditLog } from "@/lib/audit/service";
import { UserRole } from "@/types";

type RouteParams = {
  params: Promise<{ programId: string; sessionId: string }>;
};

/**
 * POST /api/programs/[programId]/sessions/[sessionId]/attendance/upload - Upload attendance photo
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId } = await params;

    // Only admins, program managers, and case managers can upload
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to upload attendance photos" } },
        { status: 403 }
      );
    }

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Verify session exists
    const session = await getSessionById(sessionId, programId);
    if (!session) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 }
      );
    }

    // Check rate limit first
    const rateLimit = await checkUploadRateLimit(user.id, sessionId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: `Upload limit reached. Try again after ${rateLimit.windowResetAt.toLocaleTimeString()}`,
            details: {
              currentCount: rateLimit.currentCount,
              maxAllowed: rateLimit.maxAllowed,
              resetAt: rateLimit.windowResetAt.toISOString(),
            },
          },
        },
        { status: 429 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    const isOverride = formData.get("isOverride") === "true";
    const overrideReason = formData.get("overrideReason") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No photo file provided" } },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid file type. Please upload a JPEG, PNG, or WebP image." } },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "File too large. Maximum size is 10MB." } },
        { status: 400 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const photoBuffer = Buffer.from(arrayBuffer);

    // Create upload with photo
    const result = await createUploadWithPhoto({
      sessionId,
      photoBuffer,
      mimeType: file.type,
      userId: user.id,
      isOverride,
      overrideReason: overrideReason || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "UPLOAD_FAILED",
            message: result.error,
            qualityMetrics: result.qualityMetrics,
          },
        },
        { status: 400 }
      );
    }

    // Create audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPLOAD",
      resource: "ATTENDANCE_UPLOAD",
      resourceId: result.uploadId,
      details: {
        sessionId,
        programId,
        isOverride,
        qualityScore: result.qualityMetrics?.qualityScore,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          uploadId: result.uploadId,
          photoPath: result.photoPath,
          enhancedPhotoPath: result.enhancedPhotoPath,
          qualityMetrics: result.qualityMetrics,
          processingTriggered: result.processingTriggered,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading attendance photo:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to upload attendance photo" } },
      { status: 500 }
    );
  }
}
