/**
 * POST /api/chatbot/sessions/[sessionId]/messages - Send a message to the chatbot
 *
 * Processes a user message and returns the AI response.
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processMessage, getSession } from "@/lib/services/chatbot";

interface RouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

// Validation schema
const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content is required").max(10000, "Message too long"),
});

/**
 * POST /api/chatbot/sessions/[sessionId]/messages - Send a message
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

    // Validate request body
    const body = await request.json();
    const validation = sendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid message data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Process the message
    const result = await processMessage(sessionId, validation.data.content);

    return NextResponse.json({
      success: true,
      data: {
        message: result.message,
        nextQuestion: result.nextQuestion,
        isComplete: result.isComplete,
        crisisDetected: result.crisisDetected,
        crisisResources: result.crisisResources,
      },
    });
  } catch (error) {
    console.error("Error processing chatbot message:", error);

    if (error instanceof Error) {
      if (error.message === "Session not found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message.includes("completed") || error.message.includes("abandoned")) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: error.message } },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process message" } },
      { status: 500 }
    );
  }
}
