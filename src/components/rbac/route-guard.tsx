"use client";

/**
 * Route Guard Component
 *
 * Wraps content that requires specific permissions.
 * Shows 403 page if user doesn't have access.
 */

import { ReactNode } from "react";
import { useRBAC } from "@/lib/rbac/context";
import { Resource, Action } from "@/lib/rbac/permissions";
import { Forbidden403 } from "./forbidden-403";

// ============================================
// Types
// ============================================

export interface RouteGuardProps {
  /** The resource being accessed */
  resource: Resource;
  /** The action being performed */
  action: Action;
  /** Content to render if authorized */
  children: ReactNode;
  /** Optional custom fallback (defaults to Forbidden403) */
  fallback?: ReactNode;
  /** Admin email for 403 page */
  adminEmail?: string;
  /** Admin name for 403 page */
  adminName?: string;
}

// ============================================
// Component
// ============================================

/**
 * Wrap page content with permission check.
 *
 * @example
 * ```tsx
 * function FormsPage() {
 *   return (
 *     <RouteGuard resource="forms" action="read">
 *       <FormsList />
 *     </RouteGuard>
 *   );
 * }
 * ```
 */
export function RouteGuard({
  resource,
  action,
  children,
  fallback,
  adminEmail,
  adminName,
}: RouteGuardProps) {
  const { can, user } = useRBAC();

  // Not authenticated (should not happen with middleware)
  if (!user) {
    return null;
  }

  // Check permission
  if (!can(resource, action)) {
    return (
      fallback || (
        <Forbidden403
          resource={resource}
          action={action}
          userRole={user.role}
          adminEmail={adminEmail}
          adminName={adminName}
        />
      )
    );
  }

  return <>{children}</>;
}

// ============================================
// Specialized Guards
// ============================================

export interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  adminEmail?: string;
  adminName?: string;
}

/**
 * Guard for admin-only content.
 *
 * @example
 * ```tsx
 * function AdminPage() {
 *   return (
 *     <AdminGuard>
 *       <AdminPanel />
 *     </AdminGuard>
 *   );
 * }
 * ```
 */
export function AdminGuard({
  children,
  fallback,
  adminEmail,
  adminName,
}: AdminGuardProps) {
  return (
    <RouteGuard
      resource="admin"
      action="read"
      fallback={fallback}
      adminEmail={adminEmail}
      adminName={adminName}
    >
      {children}
    </RouteGuard>
  );
}

export interface SettingsGuardProps {
  setting: "billing" | "team" | "integrations" | "branding";
  children: ReactNode;
  fallback?: ReactNode;
  adminEmail?: string;
  adminName?: string;
}

/**
 * Guard for settings with delegation support.
 *
 * @example
 * ```tsx
 * function BillingPage() {
 *   return (
 *     <SettingsGuard setting="billing">
 *       <BillingPanel />
 *     </SettingsGuard>
 *   );
 * }
 * ```
 */
export function SettingsGuard({
  setting,
  children,
  fallback,
  adminEmail,
  adminName,
}: SettingsGuardProps) {
  const { hasSettingsAccess, user } = useRBAC();

  if (!user) {
    return null;
  }

  if (!hasSettingsAccess(setting)) {
    return (
      fallback || (
        <Forbidden403
          resource="settings"
          action={`manage ${setting}`}
          userRole={user.role}
          adminEmail={adminEmail}
          adminName={adminName}
        />
      )
    );
  }

  return <>{children}</>;
}
