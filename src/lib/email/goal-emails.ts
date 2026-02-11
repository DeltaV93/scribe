/**
 * Goal Email Templates
 *
 * Email templates for goal-related notifications using AWS SES
 */

import { sendEmail } from "./service";
import { GoalType } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface GoalEmailParams {
  to: string;
  recipientName: string;
  goalName: string;
  goalType: GoalType;
  notificationType: "milestone" | "at_risk" | "behind" | "completed" | "deadline_approaching";
  metadata: {
    milestone?: number;
    daysRemaining?: number;
    previousProgress?: number;
    newProgress?: number;
  };
  actionUrl: string;
}

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Send a goal notification email
 */
export async function sendGoalNotificationEmail(params: GoalEmailParams): Promise<void> {
  const { to, recipientName, goalName, goalType, notificationType, metadata, actionUrl } = params;

  const typeLabel = formatGoalType(goalType);
  const { subject, htmlBody, textBody } = generateEmailContent(
    recipientName,
    goalName,
    typeLabel,
    notificationType,
    metadata,
    actionUrl
  );

  await sendEmail({
    to,
    subject,
    htmlBody,
    textBody,
  });
}

/**
 * Format goal type for display
 */
function formatGoalType(type: GoalType): string {
  switch (type) {
    case "GRANT":
      return "Grant";
    case "KPI":
      return "KPI";
    case "OKR":
      return "OKR";
    case "PROGRAM_INITIATIVE":
      return "Program Initiative";
    case "TEAM_INITIATIVE":
      return "Team Initiative";
    case "INDIVIDUAL":
      return "Individual Goal";
    default:
      return "Goal";
  }
}

/**
 * Generate email content based on notification type
 */
function generateEmailContent(
  recipientName: string,
  goalName: string,
  typeLabel: string,
  notificationType: string,
  metadata: GoalEmailParams["metadata"],
  actionUrl: string
): { subject: string; htmlBody: string; textBody: string } {
  let subject: string;
  let headline: string;
  let message: string;
  let ctaText: string;

  switch (notificationType) {
    case "milestone":
      subject = `${goalName} reached ${metadata.milestone}% progress`;
      headline = `Milestone Reached! 🎯`;
      message = `Great news! Your ${typeLabel} "<strong>${goalName}</strong>" has reached <strong>${metadata.milestone}%</strong> progress.`;
      ctaText = "View Progress";
      break;

    case "at_risk":
      subject = `Action needed: ${goalName} is at risk`;
      headline = `Goal At Risk ⚠️`;
      message = `Your ${typeLabel} "<strong>${goalName}</strong>" is falling behind schedule. Consider reviewing your progress and taking corrective action.`;
      ctaText = "Review Goal";
      break;

    case "behind":
      subject = `Urgent: ${goalName} is behind schedule`;
      headline = `Goal Behind Schedule 🔴`;
      message = `Your ${typeLabel} "<strong>${goalName}</strong>" is significantly behind schedule and needs immediate attention.`;
      ctaText = "Take Action";
      break;

    case "completed":
      subject = `Congratulations! ${goalName} is complete`;
      headline = `Goal Completed! 🎉`;
      message = `Congratulations! Your ${typeLabel} "<strong>${goalName}</strong>" has been successfully completed.`;
      ctaText = "View Details";
      break;

    case "deadline_approaching":
      subject = `Reminder: ${goalName} deadline in ${metadata.daysRemaining} days`;
      headline = `Deadline Approaching 📅`;
      message = `Your ${typeLabel} "<strong>${goalName}</strong>" is due in <strong>${metadata.daysRemaining} days</strong>. Make sure you're on track to complete it.`;
      ctaText = "Check Progress";
      break;

    default:
      subject = `Update on ${goalName}`;
      headline = `Goal Update`;
      message = `There's an update on your ${typeLabel} "<strong>${goalName}</strong>".`;
      ctaText = "View Goal";
  }

  const htmlBody = generateHtmlEmail(recipientName, headline, message, ctaText, actionUrl);
  const textBody = generateTextEmail(recipientName, headline, message.replace(/<[^>]+>/g, ""), actionUrl);

  return { subject, htmlBody, textBody };
}

/**
 * Generate HTML email body
 */
function generateHtmlEmail(
  recipientName: string,
  headline: string,
  message: string,
  ctaText: string,
  actionUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scrybe Goal Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 24px 32px;">
              <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo-white.png" alt="Scrybe" style="height: 32px;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #1a1a2e;">${headline}</h1>
              <p style="margin: 0 0 8px 0; font-size: 16px; color: #666;">Hi ${recipientName},</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333; line-height: 1.5;">${message}</p>

              <a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">${ctaText}</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                This is an automated notification from Scrybe.
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications" style="color: #4F46E5;">Manage your notification preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Generate plain text email body
 */
function generateTextEmail(
  recipientName: string,
  headline: string,
  message: string,
  actionUrl: string
): string {
  return `
${headline}

Hi ${recipientName},

${message}

View details: ${actionUrl}

---
This is an automated notification from Scrybe.
Manage your notification preferences: ${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications
`.trim();
}

// ============================================
// BATCH EMAIL HELPERS
// ============================================

/**
 * Send deadline reminder emails in batch
 */
export async function sendDeadlineReminderBatch(
  goals: Array<{
    id: string;
    name: string;
    type: GoalType;
    daysRemaining: number;
    recipients: Array<{ email: string; name: string | null }>;
  }>
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const goal of goals) {
    for (const recipient of goal.recipients) {
      try {
        await sendGoalNotificationEmail({
          to: recipient.email,
          recipientName: recipient.name ?? "there",
          goalName: goal.name,
          goalType: goal.type,
          notificationType: "deadline_approaching",
          metadata: { daysRemaining: goal.daysRemaining },
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/goals/${goal.id}`,
        });
        sent++;
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        failed++;
      }
    }
  }

  return { sent, failed };
}
