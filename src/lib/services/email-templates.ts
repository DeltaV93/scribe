// ============================================
// Email Templates (PX-705)
// ============================================
// Standard templates for email notifications
// Templates use org logo from branding settings
// Simple HTML rendering with consistent styling

export type EmailTemplateId =
  | "client_message"
  | "appointment_reminder"
  | "document_request"
  | "intake_confirmation"
  | "portal_notification";

interface BaseTemplateData {
  orgName: string;
  logoUrl?: string;
}

interface ClientMessageData extends BaseTemplateData {
  caseManagerName: string;
  messageContent: string;
  portalUrl: string;
}

interface AppointmentReminderData extends BaseTemplateData {
  clientName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation?: string;
  caseManagerName: string;
  caseManagerPhone?: string;
  notes?: string;
}

interface DocumentRequestData extends BaseTemplateData {
  clientName: string;
  documentType: string;
  dueDate?: string;
  instructions?: string;
  uploadUrl: string;
  caseManagerName: string;
}

interface IntakeConfirmationData extends BaseTemplateData {
  clientName: string;
  intakeDate: string;
  nextSteps: string[];
  caseManagerName: string;
  caseManagerEmail: string;
  caseManagerPhone?: string;
}

interface PortalNotificationData extends BaseTemplateData {
  clientName: string;
  notificationType: "new_message" | "document_ready" | "action_required";
  previewText?: string;
  portalUrl: string;
}

type TemplateData =
  | ClientMessageData
  | AppointmentReminderData
  | DocumentRequestData
  | IntakeConfirmationData
  | PortalNotificationData;

// ============================================
// BASE STYLES
// ============================================

