import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/services/portal-sessions";
import { getMessageForPortal, markMessageAsRead } from "@/lib/services/messaging";
import { getSessionFromCookie } from "@/lib/portal/cookies";
import { validateCSRF, createCSRFErrorResponse } from "@/lib/portal/csrf";

interface RouteContext {
  params: Promise<{ messageId: string }>;
}

/**
 * GET /api/portal/messages/:messageId - Get a specific message
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const sessionToken = getSessionFromCookie(request);
    const { messageId } = await context.params;

    if (!sessionToken) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No session cookie" } },
        { status: 401 }
      );
    }

    const session = await validateSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } },
        { status: 401 }
      );
    }

    const message = await getMessageForPortal(messageId, session.clientId);

    if (!message) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Message not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Error fetching portal message:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch message" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/messages/:messageId/read - Mark message as read
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const sessionToken = getSessionFromCookie(request);
    const { messageId } = await context.params;

    if (!sessionToken) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No session cookie" } },
        { status: 401 }
      );
    }

    const session = await validateSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } },
        { status: 401 }
      );
    }

    // Validate CSRF for POST request
    if (!validateCSRF(request, session.csrfToken)) {
      return createCSRFErrorResponse();
    }

    // Verify message belongs to this client
    const message = await getMessageForPortal(messageId, session.clientId);

    if (!message) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Message not found" } },
        { status: 404 }
      );
    }

    // Mark as read
    const updatedMessage = await markMessageAsRead(messageId, session.clientId);

    return NextResponse.json({
      success: true,
      data: updatedMessage,
    });
  } catch (error) {
    console.error("Error marking message as read:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to mark message as read" } },
      { status: 500 }
    );
  }
}
