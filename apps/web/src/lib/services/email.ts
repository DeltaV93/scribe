import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { prisma } from "@/lib/db";
import { EmailStatus } from "@prisma/client";
import crypto from "crypto";
import { createAuditLog } from "@/lib/audit/service";
import { renderEmailTemplate, EmailTemplateId } from "./email-templates";

// ============================================
// CONFIGURATION
// ============================================

const AWS_SES_REGION = process.env.AWS_SES_REGION || "us-east-1";
const AWS_SES_FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL || "noreply@scrybe.app";
const REPLY_TO_DOMAIN = process.env.EMAIL_REPLY_DOMAIN || "reply.scrybe.app";
const MAX_RETRY_ATTEMPTS = 3;
const RATE_LIMIT_PER_HOUR = 100;

// Backoff delays in milliseconds: 5 min, 15 min, 1 hour
const RETRY_DELAYS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];

// ============================================
// SES CLIENT (LAZY LOADED)
// ============================================

let sesClient: SESClient | null = null;

function getSESClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: AWS_SES_REGION,
      // AWS SDK will automatically use environment variables:
      // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or IAM role
    });
  }
  return sesClient;
}

// ============================================
// TYPES
// ============================================

export interface SendEmailInput {
  organizationId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  templateId?: EmailTemplateId;
  messageId?: string; // Link to Message table
  clientId?: string; // Link to Client table
  replyToThreadId?: string; // For generating unique reply-to address
}

export interface SendClientMessageInput {
  organizationId: string;
  clientId: string;
  messageId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  caseManagerName: string;
  orgName: string;
  orgLogoUrl?: string;
}

export interface EmailSendResult {
  success: boolean;
  emailLogId: string;
  sesMessageId?: string;
  error?: string;
}

// ============================================
// RATE LIMITING
// ============================================

/**
 * Check if organization is within rate limit (100 emails/hour)
 */
export async function checkRateLimit(organizationId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const count = await prisma.emailLog.count({
    where: {
      organizationId,
      createdAt: { gte: oneHourAgo },
    },
  });

  const resetAt = new Date(oneHourAgo.getTime() + 60 * 60 * 1000);

  return {
    allowed: count < RATE_LIMIT_PER_HOUR,
    remaining: Math.max(0, RATE_LIMIT_PER_HOUR - count),
    resetAt,
  };
}

// ============================================
// REPLY-TO ADDRESS GENERATION
// ============================================

/**
 * Generate a unique reply-to address for email threading
 * Format: {messageId}-{hash}@reply.scrybe.app
 */
export function generateReplyToAddress(messageId: string): string {
  const secret = process.env.EMAIL_REPLY_SECRET || "default-secret-change-me";
  const hash = crypto
    .createHmac("sha256", secret)
    .update(messageId)
    .digest("hex")
    .substring(0, 8);

  return `${messageId}-${hash}@${REPLY_TO_DOMAIN}`;
}

/**
 * Parse and validate a reply-to address
 * Returns messageId if valid, null if invalid
 */
export function parseReplyToAddress(replyTo: string): string | null {
  const match = replyTo.match(/^([a-f0-9-]+)-([a-f0-9]{8})@/i);
  if (!match) return null;

  const [, messageId, providedHash] = match;
  const secret = process.env.EMAIL_REPLY_SECRET || "default-secret-change-me";
  const expectedHash = crypto
    .createHmac("sha256", secret)
    .update(messageId)
    .digest("hex")
    .substring(0, 8);

  if (providedHash.toLowerCase() !== expectedHash.toLowerCase()) {
    return null;
  }

  return messageId;
}

// ============================================
// EMAIL SENDING
// ============================================

