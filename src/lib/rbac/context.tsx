"use client";

/**
 * RBAC Context Provider
 *
 * Provides permission checking utilities to React components.
 * Must be used within a client component.
 */

import { createContext, useContext, ReactNode } from "react";
import type { SessionUser, UserRole } from "@/types";
import {
  Resource,
  Action,
  Scope,
  ROLE_PERMISSIONS,
  isAdminRole,
  SettingsPermission,
} from "./permissions";

// ============================================
// Types
// ============================================

export interface SettingsDelegationData {
  canManageBilling: boolean;
  canManageTeam: boolean;
  canManageIntegrations: boolean;
  canManageBranding: boolean;
}

export interface RBACContextValue {
  user: SessionUser | null;
  /** Check if user has permission (ignoring scope) */
  can: (resource: Resource, action: Action) => boolean;
  /** Check permission with scope information */
  canWithScope: (
    resource: Resource,
    action: Action
  ) => { allowed: boolean; scope: Scope };
  /** Check if user is admin (SUPER_ADMIN or ADMIN) */
  isAdmin: boolean;
  /** Check if user has delegated settings permission */
  hasSettingsAccess: (setting: SettingsPermission) => boolean;
  /** Get the user's role display name */
  roleDisplayName: string;
  /** Settings delegation data (null if not loaded or not applicable) */
  delegatedSettings: SettingsDelegationData | null;
}

// ============================================
// Context
// ============================================

const RBACContext = createContext<RBACContextValue | null>(null);

// ============================================
// Provider
// ============================================

export interface RBACProviderProps {
  children: ReactNode;
  user: SessionUser | null;
  delegatedSettings?: SettingsDelegationData | null;
}

export function RBACProvider({
  children,
  user,
  delegatedSettings = null,
}: RBACProviderProps) {
  /**
   * Check if user has a specific permission (ignoring scope)
   */
  const can = (resource: Resource, action: Action): boolean => {
    if (!user) return false;
    const permissions = ROLE_PERMISSIONS[user.role as UserRole];
    return permissions.some(
      (p) => p.resource === resource && p.action === action
    );
  };

  /**
   * Check permission with scope information
   */
  const canWithScope = (
    resource: Resource,
    action: Action
  ): { allowed: boolean; scope: Scope } => {
    if (!user) return { allowed: false, scope: "none" };
    const permission = ROLE_PERMISSIONS[user.role as UserRole].find(
      (p) => p.resource === resource && p.action === action
    );
    return {
      allowed: !!permission,
      scope: permission?.scope || "none",
    };
  };

  /**
   * Check if user is admin level
   */
  const isAdmin = user ? isAdminRole(user.role as UserRole) : false;

  /**
   * Check if user has specific settings permission (via role or delegation)
   */
  const hasSettingsAccess = (setting: SettingsPermission): boolean => {
    // Admins always have full settings access
    if (isAdmin) return true;

    // Check delegation
    if (!delegatedSettings) return false;

    switch (setting) {
      case "billing":
        return delegatedSettings.canManageBilling;
      case "team":
        return delegatedSettings.canManageTeam;
      case "integrations":
        return delegatedSettings.canManageIntegrations;
      case "branding":
        return delegatedSettings.canManageBranding;
      default:
        return false;
    }
  };

  /**
   * Get human-readable role name
   */
  const roleDisplayName = user
    ? user.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unknown";

  return (
    <RBACContext.Provider
      value={{
        user,
        can,
        canWithScope,
        isAdmin,
        hasSettingsAccess,
        roleDisplayName,
        delegatedSettings,
      }}
    >
      {children}
    </RBACContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

/**
 * Access RBAC context in client components.
 * Must be used within RBACProvider.
 */
export function useRBAC(): RBACContextValue {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error("useRBAC must be used within an RBACProvider");
  }
  return context;
}
