import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  updateCredentialStatuses,
  getCredentialsNeedingAlerts,
} from "@/lib/services/credentials";
import { sendCredentialExpiryAlert } from "@/lib/services/credential-notifications";
import { verifyCronRequest } from "@/lib/cron/verify";

/**
 * POST /api/cron/credential-expiry - Daily job to update credential statuses and send expiry alerts
 *
 * This endpoint should be called daily by a cron job (recommended: 6am UTC).
 * It performs the following tasks:
 * 1. Updates credential statuses based on expiry dates (ACTIVE -> EXPIRING -> EXPIRED)
 * 2. Sends alerts to case managers for credentials expiring in 30 days and 7 days
 *
 * Secured with CRON_SECRET environment variable.
 *
 * Call schedule: Daily at 6:00 AM UTC
 */
export async function POST(request: NextRequest) {
  try {
    // Validate cron secret with timing-safe comparison
    const verification = verifyCronRequest(request);

    if (!verification.verified) {
      const statusCode = verification.reason === "missing_secret" ? 500 : 401;
      const message =
        verification.reason === "missing_secret"
          ? "Cron not configured"
          : "Invalid cron secret";
      return NextResponse.json(
        { error: { code: statusCode === 500 ? "SERVER_ERROR" : "UNAUTHORIZED", message } },
        { status: statusCode }
      );
    }

    const results = {
      statusUpdates: {
        updated: 0,
        newlyExpiring: 0,
        newlyExpired: 0,
      },
      alertsSent: {
        at30Days: 0,
        at7Days: 0,
      },
      orgsProcessed: 0,
      errors: [] as string[],
    };

    // Step 1: Update all credential statuses globally
    try {
      results.statusUpdates = await updateCredentialStatuses();
      console.log("Credential status updates:", results.statusUpdates);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`Status update error: ${message}`);
      console.error("Error updating credential statuses:", error);
    }

    // Step 2: Send alerts for each organization with workforce features enabled
    const orgsWithWorkforce = await prisma.organization.findMany({
      where: { workforceEnabled: true },
      select: { id: true, name: true },
    });

    for (const org of orgsWithWorkforce) {
      results.orgsProcessed++;

      try {
        const alerts = await getCredentialsNeedingAlerts(org.id);

        // Send 30-day alerts
        for (const alert of alerts.at30Days) {
          try {
            await sendCredentialExpiryAlert({
              caseManagerId: alert.caseManagerId,
              clientName: alert.clientName,
              credentialName: alert.credential.name,
              daysUntilExpiry: 30,
              expiryDate: alert.credential.expiryDate!,
              credentialId: alert.credential.id,
              clientId: alert.credential.clientId,
              orgName: org.name,
            });
            results.alertsSent.at30Days++;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            results.errors.push(
              `30-day alert for ${alert.credential.name} (${alert.clientName}): ${message}`
            );
          }
        }

        // Send 7-day alerts
        for (const alert of alerts.at7Days) {
          try {
            await sendCredentialExpiryAlert({
              caseManagerId: alert.caseManagerId,
              clientName: alert.clientName,
              credentialName: alert.credential.name,
              daysUntilExpiry: 7,
              expiryDate: alert.credential.expiryDate!,
              credentialId: alert.credential.id,
              clientId: alert.credential.clientId,
              orgName: org.name,
            });
            results.alertsSent.at7Days++;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            results.errors.push(
              `7-day alert for ${alert.credential.name} (${alert.clientName}): ${message}`
            );
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`Org ${org.name} (${org.id}): ${message}`);
        console.error(`Error processing org ${org.id}:`, error);
      }
    }

    console.log("Credential expiry cron completed:", results);

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error during credential expiry cron:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Credential expiry check failed" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/credential-expiry - Health check / status
 */
export async function GET(request: NextRequest) {
  // Validate cron secret with timing-safe comparison
  const verification = verifyCronRequest(request);

  if (!verification.verified) {
    const statusCode = verification.reason === "missing_secret" ? 500 : 401;
    const message =
      verification.reason === "missing_secret"
        ? "Cron not configured"
        : "Invalid cron secret";
    return NextResponse.json(
      { error: { code: statusCode === 500 ? "SERVER_ERROR" : "UNAUTHORIZED", message } },
      { status: statusCode }
    );
  }

  // Get summary statistics
  const [orgsWithWorkforce, expiringCount, expiredCount] = await Promise.all([
    prisma.organization.count({ where: { workforceEnabled: true } }),
    prisma.credential.count({ where: { status: "EXPIRING" } }),
    prisma.credential.count({ where: { status: "EXPIRED" } }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      status: "healthy",
      orgsWithWorkforce,
      credentialsExpiringSoon: expiringCount,
      credentialsExpired: expiredCount,
    },
  });
}
