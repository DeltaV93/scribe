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

// OAuth route handlers
export {
  createOAuthAuthorizeHandler,
  createOAuthCallbackHandler,
} from "./oauth-handler";

// Connection route handlers
export {
  createGetConnectionHandler,
  createDeleteConnectionHandler,
} from "./connection-handler";

// Token management
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

// Service registry
export {
  getWorkflowService,
  getWorkflowServiceAsync,
  hasWorkflowService,
  getSupportedPlatforms,
} from "./registry";
