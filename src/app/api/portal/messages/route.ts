import { NextRequest, NextResponse } from "next/server";
import { validatePortalToken } from "@/lib/services/portal-tokens";
import { getClientMessages, createClientReply } from "@/lib/services/messaging";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Extract token from Authorization header
function getTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

const replySchema = z.object({
  content: z.string().min(1).max(5000),
});

/**
 * GET /api/portal/messages - Get all messages for the authenticated client
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);

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

    // Get client's orgId
    const client = await prisma.client.findUnique({
      where: { id: tokenResult.clientId },
      select: { orgId: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Get messages
    const { messages, total } = await getClientMessages(
      client.orgId,
      tokenResult.clientId,
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
    const token = getTokenFromHeader(request);

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
    const message = await createClientReply(tokenResult.clientId, content);

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