/**
 * Send an email via AWS SES with logging and tracking
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const {
    organizationId,
    recipientEmail,
    subject,
    body,
    templateId,
    messageId,
    clientId,
    replyToThreadId,
  } = input;

  // Check rate limit
  const rateLimit = await checkRateLimit(organizationId);
  if (!rateLimit.allowed) {
    // Create log entry for rate limited email
    const emailLog = await prisma.emailLog.create({
      data: {
        organizationId,
        messageId,
        clientId,
        recipientEmail,
        subject,
        templateId,
        body,
        status: EmailStatus.FAILED,
        bounceReason: "Rate limit exceeded",
      },
    });

    return {
      success: false,
      emailLogId: emailLog.id,
      error: `Rate limit exceeded. ${rateLimit.remaining} emails remaining. Resets at ${rateLimit.resetAt.toISOString()}`,
    };
  }

  // Create email log entry in QUEUED status
  const emailLog = await prisma.emailLog.create({
    data: {
      organizationId,
      messageId,
      clientId,
      recipientEmail,
      subject,
      templateId,
      body,
      status: EmailStatus.QUEUED,
    },
  });

  try {
    const client = getSESClient();

    // Build reply-to address if thread ID provided
    const replyToAddress = replyToThreadId
      ? generateReplyToAddress(replyToThreadId)
      : undefined;

    const params: SendEmailCommandInput = {
      Source: AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: body,
            Charset: "UTF-8",
          },
          Text: {
            Data: stripHtml(body),
            Charset: "UTF-8",
          },
        },
      },
      ReplyToAddresses: replyToAddress ? [replyToAddress] : undefined,
      ConfigurationSetName: process.env.AWS_SES_CONFIG_SET || undefined,
    };

    const command = new SendEmailCommand(params);
    const response = await client.send(command);

    // Update log with success
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: EmailStatus.SENT,
        sesMessageId: response.MessageId,
        sentAt: new Date(),
      },
    });

    // Audit log for compliance
    await createAuditLog({
      orgId: organizationId,
      action: "CREATE",
      resource: "EMAIL",
      resourceId: emailLog.id,
      resourceName: `Email to ${recipientEmail}`,
      details: {
        type: "email_sent",
        templateId,
        clientId,
        messageId,
      },
    });

    return {
      success: true,
      emailLogId: emailLog.id,
      sesMessageId: response.MessageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update log with failure
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: EmailStatus.FAILED,
        bounceReason: errorMessage,
        nextRetryAt: new Date(Date.now() + RETRY_DELAYS[0]),
      },
    });

    console.error("[EMAIL] Failed to send email:", error);

    return {
      success: false,
      emailLogId: emailLog.id,
      error: errorMessage,
    };
  }
}

/**
 * Send a message to a client with email
 * Creates proper threading and uses client_message template
 */
export async function sendClientMessage(
  input: SendClientMessageInput
): Promise<EmailSendResult> {
  const {
    organizationId,
    clientId,
    messageId,
    recipientEmail,
    subject,
    body,
    caseManagerName,
    orgName,
    orgLogoUrl,
  } = input;

  // Check if client's email is bounced
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { emailBounced: true },
  });

  if (client?.emailBounced) {
    return {
      success: false,
      emailLogId: "",
      error: "Client email address is marked as bounced",
    };
  }

  // Render the client_message template
  const renderedBody = renderEmailTemplate("client_message", {
    caseManagerName,
    orgName,
    messageContent: body,
    portalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
    logoUrl: orgLogoUrl,
  });

  return sendEmail({
    organizationId,
    recipientEmail,
    subject,
    body: renderedBody,
    templateId: "client_message",
    messageId,
    clientId,
    replyToThreadId: messageId, // Use message ID for threading
  });
}

// ============================================
// BOUNCE HANDLING
// ============================================

export interface BounceNotification {
  sesMessageId: string;
  bounceType: "Permanent" | "Transient";
  bounceSubType: string;
  bouncedRecipients: Array<{
    emailAddress: string;
    action?: string;
    status?: string;
    diagnosticCode?: string;
  }>;
  timestamp: string;
}

/**
 * Handle bounce notification from AWS SES
 */
