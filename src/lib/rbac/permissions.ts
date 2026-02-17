/**
 * RBAC Permission Configuration
 *
 * This is the single source of truth for all permission definitions.
 * Permissions are defined centrally in code (not database) for:
 * - Better scalability (1000+ users)
 * - Instant role change application
 * - Easy auditing
 * - No N+1 database queries
 */

import { UserRole } from "@/types";

// ============================================
// Resource Types
// ============================================

export type Resource =
  | "clients"
  | "programs"
  | "forms"
  | "calls"
  | "goals"
  | "settings"
  | "billing"
  | "admin"
  | "exports"
  | "attendance";

// ============================================
// Action Types
// ============================================

export type Action =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "export"
  | "publish"
  | "use"; // For forms: submit data without editing form structure

// ============================================
// Scope Types
// ============================================

/**
 * Scope determines the breadth of access:
 * - all: Full organization visibility
 * - program: Scoped to assigned programs (via ProgramMember)
 * - assigned: Scoped to specifically assigned resources (e.g., assigned clients, own calls)
 * - session: Session-only access (for facilitators during active sessions)
 * - none: No access
 */
export type Scope = "all" | "program" | "assigned" | "session" | "none";

// ============================================
// Settings Permissions (Delegatable by Admin)
// ============================================

export type SettingsPermission =
  | "billing"
  | "team"
  | "integrations"
  | "branding";

// ============================================
// Permission Definition
// ============================================

export interface Permission {
  resource: Resource;
  action: Action;
  scope: Scope;
}

// ============================================
// Role Permission Matrix
// ============================================

