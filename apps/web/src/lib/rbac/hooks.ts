"use client";

/**
 * RBAC Hooks
 *
 * Convenience hooks for permission checking in React components.
 */

import { useRBAC } from "./context";
import { Resource, Action, Scope, SettingsPermission } from "./permissions";

// ============================================
// Permission Checking Hooks
// ============================================

/**
 * Check if user has permission to perform action on resource.
 *
 * @example
 * ```tsx
 * function CreateButton() {
 *   const canCreate = useCan("forms", "create");
 *   if (!canCreate) return null;
 *   return <Button>Create Form</Button>;
 * }
 * ```
 */
export function useCan(resource: Resource, action: Action): boolean {
  const { can } = useRBAC();
  return can(resource, action);
}

/**
 * Check permission with scope information.
 * Useful when you need to know if access is org-wide, program-scoped, etc.
 *
 * @example
 * ```tsx
 * function ClientList() {
 *   const { allowed, scope, isOrgWide, isProgramScoped } =
 *     useCanWithScope("clients", "read");
 *
 *   if (!allowed) return <AccessDenied />;
 *
 *   return (
 *     <div>
 *       {isProgramScoped && <ProgramFilter />}
 *       <ClientTable />
 *     </div>
 *   );
 * }
 * ```
 */
export function useCanWithScope(
  resource: Resource,
  action: Action
): {
  allowed: boolean;
  scope: Scope;
  isOrgWide: boolean;
  isProgramScoped: boolean;
  isAssignedOnly: boolean;
  isSessionOnly: boolean;
} {
  const { canWithScope } = useRBAC();
  const result = canWithScope(resource, action);
  return {
    ...result,
    isOrgWide: result.scope === "all",
    isProgramScoped: result.scope === "program",
    isAssignedOnly: result.scope === "assigned",
    isSessionOnly: result.scope === "session",
  };
}

/**
 * Check if content should be hidden (inverse of useCan).
 * Useful for conditional rendering.
 *
 * @example
 * ```tsx
 * function AdminSection() {
 *   const hide = useHide("admin", "read");
 *   if (hide) return null;
 *   return <AdminPanel />;
 * }
 * ```
 */
export function useHide(resource: Resource, action: Action): boolean {
  const { can } = useRBAC();
  return !can(resource, action);
}

/**
 * Check if user is admin (SUPER_ADMIN or ADMIN).
 *
 * @example
 * ```tsx
 * function DeleteButton() {
 *   const isAdmin = useIsAdmin();
 *   if (!isAdmin) return null;
 *   return <Button variant="destructive">Delete</Button>;
 * }
 * ```
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = useRBAC();
  return isAdmin;
}

/**
 * Check if user has specific settings permission.
 *
 * @example
 * ```tsx
 * function BillingLink() {
 *   const canBilling = useHasSettingsAccess("billing");
 *   if (!canBilling) return null;
 *   return <Link href="/billing">Billing</Link>;
 * }
 * ```
 */
export function useHasSettingsAccess(setting: SettingsPermission): boolean {
  const { hasSettingsAccess } = useRBAC();
  return hasSettingsAccess(setting);
}

/**
 * Get the current user's role display name.
 *
 * @example
 * ```tsx
 * function RoleBadge() {
 *   const role = useRoleDisplayName();
 *   return <Badge>{role}</Badge>;
 * }
 * ```
 */
export function useRoleDisplayName(): string {
  const { roleDisplayName } = useRBAC();
  return roleDisplayName;
}

// ============================================
// Compound Hooks
// ============================================

/**
 * Get all permissions for a specific resource.
 * Useful for showing/hiding multiple UI elements at once.
 *
 * @example
 * ```tsx
 * function FormActions() {
 *   const { canCreate, canUpdate, canDelete, canPublish } =
 *     useResourcePermissions("forms");
 *
 *   return (
 *     <div>
 *       {canCreate && <CreateButton />}
 *       {canUpdate && <EditButton />}
 *       {canDelete && <DeleteButton />}
 *       {canPublish && <PublishButton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useResourcePermissions(resource: Resource): {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
  canPublish: boolean;
  canUse: boolean;
} {
  const { can } = useRBAC();
  return {
    canCreate: can(resource, "create"),
    canRead: can(resource, "read"),
    canUpdate: can(resource, "update"),
    canDelete: can(resource, "delete"),
    canExport: can(resource, "export"),
    canPublish: can(resource, "publish"),
    canUse: can(resource, "use"),
  };
}

/**
 * Get all settings permissions at once.
 *
 * @example
 * ```tsx
 * function SettingsNav() {
 *   const { billing, team, integrations, branding } = useSettingsPermissions();
 *
 *   return (
 *     <nav>
 *       {billing && <Link href="/settings/billing">Billing</Link>}
 *       {team && <Link href="/settings/team">Team</Link>}
 *       {integrations && <Link href="/settings/integrations">Integrations</Link>}
 *       {branding && <Link href="/settings/branding">Branding</Link>}
 *     </nav>
 *   );
 * }
 * ```
 */
export function useSettingsPermissions(): {
  billing: boolean;
  team: boolean;
  integrations: boolean;
  branding: boolean;
} {
  const { hasSettingsAccess } = useRBAC();
  return {
    billing: hasSettingsAccess("billing"),
    team: hasSettingsAccess("team"),
    integrations: hasSettingsAccess("integrations"),
    branding: hasSettingsAccess("branding"),
  };
}
