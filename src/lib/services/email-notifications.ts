import { prisma } from "@/lib/db";

// ============================================
// Email Notification Stub
// ============================================
// This is a stub implementation that logs emails to console.
// Replace with AWS SES integration when ready.
//
// To integrate SES:
// 1. npm install @aws-sdk/client-ses
// 2. Add AWS credentials to environment
// 3. Replace sendEmail implementation below
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
  | "draft_digest";

/**
 * Send an email notification
 * Currently logs to console - replace with SES for production
 */
export async function sendEmail(notification: EmailNotification): Promise<void> {
  console.log("[EMAIL STUB] Would send email:", {
    to: notification.to,
    subject: notification.subject,
    template: notification.template,
    data: notification.data,
    timestamp: new Date().toISOString(),
  });

  // TODO: Replace with AWS SES implementation
  // Example:
  // const ses = new SESClient({ region: process.env.AWS_REGION });
  // await ses.send(new SendEmailCommand({
  //   Source: process.env.EMAIL_FROM,
  //   Destination: { ToAddresses: [notification.to] },
  //   Message: {
  //     Subject: { Data: notification.subject },
  //     Body: {
  //       Html: { Data: renderTemplate(notification.template, notification.data) }
  //     }
  //   }
  // }));
}

/**
 * Notify organization admins when a case manager requests a phone number
 */
export async function notifyAdminOfPhoneRequest(
  orgId: string,
  userName: string
): Promise<void> {
  // Get all admins in the organization
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

  // Send notification to each admin
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
  // Remove +1 prefix and format as (XXX) XXX-XXXX
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);

  if (last10.length === 10) {
    return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
  }

  return phone;
}
