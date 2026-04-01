/**
 * POST /api/admin/sensitivity/retrain
 * Trigger manual retraining of sensitivity model.
 *
 * PX-878: Tiered Content Classifier
 *
 * INTERNAL USE ONLY - Admin endpoint for triggering model retraining.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSensitivityClient, isSensitivityConfigured } from "@/lib/services/sensitivity";

interface RetrainRequestBody {
  /** Whether to retrain the org-specific model (true) or base model (false) */
  privateModel?: boolean;
  /** Optional: force retraining even if threshold not met */
  force?: boolean;
}

/**
 * POST /api/admin/sensitivity/retrain - Trigger manual retraining
 *
 * Triggers retraining of the sensitivity classification model.
 * By default, retrains the organization-specific model.
 * Set privateModel: false to retrain the shared base model (super admin only).
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

    const body: RetrainRequestBody = await request.json().catch(() => ({}));
    const isPrivateModel = body.privateModel !== false;
    const force = body.force === true;

    // Only super admin can retrain base model
    if (!isPrivateModel && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only super admins can retrain the base model",
          },
        },
        { status: 403 }
      );
    }

    const orgId = isPrivateModel ? user.orgId : null;

    // Check for existing running job
    const existingJob = await prisma.sensitivityRetrainingJob.findFirst({
      where: {
        orgId,
        status: { in: ["PENDING", "RUNNING"] },
      },
    });

    if (existingJob) {
      return NextResponse.json(
        {
          error: {
            code: "JOB_IN_PROGRESS",
            message: "A retraining job is already in progress",
            jobId: existingJob.id,
          },
        },
        { status: 409 }
      );
    }

    // Count available labels
    const labelCount = await prisma.sensitivityAuditLog.count({
      where: {
        orgId: isPrivateModel ? user.orgId : undefined,
        action: { in: ["CONFIRMED", "DISPUTED"] },
      },
    });

    // Check threshold (500 labels) unless force
    const LABEL_THRESHOLD = 500;
    if (!force && labelCount < LABEL_THRESHOLD) {
      return NextResponse.json(
        {
          error: {
            code: "INSUFFICIENT_LABELS",
            message: `Need at least ${LABEL_THRESHOLD} labels for retraining. Current: ${labelCount}`,
            labelCount,
            threshold: LABEL_THRESHOLD,
          },
        },
        { status: 400 }
      );
    }

    // Get current active model version
    const currentModel = await prisma.sensitivityModel.findFirst({
      where: {
        orgId,
        isActive: true,
      },
      select: { version: true },
    });

    // Create retraining job
    const job = await prisma.sensitivityRetrainingJob.create({
      data: {
        orgId,
        status: "PENDING",
        triggerReason: "MANUAL",
        labelCount,
        previousVersion: currentModel?.version || null,
      },
    });

    // Trigger async retraining via NLP service
    try {
      const client = getSensitivityClient();
      await client.triggerRetraining({
        jobId: job.id,
        orgId,
        force,
      });

      // Update job status
      await prisma.sensitivityRetrainingJob.update({
        where: { id: job.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      console.log(
        `[Sensitivity Retrain] Manual retraining triggered by ${user.id} ` +
          `for ${isPrivateModel ? `org ${user.orgId}` : "base model"}. Job: ${job.id}`
      );

      return NextResponse.json({
        success: true,
        data: {
          jobId: job.id,
          status: "RUNNING",
          modelType: isPrivateModel ? "private" : "base",
          labelCount,
          previousVersion: currentModel?.version || null,
          message: "Retraining job started successfully",
        },
      });
    } catch (serviceError) {
      // Update job status to failed
      await prisma.sensitivityRetrainingJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error:
            serviceError instanceof Error
              ? serviceError.message
              : "Failed to start retraining",
          completedAt: new Date(),
        },
      });

      throw serviceError;
    }
  } catch (error) {
    console.error("[Sensitivity Retrain API] Error triggering retraining:", error);
    return NextResponse.json(
      { error: "Failed to trigger retraining" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sensitivity/retrain - Get retraining job status
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

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (jobId) {
      // Get specific job
      const job = await prisma.sensitivityRetrainingJob.findFirst({
        where: {
          id: jobId,
          OR: [{ orgId: null }, { orgId: user.orgId }],
        },
      });

      if (!job) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Job not found" } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        data: {
          id: job.id,
          type: job.orgId === null ? "base" : "private",
          status: job.status,
          triggerReason: job.triggerReason,
          labelCount: job.labelCount,
          previousVersion: job.previousVersion,
          newVersion: job.newVersion,
          metrics: job.metrics,
          error: job.error,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          createdAt: job.createdAt,
        },
      });
    }

    // Get recent jobs
    const jobs = await prisma.sensitivityRetrainingJob.findMany({
      where: {
        OR: [{ orgId: null }, { orgId: user.orgId }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get label counts for both models
    const [baseLabelCount, privateLabelCount] = await Promise.all([
      prisma.sensitivityAuditLog.count({
        where: {
          action: { in: ["CONFIRMED", "DISPUTED"] },
        },
      }),
      prisma.sensitivityAuditLog.count({
        where: {
          orgId: user.orgId,
          action: { in: ["CONFIRMED", "DISPUTED"] },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        labelCounts: {
          base: baseLabelCount,
          private: privateLabelCount,
          threshold: 500,
        },
        jobs: jobs.map((job) => ({
          id: job.id,
          type: job.orgId === null ? "base" : "private",
          status: job.status,
          triggerReason: job.triggerReason,
          labelCount: job.labelCount,
          previousVersion: job.previousVersion,
          newVersion: job.newVersion,
          error: job.error,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          createdAt: job.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("[Sensitivity Retrain API] Error getting job status:", error);
    return NextResponse.json(
      { error: "Failed to get retraining status" },
      { status: 500 }
    );
  }
}
