import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPresignedUploadUrl, calculateRetentionDate } from "@/lib/recording";
import { addParticipant } from "@/lib/services/conversation-access";
import { createAuditLog } from "@/lib/audit/service";
import { isFeatureEnabled } from "@/lib/features/flags";
import type { ConversationType } from "@prisma/client";

/**
 * POST /api/conversations/in-person - Create in-person recording conversation
 * Returns presigned S3 upload URL for direct client upload
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const {
      title,
      clientIds = [],
      participants = [],
      location,
      formIds = [],
    } = body;

    // Check if conversation capture feature is enabled
    const isEnabled = await isFeatureEnabled(user.orgId, 'conversation-capture');
    if (!isEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "In-person recording is not enabled for this organization" } },
        { status: 403 }
      );
    }

    // Get org settings for retention
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: {
        recordingRetentionDays: true,
        maxRecordingDurationMinutes: true,
      },
    });

    // Default values if org settings not found
    const recordingRetentionDays = org?.recordingRetentionDays ?? 90;
    const maxRecordingDurationMinutes = org?.maxRecordingDurationMinutes ?? 120;

    // Create conversation record
    const conversation = await prisma.conversation.create({
      data: {
        orgId: user.orgId,
        type: "IN_PERSON" as ConversationType,
        title: title || `In-Person Recording - ${new Date().toLocaleDateString()}`,
        status: "RECORDING",
        startedAt: new Date(),
        recordingRetention: calculateRetentionDate(recordingRetentionDays),
        formIds,
        createdById: user.id,
        inPersonDetails: {
          create: {
            participants,
            clientIds,
            location,
            deviceInfo: {
              userAgent: request.headers.get("user-agent"),
            },
          },
        },
      },
      include: {
        inPersonDetails: true,
      },
    });

    // Add creator as participant
    await addParticipant(conversation.id, user.id);

    // Link clients
    if (clientIds.length > 0) {
      await prisma.conversationClient.createMany({
        data: clientIds.map((clientId: string, index: number) => ({
          conversationId: conversation.id,
          clientId,
          isPrimary: index === 0,
        })),
      });
    }

    // Get presigned upload URL
    const uploadInfo = await getPresignedUploadUrl(
      user.orgId,
      conversation.id,
      "audio/webm"
    );

    // Audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "CREATE",
      resource: "CONVERSATION",
      resourceId: conversation.id,
      details: {
        type: "IN_PERSON",
        clientIds,
        participantCount: participants.length,
      },
    });

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        type: conversation.type,
        title: conversation.title,
        status: conversation.status,
        startedAt: conversation.startedAt,
      },
      upload: {
        url: uploadInfo.uploadUrl,
        key: uploadInfo.key,
        expiresAt: uploadInfo.expiresAt,
      },
      maxDurationMinutes: maxRecordingDurationMinutes,
    });
  } catch (error) {
    console.error("Error creating in-person conversation:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create conversation" } },
      { status: 500 }
    );
  }
}
