/**
 * Meeting Integrations Service
 *
 * Central service for managing Teams/Zoom/Google Meet integrations.
 * Handles OAuth flows, credential storage, webhook management, and
 * recording processing.
 */

import { prisma } from "@/lib/db";
import { MeetingPlatform, IntegrationStatus, Prisma } from "@prisma/client";
import { createMeeting, startMeetingProcessing } from "../index";
import { teamsService } from "./teams";
import { zoomService } from "./zoom";
import { googleMeetService } from "./google-meet";
import {
  Integration,
  IntegrationSettings,
  MeetingPlatformService,
  OAuthState,
  OAuthTokens,
  RecordingEvent,
} from "./types";

// Re-export types and services
export * from "./types";
export { teamsService } from "./teams";
export { zoomService } from "./zoom";
export { googleMeetService } from "./google-meet";

// ============================================
// PLATFORM SERVICE REGISTRY
// ============================================

const platformServices: Record<MeetingPlatform, MeetingPlatformService> = {
  [MeetingPlatform.TEAMS]: teamsService,
  [MeetingPlatform.ZOOM]: zoomService,
  [MeetingPlatform.GOOGLE_MEET]: googleMeetService,
};

/**
 * Get platform-specific service
 */
export function getPlatformService(
  platform: MeetingPlatform
): MeetingPlatformService {
  const service = platformServices[platform];
  if (!service) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return service;
}

// ============================================
// OAUTH STATE MANAGEMENT
// ============================================

const OAUTH_STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes

/**
 * Generate and encode OAuth state parameter
 */
