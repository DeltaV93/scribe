/**
 * Workflow Integrations - Service Registry (PX-882, PX-1007)
 *
 * Factory pattern for getting platform-specific WorkflowService and IntegrationAdapter instances.
 *
 * Design Patterns:
 * - Factory: getWorkflowService/getIntegrationAdapter returns platform-specific implementation
 * - Registry: Maps platform enum to service instances
 * - Lazy Loading: Services are created on first access
 *
 * Usage:
 * ```typescript
 * // Legacy WorkflowService pattern
 * const service = getWorkflowService("LINEAR");
 * const result = await service.pushActionItem(token, draft, config);
 *
 * // New IntegrationAdapter pattern (PX-1007)
 * const adapter = await getIntegrationAdapterAsync("LINEAR");
 * const result = await adapter.push({ type, payload, destination, accessToken });
 * ```
 */

import { IntegrationPlatform } from "@prisma/client";
import type { WorkflowService, WorkflowPlatform } from "./types";
import type { IntegrationAdapter } from "./adapter";
import { isIntegrationAdapter } from "./adapter";

// ============================================
// Service Registry
// ============================================

/**
 * Registry of workflow service instances
 * Services are lazily loaded when first accessed
 */
const serviceRegistry: Partial<Record<WorkflowPlatform, WorkflowService>> = {};

/**
 * Service factory functions - import actual implementations
 */
const serviceFactories: Record<WorkflowPlatform, () => Promise<WorkflowService>> = {
  LINEAR: async () => {
    const { LinearWorkflowService } = await import("../linear/service");
    return new LinearWorkflowService();
  },
  NOTION: async () => {
    const { NotionWorkflowService } = await import("../notion/service");
    return new NotionWorkflowService();
  },
  JIRA: async () => {
    const { JiraWorkflowService } = await import("../jira/service");
    return new JiraWorkflowService();
  },
  SLACK: async () => {
    const { SlackWorkflowService } = await import("../slack/service");
    return new SlackWorkflowService();
  },
};

// ============================================
// Factory Function
// ============================================

/**
 * Get the WorkflowService for a platform
 *
 * Uses lazy loading - services are instantiated on first access
 * and cached for subsequent calls.
 *
 * @throws Error if platform is not supported
 */
export function getWorkflowService(platform: WorkflowPlatform): WorkflowService {
  // Check if already loaded
  const cached = serviceRegistry[platform];
  if (cached) {
    return cached;
  }

  // Create synchronous wrapper that loads on first method call
  // This allows getWorkflowService to be synchronous while
  // actual service loading happens lazily
  const lazyService = createLazyService(platform);
  serviceRegistry[platform] = lazyService;
  return lazyService;
}

/**
 * Get the WorkflowService asynchronously (ensures loaded)
 */
export async function getWorkflowServiceAsync(
  platform: WorkflowPlatform
): Promise<WorkflowService> {
  const cached = serviceRegistry[platform];
  if (cached && !(cached as LazyWorkflowService).isProxy) {
    return cached;
  }

  const factory = serviceFactories[platform];
  if (!factory) {
    throw new Error(`No service factory registered for platform: ${platform}`);
  }

  const service = await factory();
  serviceRegistry[platform] = service;
  return service;
}

/**
 * Check if a platform has a registered service
 */
export function hasWorkflowService(platform: string): platform is WorkflowPlatform {
  return platform in serviceFactories;
}

/**
 * Get all supported workflow platforms
 */
export function getSupportedPlatforms(): WorkflowPlatform[] {
  return Object.keys(serviceFactories) as WorkflowPlatform[];
}

// ============================================
// Lazy Loading Implementation
// ============================================

interface LazyWorkflowService extends WorkflowService {
  isProxy: true;
}

/**
 * Create a lazy-loading service wrapper
 *
 * The wrapper implements WorkflowService interface and loads
 * the actual service on first method call.
 */
