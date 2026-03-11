import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";
import { AuditLogger } from "@/lib/audit/service";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ modelId: string; versionNumber: string }>;
}

// Validation schema for rollback
const rollbackSchema = z.object({
  environment: z.enum(["staging", "production"]),
});

/**
 * POST /api/ml/models/[modelId]/versions/[versionNumber]/rollback - Rollback to a specific version
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { modelId, versionNumber } = await params;

    const versionNum = parseInt(versionNumber, 10);
    if (isNaN(versionNum)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid version number" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = rollbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid rollback data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Get current deployed version for audit purposes
    let currentVersion: number | undefined;
    try {
      const versions = await mlServices.versions.list(modelId);
      const deployedVersion = versions.items.find(
        (v) => v.status === "deployed"
      );
      currentVersion = deployedVersion?.version_number;
    } catch {
      // Continue without current version info
    }

    // Perform the rollback
    const deployment = await mlServices.versions.rollback(
      modelId,
      versionNum,
      validation.data.environment
    );

    // Emit audit event to ml-services for rollback
    try {
      await mlServices.emitModelRollback(
        user.orgId,
        modelId,
        currentVersion || 0,
        versionNum,
        validation.data.environment,
        user.id
      );
    } catch (auditError) {
      // Log but don't fail the request if audit event fails
      console.error("Failed to emit model rollback audit event:", auditError);
    }

    // Also log to local audit log for compliance
    try {
      await AuditLogger.formUpdated(
        user.orgId,
        user.id,
        modelId,
        `Model ${modelId}`,
        {
          action: "model_rollback",
          from_version: currentVersion,
          to_version: versionNum,
          environment: validation.data.environment,
        }
      );
    } catch (localAuditError) {
      console.error("Failed to create local audit log:", localAuditError);
    }

    return NextResponse.json({ success: true, data: deployment });
  } catch (error) {
    console.error("Error rolling back version:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to rollback version" } },
      { status: 500 }
    );
  }
}
