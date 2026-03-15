/**
 * Workflow Integrations - Token Storage (PX-882 + PX-1001)
 *
 * Manages secure storage and retrieval of OAuth tokens.
 * Uses IntegrationToken for encrypted storage (AES-256-GCM).
 *
 * PX-1001: Added encrypted token storage using IntegrationToken model
 */

import { prisma } from "@/lib/db";
import { IntegrationPlatform } from "@prisma/client";
import { encryptForOrg, decryptForOrg } from "@/lib/encryption/field-encryption";
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
// Connection Storage (with Encryption - PX-1001)
// ============================================

/**
 * Store or update an integration connection with encrypted tokens
 *
 * Uses IntegrationToken for secure token storage (AES-256-GCM encryption).
 * Tokens are encrypted before storage using org-level encryption keys.
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
  // Encrypt tokens before storage
  const encryptedAccessToken = await encryptForOrg(orgId, accessToken);
  const encryptedRefreshToken = refreshToken
    ? await encryptForOrg(orgId, refreshToken)
    : null;

  const existing = await prisma.integrationConnection.findFirst({
    where: { orgId, platform },
    include: { integrationToken: true },
  });

  if (existing) {
    // Update existing connection
    if (existing.integrationToken) {
      // Update existing token
      await prisma.integrationToken.update({
        where: { id: existing.integrationToken.id },
        data: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: expiresAt ?? null,
          issuedAt: new Date(),
        },
      });
    } else {
      // Create new token (migrating from plaintext)
      await prisma.integrationToken.create({
        data: {
          type: "WORKFLOW",
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: expiresAt ?? null,
          integrationConnectionId: existing.id,
        },
      });
    }

    // Update connection (clear legacy plaintext tokens)
    await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: {
        accessToken: null, // Clear legacy plaintext
        refreshToken: null,
        expiresAt: expiresAt ?? null,
        config: config as object ?? undefined,
        name,
        isActive: true,
        lastError: null,
      },
    });
  } else {
    // Create new connection
    const connection = await prisma.integrationConnection.create({
      data: {
        orgId,
        platform,
        accessToken: null, // Don't store plaintext
        refreshToken: null,
        expiresAt: expiresAt ?? null,
        config: config as object ?? undefined,
        name: name || platform,
        isActive: true,
        connectedById,
      },
    });

    // Create encrypted token
    await prisma.integrationToken.create({
      data: {
        type: "WORKFLOW",
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: expiresAt ?? null,
        integrationConnectionId: connection.id,
      },
    });
  }
}

/**
 * Get active integration connection for an org
 *
 * Note: Returns decrypted tokens for API use.
 * The accessToken in the result is decrypted from IntegrationToken.
 */
export async function getIntegrationConnection(
  orgId: string,
  platform: IntegrationPlatform
): Promise<IntegrationConnectionData | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { orgId, platform, isActive: true },
    include: { integrationToken: true },
  });

  if (!connection) {
    return null;
  }

  // Get access token - prefer encrypted storage
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let expiresAt: Date | null = null;

  if (connection.integrationToken) {
    // Decrypt from IntegrationToken (new pattern)
    accessToken = await decryptForOrg(
      connection.orgId,
      connection.integrationToken.accessToken
    );
    if (connection.integrationToken.refreshToken) {
      refreshToken = await decryptForOrg(
        connection.orgId,
        connection.integrationToken.refreshToken
      );
    }
    expiresAt = connection.integrationToken.expiresAt;
  } else if (connection.accessToken) {
    // Fallback to legacy plaintext (for migration)
    accessToken = connection.accessToken;
    refreshToken = connection.refreshToken;
    expiresAt = connection.expiresAt;
    console.warn(
      `[Token Store] Connection ${connection.id} using legacy plaintext tokens. Run migration.`
    );
  }

  if (!accessToken) {
    return null;
  }

  return {
    id: connection.id,
    orgId: connection.orgId,
    platform: connection.platform,
    name: connection.name,
    accessToken,
    refreshToken,
    expiresAt,
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
 * Tokens are decrypted before returning.
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

    // TODO: Implement token refresh (PX-1001 Phase 2)
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
 *
 * Also deletes the associated IntegrationToken.
 */
export async function deleteIntegrationConnection(
  orgId: string,
  platform: IntegrationPlatform
): Promise<void> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { orgId, platform },
    include: { integrationToken: true },
  });

  if (!connection) return;

  // Delete IntegrationToken if exists
  if (connection.integrationToken) {
    await prisma.integrationToken.delete({
      where: { id: connection.integrationToken.id },
    });
  }

  // Deactivate connection
  await prisma.integrationConnection.update({
    where: { id: connection.id },
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
 *
 * Note: Tokens are decrypted for each connection.
 */
export async function getAllConnections(
  orgId: string
): Promise<IntegrationConnectionData[]> {
  const connections = await prisma.integrationConnection.findMany({
    where: { orgId, isActive: true },
    include: { integrationToken: true },
  });

  const results: IntegrationConnectionData[] = [];

  for (const c of connections) {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let expiresAt: Date | null = null;

    if (c.integrationToken) {
      // Decrypt from IntegrationToken
      accessToken = await decryptForOrg(c.orgId, c.integrationToken.accessToken);
      if (c.integrationToken.refreshToken) {
        refreshToken = await decryptForOrg(c.orgId, c.integrationToken.refreshToken);
      }
      expiresAt = c.integrationToken.expiresAt;
    } else if (c.accessToken) {
      // Legacy plaintext fallback
      accessToken = c.accessToken;
      refreshToken = c.refreshToken;
      expiresAt = c.expiresAt;
    }

    if (accessToken) {
      results.push({
        id: c.id,
        orgId: c.orgId,
        platform: c.platform,
        name: c.name,
        accessToken,
        refreshToken,
        expiresAt,
        config: c.config as PlatformConfig | null,
        isActive: c.isActive,
        lastUsedAt: c.lastUsedAt,
        lastError: c.lastError,
        createdAt: c.connectedAt,
        updatedAt: c.updatedAt,
      });
    }
  }

  return results;
}
