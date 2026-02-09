/**
 * GET /api/chatbot/sessions/[sessionId] - Get session state
 *
 * Returns the current state of a chatbot session including messages.
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, getSessionMessages } from "@/lib/services/chatbot";

interface RouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

/**
 * GET /api/chatbot/sessions/[sessionId] - Get session state and messages
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 }
      );
    }

    const messages = await getSessionMessages(sessionId);

    return NextResponse.json({
      success: true,
      data: {
        session,
        messages,
      },
    });
  } catch (error) {
    console.error("Error getting chatbot session:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get session" } },
      { status: 500 }
    );
  }
}
