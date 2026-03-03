import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";
import { AuditLogger } from "@/lib/audit/service";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ modelId: string; versionNumber: string }>;
}

// Validation schema for deployment
const deploySchema = z.object({
  environment: z.enum(["staging", "production"]),
  traffic_percentage: z.number().min(0).max(100).optional(),
});

/**
 * POST /api/ml/models/[modelId]/versions/[versionNumber]/deploy - Deploy a version
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
    const validation = deploySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid deployment data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Deploy the version
    const deployment = await mlServices.versions.deploy(modelId, versionNum, validation.data);

    // Emit audit event to ml-services for model deployment
    try {
      await mlServices.emitModelDeployed(
        user.orgId,
        modelId,
        deployment.version_id,
        validation.data.environment,
        user.id
      );
    } catch (auditError) {
      // Log but don't fail the request if audit event fails
      console.error("Failed to emit model deployed audit event:", auditError);
    }

    // Also log to local audit log for compliance
    try {
      await AuditLogger.formUpdated(
        user.orgId,
        user.id,
        modelId,
        `Model ${modelId}`,
        {
          action: "model_deployed",
          version_number: versionNum,
          environment: validation.data.environment,
          traffic_percentage: validation.data.traffic_percentage,
        }
      );
    } catch (localAuditError) {
      console.error("Failed to create local audit log:", localAuditError);
    }

    return NextResponse.json({ success: true, data: deployment });
  } catch (error) {
    console.error("Error deploying version:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to deploy version" } },
      { status: 500 }
    );
  }
}
