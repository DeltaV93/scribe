/**
 * Workflow Integrations - Core Types (PX-882)
 *
 * Defines the WorkflowService interface and shared types for all
 * workflow integration platforms (Linear, Notion, Jira).
 *
 * Design Patterns:
 * - Adapter: All platforms implement WorkflowService interface
 * - Factory: getWorkflowService returns platform-specific implementations
 */

import { IntegrationPlatform } from "@prisma/client";

// ============================================
// Platform Types
// ============================================

/**
 * Workflow platforms supported for pushing outputs
 */
export type WorkflowPlatform = Extract<
  IntegrationPlatform,
  "LINEAR" | "NOTION" | "JIRA"
>;

/**
 * Check if a platform is a workflow platform
 */
export function isWorkflowPlatform(
  platform: IntegrationPlatform
): platform is WorkflowPlatform {
  return ["LINEAR", "NOTION", "JIRA"].includes(platform);
}

// ============================================
// OAuth Types
// ============================================

/**
 * OAuth tokens returned from token exchange
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
}

/**
 * OAuth state parameter structure
 */
export interface OAuthState {
  platform: IntegrationPlatform;
  orgId: string;
  userId: string;
  redirectUrl?: string;
  createdAt: number;
}

/**
 * Connection test result
 */
export interface ConnectionStatus {
  success: boolean;
  error?: string;
  details?: {
    workspaceName?: string;
    workspaceId?: string;
    userName?: string;
    userId?: string;
  };
}

// ============================================
// Push Operation Types
// ============================================

/**
 * Result of pushing an output to a platform
 */
export interface PushResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Action item draft to push
 */
export interface ActionItemDraft {
  title: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  labels?: string[];
  projectId?: string;
  teamId?: string;
  sourceSnippet?: string;
}

/**
 * Meeting notes draft to push
 */
export interface MeetingNotesDraft {
  title: string;
  content: string;
  sections?: Array<{
    heading: string;
    content: string;
  }>;
  attendees?: string[];
  actionItems?: string[];
  databaseId?: string;
  parentPageId?: string;
}

// ============================================
// Configuration Types
// ============================================

/**
 * Platform-specific configuration stored with connection
 */
export interface PlatformConfig {
  // Linear
  teamId?: string;
  teamName?: string;
  defaultProjectId?: string;

  // Notion
  workspaceId?: string;
  workspaceName?: string;
  botId?: string;
  defaultDatabaseId?: string;
  defaultPageId?: string;

  // Jira
  cloudId?: string;
  siteUrl?: string;
  projectKey?: string;
  defaultIssueType?: string;
}

/**
 * OAuth configuration for a platform
 */
export interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scopes?: string[];
  clientId: string;
  clientSecret: string;
}

// ============================================
// WorkflowService Interface
// ============================================

/**
 * Core interface for workflow integration services.
 *
 * All platform implementations must implement this interface,
 * enabling the Factory pattern via getWorkflowService().
 *
 * @example
 * ```typescript
 * const service = getWorkflowService("LINEAR");
 * const result = await service.pushActionItem(orgId, draft);
 * ```
 */
export interface WorkflowService {
  /**
   * The platform this service handles
   */
  readonly platform: WorkflowPlatform;

  /**
   * Check if the platform is configured (env vars present)
   */
  isConfigured(): boolean;

  /**
   * Get the OAuth configuration for this platform
   */
  getOAuthConfig(): OAuthConfig | null;

  /**
   * Generate the OAuth authorization URL
   */
  getAuthorizationUrl(state: string, callbackUrl: string): string;

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(
    code: string,
    callbackUrl: string
  ): Promise<OAuthTokens>;

  /**
   * Test the connection with the given access token
   */
  testConnection(accessToken: string): Promise<ConnectionStatus>;

  /**
   * Push an action item to the platform
   */
  pushActionItem(
    accessToken: string,
    draft: ActionItemDraft,
    config?: PlatformConfig
  ): Promise<PushResult>;

  /**
   * Push meeting notes to the platform (optional)
   */
  pushMeetingNotes?(
    accessToken: string,
    draft: MeetingNotesDraft,
    config?: PlatformConfig
  ): Promise<PushResult>;
}

// ============================================
// Connection Types (from DB)
// ============================================

/**
 * Integration connection from database
 */
export interface IntegrationConnectionData {
  id: string;
  orgId: string;
  platform: IntegrationPlatform;
  name: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  config?: PlatformConfig | null;
  isActive: boolean;
  lastUsedAt?: Date | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Connection status for API response
 */
export interface ConnectionStatusResponse {
  connected: boolean;
  configured: boolean;
  connection: {
    id: string;
    name: string;
    lastUsedAt: Date | null;
    lastError: string | null;
  } | null;
}
