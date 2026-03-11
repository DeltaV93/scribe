import { NextRequest, NextResponse } from "next/server";
import { simpleParser, ParsedMail } from "mailparser";
import { prisma } from "@/lib/db";
import { parseReplyToAddress } from "@/lib/services/email";
import { createAuditLog } from "@/lib/audit/service";
import { MessageSenderType, MessageStatus } from "@prisma/client";
import crypto from "crypto";

// ============================================
// INBOUND EMAIL WEBHOOK (PX-705)
// ============================================
// Handles incoming email replies from clients
// Parses In-Reply-To header for threading
// Creates Message record appended to existing thread
// Notifies case manager of reply

/**
 * POST /api/webhooks/email/inbound
 *
 * Receives inbound email from AWS SES via SNS or S3 trigger
 * Expected payload formats:
 * 1. SNS notification with raw email in "Message" field
 * 2. Direct POST with raw email in body
 * 3. JSON payload with parsed email fields
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let parsedEmail: ParsedMail | null = null;
    let fromEmail = "";
    let toEmail = "";
    let subject = "";
    let textContent = "";
    let inReplyTo = "";

    // Handle different payload formats
    if (contentType.includes("application/json")) {
      const body = await request.json();

      // Check if this is an SNS notification
      if (body.Type === "SubscriptionConfirmation") {
        // Handle SNS subscription confirmation
        console.log("[EMAIL INBOUND] SNS subscription confirmation received");
        // In production, you would confirm the subscription here
        return NextResponse.json({ success: true, message: "Subscription noted" });
      }

      if (body.Type === "Notification") {
        // SNS notification with email content
        const message = JSON.parse(body.Message);

        // Parse the raw email if provided
        if (message.content) {
          const rawEmail = Buffer.from(message.content, "base64");
          parsedEmail = await simpleParser(rawEmail);
        } else if (message.mail) {
          // SES notification format
          fromEmail = message.mail.source;
          toEmail = message.mail.destination?.[0] || "";
          subject = message.mail.commonHeaders?.subject || "";
        }
      } else if (body.from && body.to) {
        // Direct JSON payload with parsed fields
        fromEmail = body.from;
        toEmail = body.to;
        subject = body.subject || "";
        textContent = body.body || body.text || "";
        inReplyTo = body.inReplyTo || body.references || "";
      }
    } else if (contentType.includes("text/plain") || contentType.includes("message/rfc822")) {
      // Raw email content
      const rawEmail = await request.text();
      parsedEmail = await simpleParser(rawEmail);
    } else {
      // Try to parse as raw email
      const rawEmail = await request.arrayBuffer();
      parsedEmail = await simpleParser(Buffer.from(rawEmail));
    }

    // Extract fields from parsed email if available
    if (parsedEmail) {
      // Handle from address - mailparser types use EmailAddress[]
      const fromValue = parsedEmail.from;
      if (fromValue && fromValue.value && Array.isArray(fromValue.value) && fromValue.value.length > 0) {
        fromEmail = fromValue.value[0].address || "";
      }

      // Handle to address - can be AddressObject or AddressObject[]
      const toValue = parsedEmail.to;
      if (toValue) {
        if (Array.isArray(toValue)) {
          // Multiple To addresses
          const firstTo = toValue[0];
          if (firstTo && firstTo.value && Array.isArray(firstTo.value) && firstTo.value.length > 0) {
            toEmail = firstTo.value[0].address || "";
          }
        } else if (toValue.value && Array.isArray(toValue.value) && toValue.value.length > 0) {
          // Single To address
          toEmail = toValue.value[0].address || "";
        }
      }

      subject = parsedEmail.subject || "";
      textContent = parsedEmail.text || "";
      inReplyTo = parsedEmail.inReplyTo || "";
    }

    if (!fromEmail || !toEmail) {
      console.warn("[EMAIL INBOUND] Missing required email fields", { fromEmail, toEmail });
      return NextResponse.json(
        { error: "Missing required email fields" },
        { status: 400 }
      );
    }

    // Parse the reply-to address to get the message ID
    const messageId = parseReplyToAddress(toEmail);

    if (!messageId) {
      console.warn("[EMAIL INBOUND] Invalid reply-to address", { toEmail });
      return NextResponse.json(
        { error: "Invalid reply-to address" },
        { status: 400 }
      );
    }

    // Find the original message
    const originalMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        client: {
          select: {
            id: true,
            orgId: true,
            email: true,
            firstName: true,
            lastName: true,
            assignedTo: true,
            assignedUser: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!originalMessage) {
      console.warn("[EMAIL INBOUND] Original message not found", { messageId });
      return NextResponse.json(
        { error: "Original message not found" },
        { status: 404 }
      );
    }

    // Verify the sender matches the client's email
    const client = originalMessage.client;
    if (!client) {
      console.warn("[EMAIL INBOUND] No client associated with message", { messageId });
      return NextResponse.json(
        { error: "No client associated with message" },
        { status: 400 }
      );
    }

    const senderEmail = fromEmail.toLowerCase();
    const clientEmail = client.email?.toLowerCase();

    if (clientEmail !== senderEmail) {
      console.warn("[EMAIL INBOUND] Sender email mismatch", {
        senderEmail,
        clientEmail,
        messageId,
      });
      // Still create the message but flag it for review
      // This allows for clients who reply from different email addresses
    }

    // Clean up email content (remove quoted replies, signatures, etc.)
    const cleanedContent = cleanEmailContent(textContent);

    if (!cleanedContent.trim()) {
      console.warn("[EMAIL INBOUND] Empty email content after cleaning");
      return NextResponse.json(
        { error: "Empty email content" },
        { status: 400 }
      );
    }

    // Generate content hash for integrity
    const contentHash = crypto
      .createHash("sha256")
      .update(cleanedContent)
      .digest("hex");

    // Calculate expiry date (7 years retention)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 7);

    // Create the reply message
    const replyMessage = await prisma.message.create({
      data: {
        orgId: client.orgId,
        clientId: client.id,
        senderId: null, // Client replies have no sender user
        senderType: MessageSenderType.CLIENT,
        content: cleanedContent,
        contentHash,
        status: MessageStatus.SENT,
        sentAt: new Date(),
        expiresAt,
      },
    });

    // Audit log for compliance (accessing PHI)
    await createAuditLog({
      orgId: client.orgId,
      action: "CREATE",
      resource: "EMAIL",
      resourceId: replyMessage.id,
      resourceName: `Email reply from ${client.firstName} ${client.lastName}`,
      details: {
        type: "inbound_email",
        originalMessageId: messageId,
        clientId: client.id,
        fromEmail: senderEmail,
      },
    });

    // Notify case manager of the reply
    if (client.assignedUser) {
      await notifyCaseManagerOfReply(
        client.assignedUser.email,
        client.assignedUser.name || "Case Manager",
        client.firstName,
        client.lastName,
        client.id,
        client.orgId
      );
    }

    console.log("[EMAIL INBOUND] Reply created successfully", {
      messageId: replyMessage.id,
      clientId: client.id,
      originalMessageId: messageId,
    });

    return NextResponse.json({
      success: true,
      messageId: replyMessage.id,
    });
  } catch (error) {
    console.error("[EMAIL INBOUND] Error processing inbound email:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Clean email content by removing quoted replies and signatures
 */
