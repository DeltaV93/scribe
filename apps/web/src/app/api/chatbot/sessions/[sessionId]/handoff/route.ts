/**
 * POST /api/chatbot/sessions/[sessionId]/handoff - Request human takeover
 *
 * Triggers handoff request to notify available case managers.
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, requestHandoff } from "@/lib/services/chatbot";

interface RouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

/**
 * POST /api/chatbot/sessions/[sessionId]/handoff - Request handoff
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

    // Request handoff
    const result = await requestHandoff(sessionId);

    return NextResponse.json({
      success: true,
      data: {
        queued: result.queued,
        estimatedWait: result.estimatedWait,
        message: result.queued
          ? `Your request has been received. ${result.estimatedWait ? `Expected wait: ${result.estimatedWait}` : "We'll connect you shortly."}`
          : "Connecting you to a case manager...",
      },
    });
  } catch (error) {
    console.error("Error requesting handoff:", error);

    if (error instanceof Error && error.message === "Session not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to request handoff" } },
      { status: 500 }
    );
  }
}
