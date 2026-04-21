import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  initiateMultipartUpload,
  listUploadedParts,
} from "@/lib/storage/multipart-s3";
import { generateRecordingKey } from "@/lib/recording";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/conversations/:id/multipart-upload
 *
 * Initiate a new multipart upload for a conversation recording.
 * Returns uploadId and key for subsequent part uploads.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const { contentType = "audio/webm" } = body;

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

    // Only creator can initiate upload
    if (conversation.createdById !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the recording creator can upload" } },
        { status: 403 }
      );
    }

    // Only allow for RECORDING status
    if (conversation.status !== "RECORDING") {
      return NextResponse.json(
        { error: { code: "INVALID_STATUS", message: `Cannot upload for conversation with status: ${conversation.status}` } },
        { status: 400 }
      );
    }

    // Generate S3 key
    // Strip codec suffix (e.g., "webm;codecs=opus" → "webm")
    const extension = contentType.split("/")[1]?.split(";")[0] || "webm";
    const key = generateRecordingKey(conversation.orgId, conversation.id, extension);

    // Initiate multipart upload
    const upload = await initiateMultipartUpload(key, contentType);

    console.log(
      `[MultipartUpload] Initiated for conversation ${id}, uploadId=${upload.uploadId}`
    );

    return NextResponse.json({
      success: true,
      uploadId: upload.uploadId,
      key: upload.key,
      bucket: upload.bucket,
    });
  } catch (error) {
    console.error("Error initiating multipart upload:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to initiate multipart upload" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations/:id/multipart-upload?uploadId=xxx
 *
 * List already uploaded parts for resuming an interrupted upload.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const uploadId = searchParams.get("uploadId");
    const key = searchParams.get("key");

    if (!uploadId || !key) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "uploadId and key are required" } },
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

    // List uploaded parts
    const parts = await listUploadedParts(key, uploadId);

    return NextResponse.json({
      success: true,
      parts,
      uploadedPartCount: parts.length,
    });
  } catch (error) {
    console.error("Error listing multipart upload parts:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list upload parts" } },
      { status: 500 }
    );
  }
}
