/**
 * Email Service
 *
 * AWS SES integration for sending transactional emails
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// ============================================
// CLIENT INITIALIZATION
// ============================================

let sesClient: SESClient | null = null;

function getSESClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.AWS_SES_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SES_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return sesClient;
}

// ============================================
// TYPES
// ============================================

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  from?: string;
}

export interface SendEmailResult {
  messageId: string;
  success: boolean;
}

// ============================================
// EMAIL SENDING
// ============================================

/**
 * Send an email via AWS SES
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = input.from || process.env.EMAIL_FROM || "notifications@scribe.app";
  const toAddresses = Array.isArray(input.to) ? input.to : [input.to];

  // In development, log instead of sending
  if (process.env.NODE_ENV === "development" && !process.env.FORCE_EMAIL_SEND) {
    console.log("[EMAIL] Would send email:", {
      from,
      to: toAddresses,
      subject: input.subject,
    });
    return {
      messageId: `dev-${Date.now()}`,
      success: true,
    };
  }

  try {
    const client = getSESClient();

    const command = new SendEmailCommand({
      Source: from,
      Destination: {
        ToAddresses: toAddresses,
      },
      Message: {
        Subject: {
          Data: input.subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: input.htmlBody,
            Charset: "UTF-8",
          },
          ...(input.textBody && {
            Text: {
              Data: input.textBody,
              Charset: "UTF-8",
            },
          }),
        },
      },
      ...(input.replyTo && {
        ReplyToAddresses: [input.replyTo],
      }),
    });

    const response = await client.send(command);

    console.log(`[EMAIL] Sent to ${toAddresses.join(", ")}: ${input.subject}`);

    return {
      messageId: response.MessageId || "",
      success: true,
    };
  } catch (error) {
    console.error("[EMAIL] Failed to send:", error);
    throw error;
  }
}

/**
 * Send email to multiple recipients (batch)
 */
export async function sendBulkEmail(
  emails: SendEmailInput[]
): Promise<{ sent: number; failed: number; results: SendEmailResult[] }> {
  const results: SendEmailResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      const result = await sendEmail(email);
      results.push(result);
      sent++;
    } catch (error) {
      results.push({ messageId: "", success: false });
      failed++;
    }
  }

  return { sent, failed, results };
}

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Generate a basic email wrapper
 */
export function wrapEmailContent(content: string, options?: { title?: string }): string {
  const title = options?.title || "Scrybe Notification";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.scribe.app";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 24px 32px;">
              <img src="${appUrl}/logo-white.png" alt="Scrybe" style="height: 32px;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                This is an automated notification from Scrybe.
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

// ============================================
// VALIDATION
// ============================================

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if SES is properly configured
 */
export function isEmailConfigured(): boolean {
  return !!(
    (process.env.AWS_SES_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID) &&
    (process.env.AWS_SES_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY)
  );
}
