/**
 * RBAC Middleware for API Routes
 *
 * Wraps API handlers with automatic permission checking.
 * Handles authentication, authorization, and denial logging.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/types";
import {
  Resource,
  Action,
  Scope,
} from "./permissions";
import {
  checkPermission,
  PermissionCheckResult,
  getOrgAdminContact,
} from "./checker";

// ============================================
// Types
// ============================================

export interface RBACOptions {
  resource: Resource;
  action: Action;
  /**
   * Extract the resource ID from the request/params.
   * Return null if not applicable.
   */
  getResourceId?: (
    req: NextRequest,
    params: Record<string, string>
  ) => Promise<string | null>;
  /**
   * Extract scope context (programIds, clientId, ownerId) from the request.
   * Used for scope validation.
   */
  getScope?: (
    req: NextRequest,
    params: Record<string, string>
  ) => Promise<ScopeContext>;
  /**
   * Skip RBAC check entirely (use with caution).
   * Useful for public endpoints or special cases.
   */
  skip?: boolean;
}

export interface ScopeContext {
  programIds?: string[];
  clientId?: string;
  ownerId?: string;
}

export interface RBACContext {
  user: SessionUser;
  permissionResult: PermissionCheckResult;
}

type RouteHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
  rbac: RBACContext
) => Promise<NextResponse>;

// ============================================
// Denial Logging
// ============================================

// Track denial counts per user to only log repeated denials
const denialCounts = new Map<string, { count: number; lastDenial: number }>();
const DENIAL_THRESHOLD = 3; // Log after this many denials
const DENIAL_WINDOW_MS = 5 * 60 * 1000; // 5 minute window

async function logPermissionDenial(
  orgId: string,
  userId: string,
  resource: Resource,
  action: Action,
  resourceId: string | null,
  reason: string,
  req: NextRequest
): Promise<void> {
  const key = `${userId}:${resource}:${action}`;
  const now = Date.now();

  // Get or initialize denial tracking
  let tracking = denialCounts.get(key);
  if (!tracking || now - tracking.lastDenial > DENIAL_WINDOW_MS) {
    tracking = { count: 0, lastDenial: now };
  }

  tracking.count++;
  tracking.lastDenial = now;
  denialCounts.set(key, tracking);

  // Only log if threshold reached (repeated denials)
  if (tracking.count >= DENIAL_THRESHOLD) {
    try {
      await prisma.permissionDenialLog.create({
        data: {
          orgId,
          userId,
          resource,
          action,
          resourceId,
          reason,
          ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
          userAgent: req.headers.get("user-agent") || null,
        },
      });

      // Reset counter after logging
      denialCounts.delete(key);
    } catch (error) {
      console.error("Failed to log permission denial:", error);
    }
  }
}

// ============================================
// Error Response Builders
// ============================================

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    },
    { status: 401 }
  );
}

function forbiddenResponse(
  result: PermissionCheckResult,
  resource: Resource,
  action: Action
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "FORBIDDEN",
        message:
          result.userMessage ||
          `You do not have permission to ${action} ${resource}`,
        adminContact: result.adminContact,
      },
    },
    { status: 403 }
  );
}

// ============================================
// Middleware Factory
// ============================================

/**
 * Wrap an API route handler with RBAC enforcement.
 *
 * @example
 * ```ts
 * export const GET = withRBAC(
 *   async (req, context, { user, permissionResult }) => {
 *     // Handler logic - user is guaranteed to have permission
 *     return NextResponse.json({ data: ... });
 *   },
 *   {
 *     resource: "clients",
 *     action: "read",
 *     getResourceId: async (req, params) => params.clientId,
 *   }
 * );
 * ```
 */
