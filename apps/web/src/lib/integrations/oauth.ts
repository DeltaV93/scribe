/**
 * OAuth Helper for Workflow Integrations (PX-882)
 *
 * DEPRECATED: This file is kept for backward compatibility.
 * Use @/lib/integrations/base instead for new code.
 *
 * Re-exports from the base module.
 */

// Re-export from base module
export {
  generateOAuthState,
  parseOAuthState,
} from "./base/security";

export {
  getIntegrationConnection,
  deleteIntegrationConnection,
  isPlatformConfigured,
  getCallbackUrl,
} from "./base/token-store";

// Re-export types
export type { OAuthState } from "./base/types";

// Legacy OAuth config for backward compatibility
export const OAUTH_CONFIG = {
  LINEAR: {
    authUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    scopes: ["read", "write", "issues:create"],
  },
  NOTION: {
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
  },
  JIRA: {
    authUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    scopes: [
      "read:jira-work",
      "write:jira-work",
      "read:jira-user",
      "offline_access",
    ],
  },
};

// Legacy storeIntegrationConnection wrapper
import { storeIntegrationConnection as baseStoreConnection } from "./base/token-store";
import { IntegrationPlatform } from "@prisma/client";

/**
 * @deprecated Use storeIntegrationConnection from @/lib/integrations/base instead
 */
export async function storeIntegrationConnection(
  orgId: string,
  platform: IntegrationPlatform,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date,
  config?: Record<string, unknown>,
  name?: string,
  connectedById?: string
): Promise<void> {
  // For legacy calls without connectedById, use a placeholder
  // This should only happen in test/migration scenarios
  const userId = connectedById || "system-migration";

  await baseStoreConnection(
    orgId,
    platform,
    accessToken,
    refreshToken,
    expiresAt,
    config as import("./base/types").PlatformConfig | undefined,
    name,
    userId
  );
}
