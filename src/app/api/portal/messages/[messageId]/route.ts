import { NextRequest, NextResponse } from "next/server";
import { validatePortalToken } from "@/lib/services/portal-tokens";
import { getMessageForPortal, markMessageAsRead } from "@/lib/services/messaging";

interface RouteContext {
  params: Promise<{ messageId: string }>;
}

// Extract token from Authorization header
function getTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * GET /api/portal/messages/:messageId - Get a specific message
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = getTokenFromHeader(request);
    const { messageId } = await context.params;

    if (!token) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing authorization token" } },
        { status: 401 }
      );
    }

    const tokenResult = await validatePortalToken(token);

    if (!tokenResult.isValid || !tokenResult.clientId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: tokenResult.error || "Invalid token" } },
        { status: 401 }
      );
    }

    const message = await getMessageForPortal(messageId, tokenResult.clientId);

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
    const token = getTokenFromHeader(request);
    const { messageId } = await context.params;

    if (!token) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing authorization token" } },
        { status: 401 }
      );
    }

    const tokenResult = await validatePortalToken(token);

    if (!tokenResult.isValid || !tokenResult.clientId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: tokenResult.error || "Invalid token" } },
        { status: 401 }
      );
    }

    // Verify message belongs to this client
    const message = await getMessageForPortal(messageId, tokenResult.clientId);

    if (!message) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Message not found" } },
        { status: 404 }
      );
    }

    // Mark as read
    const updatedMessage = await markMessageAsRead(messageId, tokenResult.clientId);

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