export function withRBAC(
  handler: RouteHandler,
  options: RBACOptions
): (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> {
  return async (req, context) => {
    // Skip RBAC if configured (use with caution)
    if (options.skip) {
      const user = await getCurrentUser();
      if (!user) {
        return unauthorizedResponse();
      }
      return handler(req, context, {
        user,
        permissionResult: { allowed: true },
      });
    }

    // Get authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    // Resolve params
    const params = await context.params;

    // Get resource ID if extractor provided
    const resourceId = options.getResourceId
      ? await options.getResourceId(req, params)
      : null;

    // Get scope context if extractor provided
    const scopeContext = options.getScope
      ? await options.getScope(req, params)
      : {};

    // Check permission
    const result = await checkPermission(user, {
      resource: options.resource,
      action: options.action,
      resourceId,
      ...scopeContext,
    });

    // Handle denial
    if (!result.allowed) {
      // Log repeated denials
      await logPermissionDenial(
        user.orgId,
        user.id,
        options.resource,
        options.action,
        resourceId,
        result.reason || "Permission denied",
        req
      );

      return forbiddenResponse(result, options.resource, options.action);
    }

    // Call the actual handler with RBAC context
    return handler(req, context, { user, permissionResult: result });
  };
}

// ============================================
// Convenience Wrappers
// ============================================

/**
 * Require admin role (SUPER_ADMIN or ADMIN)
 */
export function requireAdmin(handler: RouteHandler): (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> {
  return withRBAC(handler, {
    resource: "admin",
    action: "read",
  });
}

/**
 * Require specific settings permission
 */
export async function requireSettingsPermission(
  user: SessionUser,
  setting: "billing" | "team" | "integrations" | "branding"
): Promise<{ allowed: boolean; response?: NextResponse }> {
  // Admins always have access
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    return { allowed: true };
  }

  // Check delegation
  const delegation = await prisma.settingsDelegation.findUnique({
    where: {
      orgId_userId: { orgId: user.orgId, userId: user.id },
    },
  });

  if (!delegation) {
    const adminContact = await getOrgAdminContact(user.orgId);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `You do not have permission to manage ${setting} settings.`,
            adminContact,
          },
        },
        { status: 403 }
      ),
    };
  }

  // Check specific permission
  let hasPermission = false;
  switch (setting) {
    case "billing":
      hasPermission = delegation.canManageBilling;
      break;
    case "team":
      hasPermission = delegation.canManageTeam;
      break;
    case "integrations":
      hasPermission = delegation.canManageIntegrations;
      break;
    case "branding":
      hasPermission = delegation.canManageBranding;
      break;
  }

  if (!hasPermission) {
    const adminContact = await getOrgAdminContact(user.orgId);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `You do not have delegated permission to manage ${setting} settings.`,
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
// Scope Context Helpers
// ============================================

/**
 * Get program IDs for a client (for scope validation)
 */
export async function getClientScopeContext(
  clientId: string
): Promise<ScopeContext> {
  const enrollments = await prisma.programEnrollment.findMany({
    where: {
      clientId,
      status: { in: ["ENROLLED", "COMPLETED"] },
    },
    select: { programId: true },
  });

  return {
    clientId,
    programIds: enrollments.map((e) => e.programId),
  };
}

/**
 * Get owner ID for a call (for scope validation)
 */
export async function getCallScopeContext(
  callId: string
): Promise<ScopeContext> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      caseManagerId: true,
      clientId: true,
    },
  });

  if (!call) {
    return {};
  }

  // Get client's program enrollments
  const enrollments = await prisma.programEnrollment.findMany({
    where: {
      clientId: call.clientId,
      status: { in: ["ENROLLED", "COMPLETED"] },
    },
    select: { programId: true },
  });

  return {
    ownerId: call.caseManagerId,
    clientId: call.clientId,
    programIds: enrollments.map((e) => e.programId),
  };
}

/**
 * Get program ID for a program resource (for scope validation)
 */
export async function getProgramScopeContext(
  programId: string
): Promise<ScopeContext> {
  return {
    programIds: [programId],
  };
}
