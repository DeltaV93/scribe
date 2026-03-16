/**
 * Integration Provider Registry (PX-1001 Phase 3)
 *
 * Centralizes OAuth provider configuration in the database.
 * Replaces scattered environment variable lookups with a unified registry.
 *
 * Benefits:
 * - Single source of truth for provider config
 * - Admin UI can manage provider settings
 * - Supports runtime enable/disable without deploy
 * - Encrypted credential storage
 */

import { prisma } from "@/lib/db";
import { IntegrationPlatform, IntegrationCategory } from "@prisma/client";
import { encryptForOrg, decryptForOrg } from "@/lib/encryption/field-encryption";

// ============================================
// Provider Configuration Types
// ============================================

export interface ProviderConfig {
  platform: IntegrationPlatform;
  displayName: string;
  category: IntegrationCategory;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  iconUrl?: string;
  isEnabled: boolean;
  isConfigured: boolean;
}

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export interface FullProviderConfig extends ProviderConfig {
  credentials?: ProviderCredentials;
}

// ============================================
// Default Provider Definitions
// ============================================

/**
 * Static provider metadata that doesn't change.
 * Credentials are loaded from env vars during sync.
 */
const PROVIDER_DEFAULTS: Record<
  IntegrationPlatform,
  Omit<ProviderConfig, "platform" | "isEnabled" | "isConfigured">
> = {
  LINEAR: {
    displayName: "Linear",
    category: "PROJECT_MGMT",
    authorizeUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    scopes: ["read", "write", "issues:create"],
    iconUrl: "/integrations/linear.svg",
  },
  JIRA: {
    displayName: "Jira",
    category: "PROJECT_MGMT",
    authorizeUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    scopes: ["read:jira-work", "write:jira-work", "read:jira-user", "offline_access"],
    iconUrl: "/integrations/jira.svg",
  },
  NOTION: {
    displayName: "Notion",
    category: "DOCUMENTATION",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [], // Notion doesn't use scopes in the same way
    iconUrl: "/integrations/notion.svg",
  },
  GOOGLE_DOCS: {
    displayName: "Google Docs",
    category: "DOCUMENTATION",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ],
    iconUrl: "/integrations/google-docs.svg",
  },
  GOOGLE_CALENDAR: {
    displayName: "Google Calendar",
    category: "CALENDAR",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    iconUrl: "/integrations/google-calendar.svg",
  },
  OUTLOOK_CALENDAR: {
    displayName: "Outlook Calendar",
    category: "CALENDAR",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Calendars.ReadWrite", "offline_access"],
    iconUrl: "/integrations/outlook.svg",
  },
};

// ============================================
// Environment Variable Mapping
// ============================================

/**
 * Maps platforms to their environment variable names
 */
const ENV_VAR_MAPPING: Record<IntegrationPlatform, { clientId: string; clientSecret: string }> = {
  LINEAR: {
    clientId: "LINEAR_CLIENT_ID",
    clientSecret: "LINEAR_CLIENT_SECRET",
  },
  JIRA: {
    clientId: "JIRA_CLIENT_ID",
    clientSecret: "JIRA_CLIENT_SECRET",
  },
  NOTION: {
    clientId: "NOTION_CLIENT_ID",
    clientSecret: "NOTION_CLIENT_SECRET",
  },
  GOOGLE_DOCS: {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
  },
  GOOGLE_CALENDAR: {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
  },
  OUTLOOK_CALENDAR: {
    clientId: "MICROSOFT_CLIENT_ID",
    clientSecret: "MICROSOFT_CLIENT_SECRET",
  },
};

// ============================================
// Registry Functions
// ============================================

/**
 * Get provider configuration by platform
 *
 * Returns the provider config from database if exists,
 * otherwise returns defaults with env var config status.
 */
