import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  listUserSessions,
  terminateSessionById,
  terminateOtherSessions,
  checkSuspiciousActivity,
  getSessionStats,
} from "@/lib/auth/session/concurrent-sessions";
import { isAdmin } from "@/lib/auth";

/**
 * GET /api/auth/sessions
 *
 * List all active sessions for the current user.
 * Optionally check for suspicious activity.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("stats") === "true";
    const checkSuspicious = searchParams.get("suspicious") === "true";

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { id: true, orgId: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Get current session token from cookie or header
    const currentSessionToken = request.headers.get("x-session-token") || undefined;

    // List sessions
    const sessions = await listUserSessions(user.id, currentSessionToken);

    const response: Record<string, unknown> = {
      sessions,
      currentSessionId: sessions.find((s) => s.isCurrent)?.id || null,
    };

    // Optionally include stats
    if (includeStats) {
      response.stats = await getSessionStats(user.id);
    }

    // Optionally check for suspicious activity
    if (checkSuspicious) {
      response.suspiciousActivity = await checkSuspiciousActivity(user.id);
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error listing sessions:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list sessions" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/sessions
 *
 * Terminate a specific session or all other sessions.
 *
 * Query params:
 * - sessionId: Specific session to terminate
 * - all: If "true", terminate all other sessions (except current)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const terminateAll = searchParams.get("all") === "true";

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      include: {
        organization: { select: { id: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Get current session
    const currentSession = await prisma.userSession.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivity: "desc" },
      select: { id: true },
    });

    if (terminateAll) {
      // Terminate all other sessions
      if (!currentSession) {
        return NextResponse.json(
          { error: { code: "NO_SESSION", message: "No current session found" } },
          { status: 400 }
        );
      }

      const result = await terminateOtherSessions(user.id, currentSession.id);

      return NextResponse.json({
        success: true,
        data: {
          terminatedCount: result.terminatedCount,
        },
      });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Session ID required" } },
        { status: 400 }
      );
    }

    // Don't allow terminating the current session through this endpoint
    if (sessionId === currentSession?.id) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Cannot terminate current session. Use logout instead." } },
        { status: 400 }
      );
    }

    // Check if user is admin (can terminate any session in org)
    const sessionUser = {
      id: user.id,
      role: user.role as import("@/types").UserRole,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      orgId: user.orgId,
      orgName: "",
      permissions: {
        canCreateForms: user.canCreateForms,
        canReadForms: user.canReadForms,
        canUpdateForms: user.canUpdateForms,
        canDeleteForms: user.canDeleteForms,
        canPublishForms: user.canPublishForms,
      },
    };
    const userIsAdmin = isAdmin(sessionUser);

    const result = await terminateSessionById(sessionId, user.id, userIsAdmin);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "TERMINATE_FAILED", message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        terminatedSessionId: sessionId,
      },
    });
  } catch (error) {
    console.error("Error terminating session:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to terminate session" } },
      { status: 500 }
    );
  }
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

const adminTerminateSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().optional(),
});

/**
 * POST /api/auth/sessions
 *
 * Admin endpoint to terminate all sessions for a specific user.
 * Requires admin privileges.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: {
        id: true,
        role: true,
        orgId: true,
        email: true,
        name: true,
        avatarUrl: true,
        canCreateForms: true,
        canReadForms: true,
        canUpdateForms: true,
        canDeleteForms: true,
        canPublishForms: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Check admin privileges
    const sessionUser = {
      id: user.id,
      role: user.role as import("@/types").UserRole,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      orgId: user.orgId,
      orgName: "",
      permissions: {
        canCreateForms: user.canCreateForms,
        canReadForms: user.canReadForms,
        canUpdateForms: user.canUpdateForms,
        canDeleteForms: user.canDeleteForms,
        canPublishForms: user.canPublishForms,
      },
    };

    if (!isAdmin(sessionUser)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin privileges required" } },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const parsed = adminTerminateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { userId: targetUserId, reason } = parsed.data;

    // Verify target user is in the same org
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        orgId: user.orgId,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Target user not found" } },
        { status: 404 }
      );
    }

    // Import admin revoke function
    const { adminRevokeAllSessions } = await import("@/lib/auth/session/concurrent-sessions");

    const terminatedCount = await adminRevokeAllSessions(targetUserId, user.id);

    return NextResponse.json({
      success: true,
      data: {
        targetUserId,
        terminatedCount,
        reason: reason || "Admin initiated revocation",
      },
    });
  } catch (error) {
    console.error("Error in admin session termination:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to terminate sessions" } },
      { status: 500 }
    );
  }
}
