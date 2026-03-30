/**
 * Token Refresh Service (PX-1001 Phase 2)
 *
 * Handles automatic token refresh for OAuth integrations.
 * Each platform has different refresh mechanisms:
 * - Linear: Standard OAuth2 refresh_token grant
 * - Jira: Standard OAuth2 refresh_token grant
 * - Notion: Tokens don't expire (no refresh needed)
 */

import { prisma } from "@/lib/db";
import { IntegrationPlatform } from "@prisma/client";
import { encryptForOrg, decryptForOrg } from "@/lib/encryption/field-encryption";
import type { OAuthTokens } from "./types";

// ============================================
// Refresh Configuration
// ============================================

interface RefreshConfig {
  /** Whether this platform supports token refresh */
  supportsRefresh: boolean;
  /** Token endpoint URL */
  tokenUrl?: string;
  /** Content type for token request */
  contentType?: "json" | "form";
  /** How to send credentials */
  authMethod?: "body" | "basic";
  /** Refresh buffer - refresh if expiring within this many seconds */
  refreshBuffer?: number;
}

/**
 * Per-platform refresh configurations
 */
const REFRESH_CONFIGS: Record<IntegrationPlatform, RefreshConfig> = {
  LINEAR: {
    supportsRefresh: true,
    tokenUrl: "https://api.linear.app/oauth/token",
    contentType: "form",
    authMethod: "body",
    refreshBuffer: 300, // 5 minutes
  },
  JIRA: {
    supportsRefresh: true,
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    contentType: "json",
    authMethod: "body",
    refreshBuffer: 300,
  },
  NOTION: {
    // Notion tokens don't expire
    supportsRefresh: false,
  },
  GOOGLE_DOCS: {
    supportsRefresh: true,
    tokenUrl: "https://oauth2.googleapis.com/token",
    contentType: "form",
    authMethod: "body",
    refreshBuffer: 300,
  },
  GOOGLE_CALENDAR: {
    supportsRefresh: true,
    tokenUrl: "https://oauth2.googleapis.com/token",
    contentType: "form",
    authMethod: "body",
    refreshBuffer: 300,
  },
  OUTLOOK_CALENDAR: {
    supportsRefresh: true,
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    contentType: "form",
    authMethod: "body",
    refreshBuffer: 300,
  },
  SLACK: {
    // Slack bot tokens don't expire
    supportsRefresh: false,
  },
};

// ============================================
// Refresh Result Types
// ============================================

export interface RefreshResult {
  success: boolean;
  error?: string;
  tokens?: OAuthTokens;
}

// ============================================
// Core Refresh Functions
// ============================================

/**
 * Check if a platform supports token refresh
 */
export function canRefresh(platform: IntegrationPlatform): boolean {
  return REFRESH_CONFIGS[platform]?.supportsRefresh ?? false;
}

/**
 * Check if a token needs refresh (within buffer period)
 */
export function needsRefresh(expiresAt: Date | null | undefined, platform: IntegrationPlatform): boolean {
  if (!expiresAt) {
    // No expiry = doesn't expire (e.g., Notion)
    return false;
  }

  const config = REFRESH_CONFIGS[platform];
  const buffer = config?.refreshBuffer ?? 300;
  const bufferMs = buffer * 1000;

  return expiresAt.getTime() - Date.now() < bufferMs;
}

/**
 * Get platform credentials from environment
 */
function getPlatformCredentials(platform: IntegrationPlatform): {
  clientId: string;
  clientSecret: string;
} | null {
  switch (platform) {
    case "LINEAR":
      if (!process.env.LINEAR_CLIENT_ID || !process.env.LINEAR_CLIENT_SECRET) {
        return null;
      }
      return {
        clientId: process.env.LINEAR_CLIENT_ID,
        clientSecret: process.env.LINEAR_CLIENT_SECRET,
      };
    case "JIRA":
      if (!process.env.JIRA_CLIENT_ID || !process.env.JIRA_CLIENT_SECRET) {
        return null;
      }
      return {
        clientId: process.env.JIRA_CLIENT_ID,
        clientSecret: process.env.JIRA_CLIENT_SECRET,
      };
    case "NOTION":
      if (!process.env.NOTION_CLIENT_ID || !process.env.NOTION_CLIENT_SECRET) {
        return null;
      }
      return {
        clientId: process.env.NOTION_CLIENT_ID,
        clientSecret: process.env.NOTION_CLIENT_SECRET,
      };
    case "GOOGLE_DOCS":
    case "GOOGLE_CALENDAR":
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return null;
      }
      return {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      };
    case "OUTLOOK_CALENDAR":
      if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
        return null;
      }
      return {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      };
    case "SLACK":
      if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) {
        return null;
      }
      return {
        clientId: process.env.SLACK_CLIENT_ID,
        clientSecret: process.env.SLACK_CLIENT_SECRET,
      };
    default:
      return null;
  }
}

/**
 * Perform token refresh for a connection
 */
