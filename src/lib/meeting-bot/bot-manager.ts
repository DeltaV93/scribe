/**
 * Meeting Bot Manager (PX-865)
 * Orchestrates video meeting bot operations
 *
 * The actual bot (headless browser) runs as a separate service.
 * This manager handles:
 * - Communication with the bot service via API
 * - Database state management
 * - Webhook handling for status updates
 * - Platform-specific URL parsing
 */

import { prisma } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/features/flags";
import { VideoPlatform, ConversationStatus } from "@prisma/client";
import type {
  MeetingBotConfig,
  BotInstance,
  BotStatus,
  BotServiceResponse,
  JoinMeetingRequest,
  LeaveMeetingRequest,
  BotStatusWebhook,
  RecordingCompletedWebhook,
  ParsedMeetingInfo,
  BotServiceHealth,
  BotErrorCode,
} from "./types";
import { BOT_ERROR_CODES } from "./types";
import { isZoomUrl, parseZoomUrl } from "./platforms/zoom";
import { isGoogleMeetUrl, parseGoogleMeetUrl } from "./platforms/google-meet";
import { isTeamsUrl, parseTeamsUrl } from "./platforms/teams";
import { queueForProcessing } from "@/lib/services/conversation-processing";
import { createAuditLog } from "@/lib/audit/service";

// Bot service configuration
const BOT_SERVICE_URL = process.env.MEETING_BOT_SERVICE_URL || "";
const BOT_SERVICE_API_KEY = process.env.MEETING_BOT_API_KEY || "";
const WEBHOOK_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "";

// Default bot display name
const DEFAULT_BOT_NAME = "Inkra Notetaker";

// In-memory store for active bot instances (production would use Redis)
const activeBots = new Map<string, BotInstance>();

/**
 * Check if meeting bot feature is enabled for organization
 */
export async function isMeetingBotEnabled(orgId: string): Promise<boolean> {
  return isFeatureEnabled(orgId, "video-meeting-bot");
}

/**
 * Check if bot service is configured and available
 */
export function isBotServiceConfigured(): boolean {
  return Boolean(BOT_SERVICE_URL && BOT_SERVICE_API_KEY);
}

/**
 * Parse meeting URL to determine platform and extract meeting info
 */
export function parseMeetingUrl(url: string): ParsedMeetingInfo {
  const trimmedUrl = url.trim();

  if (isZoomUrl(trimmedUrl)) {
    return parseZoomUrl(trimmedUrl);
  }

  if (isGoogleMeetUrl(trimmedUrl)) {
    return parseGoogleMeetUrl(trimmedUrl);
  }

  if (isTeamsUrl(trimmedUrl)) {
    return parseTeamsUrl(trimmedUrl);
  }

  // Unknown platform
  return {
    platform: "ZOOM", // Default fallback
    meetingId: "",
    isValid: false,
    error: "Unsupported meeting platform. Please use Zoom, Google Meet, or Microsoft Teams.",
  };
}

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): VideoPlatform | null {
  const trimmedUrl = url.trim().toLowerCase();

  if (isZoomUrl(trimmedUrl)) {
    return "ZOOM";
  }
  if (isGoogleMeetUrl(trimmedUrl)) {
    return "GOOGLE_MEET";
  }
  if (isTeamsUrl(trimmedUrl)) {
    return "MICROSOFT_TEAMS";
  }

  return null;
}

/**
 * Request bot to join a meeting
 */
