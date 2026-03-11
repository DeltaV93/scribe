/**
 * RBAC (Role-Based Access Control) Module
 *
 * Centralized permission management for Scrybe.
 *
 * Usage:
 * - Backend: Use withRBAC middleware or checkPermission directly
 * - Frontend: Use RBACProvider context and useCan/useCanWithScope hooks
 */

// Core permission definitions
export * from "./permissions";

// Permission checker (server-side)
export {
  checkPermission,
  getUserProgramIds,
  isClientAssignedToUser,
  isClientSharedWithUser,
  getClientProgramIds,
  hasActiveSessionWithClient,
  getOrgAdminContact,
  getSettingsDelegation,
  hasSettingsPermission,
  type PermissionCheckInput,
  type PermissionCheckResult,
} from "./checker";

// API middleware (server-side)
export {
  withRBAC,
  requireAdmin,
  requireSettingsPermission,
  getClientScopeContext,
  getCallScopeContext,
  getProgramScopeContext,
  type RBACOptions,
  type ScopeContext,
  type RBACContext,
} from "./middleware";

// API route helpers (simple permission checks for gradual migration)
export {
  checkApiPermission,
  checkScopedPermission,
  requireAdminRole,
} from "./api-helpers";

// Frontend context and hooks (client-side)
// Note: These must be imported directly in client components
// to avoid "use client" boundary issues:
// import { RBACProvider, useRBAC } from "@/lib/rbac/context";
// import { useCan, useCanWithScope } from "@/lib/rbac/hooks";
