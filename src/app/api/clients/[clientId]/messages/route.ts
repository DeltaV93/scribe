import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClientById } from "@/lib/services/clients";
import {
  createMessage,
  getClientMessages,
  CreateAttachmentInput,
} from "@/lib/services/messaging";
import { generatePortalToken } from "@/lib/services/portal-tokens";
import { sendSmsNotification, canSendSms } from "@/lib/services/sms-notifications";
import { MessageSenderType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a message
const createMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        fileUrl: z.string().url(),
        mimeType: z.string().min(1),
        fileSize: z.number().positive().max(10 * 1024 * 1024), // 10MB max
      })
    )
    .optional(),
  sendSmsNotification: z.boolean().default(true),
});

// Query params schema
const listMessagesSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(50),
  since: z.coerce.date().optional(),
  before: z.coerce.date().optional(),
});

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/messages - Get messages for a client
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Verify client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Case managers can only view messages for their assigned clients
    if (
      user.role === UserRole.CASE_MANAGER &&
      client.assignedTo !== user.id
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view this client's messages" } },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const queryValidation = listMessagesSchema.safeParse({
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 50,
      since: searchParams.get("since") || undefined,
      before: searchParams.get("before") || undefined,
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: queryValidation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { page, limit, since, before } = queryValidation.data;

    const { messages, total } = await getClientMessages(
      user.orgId,
      clientId,
      { since, before },
      { page, limit }
    );

    return NextResponse.json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch messages" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/:clientId/messages - Send a message to a client
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Viewers cannot send messages
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to send messages" } },
        { status: 403 }
      );
    }

    // Verify client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Case managers can only send messages to their assigned clients
    if (
      user.role === UserRole.CASE_MANAGER &&
      client.assignedTo !== user.id
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to message this client" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createMessageSchema.safeParse(body);

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

    const { content, attachments, sendSmsNotification: shouldSendSms } = validation.data;

    // Create the message
    const message = await createMessage({
      orgId: user.orgId,
      clientId,
      senderId: user.id,
      senderType: MessageSenderType.CASE_MANAGER,
      content,
      attachments: attachments as CreateAttachmentInput[],
    });

    // Send SMS notification if requested and client is opted in
    let smsResult = null;
    if (shouldSendSms) {
      const smsCheck = await canSendSms(clientId);

      if (smsCheck.canSend) {
        // Generate portal token for the link
        const tokenResult = await generatePortalToken(clientId, message.id);

        // Send SMS notification
        smsResult = await sendSmsNotification(
          message.id,
          clientId,
          tokenResult.token
        );
      } else {
        smsResult = {
          success: false,
          skipped: true,
          reason: smsCheck.reason,
        };
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          message,
          smsNotification: smsResult,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to send message" } },
      { status: 500 }
    );
  }
}
