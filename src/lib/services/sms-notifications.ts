import { prisma } from "@/lib/db";
import { getTwilioClient } from "@/lib/twilio/client";
import { SmsDeliveryStatus } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface SendSmsResult {
  success: boolean;
  twilioSid?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SmsPreferenceInput {
  optedIn: boolean;
  phoneNumber: string;
  optInMethod: "portal" | "verbal" | "written";
}

// ============================================
// CONFIGURATION
// ============================================

// Default SMS template - no PHI, just a notification
const DEFAULT_SMS_TEMPLATE = `You have a new message from your case manager. View it securely here: {{portal_link}}`;

/**
 * Get the portal base URL from environment
 */
function getPortalBaseUrl(): string {
  return process.env.PORTAL_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Get the Twilio phone number for sending SMS
 */
function getTwilioPhoneNumber(): string {
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!phoneNumber) {
    throw new Error("TWILIO_PHONE_NUMBER not configured");
  }
  return phoneNumber;
}

// ============================================
// SMS SENDING
// ============================================

/**
 * Send SMS notification to client about a new message
 * The SMS contains only a generic notification and portal link (no PHI)
 */
export async function sendSmsNotification(
  messageId: string,
  clientId: string,
  portalToken: string
): Promise<SendSmsResult> {
  // Get client's SMS preference
  const smsPreference = await prisma.smsPreference.findUnique({
    where: { clientId },
  });

  if (!smsPreference || !smsPreference.optedIn) {
    return {
      success: false,
      errorCode: "NOT_OPTED_IN",
      errorMessage: "Client has not opted in to SMS notifications",
    };
  }

  // Get org's SMS template or use default
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      organization: {
        include: {
          smsTemplates: {
            where: { isDefault: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!message) {
    return {
      success: false,
      errorCode: "MESSAGE_NOT_FOUND",
      errorMessage: "Message not found",
    };
  }

  // Build portal link
  const portalLink = `${getPortalBaseUrl()}/portal/m/${portalToken}`;

  // Get template content
  const templateContent =
    message.organization.smsTemplates[0]?.content || DEFAULT_SMS_TEMPLATE;

  // Replace placeholders
  const smsBody = templateContent.replace("{{portal_link}}", portalLink);

  // Create SMS notification record
  const smsNotification = await prisma.smsNotification.create({
    data: {
      messageId,
      phoneNumber: smsPreference.phoneNumber,
      deliveryStatus: SmsDeliveryStatus.QUEUED,
    },
  });

  try {
    // Send via Twilio
    const twilioClient = getTwilioClient();
    const twilioMessage = await twilioClient.messages.create({
      body: smsBody,
      from: getTwilioPhoneNumber(),
      to: smsPreference.phoneNumber,
      statusCallback: `${getPortalBaseUrl()}/api/webhooks/twilio/sms-status`,
    });

    // Update notification with Twilio SID
    await prisma.smsNotification.update({
      where: { id: smsNotification.id },
      data: {
        twilioSid: twilioMessage.sid,
        deliveryStatus: SmsDeliveryStatus.SENT,
        sentAt: new Date(),
      },
    });

    return {
      success: true,
      twilioSid: twilioMessage.sid,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update notification with error
    await prisma.smsNotification.update({
      where: { id: smsNotification.id },
      data: {
        deliveryStatus: SmsDeliveryStatus.FAILED,
        errorMessage,
      },
    });

    return {
      success: false,
      errorCode: "TWILIO_ERROR",
      errorMessage,
    };
  }
}

// ============================================
// WEBHOOK HANDLING
// ============================================

/**
 * Handle Twilio SMS status webhook callback
 */
export async function handleSmsStatusWebhook(
  twilioSid: string,
  status: string,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  // Map Twilio status to our enum
  let deliveryStatus: SmsDeliveryStatus;
  switch (status.toLowerCase()) {
    case "queued":
      deliveryStatus = SmsDeliveryStatus.QUEUED;
      break;
    case "sent":
      deliveryStatus = SmsDeliveryStatus.SENT;
      break;
    case "delivered":
      deliveryStatus = SmsDeliveryStatus.DELIVERED;
      break;
    case "undelivered":
      deliveryStatus = SmsDeliveryStatus.UNDELIVERED;
      break;
    case "failed":
      deliveryStatus = SmsDeliveryStatus.FAILED;
      break;
    default:
      deliveryStatus = SmsDeliveryStatus.SENT;
  }

  // Find and update the notification
  const notification = await prisma.smsNotification.findUnique({
    where: { twilioSid },
    include: { message: true },
  });

  if (!notification) {
    console.error(`SMS notification not found for Twilio SID: ${twilioSid}`);
    return;
  }

  // Update notification status
  await prisma.smsNotification.update({
    where: { twilioSid },
    data: {
      deliveryStatus,
      deliveredAt: deliveryStatus === SmsDeliveryStatus.DELIVERED ? new Date() : undefined,
      errorCode: errorCode || undefined,
      errorMessage: errorMessage || undefined,
    },
  });

  // If delivered, update the parent message status too
  if (deliveryStatus === SmsDeliveryStatus.DELIVERED) {
    await prisma.message.update({
      where: { id: notification.messageId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });
  }
}

// ============================================
// SMS PREFERENCE MANAGEMENT
// ============================================

/**
 * Get client's SMS preference
 */
export async function getClientSmsPreference(
  clientId: string
): Promise<{
  optedIn: boolean;
  phoneNumber: string | null;
  optInMethod: string | null;
  optedInAt: Date | null;
} | null> {
  const preference = await prisma.smsPreference.findUnique({
    where: { clientId },
    select: {
      optedIn: true,
      phoneNumber: true,
      optInMethod: true,
      optedInAt: true,
    },
  });

  return preference;
}

/**
 * Update or create client's SMS preference
 */
export async function updateSmsPreference(
  clientId: string,
  input: SmsPreferenceInput
): Promise<void> {
  const { optedIn, phoneNumber, optInMethod } = input;

  await prisma.smsPreference.upsert({
    where: { clientId },
    create: {
      clientId,
      optedIn,
      phoneNumber,
      optInMethod,
      optedInAt: optedIn ? new Date() : null,
    },
    update: {
      optedIn,
      phoneNumber,
      optInMethod,
      optedInAt: optedIn ? new Date() : undefined,
      optedOutAt: !optedIn ? new Date() : undefined,
    },
  });
}

/**
 * Check if SMS can be sent to a client
 */
export async function canSendSms(clientId: string): Promise<{
  canSend: boolean;
  reason?: string;
}> {
  const preference = await prisma.smsPreference.findUnique({
    where: { clientId },
  });

  if (!preference) {
    return {
      canSend: false,
      reason: "Client has no SMS preference set",
    };
  }

  if (!preference.optedIn) {
    return {
      canSend: false,
      reason: "Client has opted out of SMS notifications",
    };
  }

  if (!preference.phoneNumber) {
    return {
      canSend: false,
      reason: "No phone number on file",
    };
  }

  return { canSend: true };
}

// ============================================
// SMS TEMPLATE MANAGEMENT (P1 - Admin)
// ============================================

/**
 * Get organization's SMS templates
 */
export async function getOrgSmsTemplates(orgId: string) {
  return prisma.smsTemplate.findMany({
    where: { orgId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

/**
 * Create a new SMS template
 */
export async function createSmsTemplate(
  orgId: string,
  name: string,
  content: string,
  isDefault: boolean = false
): Promise<void> {
  // If setting as default, unset other defaults first
  if (isDefault) {
    await prisma.smsTemplate.updateMany({
      where: { orgId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.smsTemplate.create({
    data: {
      orgId,
      name,
      content,
      isDefault,
    },
  });
}

/**
 * Update an SMS template
 */
export async function updateSmsTemplate(
  templateId: string,
  orgId: string,
  updates: { name?: string; content?: string; isDefault?: boolean }
): Promise<void> {
  // If setting as default, unset other defaults first
  if (updates.isDefault) {
    await prisma.smsTemplate.updateMany({
      where: { orgId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.smsTemplate.update({
    where: { id: templateId, orgId },
    data: updates,
  });
}

/**
 * Delete an SMS template
 */
export async function deleteSmsTemplate(
  templateId: string,
  orgId: string
): Promise<void> {
  await prisma.smsTemplate.delete({
    where: { id: templateId, orgId },
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format phone number to E.164 format
 */
export function formatPhoneToE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // If already has country code, just add +
  if (digits.length > 10) {
    return `+${digits}`;
  }

  // Return as-is if unclear
  return phone;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{10,14}$/;
  return e164Regex.test(formatPhoneToE164(phone));
}
