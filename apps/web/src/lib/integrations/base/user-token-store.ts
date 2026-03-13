/**
 * Per-User Integration Token Store (PX-882)
 *
 * Manages OAuth tokens at the user level for workflow integrations.
 * Each user connects their own account (Linear, Notion, Jira), so
 * tasks they create appear as created by them in the destination platform.
 *
 * Pattern: Follows CalendarIntegration model structure.
 */

import { prisma } from "@/lib/db";
import { IntegrationPlatform, UserIntegrationStatus } from "@prisma/client";
import type { PlatformConfig, WorkflowPlatform } from "./types";
import { isWorkflowPlatformEnabled } from "@/lib/features/flags";

// ============================================
// Types
// ============================================

/**
 * User integration connection from database
 */
export interface UserIntegrationConnectionData {
  id: string;
  userId: string;
  orgId: string;
  platform: IntegrationPlatform;
  config: PlatformConfig | null;
  status: UserIntegrationStatus;
  lastUsedAt: Date | null;
  lastError: string | null;
  externalUserId: string | null;
  externalUserName: string | null;
  connectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User connection status for API response
 */
export interface UserConnectionStatusResponse {
  connected: boolean;
  platformEnabled: boolean;
  connection: {
    id: string;
    status: UserIntegrationStatus;
    externalUserName: string | null;
    lastUsedAt: Date | null;
    lastError: string | null;
    connectedAt: Date | null;
  } | null;
}

// ============================================
// Platform Configuration
// ============================================

/**
 * Check if a platform has required environment variables
 */
export function isPlatformConfigured(platform: IntegrationPlatform): boolean {
  switch (platform) {
    case "LINEAR":
      return !!(
        process.env.LINEAR_CLIENT_ID && process.env.LINEAR_CLIENT_SECRET
      );
    case "NOTION":
      return !!(
        process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET
      );
    case "JIRA":
      return !!(
        process.env.JIRA_CLIENT_ID && process.env.JIRA_CLIENT_SECRET
      );
    default:
      return false;
  }
}

/**
 * Get OAuth callback URL for a platform (user flow)
 */
export function getUserCallbackUrl(platform: IntegrationPlatform): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/user/integrations/${platform.toLowerCase()}/callback`;
}

// ============================================
// Connection Storage
// ============================================

/**
 * Store or update a user's integration connection
 *
 * Creates IntegrationToken for secure token storage.
 */
export async function storeUserIntegrationConnection(
  userId: string,
  orgId: string,
  platform: IntegrationPlatform,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: Date | undefined,
  config: PlatformConfig | undefined,
  externalUserId?: string,
  externalUserName?: string
): Promise<void> {
  // Check for existing connection
  const existing = await prisma.userIntegrationConnection.findUnique({
    where: { userId_platform: { userId, platform } },
    include: { integrationToken: true },
  });

  if (existing) {
    // Update existing connection
    if (existing.integrationToken) {
      // Update token
      await prisma.integrationToken.update({
        where: { id: existing.integrationToken.id },
        data: {
          accessToken,
          refreshToken: refreshToken ?? null,
          expiresAt: expiresAt ?? null,
          issuedAt: new Date(),
        },
      });
    } else {
      // Create new token
      await prisma.integrationToken.create({
        data: {
          type: "WORKFLOW",
          accessToken,
          refreshToken: refreshToken ?? null,
          expiresAt: expiresAt ?? null,
          userIntegrationConnectionId: existing.id,
        },
      });
    }

    // Update connection
    await prisma.userIntegrationConnection.update({
      where: { id: existing.id },
      data: {
        config: config as object ?? undefined,
        status: "ACTIVE",
        lastError: null,
        externalUserId,
        externalUserName,
        connectedAt: new Date(),
      },
    });
  } else {
    // Create new connection with token
    const connection = await prisma.userIntegrationConnection.create({
      data: {
        userId,
        orgId,
        platform,
        config: config as object ?? undefined,
        status: "ACTIVE",
        externalUserId,
        externalUserName,
        connectedAt: new Date(),
      },
    });

    // Create token
    await prisma.integrationToken.create({
      data: {
        type: "WORKFLOW",
        accessToken,
        refreshToken: refreshToken ?? null,
        expiresAt: expiresAt ?? null,
        userIntegrationConnectionId: connection.id,
      },
    });
  }
}

/**
 * Get user's integration connection
 */
export async function getUserIntegrationConnection(
  userId: string,
  platform: IntegrationPlatform
): Promise<UserIntegrationConnectionData | null> {
  const connection = await prisma.userIntegrationConnection.findUnique({
    where: { userId_platform: { userId, platform } },
  });

  if (!connection || connection.status === "DISCONNECTED") {
    return null;
  }

  return {
    id: connection.id,
    userId: connection.userId,
    orgId: connection.orgId,
    platform: connection.platform,
    config: connection.config as PlatformConfig | null,
    status: connection.status,
    lastUsedAt: connection.lastUsedAt,
    lastError: connection.lastError,
    externalUserId: connection.externalUserId,
    externalUserName: connection.externalUserName,
    connectedAt: connection.connectedAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

/**
 * Get access token for a user (with refresh if needed)
 *
 * Returns null if connection doesn't exist or token is expired.
 */
export async function getUserAccessToken(
  userId: string,
  platform: IntegrationPlatform
): Promise<string | null> {
  const connection = await prisma.userIntegrationConnection.findUnique({
    where: { userId_platform: { userId, platform } },
    include: { integrationToken: true },
  });

  if (!connection || connection.status !== "ACTIVE" || !connection.integrationToken) {
    return null;
  }

  const token = connection.integrationToken;

  // Check if token is expired
  if (token.expiresAt && token.expiresAt < new Date()) {
    // Token expired - need to refresh
    if (!token.refreshToken) {
      // No refresh token, mark connection as error
      await markUserConnectionError(
        connection.id,
        "Token expired and no refresh token available"
      );
      return null;
    }

    // TODO: Implement token refresh for each platform
    // For now, mark as error
    await markUserConnectionError(
      connection.id,
      "Token expired - please reconnect"
    );
    return null;
  }

  // Update last used timestamp
  await prisma.userIntegrationConnection.update({
    where: { id: connection.id },
    data: { lastUsedAt: new Date() },
  });

  return token.accessToken;
}

/**
 * Check if user has an active connection to a platform
 */
export async function hasUserConnection(
  userId: string,
  platform: IntegrationPlatform
): Promise<boolean> {
  const connection = await prisma.userIntegrationConnection.findUnique({
    where: { userId_platform: { userId, platform } },
    select: { status: true },
  });

  return connection?.status === "ACTIVE";
}

/**
 * Disconnect a user's integration
 */
export async function disconnectUserIntegration(
  userId: string,
  platform: IntegrationPlatform
): Promise<void> {
  const connection = await prisma.userIntegrationConnection.findUnique({
    where: { userId_platform: { userId, platform } },
    include: { integrationToken: true },
  });

  if (!connection) return;

  // Delete token if exists
  if (connection.integrationToken) {
    await prisma.integrationToken.delete({
      where: { id: connection.integrationToken.id },
    });
  }

  // Mark connection as disconnected
  await prisma.userIntegrationConnection.update({
    where: { id: connection.id },
    data: {
      status: "DISCONNECTED",
      lastError: null,
    },
  });
}

/**
 * Mark a connection as having an error
 */
export async function markUserConnectionError(
  connectionId: string,
  error: string
): Promise<void> {
  await prisma.userIntegrationConnection.update({
    where: { id: connectionId },
    data: {
      status: "ERROR",
      lastError: error,
    },
  });
}

/**
 * Clear error status from a connection
 */
export async function clearUserConnectionError(
  connectionId: string
): Promise<void> {
  await prisma.userIntegrationConnection.update({
    where: { id: connectionId },
    data: {
      status: "ACTIVE",
      lastError: null,
    },
  });
}

// ============================================
// Query Helpers
// ============================================

/**
 * Get all active connections for a user
 */
export async function getUserConnections(
  userId: string
): Promise<UserIntegrationConnectionData[]> {
  const connections = await prisma.userIntegrationConnection.findMany({
    where: { userId, status: "ACTIVE" },
  });

  return connections.map((c) => ({
    id: c.id,
    userId: c.userId,
    orgId: c.orgId,
    platform: c.platform,
    config: c.config as PlatformConfig | null,
    status: c.status,
    lastUsedAt: c.lastUsedAt,
    lastError: c.lastError,
    externalUserId: c.externalUserId,
    externalUserName: c.externalUserName,
    connectedAt: c.connectedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

/**
 * Get users in an org who have connected a specific platform
 */
export async function getOrgUsersWithConnection(
  orgId: string,
  platform: IntegrationPlatform
): Promise<Array<{ userId: string; externalUserName: string | null; connectedAt: Date | null }>> {
  const connections = await prisma.userIntegrationConnection.findMany({
    where: { orgId, platform, status: "ACTIVE" },
    select: {
      userId: true,
      externalUserName: true,
      connectedAt: true,
    },
  });

  return connections;
}

/**
 * Count users in an org who have connected a specific platform
 */
export async function countOrgUsersWithConnection(
  orgId: string,
  platform: IntegrationPlatform
): Promise<number> {
  return prisma.userIntegrationConnection.count({
    where: { orgId, platform, status: "ACTIVE" },
  });
}

// ============================================
// Combined Checks
// ============================================

/**
 * Check if a platform is enabled for org AND user is connected
 */
export async function canUserPushToPlatform(
  userId: string,
  orgId: string,
  platform: WorkflowPlatform
): Promise<{ canPush: boolean; reason?: string }> {
  // Check if platform is enabled for org
  const platformEnabled = await isWorkflowPlatformEnabled(orgId, platform);
  if (!platformEnabled) {
    return {
      canPush: false,
      reason: `${platform} is not enabled for your organization. Ask your admin to enable it.`,
    };
  }

  // Check if user has connected
  const hasConnection = await hasUserConnection(userId, platform);
  if (!hasConnection) {
    return {
      canPush: false,
      reason: `You haven't connected your ${platform} account. Go to Settings > Integrations to connect.`,
    };
  }

  return { canPush: true };
}

/**
 * Get connection status for a specific platform for a user
 */
export async function getUserConnectionStatus(
  userId: string,
  orgId: string,
  platform: IntegrationPlatform
): Promise<UserConnectionStatusResponse> {
  const platformEnabled = await isWorkflowPlatformEnabled(orgId, platform as WorkflowPlatform);
  const connection = await prisma.userIntegrationConnection.findUnique({
    where: { userId_platform: { userId, platform } },
    select: {
      id: true,
      status: true,
      externalUserName: true,
      lastUsedAt: true,
      lastError: true,
      connectedAt: true,
    },
  });

  const isConnected = connection?.status === "ACTIVE";

  return {
    connected: isConnected,
    platformEnabled,
    connection: connection
      ? {
          id: connection.id,
          status: connection.status,
          externalUserName: connection.externalUserName,
          lastUsedAt: connection.lastUsedAt,
          lastError: connection.lastError,
          connectedAt: connection.connectedAt,
        }
      : null,
  };
}
