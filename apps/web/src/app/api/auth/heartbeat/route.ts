import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { refreshSession, getSessionByToken } from "@/lib/auth/session/timeout";
import { getRemainingSeconds } from "@/lib/auth/session/types";

const heartbeatSchema = z.object({
  sessionId: z.string().uuid().optional(),
  sessionToken: z.string().optional(),
});

/**
 * POST /api/auth/heartbeat
 *
 * Refresh the current session's expiration time.
 * Called periodically (every 5 minutes) while user is active.
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

    // Parse request body
    const body = await request.json();
    const parsed = heartbeatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
        { status: 400 }
      );
    }

    const { sessionId, sessionToken } = parsed.data;

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

    // Find the session to refresh
    let targetSessionId = sessionId;

    if (!targetSessionId && sessionToken) {
      const sessionRecord = await getSessionByToken(sessionToken);
      if (sessionRecord) {
        targetSessionId = sessionRecord.id;
      }
    }

    // If no session ID provided, try to find the most recent active session
    if (!targetSessionId) {
      const recentSession = await prisma.userSession.findFirst({
        where: {
          userId: user.id,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastActivity: "desc" },
        select: { id: true },
      });

      if (recentSession) {
        targetSessionId = recentSession.id;
      }
    }

    if (!targetSessionId) {
      return NextResponse.json(
        { error: { code: "NO_SESSION", message: "No active session found" } },
        { status: 404 }
      );
    }

    // Refresh the session
    const result = await refreshSession(targetSessionId, user.id);

    if (!result) {
      return NextResponse.json(
        { error: { code: "SESSION_EXPIRED", message: "Session has expired" } },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: targetSessionId,
        expiresAt: result.expiresAt.toISOString(),
        remainingSeconds: result.remainingSeconds,
      },
    });
  } catch (error) {
    console.error("Error in heartbeat:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to refresh session" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/heartbeat
 *
 * Check current session status without refreshing.
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

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Find the most recent active session
    const activeSession = await prisma.userSession.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivity: "desc" },
    });

    if (!activeSession) {
      return NextResponse.json({
        success: true,
        data: {
          hasSession: false,
          isValid: false,
        },
      });
    }

    const remainingSeconds = getRemainingSeconds(activeSession.expiresAt);
    const warningThreshold = 5 * 60; // 5 minutes

    return NextResponse.json({
      success: true,
      data: {
        hasSession: true,
        isValid: remainingSeconds > 0,
        sessionId: activeSession.id,
        expiresAt: activeSession.expiresAt.toISOString(),
        remainingSeconds,
        isExpiringSoon: remainingSeconds <= warningThreshold && remainingSeconds > 0,
      },
    });
  } catch (error) {
    console.error("Error checking session status:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to check session status" } },
      { status: 500 }
    );
  }
}
