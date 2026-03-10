/**
 * Meeting Bot Leave API (PX-865)
 * POST /api/meeting-bot/leave
 *
 * Request a bot to leave a video meeting
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit/service";
import { leaveMeeting, getBotStatus } from "@/lib/meeting-bot";

interface LeaveMeetingBody {
  botId: string;
  reason?: "user_requested" | "meeting_ended" | "timeout" | "error";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  // Parse request body
  let body: LeaveMeetingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid request body" } },
      { status: 400 }
    );
  }

  // Validate bot ID
  if (!body.botId) {
    return NextResponse.json(
      { error: { code: "MISSING_BOT_ID", message: "Bot ID is required" } },
      { status: 400 }
    );
  }

  try {
    // Get bot status to verify ownership
    const botInstance = await getBotStatus(body.botId);

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

    // Request bot to leave
    const leaveResult = await leaveMeeting(body.botId, body.reason || "user_requested");

    if (!leaveResult.success) {
      return NextResponse.json(
        {
          error: {
            code: leaveResult.error?.code || "LEAVE_FAILED",
            message: leaveResult.error?.message || "Failed to leave meeting",
          },
        },
        { status: 500 }
      );
    }

    // Audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "CONVERSATION",
      resourceId: botInstance.conversationId,
      details: {
        action: "bot_leave_requested",
        botId: body.botId,
        reason: body.reason || "user_requested",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        botId: body.botId,
        status: "leaving",
      },
    });
  } catch (error) {
    console.error("[MeetingBot] Leave error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to leave meeting",
        },
      },
      { status: 500 }
    );
  }
}
