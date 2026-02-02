import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  getKMSStatus,
  checkKeyHealth,
  getKeyRotationStatus,
  isKMSConfigured,
  listOrgKeyVersions,
  getKeyCacheStatus,
} from "@/lib/encryption";
import { prisma } from "@/lib/db";
import { logEnhancedAudit } from "@/lib/audit/enhanced-logger";
import { AuditEventType, SecurityAction, AuditSeverity } from "@/lib/audit/events";

/**
 * GET /api/admin/encryption/status
 *
 * Get comprehensive encryption and KMS status for the organization.
 * HIPAA/SOC 2 requirement: Monitoring of encryption key status.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get basic KMS configuration status
    const kmsStatus = getKMSStatus();

    // Build response object
    const response: Record<string, unknown> = {
      kms: {
        configured: kmsStatus.configured,
        region: kmsStatus.region,
        environment: kmsStatus.environment,
        keyAlias: kmsStatus.keyAlias,
      },
      organization: {
        id: user.orgId,
        name: user.orgName,
      },
      cacheStatus: getKeyCacheStatus(),
      timestamp: new Date().toISOString(),
    };

    // If KMS is configured, get detailed health status
    if (isKMSConfigured()) {
      try {
        const [keyHealth, rotationStatus] = await Promise.all([
          checkKeyHealth(),
          getKeyRotationStatus(),
        ]);

        response.keyHealth = {
          keyId: keyHealth.keyId,
          keyArn: keyHealth.keyArn,
          alias: keyHealth.alias,
          enabled: keyHealth.enabled,
          keyState: keyHealth.keyState,
          creationDate: keyHealth.creationDate,
          rotationEnabled: keyHealth.rotationEnabled,
          healthChecks: keyHealth.healthChecks,
          lastHealthCheck: keyHealth.lastHealthCheck,
        };

        response.rotation = {
          enabled: rotationStatus.rotationEnabled,
          periodDays: rotationStatus.rotationPeriodInDays,
          nextRotation: rotationStatus.nextRotationDate,
        };

        // Log health check for audit
        await logEnhancedAudit({
          eventType: AuditEventType.SECURITY,
          action: SecurityAction.KEY_HEALTH_CHECK,
          severity: AuditSeverity.LOW,
          orgId: user.orgId,
          userId: user.id,
          resource: "EncryptionKey",
          resourceId: keyHealth.keyId,
          details: {
            healthChecks: keyHealth.healthChecks,
            rotationEnabled: rotationStatus.rotationEnabled,
          },
          ipAddress: request.headers.get("x-forwarded-for") || undefined,
          userAgent: request.headers.get("user-agent") || undefined,
        });
      } catch (kmsError) {
        console.error("[Encryption Status] KMS health check failed:", kmsError);
        response.keyHealth = {
          error: "Failed to retrieve KMS key health",
          message: (kmsError as Error).message,
        };
      }
    } else {
      response.keyHealth = {
        warning: "KMS not configured - using development mode",
        note: "Development mode keys are NOT suitable for production PHI",
      };
    }

    // Get organization's DEK versions
    try {
      const dekVersions = await listOrgKeyVersions(user.orgId);
      const activeVersion = dekVersions.find((k) => k.isActive);

      response.organizationKey = {
        activeVersion: activeVersion?.keyVersion || null,
        totalVersions: dekVersions.length,
        versions: dekVersions.map((v) => ({
          version: v.keyVersion,
          isActive: v.isActive,
          createdAt: v.createdAt,
          rotatedAt: v.rotatedAt,
        })),
      };
    } catch (dekError) {
      console.error("[Encryption Status] DEK status check failed:", dekError);
      response.organizationKey = {
        error: "Failed to retrieve organization key status",
      };
    }

    // Get encryption statistics
    try {
      const [
        formSubmissionCount,
        noteCount,
        callCount,
        messageCount,
      ] = await Promise.all([
        prisma.formSubmission.count({ where: { orgId: user.orgId } }),
        prisma.note.count({
          where: { client: { orgId: user.orgId } },
        }),
        prisma.call.count({
          where: { client: { orgId: user.orgId } },
        }),
        prisma.message.count({ where: { orgId: user.orgId } }),
      ]);

      response.encryptedRecords = {
        formSubmissions: formSubmissionCount,
        notes: noteCount,
        calls: callCount,
        messages: messageCount,
        total: formSubmissionCount + noteCount + callCount + messageCount,
      };
    } catch (statsError) {
      console.error("[Encryption Status] Stats check failed:", statsError);
      response.encryptedRecords = {
        error: "Failed to retrieve encryption statistics",
      };
    }

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("Error fetching encryption status:", error);
    return NextResponse.json(
      { error: "Failed to fetch encryption status" },
      { status: 500 }
    );
  }
}