/**
 * Complete permission matrix for all roles.
 *
 * Role Hierarchy:
 * 1. SUPER_ADMIN - Full system access (Scrybe staff only)
 * 2. ADMIN - Full org access + settings delegation
 * 3. PROGRAM_MANAGER - Assigned programs, read all clients, no form delete/publish
 * 4. CASE_MANAGER - Assigned clients, own calls, form use only
 * 5. FACILITATOR - Session-only access, attendance/notes/forms
 * 6. VIEWER - Read-only on assigned/program data (default for new invites)
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // ----------------------------------------
  // SUPER_ADMIN: Full system access
  // ----------------------------------------
  SUPER_ADMIN: [
    // Clients
    { resource: "clients", action: "create", scope: "all" },
    { resource: "clients", action: "read", scope: "all" },
    { resource: "clients", action: "update", scope: "all" },
    { resource: "clients", action: "delete", scope: "all" },
    { resource: "clients", action: "export", scope: "all" },
    // Programs
    { resource: "programs", action: "create", scope: "all" },
    { resource: "programs", action: "read", scope: "all" },
    { resource: "programs", action: "update", scope: "all" },
    { resource: "programs", action: "delete", scope: "all" },
    // Forms
    { resource: "forms", action: "create", scope: "all" },
    { resource: "forms", action: "read", scope: "all" },
    { resource: "forms", action: "update", scope: "all" },
    { resource: "forms", action: "delete", scope: "all" },
    { resource: "forms", action: "publish", scope: "all" },
    { resource: "forms", action: "use", scope: "all" },
    // Calls
    { resource: "calls", action: "create", scope: "all" },
    { resource: "calls", action: "read", scope: "all" },
    { resource: "calls", action: "update", scope: "all" },
    { resource: "calls", action: "delete", scope: "all" },
    // Goals
    { resource: "goals", action: "create", scope: "all" },
    { resource: "goals", action: "read", scope: "all" },
    { resource: "goals", action: "update", scope: "all" },
    { resource: "goals", action: "delete", scope: "all" },
    // Admin
    { resource: "admin", action: "read", scope: "all" },
    { resource: "admin", action: "update", scope: "all" },
    // Settings
    { resource: "settings", action: "read", scope: "all" },
    { resource: "settings", action: "update", scope: "all" },
    // Billing
    { resource: "billing", action: "read", scope: "all" },
    { resource: "billing", action: "update", scope: "all" },
    // Exports
    { resource: "exports", action: "create", scope: "all" },
    { resource: "exports", action: "read", scope: "all" },
    // Attendance
    { resource: "attendance", action: "create", scope: "all" },
    { resource: "attendance", action: "read", scope: "all" },
    { resource: "attendance", action: "update", scope: "all" },
  ],

  // ----------------------------------------
  // ADMIN: Full org access
  // ----------------------------------------
  ADMIN: [
    // Clients
    { resource: "clients", action: "create", scope: "all" },
    { resource: "clients", action: "read", scope: "all" },
    { resource: "clients", action: "update", scope: "all" },
    { resource: "clients", action: "delete", scope: "all" },
    { resource: "clients", action: "export", scope: "all" },
    // Programs
    { resource: "programs", action: "create", scope: "all" },
    { resource: "programs", action: "read", scope: "all" },
    { resource: "programs", action: "update", scope: "all" },
    { resource: "programs", action: "delete", scope: "all" },
    // Forms
    { resource: "forms", action: "create", scope: "all" },
    { resource: "forms", action: "read", scope: "all" },
    { resource: "forms", action: "update", scope: "all" },
    { resource: "forms", action: "delete", scope: "all" },
    { resource: "forms", action: "publish", scope: "all" },
    { resource: "forms", action: "use", scope: "all" },
    // Calls
    { resource: "calls", action: "create", scope: "all" },
    { resource: "calls", action: "read", scope: "all" },
    { resource: "calls", action: "update", scope: "all" },
    { resource: "calls", action: "delete", scope: "all" },
    // Goals
    { resource: "goals", action: "create", scope: "all" },
    { resource: "goals", action: "read", scope: "all" },
    { resource: "goals", action: "update", scope: "all" },
    { resource: "goals", action: "delete", scope: "all" },
    // Admin
    { resource: "admin", action: "read", scope: "all" },
    { resource: "admin", action: "update", scope: "all" },
    // Settings
    { resource: "settings", action: "read", scope: "all" },
    { resource: "settings", action: "update", scope: "all" },
    // Billing
    { resource: "billing", action: "read", scope: "all" },
    { resource: "billing", action: "update", scope: "all" },
    // Exports
    { resource: "exports", action: "create", scope: "all" },
    { resource: "exports", action: "read", scope: "all" },
    // Attendance
    { resource: "attendance", action: "create", scope: "all" },
    { resource: "attendance", action: "read", scope: "all" },
    { resource: "attendance", action: "update", scope: "all" },
  ],

  // ----------------------------------------
  // PROGRAM_MANAGER: Assigned programs, read all clients
  // ----------------------------------------
  PROGRAM_MANAGER: [
    // Clients - read all, edit only in their programs
    { resource: "clients", action: "create", scope: "program" },
    { resource: "clients", action: "read", scope: "all" },
    { resource: "clients", action: "update", scope: "program" },
    { resource: "clients", action: "export", scope: "program" },
    // Programs - CRUD on assigned
    { resource: "programs", action: "create", scope: "all" },
    { resource: "programs", action: "read", scope: "all" },
    { resource: "programs", action: "update", scope: "program" },
    { resource: "programs", action: "delete", scope: "program" },
    // Forms - create + edit, NO delete, NO publish
    { resource: "forms", action: "create", scope: "all" },
    { resource: "forms", action: "read", scope: "all" },
    { resource: "forms", action: "update", scope: "all" },
    { resource: "forms", action: "use", scope: "all" },
    // Calls - view program only
    { resource: "calls", action: "read", scope: "program" },
    // Goals - read only
    { resource: "goals", action: "read", scope: "all" },
    // Exports - program scoped only
    { resource: "exports", action: "create", scope: "program" },
    { resource: "exports", action: "read", scope: "program" },
    // Attendance
    { resource: "attendance", action: "create", scope: "program" },
    { resource: "attendance", action: "read", scope: "program" },
    { resource: "attendance", action: "update", scope: "program" },
  ],

  // ----------------------------------------
  // CASE_MANAGER: Assigned clients, own calls
  // ----------------------------------------
  CASE_MANAGER: [
    // Clients - CRUD on assigned only
    { resource: "clients", action: "create", scope: "assigned" },
    { resource: "clients", action: "read", scope: "assigned" },
    { resource: "clients", action: "update", scope: "assigned" },
    { resource: "clients", action: "delete", scope: "assigned" },
    // Programs - view assigned only
    { resource: "programs", action: "read", scope: "program" },
    // Forms - use only (submit data), no create/edit
    { resource: "forms", action: "read", scope: "all" },
    { resource: "forms", action: "use", scope: "all" },
    // Calls - own only
    { resource: "calls", action: "create", scope: "assigned" },
    { resource: "calls", action: "read", scope: "assigned" },
    { resource: "calls", action: "update", scope: "assigned" },
    // Attendance - read own program sessions
    { resource: "attendance", action: "read", scope: "program" },
  ],

  // ----------------------------------------
  // FACILITATOR: Session-only access
  // ----------------------------------------
  FACILITATOR: [
    // Clients - basic info in sessions only
    { resource: "clients", action: "read", scope: "session" },
    // Programs - view assigned + update (attendance/notes)
    { resource: "programs", action: "read", scope: "program" },
    { resource: "programs", action: "update", scope: "program" },
    // Forms - use in sessions only
    { resource: "forms", action: "read", scope: "all" },
    { resource: "forms", action: "use", scope: "program" },
    // Attendance - full access within assigned programs
    { resource: "attendance", action: "create", scope: "program" },
    { resource: "attendance", action: "read", scope: "program" },
    { resource: "attendance", action: "update", scope: "program" },
  ],

  // ----------------------------------------
  // VIEWER: Read-only on assigned/program data
  // Default role for new invites
  // ----------------------------------------
  VIEWER: [
    // Clients - read assigned/program only
    { resource: "clients", action: "read", scope: "program" },
    // Programs - read assigned only
    { resource: "programs", action: "read", scope: "program" },
    // Forms - read only (cannot submit)
    { resource: "forms", action: "read", scope: "all" },
    // Goals - read program only
    { resource: "goals", action: "read", scope: "program" },
    // Attendance - read only
    { resource: "attendance", action: "read", scope: "program" },
  ],
};

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a role has a specific permission (ignoring scope)
 */