function createLazyService(platform: WorkflowPlatform): LazyWorkflowService {
  let loadedService: WorkflowService | null = null;
  let loadPromise: Promise<WorkflowService> | null = null;

  const loadService = async (): Promise<WorkflowService> => {
    if (loadedService) return loadedService;
    if (loadPromise) return loadPromise;

    loadPromise = getWorkflowServiceAsync(platform);
    loadedService = await loadPromise;
    return loadedService;
  };

  return {
    isProxy: true,
    platform,

    isConfigured() {
      // This can be checked without loading the full service
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
        case "SLACK":
          return !!(
            process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
          );
        default:
          return false;
      }
    },

    getOAuthConfig() {
      // Return config without loading service
      switch (platform) {
        case "LINEAR":
          if (!process.env.LINEAR_CLIENT_ID || !process.env.LINEAR_CLIENT_SECRET) {
            return null;
          }
          return {
            authUrl: "https://linear.app/oauth/authorize",
            tokenUrl: "https://api.linear.app/oauth/token",
            scopes: ["read", "write", "issues:create"],
            clientId: process.env.LINEAR_CLIENT_ID,
            clientSecret: process.env.LINEAR_CLIENT_SECRET,
          };
        case "NOTION":
          if (!process.env.NOTION_CLIENT_ID || !process.env.NOTION_CLIENT_SECRET) {
            return null;
          }
          return {
            authUrl: "https://api.notion.com/v1/oauth/authorize",
            tokenUrl: "https://api.notion.com/v1/oauth/token",
            clientId: process.env.NOTION_CLIENT_ID,
            clientSecret: process.env.NOTION_CLIENT_SECRET,
          };
        case "JIRA":
          if (!process.env.JIRA_CLIENT_ID || !process.env.JIRA_CLIENT_SECRET) {
            return null;
          }
          return {
            authUrl: "https://auth.atlassian.com/authorize",
            tokenUrl: "https://auth.atlassian.com/oauth/token",
            scopes: [
              "read:jira-work",
              "write:jira-work",
              "read:jira-user",
              "offline_access",
            ],
            clientId: process.env.JIRA_CLIENT_ID,
            clientSecret: process.env.JIRA_CLIENT_SECRET,
          };
        case "SLACK":
          if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) {
            return null;
          }
          return {
            authUrl: "https://slack.com/oauth/v2/authorize",
            tokenUrl: "https://slack.com/api/oauth.v2.access",
            scopes: ["chat:write", "channels:read", "groups:read", "users:read"],
            clientId: process.env.SLACK_CLIENT_ID,
            clientSecret: process.env.SLACK_CLIENT_SECRET,
          };
        default:
          return null;
      }
    },

    getAuthorizationUrl(state: string, callbackUrl: string) {
      const config = this.getOAuthConfig();
      if (!config) {
        throw new Error(`${platform} is not configured`);
      }

      const url = new URL(config.authUrl);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", callbackUrl);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);

      if (config.scopes?.length) {
        // Slack uses comma-separated scopes
        const scopeSeparator = platform === "SLACK" ? "," : " ";
        url.searchParams.set("scope", config.scopes.join(scopeSeparator));
      }

      // Platform-specific params
      if (platform === "NOTION") {
        url.searchParams.set("owner", "user");
      }
      if (platform === "JIRA") {
        url.searchParams.set("audience", "api.atlassian.com");
        url.searchParams.set("prompt", "consent");
      }

      return url.toString();
    },

    async exchangeCodeForTokens(code: string, callbackUrl: string) {
      const service = await loadService();
      return service.exchangeCodeForTokens(code, callbackUrl);
    },

    async testConnection(accessToken: string) {
      const service = await loadService();
      return service.testConnection(accessToken);
    },

    async pushActionItem(accessToken, draft, config) {
      const service = await loadService();
      return service.pushActionItem(accessToken, draft, config);
    },

    async pushMeetingNotes(accessToken, draft, config) {
      const service = await loadService();
      if (!service.pushMeetingNotes) {
        return {
          success: false,
          error: `${platform} does not support meeting notes`,
        };
      }
      return service.pushMeetingNotes(accessToken, draft, config);
    },
  };
}

// ============================================
// IntegrationAdapter Registry (PX-1007)
// ============================================

/**
 * Registry of IntegrationAdapter instances
 * Separate from WorkflowService registry for type safety
 */
const adapterRegistry: Partial<Record<IntegrationPlatform, IntegrationAdapter>> = {};

/**
 * Platforms that implement the full IntegrationAdapter interface
 */
const ADAPTER_PLATFORMS: IntegrationPlatform[] = ["LINEAR"];

/**
 * Get an IntegrationAdapter asynchronously
 *
 * Returns only services that implement the full IntegrationAdapter interface,
 * not just the older WorkflowService interface.
 *
 * @throws Error if platform does not implement IntegrationAdapter
 */
export async function getIntegrationAdapterAsync(
  platform: IntegrationPlatform
): Promise<IntegrationAdapter> {
  // Check if already loaded
  const cached = adapterRegistry[platform];
  if (cached) {
    return cached;
  }

  // Check if this platform supports IntegrationAdapter
  if (!ADAPTER_PLATFORMS.includes(platform)) {
    throw new Error(
      `Platform ${platform} does not implement IntegrationAdapter. ` +
        `Supported platforms: ${ADAPTER_PLATFORMS.join(", ")}`
    );
  }

  // Load the service and verify it implements IntegrationAdapter
  const service = await loadAdapterService(platform);

  if (!isIntegrationAdapter(service)) {
    throw new Error(
      `Platform ${platform} service does not implement IntegrationAdapter interface`
    );
  }

  adapterRegistry[platform] = service;
  return service;
}

/**
 * Check if a platform implements IntegrationAdapter
 */
export function hasIntegrationAdapter(platform: IntegrationPlatform): boolean {
  return ADAPTER_PLATFORMS.includes(platform);
}

/**
 * Get all platforms that implement IntegrationAdapter
 */
export function getIntegrationAdapterPlatforms(): IntegrationPlatform[] {
  return [...ADAPTER_PLATFORMS];
}

/**
 * Load adapter service implementation
 */
async function loadAdapterService(
  platform: IntegrationPlatform
): Promise<IntegrationAdapter> {
  switch (platform) {
    case "LINEAR": {
      const { LinearWorkflowService } = await import("../linear/service");
      return new LinearWorkflowService();
    }
    // Future adapters will be added here as they implement IntegrationAdapter
    default:
      throw new Error(`No IntegrationAdapter factory for platform: ${platform}`);
  }
}