export async function handleBounce(notification: BounceNotification): Promise<void> {
  const { sesMessageId, bounceType, bounceSubType, bouncedRecipients, timestamp } = notification;

  // Find the email log by SES message ID
  const emailLog = await prisma.emailLog.findUnique({
    where: { sesMessageId },
    include: { message: { include: { client: true } } },
  });

  if (!emailLog) {
    console.warn(`[EMAIL] Bounce received for unknown SES message: ${sesMessageId}`);
    return;
  }

  const isPermanent = bounceType === "Permanent";
  const bounceReason = bouncedRecipients
    .map((r) => `${r.emailAddress}: ${r.diagnosticCode || r.status || bounceSubType}`)
    .join("; ");

  // Update email log
  await prisma.emailLog.update({
    where: { id: emailLog.id },
    data: {
      status: EmailStatus.BOUNCED,
      bouncedAt: new Date(timestamp),
      bounceType: bounceType.toLowerCase(),
      bounceReason,
    },
  });

  // If permanent bounce, mark client email as invalid
  if (isPermanent && emailLog.clientId) {
    await prisma.client.update({
      where: { id: emailLog.clientId },
      data: {
        emailBounced: true,
        emailBouncedAt: new Date(),
      },
    });

    // Notify case manager about permanent bounce
    await notifyCaseManagerOfBounce(emailLog.clientId, emailLog.recipientEmail);
  } else if (!isPermanent) {
    // For transient bounces, schedule retry
    await scheduleRetry(emailLog.id);
  }

  // Audit log
  await createAuditLog({
    orgId: emailLog.organizationId,
    action: "UPDATE",
    resource: "FILE",
    resourceId: emailLog.id,
    details: {
      type: "email_bounced",
      bounceType,
      bounceSubType,
      isPermanent,
      clientId: emailLog.clientId,
    },
  });
}

/**
 * Handle delivery confirmation from AWS SES
 */
export async function handleDelivery(sesMessageId: string): Promise<void> {
  await prisma.emailLog.updateMany({
    where: { sesMessageId },
    data: {
      status: EmailStatus.DELIVERED,
      deliveredAt: new Date(),
    },
  });
}

/**
 * Notify case manager when client email bounces permanently
 */
async function notifyCaseManagerOfBounce(
  clientId: string,
  bouncedEmail: string
): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      assignedUser: {
        select: { email: true, name: true },
      },
    },
  });

  if (!client?.assignedUser) return;

  // Import dynamically to avoid circular dependency
  const { sendEmail: sendNotificationEmail } = await import("./email-notifications");

  await sendNotificationEmail({
    to: client.assignedUser.email,
    subject: `Email Delivery Failed for ${client.firstName} ${client.lastName}`,
    template: "phone_request_rejected" as never, // Reusing existing template structure
    data: {
      caseManagerName: client.assignedUser.name || "Case Manager",
      clientName: `${client.firstName} ${client.lastName}`,
      bouncedEmail,
      reason: "Email address is invalid or no longer accepts messages",
    },
  });
}

// ============================================
// RETRY LOGIC
// ============================================

/**
 * Schedule a retry for a failed email
 */
async function scheduleRetry(emailLogId: string): Promise<void> {
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
  });

  if (!emailLog || emailLog.retryCount >= MAX_RETRY_ATTEMPTS) {
    // Max retries reached, mark as permanently failed
    if (emailLog && emailLog.retryCount >= MAX_RETRY_ATTEMPTS) {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: EmailStatus.FAILED,
          bounceReason: `Failed after ${MAX_RETRY_ATTEMPTS} retry attempts`,
        },
      });

      // Mark client email as bounced
      if (emailLog.clientId) {
        await prisma.client.update({
          where: { id: emailLog.clientId },
          data: {
            emailBounced: true,
            emailBouncedAt: new Date(),
          },
        });

        await notifyCaseManagerOfBounce(emailLog.clientId, emailLog.recipientEmail);
      }
    }
    return;
  }

  const delayMs = RETRY_DELAYS[emailLog.retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

  await prisma.emailLog.update({
    where: { id: emailLogId },
    data: {
      retryCount: { increment: 1 },
      nextRetryAt: new Date(Date.now() + delayMs),
      status: EmailStatus.QUEUED,
    },
  });
}

