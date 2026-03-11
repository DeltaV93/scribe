/**
 * Report Distribution Service
 *
 * Handles email distribution of generated reports.
 *
 * This is currently a stub implementation that logs to console.
 * To enable actual email sending, implement one of:
 * 1. Resend: npm install resend
 * 2. AWS SES: npm install @aws-sdk/client-ses
 * 3. SendGrid, Mailgun, etc.
 */

import { prisma } from "@/lib/db";
import { Report, ReportTemplate } from "@prisma/client";
import { DistributionSettings, EmailRecipient } from "./types";

// ============================================
// EMAIL STUB
// ============================================
// Replace this with actual email sending implementation
// when ready for production.

interface EmailPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

async function sendEmailStub(payload: EmailPayload): Promise<{
  success: boolean;
  error?: string;
}> {
  // Log email details (stub implementation)
  console.log("[EMAIL STUB] Would send report distribution email:", {
    from: payload.from,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject: payload.subject,
    hasAttachments: payload.attachments ? payload.attachments.length : 0,
    timestamp: new Date().toISOString(),
  });

  // Return success for stub
  return { success: true };

  // TODO: Replace with actual email sending implementation
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // const result = await resend.emails.send(payload);
  // if (result.error) return { success: false, error: result.error.message };
  // return { success: true };
}

// ============================================
// EMAIL DISTRIBUTION
// ============================================

export interface DistributeReportInput {
  reportId: string;
  orgId: string;
  settings: DistributionSettings;
  pdfBuffer?: Buffer;
}

export interface DistributionResult {
  success: boolean;
  emailsSent: number;
  errors: string[];
}

/**
 * Distribute a report via email
 */
