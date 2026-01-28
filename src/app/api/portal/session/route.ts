import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession as getPortalTokenSession } from "@/lib/services/portal-tokens";
import {
  createPortalSession,
  validateSession,
  deleteSession,
} from "@/lib/services/portal-sessions";
import {
  getSessionFromCookie,
  createResponseWithSession,
  createLogoutResponse,
} from "@/lib/portal/cookies";

const createSessionSchema = z.object({
  token: z.string().length(64),
});

/**
 * POST /api/portal/session - Create a new session from a magic link token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createSessionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid token format",
          },
        },
        { status: 400 }
      );
    }

    const { token } = validation.data;

    // Validate the magic link token
    const tokenResult = await getPortalTokenSession(token);

    if (!tokenResult.isValid || !tokenResult.client) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: tokenResult.error || "Invalid or expired token",
          },
        },
        { status: 401 }
      );
    }

    // Create a new session
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const session = await createPortalSession({
      clientId: tokenResult.client.id,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
    });

    // Return session data with cookie set
    return createResponseWithSession(
      {
        success: true,
        data: {
          csrfToken: session.csrfToken,
          client: {
            id: session.client.id,
            firstName: session.client.firstName,
            lastName: session.client.lastName,
            organization: session.client.organization.name,
          },
          expiresAt: session.expiresAt,
          requiresPIN: session.requiresPIN,
        },
      },
      session.sessionToken,
      201
    );
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create session" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/portal/session - Validate current session
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = getSessionFromCookie(request);

    if (!sessionToken) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No session cookie" } },
        { status: 401 }
      );
    }

    const session = await validateSession(sessionToken);

    if (!session) {
      return createLogoutResponse(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } },
        401
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        csrfToken: session.csrfToken,
        client: {
          id: session.client.id,
          firstName: session.client.firstName,
          lastName: session.client.lastName,
          organization: session.client.organization.name,
        },
        expiresAt: session.expiresAt,
        requiresPIN: session.requiresPIN,
      },
    });
  } catch (error) {
    console.error("Error validating portal session:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to validate session" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portal/session - Logout (delete session)
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionToken = getSessionFromCookie(request);

    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    return createLogoutResponse({ success: true });
  } catch (error) {
    console.error("Error deleting portal session:", error);
    // Still return success and clear cookie even if DB delete fails
    return createLogoutResponse({ success: true });
  }
}
