/**
 * Meeting Bot Status API (PX-865)
 * GET /api/meeting-bot/status/:botId
 *
 * Get the status of a meeting bot
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBotStatus } from "@/lib/meeting-bot";

interface RouteContext {
  params: Promise<{ botId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const params = await context.params;
  const { botId } = params;

  if (!botId) {
    return NextResponse.json(
      { error: { code: "MISSING_BOT_ID", message: "Bot ID is required" } },
      { status: 400 }
    );
  }

  try {
    const botInstance = await getBotStatus(botId);

    if (!botInstance) {
      return NextResponse.json(
        { error: { code: "BOT_NOT_FOUND", message: "Bot instance not found" } },
        { status: 404 }
      );
    }

    // Verify user has access (same org)
    if (botInstance.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: botInstance.id,
        conversationId: botInstance.conversationId,
        platform: botInstance.platform,
        status: botInstance.status,
        displayName: botInstance.displayName,
        createdAt: botInstance.createdAt.toISOString(),
        joinedAt: botInstance.joinedAt?.toISOString() || null,
        leftAt: botInstance.leftAt?.toISOString() || null,
        recordingStartedAt: botInstance.recordingStartedAt?.toISOString() || null,
        participantCount: botInstance.participantCount || null,
        participants: botInstance.participants || [],
        error: botInstance.error || null,
        errorCode: botInstance.errorCode || null,
        retryCount: botInstance.retryCount,
      },
    });
  } catch (error) {
    console.error("[MeetingBot] Status error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get bot status",
        },
      },
      { status: 500 }
    );
  }
}
