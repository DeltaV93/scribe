import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById, getSessionById } from "@/lib/services/programs";
import { getUploadWithUrls, getUploadForReview } from "@/lib/services/attendance";

type RouteParams = {
  params: Promise<{ programId: string; sessionId: string; uploadId: string }>;
};

/**
 * GET /api/programs/[programId]/sessions/[sessionId]/attendance/[uploadId] - Get upload details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId, uploadId } = await params;

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

    // Check query param for format
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    if (format === "review") {
      // Return full review data
      const reviewData = await getUploadForReview(uploadId);
      if (!reviewData || reviewData.sessionId !== sessionId) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Upload not found" } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: reviewData,
      });
    }

    // Default: return upload with signed URLs
    const { upload, photoUrl, enhancedPhotoUrl } = await getUploadWithUrls(uploadId);

    if (!upload || upload.sessionId !== sessionId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Upload not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...upload,
        photoUrl,
        enhancedPhotoUrl,
      },
    });
  } catch (error) {
    console.error("Error getting upload:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get upload" } },
      { status: 500 }
    );
  }
}
