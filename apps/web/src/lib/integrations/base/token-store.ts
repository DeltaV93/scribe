/**
 * Workflow Integrations - Token Storage (PX-882)
 *
 * Manages secure storage and retrieval of OAuth tokens.
 * Currently uses Prisma IntegrationConnection model.
 *
 * Future: Add field-level encryption matching calendar pattern.
 */

import { prisma } from "@/lib/db";
import { IntegrationPlatform } from "@prisma/client";
import type { PlatformConfig, IntegrationConnectionData } from "./types";

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
 * Get OAuth callback URL for a platform
 */
export function getCallbackUrl(platform: IntegrationPlatform): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/integrations/${platform.toLowerCase()}/callback`;
}

// ============================================
// Connection Storage
// ============================================

/**
 * Store or update an integration connection
 *
 * Uses upsert pattern - updates if exists, creates if not.
 */
export async function storeIntegrationConnection(
  orgId: string,
  platform: IntegrationPlatform,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: Date | undefined,
  config: PlatformConfig | undefined,
  name: string | undefined,
  connectedById: string
): Promise<void> {
  const existing = await prisma.integrationConnection.findFirst({
    where: { orgId, platform },
  });

  if (existing) {
    await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: {
        accessToken,
        refreshToken: refreshToken ?? null,
        expiresAt: expiresAt ?? null,
        config: config as object ?? undefined,
        name,
        isActive: true,
        lastError: null,
      },
    });
  } else {
    await prisma.integrationConnection.create({
      data: {
        orgId,
        platform,
        accessToken,
        refreshToken: refreshToken ?? null,
        expiresAt: expiresAt ?? null,
        config: config as object ?? undefined,
        name: name || platform,
        isActive: true,
        connectedById,
      },
    });
  }
}

/**
 * Get active integration connection for an org
 */
export async function getIntegrationConnection(
  orgId: string,
  platform: IntegrationPlatform
): Promise<IntegrationConnectionData | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { orgId, platform, isActive: true },
  });

  if (!connection) {
    return null;
  }

  return {
    id: connection.id,
    orgId: connection.orgId,
    platform: connection.platform,
    name: connection.name,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
    config: connection.config as PlatformConfig | null,
    isActive: connection.isActive,
    lastUsedAt: connection.lastUsedAt,
    lastError: connection.lastError,
    createdAt: connection.connectedAt,
    updatedAt: connection.updatedAt,
  };
}

/**
 * Get access token for an integration, refreshing if needed
 *
 * Returns null if connection doesn't exist or refresh fails.
 */
export async function getAccessToken(
  orgId: string,
  platform: IntegrationPlatform
): Promise<string | null> {
  const connection = await getIntegrationConnection(orgId, platform);

  if (!connection) {
    return null;
  }

  // Check if token is expired
  if (connection.expiresAt && connection.expiresAt < new Date()) {
    // Token expired - need to refresh
    if (!connection.refreshToken) {
      // No refresh token, connection is invalid
      await markConnectionError(
        connection.id,
        "Token expired and no refresh token available"
      );
      return null;
    }

    // TODO: Implement token refresh for each platform
    // For now, mark as error
    await markConnectionError(
      connection.id,
      "Token expired - reconnection required"
    );
    return null;
  }

  // Update last used timestamp
  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: { lastUsedAt: new Date() },
  });

  return connection.accessToken;
}

/**
 * Delete (deactivate) an integration connection
 */
export async function deleteIntegrationConnection(
  orgId: string,
  platform: IntegrationPlatform
): Promise<void> {
  await prisma.integrationConnection.updateMany({
    where: { orgId, platform },
    data: { isActive: false },
  });
}

/**
 * Mark a connection as having an error
 */
export async function markConnectionError(
  connectionId: string,
  error: string
): Promise<void> {
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { lastError: error },
  });
}

/**
 * Clear error status from a connection
 */
export async function clearConnectionError(connectionId: string): Promise<void> {
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { lastError: null },
  });
}

/**
 * Get all active connections for an org
 */
export async function getAllConnections(
  orgId: string
): Promise<IntegrationConnectionData[]> {
  const connections = await prisma.integrationConnection.findMany({
    where: { orgId, isActive: true },
  });

  return connections.map((c) => ({
    id: c.id,
    orgId: c.orgId,
    platform: c.platform,
    name: c.name,
    accessToken: c.accessToken,
    refreshToken: c.refreshToken,
    expiresAt: c.expiresAt,
    config: c.config as PlatformConfig | null,
    isActive: c.isActive,
    lastUsedAt: c.lastUsedAt,
    lastError: c.lastError,
    createdAt: c.connectedAt,
    updatedAt: c.updatedAt,
  }));
}
