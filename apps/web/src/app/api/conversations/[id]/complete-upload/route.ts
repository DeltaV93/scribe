import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  completeMultipartUpload,
  abortMultipartUpload,
  type CompletedPartInfo,
} from "@/lib/storage/multipart-s3";
import { createAuditLog } from "@/lib/audit/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface CompleteUploadRequest {
  uploadId: string;
  key: string;
  parts: CompletedPartInfo[];
}

interface AbortUploadRequest {
  uploadId: string;
  key: string;
}

/**
 * POST /api/conversations/:id/complete-upload
 *
 * Complete a multipart upload after all parts have been uploaded.
 * This assembles the parts into a single object in S3.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: CompleteUploadRequest = await request.json();

    const { uploadId, key, parts } = body;

    // Validate required fields
    if (!uploadId || !key || !parts || parts.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "uploadId, key, and parts are required" } },
        { status: 400 }
      );
    }

    // Validate parts format
    for (const part of parts) {
      if (!part.partNumber || !part.etag) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Each part must have partNumber and etag" } },
          { status: 400 }
        );
      }
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

    // Only creator can complete upload
    if (conversation.createdById !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the recording creator can complete upload" } },
        { status: 403 }
      );
    }

    // Complete the multipart upload
    const result = await completeMultipartUpload(key, uploadId, parts);

    // Update conversation with recording URL
    await prisma.conversation.update({
      where: { id },
      data: {
        recordingUrl: key,
        // Clear recovery status since we now have a recording
        recoveryStatus: null,
      },
    });

    // Audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "CONVERSATION",
      resourceId: id,
      details: {
        operation: "MULTIPART_UPLOAD_COMPLETE",
        key,
        partCount: parts.length,
      },
    });

    console.log(
      `[CompleteUpload] Completed multipart upload for conversation ${id}, ` +
      `parts=${parts.length}, key=${key}`
    );

    return NextResponse.json({
      success: true,
      location: result.location,
      key: result.key,
    });
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to complete multipart upload" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id/complete-upload
 *
 * Abort a multipart upload (cleanup failed uploads).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: AbortUploadRequest = await request.json();

    const { uploadId, key } = body;

    // Validate required fields
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

    // Abort the multipart upload
    await abortMultipartUpload(key, uploadId);

    console.log(
      `[CompleteUpload] Aborted multipart upload for conversation ${id}, uploadId=${uploadId}`
    );

    return NextResponse.json({
      success: true,
      message: "Multipart upload aborted",
    });
  } catch (error) {
    console.error("Error aborting multipart upload:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to abort multipart upload" } },
      { status: 500 }
    );
  }
}
