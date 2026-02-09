import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import {
  getSessionStatus,
  findActiveSessionForUser,
  SLIDING_TIMEOUT_MINUTES,
  ABSOLUTE_TIMEOUT_HOURS,
  WARNING_BEFORE_MINUTES,
} from "@/lib/auth/session-timeout";

/**
 * GET /api/auth/session-status
 *
 * Returns the current session status for the authenticated user.
 * Includes both sliding and absolute timeout information.
 *
 * Response:
 * - valid: boolean - Whether the session is still valid
 * - expiresIn: number - Seconds until sliding timeout
 * - absoluteExpiresIn: number - Seconds until absolute timeout
 * - warningActive: boolean - True if within warning period
 * - config: object - Timeout configuration values
 *
 * Error codes:
 * - UNAUTHORIZED: Not authenticated
 * - NOT_FOUND: User not found in database
 * - NO_SESSION: No active session found
 * - SESSION_EXPIRED: Session has expired
 */
export async function GET(request: NextRequest) {
  try {
    // Verify Supabase authentication
    const supabase = await createClient();
    const {
      data: { session: authSession },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError) {
      console.error("[SessionStatus] Auth error:", authError.message);
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

    // Check for session ID in query params or find most recent active session
    const { searchParams } = new URL(request.url);
    let sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      sessionId = await findActiveSessionForUser(user.id);
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

    // Get session status with both timeout types
    const status = await getSessionStatus(sessionId);

    if (!status) {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_EXPIRED",
            message: "Session not found or expired",
          },
        },
        { status: 404 }
      );
    }

    // If session is invalid, return appropriate error
    if (!status.valid) {
      const message =
        status.expiredReason === "absolute"
          ? "Session has exceeded maximum duration. Please log in again."
          : status.expiredReason === "sliding"
            ? "Session has expired due to inactivity. Please log in again."
            : "Session has been invalidated. Please log in again.";

      return NextResponse.json(
        {
          error: {
            code: "SESSION_EXPIRED",
            message,
            reason: status.expiredReason,
          },
        },
        { status: 401 }
      );
    }

    // Return session status with configuration
    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        valid: status.valid,
        expiresIn: status.expiresIn,
        absoluteExpiresIn: status.absoluteExpiresIn,
        warningActive: status.warningActive,
        config: {
          slidingTimeoutMinutes:
            user.organization.sessionTimeoutMinutes ?? SLIDING_TIMEOUT_MINUTES,
          absoluteTimeoutHours: ABSOLUTE_TIMEOUT_HOURS,
          warningBeforeMinutes: WARNING_BEFORE_MINUTES,
        },
      },
    });
  } catch (error) {
    console.error("[SessionStatus] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get session status",
        },
      },
      { status: 500 }
    );
  }
}