/**
 * Retry failed emails that are due for retry
 * This should be called by a cron job or queue worker
 */
export async function retryFailedEmails(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date();

  // Find emails that need retry
  const emailsToRetry = await prisma.emailLog.findMany({
    where: {
      status: EmailStatus.QUEUED,
      retryCount: { lt: MAX_RETRY_ATTEMPTS },
      nextRetryAt: { lte: now },
    },
    take: 50, // Process in batches
  });

  let succeeded = 0;
  let failed = 0;

  for (const emailLog of emailsToRetry) {
    if (!emailLog.body) {
      console.warn(`[EMAIL] Skipping retry for ${emailLog.id}: no body stored`);
      failed++;
      continue;
    }

    try {
      const client = getSESClient();

      const params: SendEmailCommandInput = {
        Source: AWS_SES_FROM_EMAIL,
        Destination: {
          ToAddresses: [emailLog.recipientEmail],
        },
        Message: {
          Subject: {
            Data: emailLog.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: emailLog.body,
              Charset: "UTF-8",
            },
            Text: {
              Data: stripHtml(emailLog.body),
              Charset: "UTF-8",
            },
          },
        },
        ConfigurationSetName: process.env.AWS_SES_CONFIG_SET || undefined,
      };

      const command = new SendEmailCommand(params);
      const response = await client.send(command);

      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailStatus.SENT,
          sesMessageId: response.MessageId,
          sentAt: new Date(),
          nextRetryAt: null,
        },
      });

      succeeded++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Schedule another retry or mark as failed
      await scheduleRetry(emailLog.id);

      console.error(`[EMAIL] Retry failed for ${emailLog.id}:`, errorMessage);
      failed++;
    }
  }

  return {
    attempted: emailsToRetry.length,
    succeeded,
    failed,
  };
}

// ============================================
// EMAIL LOG QUERIES
// ============================================

/**
 * Get email logs for an organization with pagination
 */
export async function getEmailLogs(
  organizationId: string,
  options: {
    status?: EmailStatus;
    clientId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  logs: Array<{
    id: string;
    recipientEmail: string;
    subject: string;
    status: EmailStatus;
    templateId: string | null;
    sesMessageId: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    bouncedAt: Date | null;
    bounceReason: string | null;
    retryCount: number;
    createdAt: Date;
  }>;
  total: number;
}> {
  const { status, clientId, limit = 50, offset = 0 } = options;

  const where = {
    organizationId,
    ...(status && { status }),
    ...(clientId && { clientId }),
  };

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      select: {
        id: true,
        recipientEmail: true,
        subject: true,
        status: true,
        templateId: true,
        sesMessageId: true,
        sentAt: true,
        deliveredAt: true,
        bouncedAt: true,
        bounceReason: true,
        retryCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.emailLog.count({ where }),
  ]);

  return { logs, total };
}

/**
 * Get a specific email log by ID
 */
export async function getEmailLog(
  id: string,
  organizationId: string
): Promise<{
  id: string;
  recipientEmail: string;
  subject: string;
  body: string | null;
  status: EmailStatus;
  templateId: string | null;
  sesMessageId: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  bounceReason: string | null;
  retryCount: number;
  createdAt: Date;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
} | null> {
  const log = await prisma.emailLog.findFirst({
    where: { id, organizationId },
    include: {
      message: {
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!log) return null;

  return {
    id: log.id,
    recipientEmail: log.recipientEmail,
    subject: log.subject,
    body: log.body,
    status: log.status,
    templateId: log.templateId,
    sesMessageId: log.sesMessageId,
    sentAt: log.sentAt,
    deliveredAt: log.deliveredAt,
    bouncedAt: log.bouncedAt,
    bounceReason: log.bounceReason,
    retryCount: log.retryCount,
    createdAt: log.createdAt,
    client: log.message?.client || null,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Strip HTML tags to create plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}
