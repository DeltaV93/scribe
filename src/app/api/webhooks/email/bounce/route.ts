import { NextRequest, NextResponse } from "next/server";
import { handleBounce, handleDelivery, BounceNotification } from "@/lib/services/email";

// ============================================
// EMAIL BOUNCE WEBHOOK (PX-705)
// ============================================
// Handles AWS SES bounce and delivery notifications
// Retry 3x with backoff, then mark email invalid
// Alert case manager when email fails permanently
// Mark client.emailBounced = true on permanent bounce

/**
 * POST /api/webhooks/email/bounce
 *
 * Receives bounce/delivery notifications from AWS SES via SNS
 * SNS notification types:
 * - SubscriptionConfirmation: Initial subscription setup
 * - Notification: Actual bounce/delivery/complaint notification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle SNS subscription confirmation
    if (body.Type === "SubscriptionConfirmation") {
      console.log("[EMAIL BOUNCE] SNS subscription confirmation received");

      // In production, you would confirm the subscription by calling the SubscribeURL
      // For now, log it and return success
      if (body.SubscribeURL) {
        console.log("[EMAIL BOUNCE] SubscribeURL:", body.SubscribeURL);
        // Optional: Auto-confirm subscription
        // await fetch(body.SubscribeURL);
      }

      return NextResponse.json({
        success: true,
        message: "Subscription confirmation received",
      });
    }

    // Handle actual notifications
    if (body.Type !== "Notification") {
      console.warn("[EMAIL BOUNCE] Unknown notification type:", body.Type);
      return NextResponse.json({ success: true });
    }

    // Parse the message content
    let message: SESNotificationMessage;
    try {
      message = JSON.parse(body.Message);
    } catch (parseError) {
      console.error("[EMAIL BOUNCE] Failed to parse message:", parseError);
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    const notificationType = message.notificationType;

    switch (notificationType) {
      case "Bounce":
        await handleBounceNotification(message);
        break;

      case "Delivery":
        await handleDeliveryNotification(message);
        break;

      case "Complaint":
        await handleComplaintNotification(message);
        break;

      default:
        console.log("[EMAIL BOUNCE] Unknown notification type:", notificationType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[EMAIL BOUNCE] Error processing notification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================
// NOTIFICATION HANDLERS
// ============================================

interface SESNotificationMessage {
  notificationType: "Bounce" | "Delivery" | "Complaint";
  mail: {
    messageId: string;
    source: string;
    destination: string[];
    timestamp: string;
    commonHeaders?: {
      subject?: string;
      to?: string[];
      from?: string[];
    };
  };
  bounce?: {
    bounceType: "Permanent" | "Transient";
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      action?: string;
      status?: string;
      diagnosticCode?: string;
    }>;
    timestamp: string;
  };
  delivery?: {
    timestamp: string;
    processingTimeMillis: number;
    recipients: string[];
    smtpResponse: string;
    reportingMTA: string;
  };
  complaint?: {
    complainedRecipients: Array<{
      emailAddress: string;
    }>;
    timestamp: string;
    complaintFeedbackType?: string;
  };
}

/**
 * Handle bounce notification
 */
async function handleBounceNotification(message: SESNotificationMessage): Promise<void> {
  const { mail, bounce } = message;

  if (!bounce) {
    console.warn("[EMAIL BOUNCE] Bounce notification without bounce data");
    return;
  }

  console.log("[EMAIL BOUNCE] Processing bounce", {
    messageId: mail.messageId,
    bounceType: bounce.bounceType,
    bounceSubType: bounce.bounceSubType,
    recipients: bounce.bouncedRecipients.map((r) => r.emailAddress),
  });

  const notification: BounceNotification = {
    sesMessageId: mail.messageId,
    bounceType: bounce.bounceType,
    bounceSubType: bounce.bounceSubType,
    bouncedRecipients: bounce.bouncedRecipients,
    timestamp: bounce.timestamp,
  };

  await handleBounce(notification);
}

/**
 * Handle delivery confirmation
 */
async function handleDeliveryNotification(message: SESNotificationMessage): Promise<void> {
  const { mail, delivery } = message;

  if (!delivery) {
    console.warn("[EMAIL BOUNCE] Delivery notification without delivery data");
    return;
  }

  console.log("[EMAIL BOUNCE] Processing delivery confirmation", {
    messageId: mail.messageId,
    recipients: delivery.recipients,
    processingTime: delivery.processingTimeMillis,
  });

  await handleDelivery(mail.messageId);
}

/**
 * Handle complaint notification (user marked email as spam)
 */
async function handleComplaintNotification(message: SESNotificationMessage): Promise<void> {
  const { mail, complaint } = message;

  if (!complaint) {
    console.warn("[EMAIL BOUNCE] Complaint notification without complaint data");
    return;
  }

  console.log("[EMAIL BOUNCE] Processing complaint", {
    messageId: mail.messageId,
    recipients: complaint.complainedRecipients.map((r) => r.emailAddress),
    feedbackType: complaint.complaintFeedbackType,
  });

  // Treat complaints as permanent bounces to stop sending to these addresses
  const notification: BounceNotification = {
    sesMessageId: mail.messageId,
    bounceType: "Permanent",
    bounceSubType: complaint.complaintFeedbackType || "abuse",
    bouncedRecipients: complaint.complainedRecipients.map((r) => ({
      emailAddress: r.emailAddress,
      diagnosticCode: "User marked as spam",
    })),
    timestamp: complaint.timestamp,
  };

  await handleBounce(notification);
}
