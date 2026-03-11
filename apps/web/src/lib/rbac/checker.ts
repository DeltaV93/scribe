/**
 * Permission Checker Service
 *
 * Evaluates permissions by checking:
 * 1. Role has the permission in ROLE_PERMISSIONS
 * 2. Scope conditions are met (all, program, assigned, session)
 */

import { prisma } from "@/lib/db";
import { SessionUser, UserRole } from "@/types";
import {
  Resource,
  Action,
  Scope,
  ROLE_PERMISSIONS,
  isAdminRole,
} from "./permissions";

// ============================================
// Types
// ============================================

export interface PermissionCheckInput {
  resource: Resource;
  action: Action;
  resourceId?: string | null;
  programIds?: string[];
  clientId?: string;
  ownerId?: string; // Owner of the resource (for "assigned" scope)
}

export interface PermissionCheckResult {
  allowed: boolean;
  scope?: Scope;
  reason?: string;
  userMessage?: string;
  adminContact?: string;
}

// ============================================
// Main Permission Check Function
// ============================================

/**
 * Check if user has permission to perform action on resource.
 *
 * @param user - The authenticated user
 * @param input - Permission check parameters
 * @returns Result indicating if access is allowed
 */
export async function checkPermission(
  user: SessionUser,
  input: PermissionCheckInput
): Promise<PermissionCheckResult> {
  const rolePermissions = ROLE_PERMISSIONS[user.role as UserRole];

  // Find matching permission for this resource/action
  const permission = rolePermissions.find(
    (p) => p.resource === input.resource && p.action === input.action
  );

  if (!permission) {
    const adminContact = await getOrgAdminContact(user.orgId);
    return {
      allowed: false,
      reason: `Role ${user.role} does not have ${input.action} permission for ${input.resource}`,
      userMessage: `Your ${formatRole(user.role)} role does not allow this action.`,
      adminContact,
    };
  }

  // Check scope conditions
  const scopeResult = await checkScope(user, permission.scope, input);

  if (!scopeResult.allowed) {
    const adminContact = await getOrgAdminContact(user.orgId);
    return {
      ...scopeResult,
      adminContact,
    };
  }

  return { allowed: true, scope: permission.scope };
}

// ============================================
// Scope Checking
// ============================================

async function checkScope(
  user: SessionUser,
  scope: Scope,
  input: PermissionCheckInput
): Promise<PermissionCheckResult> {
  switch (scope) {
    case "all":
      // Full org visibility - always allowed
      return { allowed: true, scope };

    case "program":
      return checkProgramScope(user, input);

    case "assigned":
      return checkAssignedScope(user, input);

    case "session":
      return checkSessionScope(user, input);

    case "none":
      return {
        allowed: false,
        scope,
        reason: "No access scope",
        userMessage: "You do not have access to this resource type.",
      };

    default:
      return {
        allowed: false,
        reason: `Unknown scope: ${scope}`,
        userMessage: "Access denied due to unknown scope.",
      };
  }
}

/**
 * Check if user is member of the resource's program(s)
 */
async function checkProgramScope(
  user: SessionUser,
  input: PermissionCheckInput
): Promise<PermissionCheckResult> {
  // Admin roles bypass program scope
  if (isAdminRole(user.role as UserRole)) {
    return { allowed: true, scope: "program" };
  }

  // If no program context provided, allow (no scope to check)
  if (!input.programIds?.length) {
    return { allowed: true, scope: "program" };
  }

  // Get user's program memberships
  const userProgramIds = await getUserProgramIds(user.id);

  // Check if user is member of any of the resource's programs
  const hasAccess = input.programIds.some((id) => userProgramIds.includes(id));

  if (!hasAccess) {
    return {
      allowed: false,
      scope: "program",
      reason: "Not a member of the required program",
      userMessage:
        "You can only access resources in programs you are assigned to.",
    };
  }

  return { allowed: true, scope: "program" };
}

/**
 * Check if user is assigned to the resource
 * (e.g., assigned clients, own calls)
 */
async function checkAssignedScope(
  user: SessionUser,
  input: PermissionCheckInput
): Promise<PermissionCheckResult> {
  // Admin roles bypass assignment scope
  if (isAdminRole(user.role as UserRole)) {
    return { allowed: true, scope: "assigned" };
  }

  // Check client assignment
  if (input.clientId) {
    const isAssigned = await isClientAssignedToUser(input.clientId, user.id);
    const isShared = await isClientSharedWithUser(input.clientId, user.id);

    if (!isAssigned && !isShared) {
      // Also check program membership for case managers in programs
      const clientProgramIds = await getClientProgramIds(input.clientId);
      const userProgramIds = await getUserProgramIds(user.id);
      const hasProgram = clientProgramIds.some((id) =>
        userProgramIds.includes(id)
      );

      if (!hasProgram) {
        return {
          allowed: false,
          scope: "assigned",
          reason: "Not assigned to this client",
          userMessage: "You can only access clients assigned to you.",
        };
      }
    }

    return { allowed: true, scope: "assigned" };
  }

  // Check resource ownership (e.g., own calls)
  if (input.ownerId) {
    if (input.ownerId !== user.id) {
      return {
        allowed: false,
        scope: "assigned",
        reason: "Not the owner of this resource",
        userMessage: "You can only access your own resources.",
      };
    }

    return { allowed: true, scope: "assigned" };
  }

  // No specific resource to check, allow
  return { allowed: true, scope: "assigned" };
}