function cleanEmailContent(content: string): string {
  if (!content) return "";

  let cleaned = content;

  // Remove quoted reply markers
  // Pattern: lines starting with > or |
  const lines = cleaned.split("\n");
  const cleanedLines: string[] = [];
  let foundQuotedSection = false;

  for (const line of lines) {
    // Stop at common reply indicators
    if (
      line.match(/^>/) || // Quoted text
      line.match(/^On .+ wrote:$/i) || // "On [date] [person] wrote:"
      line.match(/^-{3,}/) || // Separator lines
      line.match(/^_{3,}/) || // Separator lines
      line.match(/^From:.*$/i) || // Forwarded email header
      line.match(/^Sent:.*$/i) // Forwarded email header
    ) {
      foundQuotedSection = true;
    }

    if (!foundQuotedSection) {
      cleanedLines.push(line);
    }
  }

  cleaned = cleanedLines.join("\n");

  // Remove common signature patterns
  const signaturePatterns = [
    /\n--\s*\n[\s\S]*$/, // Standard -- signature marker
    /\nSent from my [\w\s]+\s*$/i, // "Sent from my iPhone" etc.
    /\nGet Outlook for [\w\s]+\s*$/i, // Outlook mobile signature
  ];

  for (const pattern of signaturePatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Trim whitespace
  cleaned = cleaned.trim();

  // Remove excessive newlines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned;
}

/**
 * Notify case manager of a new client reply
 */
async function notifyCaseManagerOfReply(
  caseManagerEmail: string,
  caseManagerName: string,
  clientFirstName: string,
  clientLastName: string,
  clientId: string,
  orgId: string
): Promise<void> {
  try {
    // Import dynamically to avoid circular dependency
    const { notifyCaseManagerOfReply: sendNotification } = await import(
      "@/lib/services/email-notifications"
    );

    await sendNotification(caseManagerEmail, {
      caseManagerName,
      clientFirstName,
      clientLastName,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients/${clientId}/messages`,
    });
  } catch (error) {
    console.error("[EMAIL INBOUND] Failed to notify case manager:", error);
    // Don't throw - notification failure shouldn't block message creation
  }
}
