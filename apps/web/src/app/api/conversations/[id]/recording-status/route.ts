import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { objectExists, S3BucketType, getObjectMetadata } from "@/lib/storage/secure-s3";
import { generateRecordingKey } from "@/lib/recording";
import type { RecoveryStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RecordingStatusResponse {
  hasRecording: boolean;
  recordingSize?: number;
  uploadedAt?: string;
  canRecover: boolean;
  presignedUrlValid: boolean;
  presignedUrlExpiresAt?: string;
  recoveryStatus: RecoveryStatus | null;
  suggestedAction: "process" | "upload" | "extend" | "abandon";
  lastHeartbeat: string | null;
  startedAt: string;
  durationSeconds: number | null;
}

/**
 * GET /api/conversations/:id/recording-status
 *
 * Check S3 for recording existence and return recovery options.
 * Used by RecordingRecoveryPanel to determine available actions.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Fetch conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        createdById: true,
        status: true,
        recordingUrl: true,
        recoveryStatus: true,
        lastHeartbeat: true,
        startedAt: true,
        durationSeconds: true,
        createdAt: true,
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

    // Only creator or admin can check recording status for recovery
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (conversation.createdById !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the recording creator or admin can check status" } },
        { status: 403 }
      );
    }

    // Check if recording exists in S3
    let hasRecording = false;
    let recordingSize: number | undefined;
    let uploadedAt: string | undefined;

    // If recordingUrl is already set, the recording exists
    if (conversation.recordingUrl) {
      hasRecording = true;
      try {
        const metadata = await getObjectMetadata(
          S3BucketType.RECORDINGS,
          conversation.recordingUrl
        );
        if (metadata) {
          recordingSize = metadata.contentLength;
          uploadedAt = metadata.lastModified?.toISOString();
        }
      } catch {
        // Metadata fetch failed, but recording URL exists
      }
    } else {
      // Try the expected key pattern
      const expectedKey = generateRecordingKey(conversation.orgId, conversation.id, "webm");
      try {
        hasRecording = await objectExists(S3BucketType.RECORDINGS, expectedKey);
        if (hasRecording) {
          const metadata = await getObjectMetadata(S3BucketType.RECORDINGS, expectedKey);
          if (metadata) {
            recordingSize = metadata.contentLength;
            uploadedAt = metadata.lastModified?.toISOString();
          }
        }
      } catch {
        // S3 check failed, assume no recording
      }
    }

    // Calculate presigned URL validity (1 hour from creation)
    const presignedUrlValidDuration = 60 * 60 * 1000; // 1 hour in ms
    const presignedUrlExpiresAt = new Date(conversation.createdAt.getTime() + presignedUrlValidDuration);
    const presignedUrlValid = presignedUrlExpiresAt > new Date();

    // Determine suggested action
    let suggestedAction: "process" | "upload" | "extend" | "abandon";
    let canRecover = false;

    if (hasRecording) {
      suggestedAction = "process";
      canRecover = true;
    } else if (presignedUrlValid) {
      suggestedAction = "upload";
      canRecover = true;
    } else {
      // Presigned URL expired and no recording found
      suggestedAction = "abandon";
      canRecover = false;
    }

    // Override with existing recovery status if set
    if (conversation.recoveryStatus === "ABANDONED") {
      suggestedAction = "abandon";
      canRecover = false;
    }

    const response: RecordingStatusResponse = {
      hasRecording,
      recordingSize,
      uploadedAt,
      canRecover,
      presignedUrlValid,
      presignedUrlExpiresAt: presignedUrlExpiresAt.toISOString(),
      recoveryStatus: conversation.recoveryStatus,
      suggestedAction,
      lastHeartbeat: conversation.lastHeartbeat?.toISOString() || null,
      startedAt: conversation.startedAt.toISOString(),
      durationSeconds: conversation.durationSeconds,
    };

    return NextResponse.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error("Error checking recording status:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to check recording status" } },
      { status: 500 }
    );
  }
}