export async function refreshToken(
  connectionId: string
): Promise<RefreshResult> {
  // Get connection with token
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    include: { integrationToken: true },
  });

  if (!connection) {
    return { success: false, error: "Connection not found" };
  }

  const config = REFRESH_CONFIGS[connection.platform];
  if (!config?.supportsRefresh) {
    return { success: false, error: `${connection.platform} does not support token refresh` };
  }

  // Get refresh token (decrypt if stored in IntegrationToken)
  let refreshTokenValue: string | null = null;

  if (connection.integrationToken?.refreshToken) {
    refreshTokenValue = await decryptForOrg(
      connection.orgId,
      connection.integrationToken.refreshToken
    );
  } else if (connection.refreshToken) {
    // Legacy plaintext fallback
    refreshTokenValue = connection.refreshToken;
  }

  if (!refreshTokenValue) {
    return { success: false, error: "No refresh token available" };
  }

  // Get platform credentials
  const credentials = getPlatformCredentials(connection.platform);
  if (!credentials) {
    return { success: false, error: `${connection.platform} OAuth not configured` };
  }

  try {
    // Make refresh request
    const tokens = await executeRefresh(
      config,
      credentials,
      refreshTokenValue
    );

    // Encrypt and store new tokens
    const encryptedAccessToken = await encryptForOrg(connection.orgId, tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? await encryptForOrg(connection.orgId, tokens.refreshToken)
      : null;

    if (connection.integrationToken) {
      // Update existing IntegrationToken
      await prisma.integrationToken.update({
        where: { id: connection.integrationToken.id },
        data: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? connection.integrationToken.refreshToken,
          expiresAt: tokens.expiresAt ?? null,
          issuedAt: new Date(),
        },
      });
    } else {
      // Create new IntegrationToken (migration path)
      await prisma.integrationToken.create({
        data: {
          type: "WORKFLOW",
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: tokens.expiresAt ?? null,
          integrationConnectionId: connection.id,
        },
      });

      // Clear legacy plaintext tokens
      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: null,
          refreshToken: null,
          expiresAt: tokens.expiresAt ?? null,
        },
      });
    }

    // Clear any previous error
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        lastError: null,
        expiresAt: tokens.expiresAt ?? null,
      },
    });

    console.log(
      `[Token Refresh] Successfully refreshed ${connection.platform} token for connection ${connectionId}`
    );

    return { success: true, tokens };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[Token Refresh] Failed for ${connection.platform} connection ${connectionId}:`,
      error
    );

    // Mark connection as having error
    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: { lastError: `Token refresh failed: ${message}` },
    });

    return { success: false, error: message };
  }
}

/**
 * Execute the actual refresh request to the OAuth provider
 */
async function executeRefresh(
  config: RefreshConfig,
  credentials: { clientId: string; clientSecret: string },
  refreshToken: string
): Promise<OAuthTokens> {
  if (!config.tokenUrl) {
    throw new Error("Token URL not configured");
  }

  let body: string;
  const headers: Record<string, string> = {};

  if (config.contentType === "json") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });
    body = params.toString();
  }

  if (config.authMethod === "basic") {
    const basicAuth = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${basicAuth}`;
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Refresh failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // May be new refresh token
    tokenType: data.token_type,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
    scope: data.scope,
  };
}

// ============================================
// Proactive Refresh (for background jobs)
// ============================================

/**
 * Find all connections with tokens expiring soon
 */
export async function findExpiringConnections(
  withinMinutes: number = 60
): Promise<Array<{ id: string; platform: IntegrationPlatform; orgId: string }>> {
  const expiryThreshold = new Date(Date.now() + withinMinutes * 60 * 1000);

  // Check IntegrationToken (new pattern)
  const connections = await prisma.integrationConnection.findMany({
    where: {
      isActive: true,
      OR: [
        // New pattern: IntegrationToken with expiring tokens
        {
          integrationToken: {
            expiresAt: { lt: expiryThreshold },
            refreshToken: { not: null },
          },
        },
        // Legacy pattern: Direct expiresAt on connection
        {
          expiresAt: { lt: expiryThreshold },
          refreshToken: { not: null },
          integrationToken: null,
        },
      ],
    },
    select: {
      id: true,
      platform: true,
      orgId: true,
    },
  });

  // Filter to only platforms that support refresh
  return connections.filter((c) => canRefresh(c.platform));
}

/**
 * Refresh all expiring tokens (called by background job)
 */
export async function refreshExpiringTokens(): Promise<{
  refreshed: number;
  failed: number;
  errors: Array<{ connectionId: string; error: string }>;
}> {
  const expiring = await findExpiringConnections(60); // 1 hour

  let refreshed = 0;
  let failed = 0;
  const errors: Array<{ connectionId: string; error: string }> = [];

  for (const connection of expiring) {
    const result = await refreshToken(connection.id);
    if (result.success) {
      refreshed++;
    } else {
      failed++;
      errors.push({ connectionId: connection.id, error: result.error || "Unknown" });
    }
  }

  console.log(
    `[Token Refresh] Batch complete: ${refreshed} refreshed, ${failed} failed`
  );

  return { refreshed, failed, errors };
}