export function generateOAuthState(params: Omit<OAuthState, "timestamp">): string {
  const state: OAuthState = {
    ...params,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

/**
 * Decode and validate OAuth state parameter
 */
export function parseOAuthState(stateParam: string): OAuthState | null {
  try {
    const decoded = Buffer.from(stateParam, "base64url").toString();
    const state = JSON.parse(decoded) as OAuthState;

    // Validate timestamp
    if (Date.now() - state.timestamp > OAUTH_STATE_EXPIRY) {
      console.warn("[OAuth] State parameter expired");
      return null;
    }

    return state;
  } catch (error) {
    console.error("[OAuth] Failed to parse state:", error);
    return null;
  }
}

// ============================================
// INTEGRATION MANAGEMENT
// ============================================

/**
 * List all integrations for an organization
 */
export async function listIntegrations(orgId: string): Promise<Integration[]> {
  const integrations = await prisma.meetingIntegration.findMany({
    where: { orgId },
    orderBy: { connectedAt: "desc" },
  });

  return integrations.map(mapPrismaIntegration);
}

/**
 * Get a specific integration
 */
export async function getIntegration(
  orgId: string,
  platform: MeetingPlatform
): Promise<Integration | null> {
  const integration = await prisma.meetingIntegration.findUnique({
    where: { orgId_platform: { orgId, platform } },
  });

  return integration ? mapPrismaIntegration(integration) : null;
}

/**
 * Initialize OAuth flow for a platform
 */
export async function initiateOAuthFlow(
  orgId: string,
  userId: string,
  platform: MeetingPlatform,
  redirectUrl?: string
): Promise<string> {
  const service = getPlatformService(platform);

  // Generate state parameter
  const state = generateOAuthState({
    orgId,
    userId,
    platform,
    redirectUrl,
  });

  // Get authorization URL
  return service.getAuthorizationUrl(state);
}

/**
 * Complete OAuth flow with authorization code
 */
export async function completeOAuthFlow(
  code: string,
  state: OAuthState
): Promise<Integration> {
  const { orgId, userId, platform } = state;
  const service = getPlatformService(platform);

  // Exchange code for tokens
  const tokens = await service.exchangeCodeForTokens(code);

  // Get user info from platform
  let externalUserId: string | undefined;
  let externalTenantId: string | undefined;

  try {
    if (platform === MeetingPlatform.TEAMS) {
      const profile = await (service as typeof teamsService).getUserProfile(
        tokens.accessToken
      );
      externalUserId = profile.id;
    } else if (platform === MeetingPlatform.ZOOM) {
      const profile = await (service as typeof zoomService).getUserProfile(
        tokens.accessToken
      );
      externalUserId = profile.id;
    } else if (platform === MeetingPlatform.GOOGLE_MEET) {
      const profile = await (service as typeof googleMeetService).getUserProfile(
        tokens.accessToken
      );
      externalUserId = profile.id;
    }
  } catch (error) {
    console.warn(`[${platform}] Failed to get user profile:`, error);
  }

  // Save integration
  const integration = await prisma.meetingIntegration.upsert({
    where: { orgId_platform: { orgId, platform } },
    create: {
      orgId,
      platform,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      externalUserId,
      externalTenantId,
      status: IntegrationStatus.ACTIVE,
      connectedById: userId,
    },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      externalUserId,
      externalTenantId,
      status: IntegrationStatus.ACTIVE,
      lastError: null,
      errorCount: 0,
    },
  });

  // Register webhook
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meetings/${platform.toLowerCase()}`;
    const subscription = await service.registerWebhook(
      tokens.accessToken,
      webhookUrl
    );

    await prisma.meetingIntegration.update({
      where: { id: integration.id },
      data: {
        webhookId: subscription.id,
        webhookExpiresAt: subscription.expiresAt,
      },
    });
  } catch (error) {
    console.warn(`[${platform}] Failed to register webhook:`, error);
    // Don't fail the integration setup if webhook registration fails
  }

  return mapPrismaIntegration(integration);
}

/**
 * Disconnect an integration
 */
export async function disconnectIntegration(
  orgId: string,
  platform: MeetingPlatform
): Promise<void> {
  const integration = await prisma.meetingIntegration.findUnique({
    where: { orgId_platform: { orgId, platform } },
  });

  if (!integration) {
    return;
  }

  // Unregister webhook if exists
  if (integration.webhookId && integration.accessToken) {
    try {
      const service = getPlatformService(platform);
      await service.unregisterWebhook(
        integration.accessToken,
        integration.webhookId
      );
    } catch (error) {
      console.warn(`[${platform}] Failed to unregister webhook:`, error);
    }
  }

  // Update status to disconnected
  await prisma.meetingIntegration.update({
    where: { id: integration.id },
    data: {
      status: IntegrationStatus.DISCONNECTED,
      accessToken: null,
      refreshToken: null,
      webhookId: null,
    },
  });
}

/**
 * Update integration settings
 */
export async function updateIntegrationSettings(
  orgId: string,
  platform: MeetingPlatform,
  settings: Partial<IntegrationSettings>
): Promise<Integration> {
  const integration = await prisma.meetingIntegration.update({
    where: { orgId_platform: { orgId, platform } },
    data: {
      autoRecordEnabled: settings.autoRecordEnabled,
      syncCalendarEnabled: settings.syncCalendarEnabled,
      settings: settings as Prisma.InputJsonValue,
    },
  });

  return mapPrismaIntegration(integration);
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(
  orgId: string,
  platform: MeetingPlatform
): Promise<string | null> {
  const integration = await prisma.meetingIntegration.findUnique({
    where: { orgId_platform: { orgId, platform } },
  });

  if (!integration || integration.status === IntegrationStatus.DISCONNECTED) {
    return null;
  }

  // Check if token is expired or expiring soon (within 5 minutes)
  const isExpiring =
    integration.tokenExpiresAt &&
    integration.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpiring && integration.refreshToken) {
    try {
      const service = getPlatformService(platform);
      const tokens = await service.refreshAccessToken(integration.refreshToken);

      await prisma.meetingIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || integration.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          status: IntegrationStatus.ACTIVE,
          lastError: null,
        },
      });

      return tokens.accessToken;
    } catch (error) {
      console.error(`[${platform}] Token refresh failed:`, error);

      await prisma.meetingIntegration.update({
        where: { id: integration.id },
        data: {
          status: IntegrationStatus.EXPIRED,
          lastError: error instanceof Error ? error.message : "Token refresh failed",
        },
      });

      return null;
    }
  }

  return integration.accessToken;
}

// ============================================
// WEBHOOK PROCESSING
// ============================================

/**
 * Process incoming webhook from meeting platform
 */
export async function processRecordingWebhook(
  platform: MeetingPlatform,
  payload: unknown,
  signature?: string
): Promise<{ processed: boolean; meetingId?: string }> {
  const service = getPlatformService(platform);

  // Find integration with this platform
  // For now, we'll need to look up by platform; in production,
  // use webhook secrets or tokens to identify the org
  const integrations = await prisma.meetingIntegration.findMany({
    where: {
      platform,
      status: IntegrationStatus.ACTIVE,
    },
  });

  if (integrations.length === 0) {
    console.warn(`[${platform}] No active integrations found`);
    return { processed: false };
  }

  // Parse the webhook payload
  const event = service.parseWebhookPayload(payload);
  if (!event) {
    console.log(`[${platform}] Webhook payload not a recording event`);
    return { processed: false };
  }

  // For each integration, check if this event belongs to them
  // In production, use webhook secrets/tokens to match
  for (const integration of integrations) {
    try {
      // Validate webhook signature if we have a secret
      if (integration.webhookSecret) {
        const isValid = service.validateWebhook(
          payload,
          signature,
          integration.webhookSecret
        );
        if (!isValid) continue;
      }

      // Get valid access token
      const accessToken = await getValidAccessToken(
        integration.orgId,
        platform
      );
      if (!accessToken) continue;

      // Download recording if URL is available
      let recordingPath: string | undefined;
      if (event.recordingUrl) {
        try {
          const recordingBuffer = await service.downloadRecording(
            accessToken,
            event.recordingUrl
          );

          // In production, upload to S3
          // For now, we'll save the URL
          recordingPath = event.recordingUrl;

          console.log(
            `[${platform}] Downloaded recording: ${recordingBuffer.length} bytes`
          );
        } catch (error) {
          console.error(`[${platform}] Failed to download recording:`, error);
        }
      }

      // Create meeting record
      const meeting = await createMeeting({
        orgId: integration.orgId,
        createdById: integration.connectedById,
        title: event.meetingTitle || `${platform} Meeting`,
        source: platform === MeetingPlatform.TEAMS ? "TEAMS"
              : platform === MeetingPlatform.ZOOM ? "ZOOM"
              : "GOOGLE_MEET",
        externalMeetingId: event.meetingId,
        participants: event.participants?.map((p) => ({
          email: p.email,
          name: p.name || "Unknown",
        })),
      });

      // Start processing if we have a recording
      if (recordingPath) {
        await startMeetingProcessing({
          meetingId: meeting.id,
          orgId: integration.orgId,
          userId: integration.connectedById,
          recordingPath,
        });
      }

      // Update last sync time
      await prisma.meetingIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() },
      });

      return { processed: true, meetingId: meeting.id };
    } catch (error) {
      console.error(`[${platform}] Error processing webhook:`, error);

      // Increment error count
      await prisma.meetingIntegration.update({
        where: { id: integration.id },
        data: {
          errorCount: { increment: 1 },
          lastError: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  return { processed: false };
}

// ============================================
// HELPERS
// ============================================

function mapPrismaIntegration(
  integration: Prisma.MeetingIntegrationGetPayload<object>
): Integration {
  return {
    id: integration.id,
    orgId: integration.orgId,
    platform: integration.platform,
    status: integration.status,
    settings: (integration.settings as IntegrationSettings) || {},
    autoRecordEnabled: integration.autoRecordEnabled,
    syncCalendarEnabled: integration.syncCalendarEnabled,
    lastSyncAt: integration.lastSyncAt,
    lastError: integration.lastError,
    connectedAt: integration.connectedAt,
  };
}
