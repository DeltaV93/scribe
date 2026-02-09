import { prisma } from "@/lib/db";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

// ============================================
// Email Notification Service (PX-705)
// ============================================
// Production-ready email sending via AWS SES
// with logging and template support

const AWS_SES_REGION = process.env.AWS_SES_REGION || "us-east-1";
const AWS_SES_FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL || "noreply@scrybe.app";

// Feature flag - set to true to enable real email sending
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === "true";

// ============================================
// SES CLIENT (LAZY LOADED)
// ============================================

let sesClient: SESClient | null = null;

function getSESClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: AWS_SES_REGION,
    });
  }
  return sesClient;
}

// ============================================
// TYPES
// ============================================

interface EmailNotification {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

type EmailTemplate =
  | "phone_request_submitted"
  | "phone_request_approved"
  | "phone_request_rejected"
  | "phone_assigned"
  | "user_invitation"
  | "user_invitation_reminder"
  | "user_invitation_accepted"
  | "user_role_changed"
  | "user_deactivated"
  | "user_reactivated"
  | "client_reply_notification"
  | "draft_digest"
  | "email_bounced";

// ============================================
// CORE EMAIL SENDING
// ============================================

/**
 * Send an email notification via AWS SES
 * Falls back to console logging if EMAIL_ENABLED is false
 */
export async function sendEmail(notification: EmailNotification): Promise<void> {
  const htmlBody = renderTemplate(notification.template, notification.data);
  const textBody = stripHtml(htmlBody);

  // If email is not enabled, just log
  if (!EMAIL_ENABLED) {
    console.log("[EMAIL] Would send email:", {
      to: notification.to,
      subject: notification.subject,
      template: notification.template,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const client = getSESClient();

    const params: SendEmailCommandInput = {
      Source: AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [notification.to],
      },
      Message: {
        Subject: {
          Data: notification.subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: "UTF-8",
          },
          Text: {
            Data: textBody,
            Charset: "UTF-8",
          },
        },
      },
    };

    const command = new SendEmailCommand(params);
    await client.send(command);

    console.log("[EMAIL] Email sent successfully:", {
      to: notification.to,
      subject: notification.subject,
      template: notification.template,
    });
  } catch (error) {
    console.error("[EMAIL] Failed to send email:", error);
    // Don't throw - email failures shouldn't break the main flow
    // In production, you might want to queue for retry
  }
}

// ============================================
// TEMPLATE RENDERING
// ============================================

function renderTemplate(
  template: EmailTemplate,
  data: Record<string, unknown>
): string {
  const baseStyles = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #4F46E5; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 16px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 24px; }
    .highlight { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0; }
  `;

  let content = "";

  switch (template) {
    case "phone_request_submitted":
      content = `
        <p>Hello ${data.adminName},</p>
        <p><strong>${data.userName}</strong> has requested a phone number for making calls.</p>
        <p><a href="${data.actionUrl}" class="button">Review Request</a></p>
      `;
      break;

    case "phone_request_approved":
      content = `
        <p>Great news! Your phone number request has been approved.</p>
        <div class="highlight">
          <p><strong>Your new phone number:</strong> ${data.formattedNumber}</p>
        </div>
        <p>You can now make calls from the Scrybe dashboard.</p>
      `;
      break;

    case "phone_request_rejected":
      content = `
        <p>Your phone number request has been reviewed.</p>
        <p>Unfortunately, we were unable to approve your request at this time.</p>
        ${data.reason ? `<div class="highlight"><p><strong>Reason:</strong> ${data.reason}</p></div>` : ""}
        <p>Please contact your administrator for more information.</p>
      `;
      break;

    case "phone_assigned":
      content = `
        <p>A phone number has been assigned to your account.</p>
        <div class="highlight">
          <p><strong>Your phone number:</strong> ${data.formattedNumber}</p>
        </div>
        <p>You can now make calls from the Scrybe dashboard.</p>
      `;
      break;

    case "user_invitation":
      content = `
        <p>Hello ${data.inviteeName},</p>
        <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> on Scrybe as a ${data.role}.</p>
        <p><a href="${data.inviteUrl}" class="button">Accept Invitation</a></p>
        <p style="color: #6b7280; font-size: 14px;">This invitation expires on ${data.expiresAt}.</p>
      `;
      break;

    case "user_invitation_reminder":
      content = `
        <p>Hello ${data.inviteeName},</p>
        <p>This is a friendly reminder that your invitation to join <strong>${data.organizationName}</strong> is still waiting for you.</p>
        <p><a href="${data.inviteUrl}" class="button">Accept Invitation</a></p>
        <p style="color: #6b7280; font-size: 14px;">This invitation expires in ${data.daysRemaining} days.</p>
      `;
      break;

    case "user_invitation_accepted":
      content = `
        <p>Hello ${data.adminName},</p>
        <p><strong>${data.newUserName}</strong> (${data.newUserEmail}) has accepted their invitation and joined your organization as a ${data.newUserRole}.</p>
      `;
      break;

    case "user_role_changed":
      content = `
        <p>Hello ${data.userName},</p>
        <p>Your role has been updated by ${data.changedByName}.</p>
        <div class="highlight">
          <p><strong>Previous role:</strong> ${data.oldRole}</p>
          <p><strong>New role:</strong> ${data.newRole}</p>
        </div>
      `;
      break;

    case "user_deactivated":
      content = `
        <p>Hello ${data.userName},</p>
        <p>Your account with <strong>${data.organizationName}</strong> on Scrybe has been deactivated.</p>
        <p>If you believe this is an error, please contact your organization's administrator.</p>
      `;
      break;

    case "user_reactivated":
      content = `
        <p>Hello ${data.userName},</p>
        <p>Great news! Your account with <strong>${data.organizationName}</strong> on Scrybe has been reactivated.</p>
        <p><a href="${data.loginUrl}" class="button">Log In</a></p>
      `;
      break;

    case "client_reply_notification":
      content = `
        <p>Hello ${data.caseManagerName},</p>
        <p>You have a new message from <strong>${data.clientName}</strong>.</p>
        <p><a href="${data.dashboardUrl}" class="button">View Message</a></p>
      `;
      break;

    case "draft_digest":
      content = `
        <p>Hello ${data.userName},</p>
        <p>You have <strong>${data.draftCount} draft form${(data.draftCount as number) === 1 ? "" : "s"}</strong> that will be auto-archived soon:</p>
        <div class="highlight">
          ${(data.drafts as Array<{ name: string; daysUntilArchive: number; editUrl: string }>)
            .map((draft) => `<p><strong>${draft.name}</strong> - ${draft.daysUntilArchive} days remaining (<a href="${draft.editUrl}">Edit</a>)</p>`)
            .join("")}
        </div>
        <p><a href="${data.formsUrl}" class="button">View All Forms</a></p>
      `;
      break;

    case "email_bounced":
      content = `
        <p>Hello ${data.caseManagerName},</p>
        <p>We were unable to deliver emails to <strong>${data.clientName}</strong> at <strong>${data.bouncedEmail}</strong>.</p>
        <div class="highlight">
          <p><strong>Reason:</strong> ${data.reason}</p>
        </div>
        <p>Please verify the client's email address and update their record if needed.</p>
      `;
      break;

    default:
      content = `<p>Email notification</p>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Scrybe</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>Powered by Scrybe</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

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

// ============================================
// Phone Number Notifications
// ============================================

/**
 * Notify organization admins when a case manager requests a phone number
 */
export async function notifyAdminOfPhoneRequest(
  orgId: string,
  userName: string
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: {
      orgId,
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      isActive: true,
    },
    select: { email: true, name: true },
  });

