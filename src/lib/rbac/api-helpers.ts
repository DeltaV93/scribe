/**
 * RBAC API Helpers
 *
 * Simple helper functions for checking permissions in API routes.
 * These can be used alongside existing requireAuth() pattern
 * for gradual migration.
 */

import { NextResponse } from "next/server";
import type { SessionUser } from "@/types";
import { UserRole } from "@/types";
import { prisma } from "@/lib/db";
import {
  Resource,
  Action,
  hasPermission,
  getPermissionScope,
  isAdminRole,
} from "./permissions";
import { getUserProgramIds, getOrgAdminContact } from "./checker";

// ============================================
// Permission Check Helpers
// ============================================

/**
 * Check if user has permission and return 403 response if not.
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const user = await requireAuth();
 *
 *   const permissionCheck = await checkApiPermission(user, "clients", "create");
 *   if (!permissionCheck.allowed) {
 *     return permissionCheck.response;
 *   }
 *
 *   // ... rest of handler
 * }
 * ```
 */
export async function checkApiPermission(
  user: SessionUser,
  resource: Resource,
  action: Action
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  if (!hasPermission(user.role as UserRole, resource, action)) {
    const adminContact = await getOrgAdminContact(user.orgId);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `You do not have permission to ${action} ${resource}`,
            adminContact,
          },
        },
        { status: 403 }
      ),
    };
  }

  return { allowed: true };
}

/**
 * Check if user has permission for a specific resource with scope validation.
 *
 * @example
 * ```ts
 * const check = await checkScopedPermission(user, "clients", "update", {
 *   clientId: params.clientId,
 * });
 * if (!check.allowed) {
 *   return check.response;
 * }
 * ```
 */
export async function checkScopedPermission(
  user: SessionUser,
  resource: Resource,
  action: Action,
  context: {
    clientId?: string;
    programId?: string;
    resourceOwnerId?: string;
  }
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  // First check basic permission
  if (!hasPermission(user.role as UserRole, resource, action)) {
    const adminContact = await getOrgAdminContact(user.orgId);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `You do not have permission to ${action} ${resource}`,
            adminContact,
          },
        },
        { status: 403 }
      ),
    };
  }

  // Get the scope for this permission
  const scope = getPermissionScope(user.role as UserRole, resource, action);

  // Admin scope - always allowed
  if (scope === "all" || isAdminRole(user.role as UserRole)) {
    return { allowed: true };
  }

  // Program scope - check program membership
  if (scope === "program") {
    const userProgramIds = await getUserProgramIds(user.id);

    // If checking a specific program
    if (context.programId) {
      if (!userProgramIds.includes(context.programId)) {
        return {
          allowed: false,
          response: NextResponse.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "You can only access resources in your assigned programs",
              },
            },
            { status: 403 }
          ),
        };
      }
    }

    // If checking a client, verify client is in user's programs
    if (context.clientId) {
      const clientProgramIds = await getClientProgramIds(context.clientId);
      const hasOverlap = clientProgramIds.some((id) =>
        userProgramIds.includes(id)
      );
      if (!hasOverlap && clientProgramIds.length > 0) {
        return {
          allowed: false,
          response: NextResponse.json(
            {
              error: {
                code: "FORBIDDEN",
                message:
                  "You can only access clients in your assigned programs",
              },
            },
            { status: 403 }
          ),
        };
      }
    }

    return { allowed: true };
  }

  // Assigned scope - check direct assignment
  if (scope === "assigned") {
    // Check client assignment
    if (context.clientId) {
      const isAssigned = await isClientAssignedToUser(
        context.clientId,
        user.id
      );
      const isShared = await isClientSharedWithUser(context.clientId, user.id);

      if (!isAssigned && !isShared) {
        // Also check program membership as fallback
        const userProgramIds = await getUserProgramIds(user.id);
        const clientProgramIds = await getClientProgramIds(context.clientId);
        const hasProgram = clientProgramIds.some((id) =>
          userProgramIds.includes(id)
        );

        if (!hasProgram) {
          return {
            allowed: false,
            response: NextResponse.json(
              {
                error: {
                  code: "FORBIDDEN",
                  message: "You can only access clients assigned to you",
                },
              },
              { status: 403 }
            ),
          };
        }
      }
    }

    // Check resource ownership
    if (context.resourceOwnerId && context.resourceOwnerId !== user.id) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "You can only access your own resources",
            },
          },
          { status: 403 }
        ),
      };
    }

    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Require admin role or return 403.
 */
export async function requireAdminRole(
  user: SessionUser
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  if (!isAdminRole(user.role as UserRole)) {
    const adminContact = await getOrgAdminContact(user.orgId);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "This action requires admin privileges",
            adminContact,
          },
        },
        { status: 403 }
      ),
    };
  }

  return { allowed: true };
}

// ============================================
// Internal Helpers
// ============================================

async function getClientProgramIds(clientId: string): Promise<string[]> {
  const enrollments = await prisma.programEnrollment.findMany({
    where: {
      clientId,
      status: { in: ["ENROLLED", "COMPLETED"] },
    },
    select: { programId: true },
  });
  return enrollments.map((e) => e.programId);
}

async function isClientAssignedToUser(
  clientId: string,
  userId: string
): Promise<boolean> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, assignedTo: userId },
    select: { id: true },
  });
  return !!client;
}

async function isClientSharedWithUser(
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