export async function joinMeeting(
  config: MeetingBotConfig
): Promise<BotServiceResponse<BotInstance>> {
  // Check if feature is enabled
  const enabled = await isMeetingBotEnabled(config.orgId);
  if (!enabled) {
    return {
      success: false,
      error: {
        code: "FEATURE_DISABLED",
        message: "Video meeting bot is not enabled for this organization",
      },
    };
  }

  // Check if bot service is configured
  if (!isBotServiceConfigured()) {
    return {
      success: false,
      error: {
        code: BOT_ERROR_CODES.BOT_SERVICE_UNAVAILABLE,
        message: "Meeting bot service is not configured",
      },
    };
  }

  // Parse and validate meeting URL
  const meetingInfo = parseMeetingUrl(config.meetingUrl);
  if (!meetingInfo.isValid) {
    return {
      success: false,
      error: {
        code: BOT_ERROR_CODES.INVALID_URL,
        message: meetingInfo.error || "Invalid meeting URL",
      },
    };
  }

  // Generate bot instance ID
  const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Create bot instance
  const botInstance: BotInstance = {
    id: botId,
    conversationId: config.conversationId,
    platform: config.platform,
    meetingUrl: config.meetingUrl,
    status: "joining",
    displayName: config.displayName || DEFAULT_BOT_NAME,
    orgId: config.orgId,
    userId: config.userId,
    createdAt: new Date(),
    retryCount: 0,
  };

  // Store in memory (would use Redis in production)
  activeBots.set(botId, botInstance);

  // Update conversation with bot info
  await prisma.conversation.update({
    where: { id: config.conversationId },
    data: {
      status: ConversationStatus.SCHEDULED,
      videoMeetingDetails: {
        upsert: {
          create: {
            platform: config.platform,
            meetingUrl: config.meetingUrl,
            externalMeetingId: meetingInfo.meetingId,
            botId: botId,
            botStatus: "joining",
          },
          update: {
            botId: botId,
            botStatus: "joining",
          },
        },
      },
    },
  });

  // Build webhook callback URL
  const callbackUrl = `${WEBHOOK_BASE_URL}/api/meeting-bot/webhook`;

  // Prepare request for bot service
  const joinRequest: JoinMeetingRequest = {
    botId,
    config: {
      ...config,
      meetingPassword: meetingInfo.password || config.meetingPassword,
    },
    callbackUrl,
  };

  try {
    // Call bot service
    const response = await fetch(`${BOT_SERVICE_URL}/api/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BOT_SERVICE_API_KEY}`,
      },
      body: JSON.stringify(joinRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Bot service error: ${response.status}`);
    }

    // Audit log
    await createAuditLog({
      orgId: config.orgId,
      userId: config.userId,
      action: "CREATE",
      resource: "CONVERSATION",
      resourceId: config.conversationId,
      details: {
        action: "bot_join_requested",
        platform: config.platform,
        botId,
      },
    });

    return {
      success: true,
      data: botInstance,
    };
  } catch (error) {
    // Update status to failed
    botInstance.status = "failed";
    botInstance.error = error instanceof Error ? error.message : "Failed to join meeting";
    activeBots.set(botId, botInstance);

    // Update conversation
    await prisma.conversation.update({
      where: { id: config.conversationId },
      data: {
        status: ConversationStatus.FAILED,
        videoMeetingDetails: {
          update: {
            botStatus: "failed",
          },
        },
      },
    });

    return {
      success: false,
      error: {
        code: BOT_ERROR_CODES.JOIN_FAILED,
        message: error instanceof Error ? error.message : "Failed to join meeting",
      },
    };
  }
}

/**
 * Request bot to leave a meeting
 */
export async function leaveMeeting(
  botId: string,
  reason: LeaveMeetingRequest["reason"] = "user_requested"
): Promise<BotServiceResponse<void>> {
  const botInstance = activeBots.get(botId);

  if (!botInstance) {
    return {
      success: false,
      error: {
        code: "BOT_NOT_FOUND",
        message: "Bot instance not found",
      },
    };
  }

  if (!isBotServiceConfigured()) {
    return {
      success: false,
      error: {
        code: BOT_ERROR_CODES.BOT_SERVICE_UNAVAILABLE,
        message: "Meeting bot service is not configured",
      },
    };
  }

  try {
    const leaveRequest: LeaveMeetingRequest = {
      botId,
      reason,
    };

    const response = await fetch(`${BOT_SERVICE_URL}/api/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BOT_SERVICE_API_KEY}`,
      },
      body: JSON.stringify(leaveRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Bot service error: ${response.status}`);
    }

    // Update bot status
    botInstance.status = "leaving";
    botInstance.leftAt = new Date();
    activeBots.set(botId, botInstance);

    // Update conversation
    await prisma.conversation.update({
      where: { id: botInstance.conversationId },
      data: {
        videoMeetingDetails: {
          update: {
            botStatus: "leaving",
          },
        },
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        code: BOT_ERROR_CODES.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : "Failed to leave meeting",
      },
    };
  }
}

/**
 * Get bot status
 */
export async function getBotStatus(botId: string): Promise<BotInstance | null> {
  // Check in-memory first
  const memoryBot = activeBots.get(botId);
  if (memoryBot) {
    return memoryBot;
  }

  // Check database
  const videoDetails = await prisma.videoMeetingDetails.findFirst({
    where: { botId },
    include: {
      conversation: true,
    },
  });

  if (!videoDetails) {
    return null;
  }

  // Reconstruct bot instance from database
  return {
    id: botId,
    conversationId: videoDetails.conversationId,
    platform: videoDetails.platform,
    meetingUrl: videoDetails.meetingUrl || "",
    status: (videoDetails.botStatus as BotStatus) || "idle",
    displayName: DEFAULT_BOT_NAME,
    orgId: videoDetails.conversation.orgId,
    userId: videoDetails.conversation.createdById,
    createdAt: videoDetails.conversation.createdAt,
    retryCount: 0,
  };
}