export async function getProvider(
  platform: IntegrationPlatform
): Promise<ProviderConfig | null> {
  // Try database first
  const dbProvider = await prisma.integrationProvider.findUnique({
    where: { platform },
  });

  if (dbProvider) {
    return {
      platform: dbProvider.platform,
      displayName: dbProvider.displayName,
      category: dbProvider.category,
      authorizeUrl: dbProvider.authorizeUrl,
      tokenUrl: dbProvider.tokenUrl,
      scopes: dbProvider.scopes,
      iconUrl: dbProvider.iconUrl ?? undefined,
      isEnabled: dbProvider.isEnabled,
      isConfigured: dbProvider.isConfigured,
    };
  }

  // Fall back to defaults with env var check
  const defaults = PROVIDER_DEFAULTS[platform];
  if (!defaults) {
    return null;
  }

  const envVars = ENV_VAR_MAPPING[platform];
  const isConfigured = !!(
    process.env[envVars.clientId] && process.env[envVars.clientSecret]
  );

  return {
    platform,
    ...defaults,
    isEnabled: isConfigured, // Auto-enable if configured
    isConfigured,
  };
}

/**
 * Get provider with decrypted credentials
 *
 * Used internally for OAuth operations.
 * Credentials come from database if stored, otherwise from env vars.
 */
export async function getProviderWithCredentials(
  platform: IntegrationPlatform,
  orgId?: string
): Promise<FullProviderConfig | null> {
  const config = await getProvider(platform);
  if (!config) {
    return null;
  }

  // Try database credentials first
  const dbProvider = await prisma.integrationProvider.findUnique({
    where: { platform },
  });

  if (dbProvider && orgId) {
    // Decrypt credentials from database
    try {
      const clientId = await decryptForOrg(orgId, dbProvider.clientId);
      const clientSecret = await decryptForOrg(orgId, dbProvider.clientSecret);
      return {
        ...config,
        credentials: { clientId, clientSecret },
      };
    } catch {
      // Fall through to env vars
    }
  }

  // Fall back to environment variables
  const envVars = ENV_VAR_MAPPING[platform];
  const clientId = process.env[envVars.clientId];
  const clientSecret = process.env[envVars.clientSecret];

  if (clientId && clientSecret) {
    return {
      ...config,
      credentials: { clientId, clientSecret },
    };
  }

  // No credentials available
  return { ...config, credentials: undefined };
}

/**
 * List all providers, optionally filtered by category
 */
export async function listProviders(
  category?: IntegrationCategory
): Promise<ProviderConfig[]> {
  const providers: ProviderConfig[] = [];

  // Get all platforms
  const platforms = Object.keys(PROVIDER_DEFAULTS) as IntegrationPlatform[];

  for (const platform of platforms) {
    const config = await getProvider(platform);
    if (config) {
      if (!category || config.category === category) {
        providers.push(config);
      }
    }
  }

  return providers;
}

/**
 * List only configured and enabled providers
 */
export async function listEnabledProviders(
  category?: IntegrationCategory
): Promise<ProviderConfig[]> {
  const all = await listProviders(category);
  return all.filter((p) => p.isEnabled && p.isConfigured);
}

/**
 * Check if a provider is configured (has credentials)
 */
export async function isProviderConfigured(
  platform: IntegrationPlatform
): Promise<boolean> {
  const config = await getProvider(platform);
  return config?.isConfigured ?? false;
}

/**
 * Check if a provider is enabled
 */
export async function isProviderEnabled(
  platform: IntegrationPlatform
): Promise<boolean> {
  const config = await getProvider(platform);
  return (config?.isEnabled && config?.isConfigured) ?? false;
}

// ============================================
// Admin Functions
// ============================================

/**
 * Sync providers from environment variables to database
 *
 * Creates or updates IntegrationProvider records based on env vars.
 * Credentials are encrypted before storage.
 *
 * @param systemOrgId - Org ID to use for encryption (typically a system org)
 */
