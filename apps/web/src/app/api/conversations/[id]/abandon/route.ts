import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { secureDelete, S3BucketType, objectExists } from "@/lib/storage/secure-s3";
import { generateRecordingKey } from "@/lib/recording";
import { createAuditLog } from "@/lib/audit/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AbandonRequest {
  deleteRecording?: boolean; // Whether to delete any existing S3 recording
  reason?: string; // Optional reason for abandonment
}

/**
 * POST /api/conversations/:id/abandon
 *
 * Mark a stuck recording as abandoned/failed.
 * Optionally deletes any partial recording from S3.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: AbandonRequest = await request.json().catch(() => ({}));

    const { deleteRecording = false, reason } = body;

    // Fetch conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        createdById: true,
        status: true,
        recordingUrl: true,
        type: true,
        title: true,
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

    // Only creator or admin can abandon
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (conversation.createdById !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the recording creator or admin can abandon" } },
        { status: 403 }
      );
    }

    // Only allow abandoning RECORDING status conversations
    if (conversation.status !== "RECORDING") {
      return NextResponse.json(
        { error: { code: "INVALID_STATUS", message: `Cannot abandon conversation with status: ${conversation.status}` } },
        { status: 400 }
      );
    }

    // Delete recording from S3 if requested
    let deletedRecording = false;
    if (deleteRecording) {
      // Try the recorded URL first
      if (conversation.recordingUrl) {
        try {
          await secureDelete(S3BucketType.RECORDINGS, conversation.recordingUrl);
          deletedRecording = true;
        } catch (error) {
          console.warn(`Failed to delete recording at ${conversation.recordingUrl}:`, error);
        }
      } else {
        // Try expected key pattern
        const expectedKey = generateRecordingKey(conversation.orgId, conversation.id, "webm");
        try {
          const exists = await objectExists(S3BucketType.RECORDINGS, expectedKey);
          if (exists) {
            await secureDelete(S3BucketType.RECORDINGS, expectedKey);
            deletedRecording = true;
          }
        } catch (error) {
          console.warn(`Failed to delete recording at ${expectedKey}:`, error);
        }
      }
    }

    // Update conversation status
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: {
        status: "FAILED",
        recoveryStatus: "ABANDONED",
        endedAt: new Date(),
        aiProcessingError: reason || "Recording abandoned by user",
        // Clear recording URL if we deleted it
        ...(deletedRecording && { recordingUrl: null }),
      },
      select: {
        id: true,
        status: true,
        recoveryStatus: true,
        endedAt: true,
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
        operation: "ABANDON",
        reason,
        deletedRecording,
        previousStatus: conversation.status,
      },
    });

    console.log(
      `[Abandon] User ${user.id} abandoned conversation ${id}. ` +
      `Deleted recording: ${deletedRecording}. Reason: ${reason || "none"}`
    );

    return NextResponse.json({
      success: true,
      conversation: updatedConversation,
      deletedRecording,
    });
  } catch (error) {
    console.error("Error abandoning conversation:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to abandon conversation" } },
      { status: 500 }
    );
  }
}