export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.some(
    (p) => p.resource === resource && p.action === action
  );
}

/**
 * Get the scope for a specific permission
 */
export function getPermissionScope(
  role: UserRole,
  resource: Resource,
  action: Action
): Scope | null {
  const permissions = ROLE_PERMISSIONS[role];
  const permission = permissions.find(
    (p) => p.resource === resource && p.action === action
  );
  return permission?.scope ?? null;
}

/**
 * Check if role is admin-level (SUPER_ADMIN or ADMIN)
 */
export function isAdminRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/**
 * Get all resources a role can access for a given action
 */
export function getAccessibleResources(
  role: UserRole,
  action: Action
): Resource[] {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions
    .filter((p) => p.action === action)
    .map((p) => p.resource);
}

/**
 * Get all actions a role can perform on a resource
 */
export function getPermittedActions(
  role: UserRole,
  resource: Resource
): Action[] {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions
    .filter((p) => p.resource === resource)
    .map((p) => p.action);
}

// ============================================
// Navigation Items Configuration
// ============================================

export interface NavPermission {
  resource: Resource;
  action: Action;
}

/**
 * Define which permission is required for each nav item.
 * Used by sidebar to filter visible navigation.
 */
export const NAV_PERMISSIONS: Record<string, NavPermission> = {
  "/dashboard": { resource: "clients", action: "read" }, // Everyone with any read access
  "/forms": { resource: "forms", action: "read" },
  "/clients": { resource: "clients", action: "read" },
  "/programs": { resource: "programs", action: "read" },
  "/calls": { resource: "calls", action: "read" },
  "/goals": { resource: "goals", action: "read" },
  "/admin": { resource: "admin", action: "read" },
  "/billing": { resource: "billing", action: "read" },
  "/settings": { resource: "settings", action: "read" },
  "/exports": { resource: "exports", action: "read" },
};

/**
 * Check if a role can access a given route
 */
export function canAccessRoute(role: UserRole, route: string): boolean {
  // Special case: dashboard is always accessible if user can read anything
  if (route === "/dashboard") {
    const permissions = ROLE_PERMISSIONS[role];
    return permissions.some((p) => p.action === "read");
  }

  const permission = NAV_PERMISSIONS[route];
  if (!permission) {
    // Route not in nav permissions, allow by default
    return true;
  }

  return hasPermission(role, permission.resource, permission.action);
}
