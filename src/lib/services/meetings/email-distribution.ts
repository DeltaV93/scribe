/**
 * Meeting Email Distribution Service
 *
 * Sends meeting summaries to participants via email.
 */

import { prisma } from "@/lib/db";
import {
  SummaryEmailData,
  EmailRecipient,
  KeyPoint,
  Decision,
  ExtractedActionItem,
  ExtractedQuestion,
} from "./types";

// ============================================
// EMAIL SENDING
// ============================================

/**
 * Send meeting summary email to recipients
 */
export async function sendSummaryEmail(
  meetingId: string,
  recipients: EmailRecipient[],
  customMessage?: string
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      summary: true,
      actionItems: true,
      questions: true,
      organization: true,
    },
  });

  if (!meeting) {
    return { success: false, sentCount: 0, errors: ["Meeting not found"] };
  }

  if (!meeting.summary) {
    return { success: false, sentCount: 0, errors: ["Meeting has no summary"] };
  }

  // Build email data
  const emailData: SummaryEmailData = {
    meetingTitle: meeting.title,
    meetingDate: meeting.actualStartAt
      ? meeting.actualStartAt.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : meeting.scheduledStartAt?.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }) || "Unknown date",
    duration: meeting.durationSeconds
      ? formatDuration(meeting.durationSeconds)
      : "Unknown",
    participantCount: meeting.participantCount || 0,
    executiveSummary: meeting.summary.executiveSummary,
    keyPoints: (meeting.summary.keyPoints as unknown as KeyPoint[]) || [],
    decisions: (meeting.summary.decisions as unknown as Decision[]) || [],
    actionItems: meeting.actionItems.map((item) => ({
      description: item.description,
      assigneeName: item.assigneeName || undefined,
      dueDate: item.dueDate?.toISOString().split("T")[0],
    })),
    questions: meeting.questions.map((q) => ({
      question: q.question,
      askedByName: q.askedByName || undefined,
      isAnswered: q.isAnswered,
      answer: q.answer || undefined,
      answeredByName: q.answeredByName || undefined,
    })),
    meetingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.scrybe.io"}/meetings/${meeting.id}`,
  };

  // Generate email HTML
  const html = generateSummaryEmailHtml(emailData, customMessage);
  const text = generateSummaryEmailText(emailData, customMessage);
  const subject = `Meeting Summary: ${meeting.title}`;

  // Send emails
  const errors: string[] = [];
  let sentCount = 0;

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
      });
      sentCount++;
    } catch (error) {
      errors.push(`Failed to send to ${recipient.email}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Update meeting with sent info
  if (sentCount > 0) {
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        summaryEmailSentAt: new Date(),
        emailRecipients: recipients.map((r) => r.email),
      },
    });
  }

  return {
    success: errors.length === 0,
    sentCount,
    errors,
  };
}

// ============================================
// EMAIL SENDING (PROVIDER ABSTRACTION)
// ============================================

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send email using configured provider (SendGrid, SES, etc.)
 */
async function sendEmail(params: SendEmailParams): Promise<void> {
  const { to, subject, html, text } = params;

  // Check for SendGrid
  if (process.env.SENDGRID_API_KEY) {
    await sendWithSendGrid(to, subject, html, text);
    return;
  }

  // Check for AWS SES
  if (process.env.AWS_SES_REGION) {
    await sendWithSES(to, subject, html, text);
    return;
  }

  // Fallback: log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("=== EMAIL (DEV MODE) ===");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text.slice(0, 500)}...`);
    console.log("========================");
    return;
  }

  throw new Error("No email provider configured. Set SENDGRID_API_KEY or AWS_SES_REGION.");
}

/**
 * Send email via SendGrid
 */
