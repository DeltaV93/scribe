import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPartUploadUrl } from "@/lib/storage/multipart-s3";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UploadPartRequest {
  uploadId: string;
  key: string;
  partNumber: number;
}

/**
 * POST /api/conversations/:id/upload-part
 *
 * Get a presigned URL for uploading a specific part of a multipart upload.
 * The client uploads directly to S3 using this URL.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: UploadPartRequest = await request.json();

    const { uploadId, key, partNumber } = body;

    // Validate required fields
    if (!uploadId || !key || !partNumber) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "uploadId, key, and partNumber are required" } },
        { status: 400 }
      );
    }

    if (partNumber < 1 || partNumber > 10000) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "partNumber must be between 1 and 10000" } },
        { status: 400 }
      );
    }

    // Fetch conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        createdById: true,
        status: true,
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

    // Only creator can upload parts
    if (conversation.createdById !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the recording creator can upload" } },
        { status: 403 }
      );
    }

    // Get presigned URL for this part
    const partUrl = await getPartUploadUrl(key, uploadId, partNumber);

    return NextResponse.json({
      success: true,
      presignedUrl: partUrl.presignedUrl,
      partNumber: partUrl.partNumber,
      expiresAt: partUrl.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error getting part upload URL:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get part upload URL" } },
      { status: 500 }
    );
  }
}