export async function distributeReport(
  input: DistributeReportInput
): Promise<DistributionResult> {
  const { reportId, orgId, settings, pdfBuffer } = input;

  if (!settings.enabled || settings.recipients.length === 0) {
    return { success: true, emailsSent: 0, errors: [] };
  }

  // Get report details
  const report = await prisma.report.findFirst({
    where: { id: reportId, orgId },
    include: {
      template: true,
      organization: true,
      generatedBy: true,
    },
  });

  if (!report) {
    return { success: false, emailsSent: 0, errors: ["Report not found"] };
  }

  const errors: string[] = [];
  let emailsSent = 0;

  // Group recipients by type
  const toRecipients = settings.recipients.filter((r) => r.type === "to");
  const ccRecipients = settings.recipients.filter((r) => r.type === "cc");
  const bccRecipients = settings.recipients.filter((r) => r.type === "bcc");

  if (toRecipients.length === 0) {
    return {
      success: false,
      emailsSent: 0,
      errors: ["At least one 'to' recipient is required"],
    };
  }

  try {
    // Build email content
    const subject =
      settings.subject ||
      `Report: ${report.template.name} - ${formatDateRange(
        report.reportingPeriodStart,
        report.reportingPeriodEnd
      )}`;

    const htmlContent = buildEmailHtml(report, settings);
    const textContent = buildEmailText(report, settings);

    // Build attachments
    const attachments: Array<{
      filename: string;
      content: Buffer;
    }> = [];

    if (settings.attachPdf && pdfBuffer) {
      attachments.push({
        filename: `${sanitizeFilename(report.template.name)}_${formatDateForFilename(report.reportingPeriodEnd)}.pdf`,
        content: pdfBuffer,
      });
    }

    // Send email using stub (replace with actual implementation)
    const result = await sendEmailStub({
      from: `Scrybe Reports <reports@${process.env.EMAIL_DOMAIN || "scrybe.io"}>`,
      to: toRecipients.map((r) => formatRecipient(r)),
      cc: ccRecipients.length > 0 ? ccRecipients.map((r) => formatRecipient(r)) : undefined,
      bcc: bccRecipients.length > 0 ? bccRecipients.map((r) => formatRecipient(r)) : undefined,
      subject,
      html: htmlContent,
      text: textContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (!result.success) {
      errors.push(`Email send error: ${result.error || "Unknown error"}`);
    } else {
      emailsSent = toRecipients.length + ccRecipients.length + bccRecipients.length;
    }
  } catch (error) {
    errors.push(
      `Distribution error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return {
    success: errors.length === 0,
    emailsSent,
    errors,
  };
}

// ============================================
// EMAIL CONTENT BUILDERS
// ============================================

function buildEmailHtml(
  report: Report & { template: ReportTemplate; organization: { name: string } },
  settings: DistributionSettings
): string {
  const periodRange = formatDateRange(
    report.reportingPeriodStart,
    report.reportingPeriodEnd
  );

  const customMessage = settings.message
    ? `<p style="margin-bottom: 20px;">${escapeHtml(settings.message)}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #4A90D9 0%, #357ABD 100%); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Report Ready</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${escapeHtml(report.template.name)}</p>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
    ${customMessage}

    <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="margin-top: 0; color: #333; font-size: 18px;">Report Details</h2>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Organization</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 500;">${escapeHtml(report.organization.name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Report Type</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 500;">${getReportTypeLabel(report.template.type)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Reporting Period</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 500;">${periodRange}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Generated</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 500;">${formatDate(report.generatedAt || new Date())}</td>
        </tr>
      </table>
    </div>

    ${
      settings.attachPdf
        ? '<p style="color: #666; font-size: 14px;">The full report is attached as a PDF.</p>'
        : ""
    }

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

    <p style="color: #999; font-size: 12px; margin-bottom: 0;">
      This report was generated automatically by Scrybe.
      <br>
      If you have questions about this report, please contact your organization administrator.
    </p>
  </div>
</body>
</html>
  `;
}

function buildEmailText(
  report: Report & { template: ReportTemplate; organization: { name: string } },
  settings: DistributionSettings
): string {
  const periodRange = formatDateRange(
    report.reportingPeriodStart,
    report.reportingPeriodEnd
  );

  let text = `Report Ready: ${report.template.name}\n\n`;

  if (settings.message) {
    text += `${settings.message}\n\n`;
  }

  text += `Report Details:\n`;
  text += `- Organization: ${report.organization.name}\n`;
  text += `- Report Type: ${getReportTypeLabel(report.template.type)}\n`;
  text += `- Reporting Period: ${periodRange}\n`;
  text += `- Generated: ${formatDate(report.generatedAt || new Date())}\n`;

  if (settings.attachPdf) {
    text += `\nThe full report is attached as a PDF.\n`;
  }

  text += `\n---\nThis report was generated automatically by Scrybe.\n`;

  return text;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatRecipient(recipient: EmailRecipient): string {
  if (recipient.name) {
    return `${recipient.name} <${recipient.email}>`;
  }
  return recipient.email;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateRange(start: Date, end: Date): string {
  const startStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(start);

  const endStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(end);

  return `${startStr} - ${endStr}`;
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getReportTypeLabel(reportType: string): string {
  const labels: Record<string, string> = {
    HUD_APR: "HUD Annual Performance Report",
    DOL_WORKFORCE: "DOL Workforce Performance Report",
    CALI_GRANTS: "California Grant Report",
    BOARD_REPORT: "Board Report",
    IMPACT_REPORT: "Impact Report",
    CUSTOM: "Custom Report",
  };
  return labels[reportType] || reportType;
}

// ============================================
// RECIPIENT VALIDATION
// ============================================

/**
 * Validate email recipients
 */
export function validateRecipients(
  recipients: EmailRecipient[]
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const recipient of recipients) {
    if (!emailRegex.test(recipient.email)) {
      errors.push(`Invalid email address: ${recipient.email}`);
    }
  }

  const hasToRecipient = recipients.some((r) => r.type === "to");
  if (!hasToRecipient && recipients.length > 0) {
    errors.push("At least one recipient must be in the 'to' field");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get suggested recipients based on organization users
 */
export async function getSuggestedRecipients(
  orgId: string
): Promise<EmailRecipient[]> {
  const users = await prisma.user.findMany({
    where: {
      orgId,
      isActive: true,
      role: { in: ["ADMIN", "PROGRAM_MANAGER"] },
    },
    select: {
      email: true,
      name: true,
    },
    take: 10,
  });

  return users.map((user) => ({
    email: user.email,
    name: user.name || undefined,
    type: "to" as const,
  }));
}
