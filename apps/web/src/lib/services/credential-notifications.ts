import { prisma } from "@/lib/db";
import { sendEmail } from "./email-notifications";
import { createNotification, type NotificationType } from "./notifications";
import { format } from "date-fns";

// ============================================
// Credential Expiry Notifications (PX-711)
// ============================================
// Handles sending alerts for expiring credentials
// to case managers via email and in-app notifications

interface CredentialExpiryAlertInput {
  caseManagerId: string;
  clientName: string;
  credentialName: string;
  daysUntilExpiry: number;
  expiryDate: string | Date;
  credentialId: string;
  clientId: string;
  orgName: string;
}

/**
 * Send a credential expiry alert to the case manager
 * This creates both an in-app notification and sends an email
 */
export async function sendCredentialExpiryAlert(
  input: CredentialExpiryAlertInput
): Promise<void> {
  const {
    caseManagerId,
    clientName,
    credentialName,
    daysUntilExpiry,
    expiryDate,
    credentialId,
    clientId,
    orgName,
  } = input;

  // Get case manager details
  const caseManager = await prisma.user.findUnique({
    where: { id: caseManagerId },
    select: {
      id: true,
      email: true,
      name: true,
      orgId: true,
    },
  });

  if (!caseManager) {
    console.error(`Case manager not found: ${caseManagerId}`);
    return;
  }

  const formattedExpiryDate = format(new Date(expiryDate), "MMMM d, yyyy");
  const urgencyLevel = daysUntilExpiry <= 7 ? "urgent" : "warning";

  // Create in-app notification
  try {
    await createNotification({
      orgId: caseManager.orgId,
      userId: caseManager.id,
      type: "REMINDER" as NotificationType,
      title:
        daysUntilExpiry === 7
          ? `Credential Expiring in 7 Days`
          : `Credential Expiring in ${daysUntilExpiry} Days`,
      body: `${clientName}'s ${credentialName} expires on ${formattedExpiryDate}`,
      actionUrl: `/clients/${clientId}?tab=workforce`,
      metadata: {
        credentialId,
        clientId,
        clientName,
        credentialName,
        expiryDate: formattedExpiryDate,
        daysUntilExpiry,
        urgencyLevel,
      },
    });
  } catch (error) {
    console.error("Error creating credential expiry notification:", error);
  }

  // Send email notification
  try {
    await sendEmail({
      to: caseManager.email,
      subject:
        daysUntilExpiry <= 7
          ? `[Urgent] ${credentialName} for ${clientName} expires in ${daysUntilExpiry} days`
          : `${credentialName} for ${clientName} expires in ${daysUntilExpiry} days`,
      template: "credential_expiring" as never, // Type assertion for now, template needs to be added
      data: {
        caseManagerName: caseManager.name || "Case Manager",
        clientName,
        credentialName,
        expiryDate: formattedExpiryDate,
        daysUntilExpiry,
        urgencyLevel,
        orgName,
        clientUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.scrybe.io"}/clients/${clientId}?tab=workforce`,
      },
    });
  } catch (error) {
    console.error("Error sending credential expiry email:", error);
    // Don't throw - we still created the in-app notification
  }
}

/**
 * Send a batch of credential expiry alerts
 * Useful for testing or manual triggering
 */
export async function sendBatchCredentialAlerts(
  orgId: string,
  daysUntilExpiry: number = 30
): Promise<{ sent: number; errors: string[] }> {
  const { getExpiringCredentials } = await import("./credentials");
  const alerts = await getExpiringCredentials(orgId, daysUntilExpiry);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const results = {
    sent: 0,
    errors: [] as string[],
  };

  for (const alert of alerts) {
    try {
      await sendCredentialExpiryAlert({
        caseManagerId: alert.caseManagerId,
        clientName: alert.clientName,
        credentialName: alert.credential.name,
        daysUntilExpiry: alert.daysUntilExpiry,
        expiryDate: alert.credential.expiryDate!,
        credentialId: alert.credential.id,
        clientId: alert.credential.clientId,
        orgName: org?.name || "Unknown Organization",
      });
      results.sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`${alert.credential.name} for ${alert.clientName}: ${message}`);
    }
  }

  return results;
}
