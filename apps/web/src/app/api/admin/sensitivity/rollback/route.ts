/**
 * POST /api/admin/sensitivity/rollback
 * Rollback sensitivity model to a previous version.
 *
 * PX-878: Tiered Content Classifier
 *
 * INTERNAL USE ONLY - Admin endpoint for model rollback.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSensitivityClient, isSensitivityConfigured } from "@/lib/services/sensitivity";

interface RollbackRequestBody {
  /** Target version to rollback to */
  targetVersion: string;
  /** Whether this is for the private model (true) or base model (false) */
  privateModel?: boolean;
  /** Reason for rollback */
  reason?: string;
}

/**
 * POST /api/admin/sensitivity/rollback - Rollback to previous model version
 *
 * Reverts the active sensitivity model to a previous version.
 * Useful when a newly trained model is underperforming.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if sensitivity service is configured
    if (!isSensitivityConfigured()) {
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_NOT_CONFIGURED",
            message: "Sensitivity detection service is not configured",
          },
        },
        { status: 503 }
      );
    }

    const body: RollbackRequestBody = await request.json();

    if (!body.targetVersion) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "targetVersion is required",
          },
        },
        { status: 400 }
      );
    }

    const isPrivateModel = body.privateModel !== false;
    const orgId = isPrivateModel ? user.orgId : null;

    // Only super admin can rollback base model
    if (!isPrivateModel && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only super admins can rollback the base model",
          },
        },
        { status: 403 }
      );
    }

    // Find target version
    const targetModel = await prisma.sensitivityModel.findFirst({
      where: {
        orgId,
        version: body.targetVersion,
      },
    });

    if (!targetModel) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Model version ${body.targetVersion} not found`,
          },
        },
        { status: 404 }
      );
    }

    if (targetModel.isActive) {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_ACTIVE",
            message: "Target version is already active",
          },
        },
        { status: 400 }
      );
    }

    // Get current active model
    const currentModel = await prisma.sensitivityModel.findFirst({
      where: {
        orgId,
        isActive: true,
      },
    });

    // Perform rollback in transaction
    await prisma.$transaction(async (tx) => {
      // Deactivate current model
      if (currentModel) {
        await tx.sensitivityModel.update({
          where: { id: currentModel.id },
          data: { isActive: false },
        });
      }

      // Activate target model
      await tx.sensitivityModel.update({
        where: { id: targetModel.id },
        data: { isActive: true },
      });

      // Create retraining job record for the rollback
      await tx.sensitivityRetrainingJob.create({
        data: {
          orgId,
          status: "ROLLED_BACK",
          triggerReason: "MANUAL",
          labelCount: 0,
          previousVersion: currentModel?.version || null,
          newVersion: body.targetVersion,
          metrics: {
            reason: body.reason || "Manual rollback",
            rolledBackBy: user.id,
            rolledBackAt: new Date().toISOString(),
          },
          completedAt: new Date(),
        },
      });
    });

    // Notify NLP service of the rollback
    try {
      const client = getSensitivityClient();
      await client.notifyModelChange({
        orgId,
        version: body.targetVersion,
        action: "rollback",
      });
    } catch (serviceError) {
      // Log but don't fail - the DB is updated
      console.error(
        "[Sensitivity Rollback] Failed to notify NLP service:",
        serviceError
      );
    }

    console.log(
      `[Sensitivity Rollback] Model rolled back by ${user.id}: ` +
        `${currentModel?.version || "none"} -> ${body.targetVersion} ` +
        `(${isPrivateModel ? `org ${user.orgId}` : "base model"})`
    );

    return NextResponse.json({
      success: true,
      data: {
        modelType: isPrivateModel ? "private" : "base",
        previousVersion: currentModel?.version || null,
        currentVersion: body.targetVersion,
        targetModel: {
          id: targetModel.id,
          version: targetModel.version,
          accuracy: targetModel.accuracy,
          trainedAt: targetModel.trainedAt,
        },
        message: "Model successfully rolled back",
      },
    });
  } catch (error) {
    console.error("[Sensitivity Rollback API] Error rolling back model:", error);
    return NextResponse.json(
      { error: "Failed to rollback model" },
      { status: 500 }
    );
  }
}
