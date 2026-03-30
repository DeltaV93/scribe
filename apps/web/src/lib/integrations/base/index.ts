/**
 * Workflow Integrations - Base Infrastructure (PX-882)
 *
 * Re-exports all base utilities for workflow integrations.
 */

// Core types
export * from "./types";

// Validation schemas
export * from "./schemas";

// Security utilities
export * from "./security";

// OAuth route handlers (org-level - admin connects)
export {
  createOAuthAuthorizeHandler,
  createOAuthCallbackHandler,
} from "./oauth-handler";

// User OAuth route handlers (per-user - each user connects their own)
export {
  createUserOAuthAuthorizeHandler,
  createUserOAuthCallbackHandler,
  createUserConnectionStatusHandler,
  createUserDisconnectHandler,
} from "./user-oauth-handler";

// Connection route handlers (org-level)
export {
  createGetConnectionHandler,
  createDeleteConnectionHandler,
} from "./connection-handler";

// Token management (org-level)
export {
  isPlatformConfigured,
  getCallbackUrl,
  storeIntegrationConnection,
  getIntegrationConnection,
  getAccessToken,
  deleteIntegrationConnection,
  markConnectionError,
  clearConnectionError,
  getAllConnections,
} from "./token-store";

// User token management (per-user)
export {
  getUserCallbackUrl,
  storeUserIntegrationConnection,
  getUserIntegrationConnection,
  getUserAccessToken,
  hasUserConnection,
  disconnectUserIntegration,
  markUserConnectionError,
  clearUserConnectionError,
  getUserConnections,
  getOrgUsersWithConnection,
  countOrgUsersWithConnection,
  canUserPushToPlatform,
  getUserConnectionStatus,
} from "./user-token-store";

// Service registry (legacy WorkflowService)
export {
  getWorkflowService,
  getWorkflowServiceAsync,
  hasWorkflowService,
  getSupportedPlatforms,
} from "./registry";

// Adapter registry (PX-1006 - IntegrationAdapter)
export {
  getAdapter,
  hasAdapter,
  getAdapterPlatforms,
  getAdaptersByCategory,
  pushToAdapter,
  getPlatformsForOutputType,
  canPlatformHandleOutput,
  listAdapters,
  getAdapterInfo,
} from "./adapter-registry";
export type { AdapterInfo } from "./adapter-registry";

// Adapter interface (PX-1002)
export type {
  IntegrationAdapter,
  OAuthTokens,
  ConnectionTestResult,
  PlatformResources,
  PushOperation,
  PushResult,
  Workspace,
  Team,
  Project,
  Database,
  Channel,
  Folder,
} from "./adapter";
export { isIntegrationAdapter, resourceToDbFormat } from "./adapter";

// Push queue (PX-1002)
export {
  createPushJob,
  createMultiDestinationPushJobs,
  processPushJob,
  getPendingJobs,
  getJobStatus,
  getJobsForOutput,
  processAllPendingJobs,
} from "./push-queue";
export type { CreatePushJobInput, PushJobResult, ProcessJobResult } from "./push-queue";

// Sensitivity check (PX-1002)
export {
  checkOutputSensitivity,
  checkConversationSensitivity,
  getPushableOutputs,
  isOutputTypeCompatibleWithPlatform,
} from "./sensitivity-check";
export type { SensitivityCheckResult } from "./sensitivity-check";
