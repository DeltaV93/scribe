import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPresignedUploadUrl } from "@/lib/recording";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface FreshUploadUrlRequest {
  contentType?: string; // Default: audio/webm
}

/**
 * POST /api/conversations/:id/fresh-upload-url
 *
 * Generate a new presigned S3 upload URL for a stuck recording.
 * Used when the original presigned URL has expired and user wants
 * to manually upload the recording.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: FreshUploadUrlRequest = await request.json().catch(() => ({}));

    const { contentType = "audio/webm" } = body;

    // Fetch conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        createdById: true,
        status: true,
        recordingUrl: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    // Verify user belongs to same org
    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not authorized" } },
        { status: 403 }
      );
    }

    // Only creator or admin can get a fresh upload URL
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (conversation.createdById !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the recording creator or admin can request upload URL" } },
        { status: 403 }
      );
    }

    // Only allow for RECORDING status (stuck recordings)
    if (conversation.status !== "RECORDING") {
      return NextResponse.json(
        { error: { code: "INVALID_STATUS", message: `Cannot generate upload URL for conversation with status: ${conversation.status}` } },
        { status: 400 }
      );
    }

    // If recording already exists, warn but still provide URL (allows re-upload/overwrite)
    if (conversation.recordingUrl) {
      console.warn(
        `[FreshUploadUrl] Generating new upload URL for conversation ${id} ` +
        `that already has recording at ${conversation.recordingUrl}`
      );
    }

    // Generate new presigned URL (1 hour validity)
    const uploadInfo = await getPresignedUploadUrl(
      conversation.orgId,
      conversation.id,
      contentType,
      3600 // 1 hour
    );

    console.log(
      `[FreshUploadUrl] Generated new upload URL for conversation ${id}, ` +
      `expires at ${uploadInfo.expiresAt.toISOString()}`
    );

    return NextResponse.json({
      success: true,
      upload: {
        url: uploadInfo.uploadUrl,
        key: uploadInfo.key,
        expiresAt: uploadInfo.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating fresh upload URL:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate upload URL" } },
      { status: 500 }
    );
  }
}