/**
 * Handle bot status webhook
 */
export async function handleStatusWebhook(
  payload: BotStatusWebhook
): Promise<void> {
  const { botId, conversationId, status, details } = payload;

  // Update in-memory state
  const botInstance = activeBots.get(botId);
  if (botInstance) {
    botInstance.status = status;
    if (details?.participantCount !== undefined) {
      botInstance.participantCount = details.participantCount;
    }
    if (details?.participants) {
      botInstance.participants = details.participants;
    }
    if (details?.error) {
      botInstance.error = details.error;
      botInstance.errorCode = details.errorCode;
    }
    if (status === "recording") {
      botInstance.recordingStartedAt = new Date();
    }
    if (status === "in_meeting") {
      botInstance.joinedAt = new Date();
    }
    if (status === "completed" || status === "failed" || status === "kicked") {
      botInstance.leftAt = new Date();
    }
    activeBots.set(botId, botInstance);
  }

  // Map bot status to conversation status
  let conversationStatus: ConversationStatus | undefined;
  switch (status) {
    case "in_meeting":
    case "recording":
      conversationStatus = ConversationStatus.RECORDING;
      break;
    case "completed":
      conversationStatus = ConversationStatus.PROCESSING;
      break;
    case "failed":
    case "kicked":
      conversationStatus = ConversationStatus.FAILED;
      break;
  }

  // Update database
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(conversationStatus && { status: conversationStatus }),
      videoMeetingDetails: {
        update: {
          botStatus: status,
          ...(details?.participantCount !== undefined && {
            participantCount: details.participantCount,
          }),
        },
      },
    },
  });

  // If meeting completed, clean up
  if (status === "completed" || status === "failed" || status === "kicked") {
    activeBots.delete(botId);
  }
}

/**
 * Handle recording completed webhook
 */
export async function handleRecordingCompleted(
  payload: RecordingCompletedWebhook
): Promise<void> {
  const { botId, conversationId, recordingUrl, duration } = payload;

  // Update conversation with recording info
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      recordingUrl,
      durationSeconds: duration,
      status: ConversationStatus.PROCESSING,
      endedAt: new Date(),
      videoMeetingDetails: {
        update: {
          botStatus: "completed",
          recordingUrl,
        },
      },
    },
  });

  // Clean up bot instance
  activeBots.delete(botId);

  // Queue for processing
  await queueForProcessing(conversationId);
}

/**
 * Get bot service health status
 */
export async function getBotServiceHealth(): Promise<BotServiceHealth | null> {
  if (!isBotServiceConfigured()) {
    return null;
  }

  try {
    const response = await fetch(`${BOT_SERVICE_URL}/api/health`, {
      headers: {
        Authorization: `Bearer ${BOT_SERVICE_API_KEY}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

/**
 * Get all active bots for an organization
 */
export async function getActiveBots(orgId: string): Promise<BotInstance[]> {
  const bots: BotInstance[] = [];

  // Check in-memory bots
  for (const bot of activeBots.values()) {
    if (bot.orgId === orgId) {
      bots.push(bot);
    }
  }

  return bots;
}

/**
 * Cancel a pending or joining bot
 */
export async function cancelBot(botId: string): Promise<BotServiceResponse<void>> {
  const botInstance = activeBots.get(botId);

  if (!botInstance) {
    return {
      success: false,
      error: {
        code: "BOT_NOT_FOUND",
        message: "Bot instance not found",
      },
    };
  }

  // Can only cancel if not already in meeting
  if (botInstance.status === "in_meeting" || botInstance.status === "recording") {
    return leaveMeeting(botId, "user_requested");
  }

  // Just clean up locally
  activeBots.delete(botId);

  await prisma.conversation.update({
    where: { id: botInstance.conversationId },
    data: {
      status: ConversationStatus.FAILED,
      videoMeetingDetails: {
        update: {
          botStatus: "failed",
        },
      },
    },
  });

  return { success: true };
}

// Export types for external use
export type { MeetingBotConfig, BotInstance, BotStatus, ParsedMeetingInfo };
