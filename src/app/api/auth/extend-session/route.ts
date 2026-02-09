import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  updateSessionActivity,
  getSessionStatus,
  findActiveSessionForUser,
  ABSOLUTE_TIMEOUT_HOURS,
} from "@/lib/auth/session-timeout";

const extendSessionSchema = z.object({
  sessionId: z.string().uuid().optional(),
});

/**
 * POST /api/auth/extend-session
 *
 * Extends the sliding timeout for the current session.
 * The session will NOT extend past the absolute timeout (12 hours from creation).
 *
 * Request body:
 * - sessionId: string (optional) - Specific session to extend. If not provided,
 *   extends the most recent active session for the user.
 *
 * Response:
 * - sessionId: string - The extended session ID
 * - expiresIn: number - New seconds until sliding timeout
 * - absoluteExpiresIn: number - Seconds until absolute timeout (unchanged)
 * - extended: boolean - Whether the session was successfully extended
 *
 * Error codes:
 * - UNAUTHORIZED: Not authenticated
 * - NOT_FOUND: User or session not found
 * - SESSION_EXPIRED: Session has expired (sliding or absolute)
 * - ABSOLUTE_LIMIT: Cannot extend past absolute timeout
 * - VALIDATION_ERROR: Invalid request body
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Supabase authentication
    const supabase = await createClient();
    const {
      data: { session: authSession },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError) {
      console.error("[ExtendSession] Auth error:", authError.message);
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication failed",
          },
        },
        { status: 401 }
      );
    }

    if (!authSession) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          },
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable
    }

    const parsed = extendSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsed.error.errors,
          },
        },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: authSession.user.id },
      select: {
        id: true,
        orgId: true,
        organization: {
          select: {
            sessionTimeoutMinutes: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
        },
        { status: 404 }
      );
    }

    // Find session to extend
    let sessionId: string | undefined = parsed.data.sessionId;

    if (!sessionId) {
      const foundSessionId = await findActiveSessionForUser(user.id);
      sessionId = foundSessionId ?? undefined;
    }

    if (!sessionId) {
      return NextResponse.json(
        {
          error: {
            code: "NO_SESSION",
            message: "No active session found",
          },
        },
        { status: 404 }
      );
    }

    // Verify session belongs to this user
    const sessionRecord = await prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, createdAt: true, isActive: true },
    });

    if (!sessionRecord) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Session not found",
          },
        },
        { status: 404 }
      );
    }

    if (sessionRecord.userId !== user.id) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Cannot extend another user's session",
          },
        },
        { status: 403 }
      );
    }

    if (!sessionRecord.isActive) {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_EXPIRED",
            message: "Session has been invalidated",
          },
        },
        { status: 401 }
      );
    }

    // Check if session can be extended (not past absolute timeout)
    const absoluteExpiresAt = new Date(
      sessionRecord.createdAt.getTime() + ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000
    );
    const now = new Date();

    if (now >= absoluteExpiresAt) {
      return NextResponse.json(
        {
          error: {
            code: "ABSOLUTE_LIMIT",
            message: `Session has exceeded maximum duration of ${ABSOLUTE_TIMEOUT_HOURS} hours. Please log in again.`,
          },
        },
        { status: 401 }
      );
    }

    // Extend the session
    try {
      await updateSessionActivity(sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to extend session";

      if (message.includes("absolute timeout")) {
        return NextResponse.json(
          {
            error: {
              code: "ABSOLUTE_LIMIT",
              message: `Session has exceeded maximum duration. Please log in again.`,
            },
          },
          { status: 401 }
        );
      }

      throw error;
    }

    // Get updated session status
    const status = await getSessionStatus(sessionId);

    if (!status || !status.valid) {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_EXPIRED",
            message: "Session expired during extension",
          },
        },
        { status: 401 }
      );
    }

    console.info(
      `[ExtendSession] Extended session ${sessionId} for user ${user.id}, ` +
        `new sliding expiry: ${status.expiresIn}s, absolute remaining: ${status.absoluteExpiresIn}s`
    );

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        expiresIn: status.expiresIn,
        absoluteExpiresIn: status.absoluteExpiresIn,
        warningActive: status.warningActive,
        extended: true,
      },
    });
  } catch (error) {
    console.error("[ExtendSession] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to extend session",
        },
      },
      { status: 500 }
    );
  }
}