/**
 * Check if user has active session access to the resource.
 * Used for FACILITATOR role - can only access client info during sessions.
 */
async function checkSessionScope(
  user: SessionUser,
  input: PermissionCheckInput
): Promise<PermissionCheckResult> {
  // Admin roles bypass session scope
  if (isAdminRole(user.role as UserRole)) {
    return { allowed: true, scope: "session" };
  }

  // If checking client access for facilitator
  if (input.clientId) {
    const hasSessionAccess = await hasActiveSessionWithClient(
      user.id,
      input.clientId
    );

    if (!hasSessionAccess) {
      // Fall back to program membership check
      const clientProgramIds = await getClientProgramIds(input.clientId);
      const userProgramIds = await getUserProgramIds(user.id);
      const hasProgram = clientProgramIds.some((id) =>
        userProgramIds.includes(id)
      );

      if (!hasProgram) {
        return {
          allowed: false,
          scope: "session",
          reason: "Client not in active session or assigned program",
          userMessage:
            "You can only access client information during program sessions or for enrolled clients.",
        };
      }
    }

    return { allowed: true, scope: "session" };
  }

  // No specific resource to check, allow
  return { allowed: true, scope: "session" };
}

// ============================================
// Database Query Helpers
// ============================================

/**
 * Get all program IDs the user is a member of
 */
export async function getUserProgramIds(userId: string): Promise<string[]> {
  const memberships = await prisma.programMember.findMany({
    where: { userId },
    select: { programId: true },
  });

  // Also include programs where user is the facilitator (legacy field)
  const facilitatedPrograms = await prisma.program.findMany({
    where: { facilitatorId: userId },
    select: { id: true },
  });

  const programIds = new Set([
    ...memberships.map((m) => m.programId),
    ...facilitatedPrograms.map((p) => p.id),
  ]);

  return Array.from(programIds);
}

/**
 * Check if client is directly assigned to user
 */
export async function isClientAssignedToUser(
  clientId: string,
  userId: string
): Promise<boolean> {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      assignedTo: userId,
    },
    select: { id: true },
  });

  return !!client;
}

/**
 * Check if client is shared with user
 */
export async function isClientSharedWithUser(
  clientId: string,
  userId: string
): Promise<boolean> {
  const share = await prisma.clientShare.findFirst({
    where: {
      clientId,
      sharedWithUserId: userId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });

  return !!share;
}

/**
 * Get program IDs a client is enrolled in
 */
export async function getClientProgramIds(clientId: string): Promise<string[]> {
  const enrollments = await prisma.programEnrollment.findMany({
    where: {
      clientId,
      status: { in: ["ENROLLED", "COMPLETED"] },
    },
    select: { programId: true },
  });

  return enrollments.map((e) => e.programId);
}

/**
 * Check if user has an active session with the client
 * (client is enrolled in a program where user is facilitating a current session)
 */
export async function hasActiveSessionWithClient(
  userId: string,
  clientId: string
): Promise<boolean> {
  // Get programs where user is a facilitator member
  const userProgramIds = await getUserProgramIds(userId);

  // Check if client is enrolled in any of those programs
  const enrollment = await prisma.programEnrollment.findFirst({
    where: {
      clientId,
      programId: { in: userProgramIds },
      status: "ENROLLED",
    },
    select: { id: true },
  });

  return !!enrollment;
}

/**
 * Get admin contact for the organization
 */
export async function getOrgAdminContact(orgId: string): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: {
      orgId,
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      isActive: true,
    },
    select: { email: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (admin) {
    return admin.name
      ? `${admin.name} (${admin.email})`
      : admin.email;
  }

  return "your organization administrator";
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format role for user-facing messages
 */
function formatRole(role: UserRole | string): string {
  return role.replace(/_/g, " ").toLowerCase();
}

/**
 * Check settings delegation for a user
 */
export async function getSettingsDelegation(
  userId: string,
  orgId: string
): Promise<{
  canManageBilling: boolean;
  canManageTeam: boolean;
  canManageIntegrations: boolean;
  canManageBranding: boolean;
} | null> {
  const delegation = await prisma.settingsDelegation.findUnique({
    where: {
      orgId_userId: { orgId, userId },
    },
    select: {
      canManageBilling: true,
      canManageTeam: true,
      canManageIntegrations: true,
      canManageBranding: true,
      expiresAt: true,
    },
  });

  if (!delegation) {
    return null;
  }

  // Check if delegation has expired
  if (delegation.expiresAt && delegation.expiresAt < new Date()) {
    return null;
  }

  return {
    canManageBilling: delegation.canManageBilling,
    canManageTeam: delegation.canManageTeam,
    canManageIntegrations: delegation.canManageIntegrations,
    canManageBranding: delegation.canManageBranding,
  };
}

/**
 * Check if user has a specific settings permission
 */
export async function hasSettingsPermission(
  user: SessionUser,
  setting: "billing" | "team" | "integrations" | "branding"
): Promise<boolean> {
  // Admins always have all settings access
  if (isAdminRole(user.role as UserRole)) {
    return true;
  }

  const delegation = await getSettingsDelegation(user.id, user.orgId);
  if (!delegation) {
    return false;
  }

  switch (setting) {
    case "billing":
      return delegation.canManageBilling;
    case "team":
      return delegation.canManageTeam;
    case "integrations":
      return delegation.canManageIntegrations;
    case "branding":
      return delegation.canManageBranding;
    default:
      return false;
  }
}
