import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendClientMessage, checkRateLimit } from "@/lib/services/email";
import { getClientById } from "@/lib/services/clients";
import { UserRole } from "@/types";
import { z } from "zod";
import { prisma } from "@/lib/db";

// ============================================
// EMAIL SEND API (PX-705)
// ============================================
// POST /api/email/send - Send email to client
// Rate limit: 100/hour per org

const sendEmailSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  body: z.string().min(1, "Body is required").max(50000, "Body too long"),
  messageId: z.string().uuid("Invalid message ID").optional(),
});

/**
 * POST /api/email/send
 *
 * Send an email to a client
 * Requires authentication and appropriate permissions
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Viewers cannot send emails
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to send emails" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = sendEmailSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { clientId, subject, body: emailBody, messageId } = validation.data;

    // Check rate limit
    const rateLimit = await checkRateLimit(user.orgId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: `Rate limit exceeded. ${rateLimit.remaining} emails remaining.`,
            resetAt: rateLimit.resetAt.toISOString(),
          },
        },
        { status: 429 }
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

    // Case managers can only email their assigned clients
    if (user.role === UserRole.CASE_MANAGER && client.assignedTo !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to email this client" } },
        { status: 403 }
      );
    }

    // Verify client has an email address
    if (!client.email) {
      return NextResponse.json(
        { error: { code: "NO_EMAIL", message: "Client does not have an email address" } },
        { status: 400 }
      );
    }

    // Check if client's email is bounced
    if (client.emailBounced) {
      return NextResponse.json(
        {
          error: {
            code: "EMAIL_BOUNCED",
            message: "Client's email address has been marked as invalid due to previous delivery failures",
          },
        },
        { status: 400 }
      );
    }

    // Get organization details for branding
    const organization = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: {
        name: true,
        settings: true,
      },
    });

    const orgSettings = organization?.settings as Record<string, unknown> | null;
    const orgLogoUrl = (orgSettings?.branding as Record<string, unknown>)?.logoUrl as string | undefined;

    // Send the email
    const result = await sendClientMessage({
      organizationId: user.orgId,
      clientId,
      messageId: messageId || "",
      recipientEmail: client.email,
      subject,
      body: emailBody,
      caseManagerName: user.name || "Case Manager",
      orgName: organization?.name || "Scrybe",
      orgLogoUrl,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "SEND_FAILED",
            message: result.error || "Failed to send email",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        emailLogId: result.emailLogId,
        sesMessageId: result.sesMessageId,
        rateLimit: {
          remaining: rateLimit.remaining - 1,
          resetAt: rateLimit.resetAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[EMAIL API] Error sending email:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to send email" } },
      { status: 500 }
    );
  }
}
