import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/services/portal-sessions";
import { getClientMessages, createClientReply } from "@/lib/services/messaging";
import { getSessionFromCookie } from "@/lib/portal/cookies";
import { validateCSRF, createCSRFErrorResponse } from "@/lib/portal/csrf";
import { z } from "zod";

const replySchema = z.object({
  content: z.string().min(1).max(2000), // Updated to 2000 char limit per spec
});

/**
 * GET /api/portal/messages - Get all messages for the authenticated client
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
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } },
        { status: 401 }
      );
    }

    // Get messages
    const { messages, total } = await getClientMessages(
      session.client.orgId,
      session.clientId,
      {},
      { limit: 100 }
    );

    return NextResponse.json({
      success: true,
      data: {
        messages,
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching portal messages:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch messages" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/messages - Send a reply from the client
 */
export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } },
        { status: 401 }
      );
    }

    // Validate CSRF for POST request
    if (!validateCSRF(request, session.csrfToken)) {
      return createCSRFErrorResponse();
    }

    const body = await request.json();
    const validation = replySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid message content",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { content } = validation.data;

    // Create the reply
    const message = await createClientReply(session.clientId, content);

    return NextResponse.json(
      {
        success: true,
        data: message,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error sending portal reply:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to send reply" } },
      { status: 500 }
    );
  }
}
