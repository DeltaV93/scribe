/**
 * Meeting Bot Join API (PX-865)
 * POST /api/meeting-bot/join
 *
 * Request a bot to join a video meeting
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit/service";
import {
  joinMeeting,
  parseMeetingUrl,
  isMeetingBotEnabled,
  isBotServiceConfigured,
} from "@/lib/meeting-bot";
import { ConversationType, ConversationStatus, ConsentStatus } from "@prisma/client";

interface JoinMeetingBody {
  meetingUrl: string;
  title?: string;
  meetingPassword?: string;
  displayName?: string;
  clientIds?: string[];
  formIds?: string[];
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  // Check feature flag
  const enabled = await isMeetingBotEnabled(user.orgId);
  if (!enabled) {
    return NextResponse.json(
      {
        error: {
          code: "FEATURE_DISABLED",
          message: "Video meeting bot is not enabled for your organization",
        },
      },
      { status: 403 }
    );
  }

  // Check bot service configuration
  if (!isBotServiceConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Meeting bot service is not configured. This feature is coming soon.",
        },
      },
      { status: 503 }
    );
  }

  // Parse request body
  let body: JoinMeetingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid request body" } },
      { status: 400 }
    );
  }

  // Validate meeting URL
  if (!body.meetingUrl) {
    return NextResponse.json(
      { error: { code: "MISSING_URL", message: "Meeting URL is required" } },
      { status: 400 }
    );
  }

  // Parse and validate meeting URL
  const meetingInfo = parseMeetingUrl(body.meetingUrl);
  if (!meetingInfo.isValid) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_URL",
          message: meetingInfo.error || "Invalid meeting URL",
        },
      },
      { status: 400 }
    );
  }

  try {
    // Create conversation record
    const conversation = await prisma.conversation.create({
      data: {
        orgId: user.orgId,
        type: ConversationType.VIDEO_MEETING,
        title: body.title || `${meetingInfo.platform} Meeting`,
        status: ConversationStatus.SCHEDULED,
        isRecorded: true,
        consentStatus: ConsentStatus.PENDING,
        formIds: body.formIds || [],
        createdById: user.id,
        // Create video meeting details
        videoMeetingDetails: {
          create: {
            platform: meetingInfo.platform,
            meetingUrl: body.meetingUrl,
            externalMeetingId: meetingInfo.meetingId,
          },
        },
      },
      include: {
        videoMeetingDetails: true,
      },
    });

    // Link clients if provided
    if (body.clientIds && body.clientIds.length > 0) {
      await prisma.conversationClient.createMany({
        data: body.clientIds.map((clientId) => ({
          conversationId: conversation.id,
          clientId,
        })),
      });
    }

    // Request bot to join
    const joinResult = await joinMeeting({
      platform: meetingInfo.platform,
      meetingUrl: body.meetingUrl,
      conversationId: conversation.id,
      displayName: body.displayName || "Inkra Notetaker",
      orgId: user.orgId,
      userId: user.id,
      meetingPassword: meetingInfo.password || body.meetingPassword,
      recordAudio: true,
      recordVideo: false,
      joinBeforeHost: true,
      maxWaitMinutes: 15,
      maxDurationMinutes: 180,
    });

    if (!joinResult.success) {
      // Clean up conversation on failure
      await prisma.conversation.delete({
        where: { id: conversation.id },
      });

      return NextResponse.json(
        {
          error: {
            code: joinResult.error?.code || "JOIN_FAILED",
            message: joinResult.error?.message || "Failed to join meeting",
          },
        },
        { status: 500 }
      );
    }

    // Audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "CREATE",
      resource: "CONVERSATION",
      resourceId: conversation.id,
      details: {
        type: "VIDEO_MEETING",
        platform: meetingInfo.platform,
        botId: joinResult.data?.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        botId: joinResult.data?.id,
        status: joinResult.data?.status,
        platform: meetingInfo.platform,
        meetingId: meetingInfo.meetingId,
      },
    });
  } catch (error) {
    console.error("[MeetingBot] Join error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to initiate meeting capture",
        },
      },
      { status: 500 }
    );
  }
}
