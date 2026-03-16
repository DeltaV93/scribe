/**
 * Integration Adapter Interface (PX-1002)
 *
 * Unified interface that all integration adapters must implement.
 * Extends the existing WorkflowService pattern with discovery and lifecycle methods.
 */

import { IntegrationPlatform, IntegrationCategory, ResourceType, Prisma } from "@prisma/client";
import type {
  OutputType,
  OutputPayload,
  PushDestination,
  ActionItemPayload,
  MeetingNotesPayload,
} from "./output-types";

// ============================================
// Core Adapter Interface
// ============================================

/**
 * All integration adapters implement this interface.
 *
 * This extends the existing WorkflowService pattern with:
 * - Category metadata
 * - Resource discovery (teams, projects, databases)
 * - Unified push operations
 */
export interface IntegrationAdapter<TConfig = unknown> {
  readonly platform: IntegrationPlatform;
  readonly category: IntegrationCategory;
  readonly displayName: string;

  // ============================================
  // Configuration
  // ============================================

  /**
   * Check if OAuth credentials are configured (env vars present)
   */
  isConfigured(): boolean;

  // ============================================
  // OAuth
  // ============================================

  /**
   * Build the OAuth authorization URL
   */
  getAuthorizationUrl(state: string, callbackUrl: string): string;

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(
    code: string,
    callbackUrl: string
  ): Promise<OAuthTokens>;

  // ============================================
  // Connection Lifecycle
  // ============================================

  /**
   * Test that a connection is valid and working
   */
  testConnection(accessToken: string): Promise<ConnectionTestResult>;

  /**
   * Cleanup when disconnecting (optional revocation)
   */
  disconnect?(connectionId: string): Promise<void>;

  // ============================================
  // Resource Discovery
  // ============================================

  /**
   * Discover resources available in the connected account
   * (teams, projects, databases, channels, etc.)
   *
   * Called after successful OAuth to populate destination options.
   */
  discoverResources(accessToken: string): Promise<PlatformResources>;

  // ============================================
  // Push Operations
  // ============================================

  /**
   * Push an output to this platform
   */
  push(operation: PushOperation): Promise<PushResult>;
}

// ============================================
// OAuth Types
// ============================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
}

// ============================================
// Connection Types
// ============================================

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  details?: {
    userId?: string;
    userName?: string;
    workspaceId?: string;
    workspaceName?: string;
    email?: string;
  };
}

// ============================================
// Resource Discovery Types
// ============================================

export interface PlatformResources {
  workspaces?: Workspace[];
  teams?: Team[];
  projects?: Project[];
  databases?: Database[];
  channels?: Channel[];
  folders?: Folder[];
}

export interface Workspace {
  id: string;
  name: string;
  url?: string;
}

export interface Team {
  id: string;
  name: string;
  workspaceId?: string;
}

export interface Project {
  id: string;
  name: string;
  teamId?: string;
  key?: string; // Jira project key
}

export interface Database {
  id: string;
  name: string;
  parentId?: string;
}

export interface Channel {
  id: string;
  name: string;
  isPrivate?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
}

// ============================================
// Push Operation Types
// ============================================

export interface PushOperation {
  type: OutputType;
  payload: OutputPayload | ActionItemPayload | MeetingNotesPayload;
  destination: PushDestination;
  accessToken: string;
}

export interface PushResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
  errorCode?: string;
}

// ============================================
// Registry Helpers
// ============================================

/**
 * Type guard to check if a service implements IntegrationAdapter
 */
export function isIntegrationAdapter(
  service: unknown
): service is IntegrationAdapter {
  return (
    typeof service === "object" &&
    service !== null &&
    "platform" in service &&
    "category" in service &&
    "discoverResources" in service &&
    "push" in service
  );
}

// ============================================
// Resource Storage Helpers
// ============================================

/**
 * Convert discovered resources to database format
 */
export function resourceToDbFormat(
  connectionId: string,
  resourceType: ResourceType,
  resource: { id: string; name: string; parentId?: string; [key: string]: unknown }
): Prisma.IntegrationResourceCreateManyInput {
  const { id, name, parentId, ...rest } = resource;
  return {
    connectionId,
    resourceType,
    externalId: id,
    name,
    parentId: parentId ?? null,
    metadata: Object.keys(rest).length > 0 ? rest as Prisma.InputJsonValue : undefined,
  };
}