const BASE_STYLES = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    color: #333;
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }
  .email-wrapper {
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  .header {
    background-color: #4F46E5;
    padding: 24px;
    text-align: center;
  }
  .header img {
    max-height: 48px;
    max-width: 200px;
  }
  .header h1 {
    color: #ffffff;
    margin: 12px 0 0 0;
    font-size: 20px;
    font-weight: 600;
  }
  .content {
    padding: 32px 24px;
  }
  .content h2 {
    color: #1f2937;
    margin: 0 0 16px 0;
    font-size: 18px;
  }
  .content p {
    color: #4b5563;
    margin: 0 0 16px 0;
  }
  .message-box {
    background-color: #f9fafb;
    border-left: 4px solid #4F46E5;
    padding: 16px;
    margin: 24px 0;
    border-radius: 0 4px 4px 0;
  }
  .message-box p {
    margin: 0;
    white-space: pre-wrap;
  }
  .button {
    display: inline-block;
    background-color: #4F46E5;
    color: #ffffff !important;
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-weight: 500;
    margin: 16px 0;
  }
  .button:hover {
    background-color: #4338CA;
  }
  .details {
    background-color: #f9fafb;
    padding: 16px;
    border-radius: 6px;
    margin: 16px 0;
  }
  .details-row {
    display: flex;
    margin-bottom: 8px;
  }
  .details-label {
    font-weight: 600;
    color: #374151;
    width: 120px;
    flex-shrink: 0;
  }
  .details-value {
    color: #4b5563;
  }
  .list {
    margin: 16px 0;
    padding-left: 20px;
  }
  .list li {
    color: #4b5563;
    margin-bottom: 8px;
  }
  .footer {
    background-color: #f9fafb;
    padding: 24px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
  }
  .footer p {
    color: #6b7280;
    font-size: 14px;
    margin: 0 0 8px 0;
  }
  .footer a {
    color: #4F46E5;
    text-decoration: none;
  }
  .signature {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
  }
  .signature p {
    margin: 4px 0;
  }
`;

// ============================================
// TEMPLATE WRAPPER
// ============================================

function wrapTemplate(content: string, logoUrl?: string, orgName?: string): string {
  const headerContent = logoUrl
    ? `<img src="${logoUrl}" alt="${orgName || 'Organization'} Logo" />`
    : orgName
      ? `<h1>${orgName}</h1>`
      : `<h1>Scrybe</h1>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="email-wrapper">
      <div class="header">
        ${headerContent}
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>This email was sent by ${orgName || "Scrybe"}</p>
        <p>Powered by <a href="https://scrybe.app">Scrybe</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

// ============================================
// TEMPLATE RENDERERS
// ============================================

function renderClientMessage(data: ClientMessageData): string {
  const content = `
    <p>Hello,</p>
    <p>You have a new message from ${data.caseManagerName}:</p>
    <div class="message-box">
      <p>${escapeHtml(data.messageContent)}</p>
    </div>
    <p>To reply to this message or view your full conversation, please visit your portal:</p>
    <p style="text-align: center;">
      <a href="${data.portalUrl}" class="button">View in Portal</a>
    </p>
    <p style="color: #6b7280; font-size: 14px;">
      You can also reply directly to this email and your case manager will receive your response.
    </p>
    <div class="signature">
      <p>Best regards,</p>
      <p><strong>${data.caseManagerName}</strong></p>
      <p>${data.orgName}</p>
    </div>
  `;

  return wrapTemplate(content, data.logoUrl, data.orgName);
}

function renderAppointmentReminder(data: AppointmentReminderData): string {
  const locationRow = data.appointmentLocation
    ? `<div class="details-row">
         <span class="details-label">Location:</span>
         <span class="details-value">${escapeHtml(data.appointmentLocation)}</span>
       </div>`
    : "";

  const phoneInfo = data.caseManagerPhone
    ? ` or call ${data.caseManagerPhone}`
    : "";

  const content = `
    <p>Hello ${data.clientName},</p>
    <p>This is a friendly reminder about your upcoming appointment:</p>
    <div class="details">
      <div class="details-row">
        <span class="details-label">Date:</span>
        <span class="details-value">${escapeHtml(data.appointmentDate)}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Time:</span>
        <span class="details-value">${escapeHtml(data.appointmentTime)}</span>
      </div>
      ${locationRow}
      <div class="details-row">
        <span class="details-label">With:</span>
        <span class="details-value">${escapeHtml(data.caseManagerName)}</span>
      </div>
    </div>
    ${data.notes ? `<p><strong>Notes:</strong> ${escapeHtml(data.notes)}</p>` : ""}
    <p>If you need to reschedule, please contact us as soon as possible${phoneInfo}.</p>
    <div class="signature">
      <p>See you soon,</p>
      <p><strong>${data.caseManagerName}</strong></p>
      <p>${data.orgName}</p>
    </div>
  `;

  return wrapTemplate(content, data.logoUrl, data.orgName);
}

function renderDocumentRequest(data: DocumentRequestData): string {
  const dueDateInfo = data.dueDate
    ? `<p><strong>Please submit by:</strong> ${escapeHtml(data.dueDate)}</p>`
    : "";

  const content = `
    <p>Hello ${data.clientName},</p>
    <p>We need the following document from you:</p>
    <div class="message-box">
      <p><strong>${escapeHtml(data.documentType)}</strong></p>
      ${data.instructions ? `<p style="margin-top: 8px;">${escapeHtml(data.instructions)}</p>` : ""}
    </div>
    ${dueDateInfo}
    <p>You can securely upload your document using the button below:</p>
    <p style="text-align: center;">
      <a href="${data.uploadUrl}" class="button">Upload Document</a>
    </p>
    <p style="color: #6b7280; font-size: 14px;">
      If you have any questions or need assistance, please don't hesitate to reach out.
    </p>
    <div class="signature">
      <p>Thank you,</p>
      <p><strong>${data.caseManagerName}</strong></p>
      <p>${data.orgName}</p>
    </div>
  `;

  return wrapTemplate(content, data.logoUrl, data.orgName);
}

function renderIntakeConfirmation(data: IntakeConfirmationData): string {
  const nextStepsList = data.nextSteps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  const phoneInfo = data.caseManagerPhone
    ? `<p>Phone: ${data.caseManagerPhone}</p>`
    : "";

  const content = `
    <h2>Welcome, ${data.clientName}!</h2>
    <p>Thank you for completing your intake on ${data.intakeDate}. We're excited to work with you!</p>
    <p><strong>What happens next:</strong></p>
    <ul class="list">
      ${nextStepsList}
    </ul>
    <p>Your case manager, ${data.caseManagerName}, will be your primary point of contact. Feel free to reach out with any questions:</p>
    <div class="details">
      <p><strong>${data.caseManagerName}</strong></p>
      <p>Email: <a href="mailto:${data.caseManagerEmail}">${data.caseManagerEmail}</a></p>
      ${phoneInfo}
    </div>
    <div class="signature">
      <p>Welcome aboard,</p>
      <p><strong>The ${data.orgName} Team</strong></p>
    </div>
  `;

  return wrapTemplate(content, data.logoUrl, data.orgName);
}

function renderPortalNotification(data: PortalNotificationData): string {
  let title: string;
  let description: string;

  switch (data.notificationType) {
    case "new_message":
      title = "You have a new message";
      description = "Your case manager has sent you a new message.";
      break;
    case "document_ready":
      title = "Document ready for review";
      description = "A document is ready for you to review in your portal.";
      break;
    case "action_required":
      title = "Action required";
      description = "There's an item in your portal that needs your attention.";
      break;
    default:
      title = "Portal notification";
      description = "You have a new notification in your portal.";
  }

  const previewSection = data.previewText
    ? `<div class="message-box"><p>${escapeHtml(data.previewText)}</p></div>`
    : "";

  const content = `
    <p>Hello ${data.clientName},</p>
    <h2>${title}</h2>
    <p>${description}</p>
    ${previewSection}
    <p style="text-align: center;">
      <a href="${data.portalUrl}" class="button">Open Portal</a>
    </p>
    <div class="signature">
      <p>Best regards,</p>
      <p><strong>${data.orgName}</strong></p>
    </div>
  `;

  return wrapTemplate(content, data.logoUrl, data.orgName);
}

// ============================================
// MAIN RENDER FUNCTION
// ============================================

export function renderEmailTemplate(
  templateId: EmailTemplateId,
  data: Record<string, unknown>
): string {
  switch (templateId) {
    case "client_message":
      return renderClientMessage(data as unknown as ClientMessageData);
    case "appointment_reminder":
      return renderAppointmentReminder(data as unknown as AppointmentReminderData);
    case "document_request":
      return renderDocumentRequest(data as unknown as DocumentRequestData);
    case "intake_confirmation":
      return renderIntakeConfirmation(data as unknown as IntakeConfirmationData);
    case "portal_notification":
      return renderPortalNotification(data as unknown as PortalNotificationData);
    default:
      throw new Error(`Unknown email template: ${templateId}`);
  }
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