export async function syncProvidersFromEnv(systemOrgId: string): Promise<{
  synced: number;
  skipped: number;
}> {
  let synced = 0;
  let skipped = 0;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  for (const [platform, defaults] of Object.entries(PROVIDER_DEFAULTS)) {
    const platformKey = platform as IntegrationPlatform;
    const envVars = ENV_VAR_MAPPING[platformKey];

    const clientId = process.env[envVars.clientId];
    const clientSecret = process.env[envVars.clientSecret];

    if (!clientId || !clientSecret) {
      skipped++;
      continue;
    }

    // Encrypt credentials
    const encryptedClientId = await encryptForOrg(systemOrgId, clientId);
    const encryptedClientSecret = await encryptForOrg(systemOrgId, clientSecret);

    const redirectUri = `${baseUrl}/api/integrations/${platform.toLowerCase()}/callback`;

    await prisma.integrationProvider.upsert({
      where: { platform: platformKey },
      create: {
        platform: platformKey,
        displayName: defaults.displayName,
        category: defaults.category,
        authorizeUrl: defaults.authorizeUrl,
        tokenUrl: defaults.tokenUrl,
        scopes: defaults.scopes,
        iconUrl: defaults.iconUrl,
        redirectUri,
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        isEnabled: true,
        isConfigured: true,
      },
      update: {
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        isConfigured: true,
        // Keep existing isEnabled state
      },
    });

    synced++;
  }

  console.log(
    `[Provider Registry] Synced ${synced} providers, skipped ${skipped} (missing credentials)`
  );

  return { synced, skipped };
}

/**
 * Enable or disable a provider
 */
export async function setProviderEnabled(
  platform: IntegrationPlatform,
  enabled: boolean
): Promise<void> {
  await prisma.integrationProvider.update({
    where: { platform },
    data: { isEnabled: enabled },
  });
}

/**
 * Get provider stats for admin dashboard
 */
export async function getProviderStats(): Promise<{
  total: number;
  configured: number;
  enabled: number;
  byCategory: Record<IntegrationCategory, number>;
}> {
  const all = await listProviders();
  const configured = all.filter((p) => p.isConfigured);
  const enabled = all.filter((p) => p.isEnabled && p.isConfigured);

  const byCategory: Record<string, number> = {};
  for (const provider of all) {
    byCategory[provider.category] = (byCategory[provider.category] || 0) + 1;
  }

  return {
    total: all.length,
    configured: configured.length,
    enabled: enabled.length,
    byCategory: byCategory as Record<IntegrationCategory, number>,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the callback URL for a platform
 */
export function getProviderCallbackUrl(platform: IntegrationPlatform): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/integrations/${platform.toLowerCase()}/callback`;
}

/**
 * Build authorization URL for a platform
 */
export async function buildAuthorizationUrl(
  platform: IntegrationPlatform,
  state: string,
  callbackUrl?: string
): Promise<string | null> {
  const config = await getProviderWithCredentials(platform);
  if (!config?.credentials) {
    return null;
  }

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.credentials.clientId);
  url.searchParams.set("redirect_uri", callbackUrl || getProviderCallbackUrl(platform));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  // Platform-specific parameters
  switch (platform) {
    case "LINEAR":
      if (config.scopes.length) {
        url.searchParams.set("scope", config.scopes.join(","));
      }
      break;
    case "JIRA":
      url.searchParams.set("audience", "api.atlassian.com");
      url.searchParams.set("prompt", "consent");
      if (config.scopes.length) {
        url.searchParams.set("scope", config.scopes.join(" "));
      }
      break;
    case "NOTION":
      url.searchParams.set("owner", "user");
      break;
    case "GOOGLE_DOCS":
    case "GOOGLE_CALENDAR":
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      if (config.scopes.length) {
        url.searchParams.set("scope", config.scopes.join(" "));
      }
      break;
    case "OUTLOOK_CALENDAR":
      if (config.scopes.length) {
        url.searchParams.set("scope", config.scopes.join(" "));
      }
      break;
  }

  return url.toString();
}
