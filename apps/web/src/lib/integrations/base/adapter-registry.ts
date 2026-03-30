/**
 * Integration Adapter Registry (PX-1006)
 *
 * Factory pattern for getting platform-specific IntegrationAdapter instances.
 * Extends the WorkflowService registry pattern with full adapter functionality.
 *
 * Design Patterns:
 * - Factory: getAdapter returns platform-specific implementation
 * - Registry: Maps platform enum to adapter instances
 * - Lazy Loading: Adapters are created on first access
 *
 * Usage:
 * ```typescript
 * const adapter = await getAdapter("NOTION");
 * const result = await adapter.push({
 *   type: OutputType.MEETING_NOTES,
 *   payload: meetingNotes,
 *   destination: { databaseId: "abc123" },
 *   accessToken: token,
 * });
 * ```
 */

import { IntegrationPlatform, IntegrationCategory } from "@prisma/client";
import type { IntegrationAdapter, PushOperation, PushResult } from "./adapter";
import { OutputType } from "./output-types";

// ============================================
// Adapter Registry
// ============================================

/**
 * Registry of adapter instances by platform
 */
const adapterRegistry: Partial<Record<IntegrationPlatform, IntegrationAdapter>> = {};

/**
 * Adapter factory functions - import actual implementations
 */
const adapterFactories: Partial<Record<IntegrationPlatform, () => Promise<IntegrationAdapter>>> = {
  NOTION: async () => {
    const { NotionAdapter } = await import("../notion/adapter");
    return new NotionAdapter();
  },
  LINEAR: async () => {
    const { LinearAdapter } = await import("../linear/adapter");
    return new LinearAdapter();
  },
  // Future adapters:
  // JIRA: async () => {
  //   const { JiraAdapter } = await import("../jira/adapter");
  //   return new JiraAdapter();
  // },
};

// ============================================
// Factory Functions
// ============================================

/**
 * Get the IntegrationAdapter for a platform
 *
 * Uses lazy loading - adapters are instantiated on first access
 * and cached for subsequent calls.
 *
 * @throws Error if platform adapter is not implemented
 */
export async function getAdapter(
  platform: IntegrationPlatform
): Promise<IntegrationAdapter> {
  // Check cache first
  const cached = adapterRegistry[platform];
  if (cached) {
    return cached;
  }

  // Load adapter
  const factory = adapterFactories[platform];
  if (!factory) {
    throw new Error(
      `No IntegrationAdapter implemented for platform: ${platform}. ` +
      `Use getWorkflowService() for legacy WorkflowService interface.`
    );
  }

  const adapter = await factory();
  adapterRegistry[platform] = adapter;
  return adapter;
}

/**
 * Check if a platform has an IntegrationAdapter implementation
 */
export function hasAdapter(platform: IntegrationPlatform): boolean {
  return platform in adapterFactories;
}

/**
 * Get all platforms that have IntegrationAdapter implementations
 */
export function getAdapterPlatforms(): IntegrationPlatform[] {
  return Object.keys(adapterFactories) as IntegrationPlatform[];
}

/**
 * Get adapters by category
 */
export async function getAdaptersByCategory(
  category: IntegrationCategory
): Promise<IntegrationAdapter[]> {
  const platforms = getAdapterPlatforms();
  const adapters: IntegrationAdapter[] = [];

  for (const platform of platforms) {
    const adapter = await getAdapter(platform);
    if (adapter.category === category) {
      adapters.push(adapter);
    }
  }

  return adapters;
}

// ============================================
// Push Helpers
// ============================================

/**
 * Push output to a platform using the appropriate adapter
 *
 * Convenience function that handles adapter lookup and push in one call.
 */
export async function pushToAdapter(
  platform: IntegrationPlatform,
  operation: Omit<PushOperation, "destination"> & {
    destination: PushOperation["destination"];
  }
): Promise<PushResult> {
  if (!hasAdapter(platform)) {
    return {
      success: false,
      error: `No adapter available for platform: ${platform}`,
      errorCode: "NO_ADAPTER",
    };
  }

  try {
    const adapter = await getAdapter(platform);
    return await adapter.push(operation);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      errorCode: "ADAPTER_ERROR",
    };
  }
}

/**
 * Get platforms that support a specific output type
 */
export function getPlatformsForOutputType(outputType: OutputType): IntegrationPlatform[] {
  // Import from output-types to avoid circular dependency
  const { OUTPUT_COMPATIBILITY } = require("./output-types");
  return OUTPUT_COMPATIBILITY[outputType] || [];
}

/**
 * Check if a platform can handle a specific output type
 */
export function canPlatformHandleOutput(
  platform: IntegrationPlatform,
  outputType: OutputType
): boolean {
  const platforms = getPlatformsForOutputType(outputType);
  return platforms.includes(platform);
}

// ============================================
// Adapter Info
// ============================================

export interface AdapterInfo {
  platform: IntegrationPlatform;
  category: IntegrationCategory;
  displayName: string;
  isConfigured: boolean;
  supportedOutputTypes: OutputType[];
}

/**
 * Get info about all available adapters
 */
export async function listAdapters(): Promise<AdapterInfo[]> {
  const platforms = getAdapterPlatforms();
  const infos: AdapterInfo[] = [];

  for (const platform of platforms) {
    const adapter = await getAdapter(platform);

    // Determine supported output types
    const supportedOutputTypes = Object.entries(require("./output-types").OUTPUT_COMPATIBILITY)
      .filter(([_, platforms]) => (platforms as IntegrationPlatform[]).includes(platform))
      .map(([type]) => type as OutputType);

    infos.push({
      platform: adapter.platform,
      category: adapter.category,
      displayName: adapter.displayName,
      isConfigured: adapter.isConfigured(),
      supportedOutputTypes,
    });
  }

  return infos;
}

/**
 * Get info about a specific adapter
 */
export async function getAdapterInfo(
  platform: IntegrationPlatform
): Promise<AdapterInfo | null> {
  if (!hasAdapter(platform)) {
    return null;
  }

  const adapter = await getAdapter(platform);

  const supportedOutputTypes = Object.entries(require("./output-types").OUTPUT_COMPATIBILITY)
    .filter(([_, platforms]) => (platforms as IntegrationPlatform[]).includes(platform))
    .map(([type]) => type as OutputType);

  return {
    platform: adapter.platform,
    category: adapter.category,
    displayName: adapter.displayName,
    isConfigured: adapter.isConfigured(),
    supportedOutputTypes,
  };
}
