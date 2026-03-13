/**
 * Workflow Integrations - Service Registry (PX-882)
 *
 * Factory pattern for getting platform-specific WorkflowService instances.
 *
 * Design Patterns:
 * - Factory: getWorkflowService returns platform-specific implementation
 * - Registry: Maps platform enum to service instances
 * - Lazy Loading: Services are created on first access
 *
 * Usage:
 * ```typescript
 * const service = getWorkflowService("LINEAR");
 * const result = await service.pushActionItem(token, draft, config);
 * ```
 */

import type { WorkflowService, WorkflowPlatform } from "./types";

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
        url.searchParams.set("scope", config.scopes.join(" "));
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
