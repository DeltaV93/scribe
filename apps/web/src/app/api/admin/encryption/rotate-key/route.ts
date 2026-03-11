import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  rotateOrgDek,
  listOrgKeyVersions,
  isKMSConfigured,
} from "@/lib/encryption";
import { prisma } from "@/lib/db";
import { logEnhancedAudit } from "@/lib/audit/enhanced-logger";
import { AuditEventType, SecurityAction, AuditSeverity } from "@/lib/audit/events";
import { UserRole } from "@/types";

/**
 * POST /api/admin/encryption/rotate-key
 *
 * Rotate the Data Encryption Key (DEK) for the organization.
 * Creates a new DEK and marks the old one as inactive.
 *
 * HIPAA/SOC 2 Requirement:
 * - On-demand key rotation capability
 * - Audit logging of all key operations
 *
 * Note: This rotates the organization's DEK, not the AWS KMS master key.
 * The KMS master key is rotated automatically by AWS (annually when enabled).
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let rotationResult: { oldVersion: number; newVersion: number } | null = null;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPER_ADMIN or ADMIN can rotate keys
    if (!isAdmin(user)) {
      // Log unauthorized attempt
      await logEnhancedAudit({
        eventType: AuditEventType.SECURITY,
        action: SecurityAction.KEY_ACCESS_DENIED,
        severity: AuditSeverity.HIGH,
        orgId: user.orgId,
        userId: user.id,
        resource: "EncryptionKey",
        resourceId: user.orgId,
        details: {
          attemptedAction: "KEY_ROTATION",
          userRole: user.role,
          reason: "Insufficient permissions",
        },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body for optional parameters
    let body: { reason?: string; reEncrypt?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const { reason, reEncrypt = false } = body;

    // Get current key status before rotation
    const currentVersions = await listOrgKeyVersions(user.orgId);
    const activeVersion = currentVersions.find((k) => k.isActive);

    if (!activeVersion) {
      return NextResponse.json(
        { error: "No active encryption key found for organization" },
        { status: 400 }
      );
    }

    // Log rotation initiation
    await logEnhancedAudit({
      eventType: AuditEventType.SECURITY,
      action: SecurityAction.KEY_ROTATION_INITIATED,
      severity: AuditSeverity.CRITICAL,
      orgId: user.orgId,
      userId: user.id,
      resource: "EncryptionKey",
      resourceId: user.orgId,
      details: {
        currentVersion: activeVersion.keyVersion,
        reason: reason || "Manual rotation requested",
        reEncryptRequested: reEncrypt,
        kmsConfigured: isKMSConfigured(),
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Perform the key rotation
    try {
      rotationResult = await rotateOrgDek(user.orgId);
    } catch (rotationError) {
      // Log rotation failure
      await logEnhancedAudit({
        eventType: AuditEventType.SECURITY,
        action: SecurityAction.KEY_ROTATION_FAILED,
        severity: AuditSeverity.CRITICAL,
        orgId: user.orgId,
        userId: user.id,
        resource: "EncryptionKey",
        resourceId: user.orgId,
        details: {
          currentVersion: activeVersion.keyVersion,
          error: (rotationError as Error).message,
          durationMs: Date.now() - startTime,
        },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      });

      throw rotationError;
    }

    // Log successful rotation
    await logEnhancedAudit({
      eventType: AuditEventType.SECURITY,
      action: SecurityAction.KEY_ROTATION_COMPLETED,
      severity: AuditSeverity.CRITICAL,
      orgId: user.orgId,
      userId: user.id,
      resource: "EncryptionKey",
      resourceId: user.orgId,
      details: {
        previousVersion: rotationResult.oldVersion,
        newVersion: rotationResult.newVersion,
        reason: reason || "Manual rotation requested",
        durationMs: Date.now() - startTime,
        kmsConfigured: isKMSConfigured(),
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Get updated key versions
    const updatedVersions = await listOrgKeyVersions(user.orgId);

    // Build response
    const response = {
      success: true,
      rotation: {
        previousVersion: rotationResult.oldVersion,
        newVersion: rotationResult.newVersion,
        rotatedAt: new Date().toISOString(),
        rotatedBy: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      keyVersions: updatedVersions.map((v) => ({
        version: v.keyVersion,
        isActive: v.isActive,
        createdAt: v.createdAt,
        rotatedAt: v.rotatedAt,
      })),
      reEncryptionStatus: reEncrypt
        ? {
            requested: true,
            status: "QUEUED",
            note: "Re-encryption will be processed in background. Check /api/admin/encryption/re-encrypt/status for progress.",
          }
        : {
            requested: false,
            note: "Existing data remains encrypted with previous key. Call re-encrypt endpoint to migrate data to new key.",
          },
      durationMs: Date.now() - startTime,
    };

    // If re-encryption was requested, queue the job
    if (reEncrypt) {
      // Create a job record for re-encryption (would be processed by background worker)
      await prisma.jobProgress.create({
        data: {
          type: "encryption-key-migration",
          userId: user.id,
          orgId: user.orgId,
          status: "PENDING",
          metadata: {
            fromVersion: rotationResult.oldVersion,
            toVersion: rotationResult.newVersion,
            initiatedBy: user.id,
            reason: reason || "Key rotation re-encryption",
          },
        },
      });

      // Log re-encryption job creation
      await logEnhancedAudit({
        eventType: AuditEventType.SECURITY,
        action: SecurityAction.RE_ENCRYPTION_STARTED,
        severity: AuditSeverity.HIGH,
        orgId: user.orgId,
        userId: user.id,
        resource: "EncryptionKey",
        resourceId: user.orgId,
        details: {
          fromVersion: rotationResult.oldVersion,
          toVersion: rotationResult.newVersion,
          status: "QUEUED",
        },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      });
    }

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("Error rotating encryption key:", error);
    return NextResponse.json(
      {
        error: "Failed to rotate encryption key",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/encryption/rotate-key
 *
 * Get information about key rotation requirements and recommendations.
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

    // Get current key status
    const versions = await listOrgKeyVersions(user.orgId);
    const activeVersion = versions.find((k) => k.isActive);

    if (!activeVersion) {
      return NextResponse.json({
        data: {
          hasActiveKey: false,
          recommendation: "No active encryption key found. One will be created automatically on first data encryption.",
        },
      });
    }

    // Calculate key age
    const keyAgeMs = Date.now() - new Date(activeVersion.createdAt).getTime();
    const keyAgeDays = Math.floor(keyAgeMs / (1000 * 60 * 60 * 24));
    const keyAgeMonths = Math.floor(keyAgeDays / 30);

    // Determine rotation recommendation
    let recommendation = "No rotation needed at this time.";
    let urgency: "low" | "medium" | "high" = "low";

    if (keyAgeDays > 365) {
      recommendation = "Key is over 1 year old. Annual rotation is recommended for HIPAA compliance.";
      urgency = "high";
    } else if (keyAgeDays > 180) {
      recommendation = "Key is over 6 months old. Consider scheduling rotation.";
      urgency = "medium";
    } else if (keyAgeDays > 90) {
      recommendation = "Key age is acceptable. Next rotation recommended in " + (365 - keyAgeDays) + " days.";
      urgency = "low";
    }

    // Get pending re-encryption jobs
    const pendingJobs = await prisma.jobProgress.findMany({
      where: {
        orgId: user.orgId,
        type: "encryption-key-migration",
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      data: {
        currentKey: {
          version: activeVersion.keyVersion,
          createdAt: activeVersion.createdAt,
          ageInDays: keyAgeDays,
          ageInMonths: keyAgeMonths,
        },
        totalVersions: versions.length,
        previousRotations: versions
          .filter((v) => !v.isActive && v.rotatedAt)
          .map((v) => ({
            version: v.keyVersion,
            rotatedAt: v.rotatedAt,
          })),
        recommendation: {
          message: recommendation,
          urgency,
          daysUntilRecommended: Math.max(0, 365 - keyAgeDays),
        },
        pendingReEncryption: pendingJobs.map((job) => ({
          id: job.id,
          status: job.status,
          progress: job.progress,
          createdAt: job.createdAt,
        })),
        complianceNotes: {
          hipaa: "HIPAA recommends but does not mandate specific key rotation periods. Annual rotation is industry best practice.",
          soc2: "SOC 2 requires documented key management procedures including rotation policies.",
          awsKms: "AWS KMS master keys are configured for automatic annual rotation. Organization DEKs require manual rotation.",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching key rotation info:", error);
    return NextResponse.json(
      { error: "Failed to fetch key rotation information" },
      { status: 500 }
    );
  }
}
