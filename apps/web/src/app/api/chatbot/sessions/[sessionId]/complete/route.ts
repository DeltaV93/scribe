/**
 * POST /api/chatbot/sessions/[sessionId]/complete - Submit completed intake
 *
 * Finalizes the intake, creates client record and form submission.
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, completeSession } from "@/lib/services/chatbot";

interface RouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

/**
 * POST /api/chatbot/sessions/[sessionId]/complete - Complete session
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;

    // Verify session exists
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 }
      );
    }

    if (session.status !== "ACTIVE") {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: `Session is ${session.status.toLowerCase()}` } },
        { status: 400 }
      );
    }

    // Complete the session
    const result = await completeSession(sessionId);

    return NextResponse.json({
      success: true,
      data: {
        clientId: result.clientId,
        submissionId: result.submissionId,
        message: result.message,
      },
    });
  } catch (error) {
    console.error("Error completing chatbot session:", error);

    if (error instanceof Error) {
      if (error.message === "Session not found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message.includes("Missing required") || error.message.includes("case manager")) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: error.message } },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to complete intake" } },
      { status: 500 }
    );
  }
}