async function sendWithSendGrid(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "meetings@scrybe.io";

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: "Scrybe Meetings" },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid error: ${response.status} - ${error}`);
  }
}

/**
 * Send email via AWS SES
 * Note: Requires @aws-sdk/client-ses to be installed: npm install @aws-sdk/client-ses
 */
async function sendWithSES(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  // Dynamic require to avoid loading AWS SDK if not needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
  let ses: any;

  try {
    // Use require for optional dependency to avoid TypeScript module resolution
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ses = require("@aws-sdk/client-ses");
  } catch {
    throw new Error(
      "AWS SES SDK not installed. Run: npm install @aws-sdk/client-ses"
    );
  }

  const { SESClient, SendEmailCommand } = ses;
  const client = new SESClient({ region: process.env.AWS_SES_REGION });
  const fromEmail = process.env.AWS_SES_FROM_EMAIL || "meetings@scrybe.io";

  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Text: { Data: text },
        Html: { Data: html },
      },
    },
  });

  await client.send(command);
}

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Generate HTML email content
 */
function generateSummaryEmailHtml(
  data: SummaryEmailData,
  customMessage?: string
): string {
  const actionItemsHtml = data.actionItems.length > 0
    ? `
      <h3 style="color: #1a1a1a; margin-top: 24px;">Action Items</h3>
      <ul style="padding-left: 20px;">
        ${data.actionItems.map((item) => `
          <li style="margin-bottom: 8px;">
            <strong>${escapeHtml(item.description)}</strong>
            ${item.assigneeName ? `<br/><span style="color: #666;">Assigned to: ${escapeHtml(item.assigneeName)}</span>` : ""}
            ${item.dueDate ? `<br/><span style="color: #666;">Due: ${item.dueDate}</span>` : ""}
          </li>
        `).join("")}
      </ul>
    `
    : "";

  const decisionsHtml = data.decisions.length > 0
    ? `
      <h3 style="color: #1a1a1a; margin-top: 24px;">Decisions Made</h3>
      <ul style="padding-left: 20px;">
        ${data.decisions.map((d) => `
          <li style="margin-bottom: 8px;">${escapeHtml(d.decision)}</li>
        `).join("")}
      </ul>
    `
    : "";

  const keyPointsHtml = data.keyPoints.length > 0
    ? `
      <h3 style="color: #1a1a1a; margin-top: 24px;">Key Points</h3>
      <ul style="padding-left: 20px;">
        ${data.keyPoints.slice(0, 10).map((p) => `
          <li style="margin-bottom: 8px;">${escapeHtml(p.point)}</li>
        `).join("")}
      </ul>
    `
    : "";

  const unansweredQuestionsHtml = data.questions.filter((q) => !q.isAnswered).length > 0
    ? `
      <h3 style="color: #1a1a1a; margin-top: 24px;">Follow-up Needed</h3>
      <ul style="padding-left: 20px;">
        ${data.questions.filter((q) => !q.isAnswered).map((q) => `
          <li style="margin-bottom: 8px;">
            <em>${escapeHtml(q.question)}</em>
            ${q.askedByName ? `<br/><span style="color: #666;">Asked by: ${escapeHtml(q.askedByName)}</span>` : ""}
          </li>
        `).join("")}
      </ul>
    `
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="color: #1a1a1a; margin: 0 0 8px 0; font-size: 24px;">${escapeHtml(data.meetingTitle)}</h1>
    <p style="color: #666; margin: 0;">
      ${escapeHtml(data.meetingDate)} &bull; ${data.duration} &bull; ${data.participantCount} participants
    </p>
  </div>

  ${customMessage ? `<p style="background: #e8f4fd; padding: 12px; border-radius: 4px; margin-bottom: 24px;">${escapeHtml(customMessage)}</p>` : ""}

  <h2 style="color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 8px;">Summary</h2>
  <p style="white-space: pre-line;">${escapeHtml(data.executiveSummary)}</p>

  ${actionItemsHtml}
  ${decisionsHtml}
  ${keyPointsHtml}
  ${unansweredQuestionsHtml}

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; text-align: center;">
    <a href="${data.meetingUrl}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
      View Full Meeting Details
    </a>
    <p style="color: #999; font-size: 12px; margin-top: 16px;">
      This summary was automatically generated by Scrybe Meeting Intelligence.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email content
 */
function generateSummaryEmailText(
  data: SummaryEmailData,
  customMessage?: string
): string {
  let text = `MEETING SUMMARY: ${data.meetingTitle}
${data.meetingDate} | ${data.duration} | ${data.participantCount} participants

${customMessage ? `Note: ${customMessage}\n\n` : ""}
SUMMARY
-------
${data.executiveSummary}
`;

  if (data.actionItems.length > 0) {
    text += `\nACTION ITEMS\n------------\n`;
    data.actionItems.forEach((item, i) => {
      text += `${i + 1}. ${item.description}`;
      if (item.assigneeName) text += ` (Assigned: ${item.assigneeName})`;
      if (item.dueDate) text += ` [Due: ${item.dueDate}]`;
      text += "\n";
    });
  }

  if (data.decisions.length > 0) {
    text += `\nDECISIONS MADE\n--------------\n`;
    data.decisions.forEach((d, i) => {
      text += `${i + 1}. ${d.decision}\n`;
    });
  }

  if (data.keyPoints.length > 0) {
    text += `\nKEY POINTS\n----------\n`;
    data.keyPoints.slice(0, 10).forEach((p, i) => {
      text += `${i + 1}. ${p.point}\n`;
    });
  }

  const unanswered = data.questions.filter((q) => !q.isAnswered);
  if (unanswered.length > 0) {
    text += `\nFOLLOW-UP NEEDED\n----------------\n`;
    unanswered.forEach((q, i) => {
      text += `${i + 1}. ${q.question}`;
      if (q.askedByName) text += ` (Asked by: ${q.askedByName})`;
      text += "\n";
    });
  }

  text += `\n\nView full meeting details: ${data.meetingUrl}\n`;
  text += `\nThis summary was automatically generated by Scrybe Meeting Intelligence.`;

  return text;
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} minutes`;
}