  if (admins.length === 0) {
    console.warn(`[EMAIL] No admins found for org ${orgId}`);
    return;
  }

  for (const admin of admins) {
    await sendEmail({
      to: admin.email,
      subject: `Phone Number Request from ${userName}`,
      template: "phone_request_submitted",
      data: {
        adminName: admin.name || "Admin",
        userName,
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin`,
      },
    });
  }
}

/**
 * Notify user when their phone number request is approved
 */
export async function notifyUserOfApproval(
  userEmail: string,
  phoneNumber: string
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: "Your Phone Number Has Been Assigned",
    template: "phone_request_approved",
    data: {
      phoneNumber,
      formattedNumber: formatPhoneNumber(phoneNumber),
    },
  });
}

/**
 * Notify user when their phone number request is rejected
 */
export async function notifyUserOfRejection(
  userEmail: string,
  reason?: string
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: "Phone Number Request Update",
    template: "phone_request_rejected",
    data: {
      reason: reason || "No reason provided",
    },
  });
}

/**
 * Notify user when a phone number is directly assigned to them
 */
export async function notifyUserOfAssignment(
  userEmail: string,
  phoneNumber: string
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: "A Phone Number Has Been Assigned to You",
    template: "phone_assigned",
    data: {
      phoneNumber,
      formattedNumber: formatPhoneNumber(phoneNumber),
    },
  });
}

// ============================================
// User Invitation Notifications
// ============================================

/**
 * Send invitation email to new user
 */
export async function sendInvitationEmail(
  email: string,
  data: {
    inviteeName: string;
    inviterName: string;
    organizationName: string;
    role: string;
    inviteUrl: string;
    expiresAt: Date;
  }
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `You've been invited to join ${data.organizationName} on Scrybe`,
    template: "user_invitation",
    data: {
      inviteeName: data.inviteeName,
      inviterName: data.inviterName,
      organizationName: data.organizationName,
      role: data.role,
      inviteUrl: data.inviteUrl,
      expiresAt: data.expiresAt.toLocaleDateString(),
    },
  });
}

/**
 * Send reminder email for pending invitation
 */
export async function sendInvitationReminderEmail(
  email: string,
  data: {
    inviteeName: string;
    organizationName: string;
    inviteUrl: string;
    expiresAt: Date;
  }
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Reminder: Your invitation to ${data.organizationName} is waiting`,
    template: "user_invitation_reminder",
    data: {
      inviteeName: data.inviteeName,
      organizationName: data.organizationName,
      inviteUrl: data.inviteUrl,
      expiresAt: data.expiresAt.toLocaleDateString(),
      daysRemaining: Math.ceil(
        (data.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    },
  });
}

/**
 * Notify admin when user accepts invitation
 */
export async function notifyAdminOfAcceptedInvitation(
  adminEmail: string,
  data: {
    adminName: string;
    newUserName: string;
    newUserEmail: string;
    newUserRole: string;
  }
): Promise<void> {
  await sendEmail({
    to: adminEmail,
    subject: `${data.newUserName} has joined your organization`,
    template: "user_invitation_accepted",
    data,
  });
}

/**
 * Notify user when their role is changed
 */
export async function notifyUserOfRoleChange(
  userEmail: string,
  data: {
    userName: string;
    oldRole: string;
    newRole: string;
    changedByName: string;
  }
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: "Your role has been updated",
    template: "user_role_changed",
    data,
  });
}

/**
 * Notify user when their account is deactivated
 */
export async function notifyUserOfDeactivation(
  userEmail: string,
  data: {
    userName: string;
    organizationName: string;
  }
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: "Your account has been deactivated",
    template: "user_deactivated",
    data,
  });
}

/**
 * Notify user when their account is reactivated
 */
export async function notifyUserOfReactivation(
  userEmail: string,
  data: {
    userName: string;
    organizationName: string;
    loginUrl: string;
  }
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: "Your account has been reactivated",
    template: "user_reactivated",
    data,
  });
}

// ============================================
// Client Portal Notifications
// ============================================

/**
 * Notify case manager when a client sends a reply in the portal
 */
export async function notifyCaseManagerOfReply(
  caseManagerEmail: string,
  data: {
    caseManagerName: string;
    clientFirstName: string;
    clientLastName: string;
    dashboardUrl: string;
  }
): Promise<void> {
  await sendEmail({
    to: caseManagerEmail,
    subject: `New message from ${data.clientFirstName} ${data.clientLastName}`,
    template: "client_reply_notification",
    data: {
      caseManagerName: data.caseManagerName,
      clientName: `${data.clientFirstName} ${data.clientLastName}`,
      dashboardUrl: data.dashboardUrl,
    },
  });
}

// ============================================
// Draft Digest Notifications
// ============================================

export interface DraftDigestItem {
  id: string;
  name: string;
  fieldCount: number;
  lastEditedAt: Date;
  daysUntilArchive: number;
  editUrl: string;
}

/**
 * Send weekly draft digest email to a user
 */
export async function sendDraftDigestEmail(
  userEmail: string,
  data: {
    userName: string;
    orgName: string;
    drafts: DraftDigestItem[];
    appUrl: string;
  }
): Promise<void> {
  await sendEmail({
    to: userEmail,
    subject: `[Scrybe] You have ${data.drafts.length} draft form${data.drafts.length === 1 ? "" : "s"} approaching archive`,
    template: "draft_digest",
    data: {
      userName: data.userName,
      orgName: data.orgName,
      draftCount: data.drafts.length,
      drafts: data.drafts.map((draft) => ({
        ...draft,
        editUrl: `${data.appUrl}${draft.editUrl}`,
        lastEditedAt: draft.lastEditedAt.toLocaleDateString(),
      })),
      formsUrl: `${data.appUrl}/forms`,
    },
  });
}

// ============================================
// Helpers
// ============================================

/**
 * Format phone number for display (E.164 to friendly format)
 */
function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);

  if (last10.length === 10) {
    return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
  }

  return phone;
}
