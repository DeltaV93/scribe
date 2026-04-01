/**
 * GET /api/admin/sensitivity/models
 * List sensitivity model versions for the organization.
 *
 * PX-878: Tiered Content Classifier
 *
 * INTERNAL USE ONLY - Admin endpoint for model management.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/sensitivity/models - List model versions
 *
 * Returns all model versions for the organization, including:
 * - Shared base model (orgId = null)
 * - Organization-specific private model (if exists)
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

    // Get all models for this org (including shared base model)
    const models = await prisma.sensitivityModel.findMany({
      where: {
        OR: [
          { orgId: null }, // Shared base model
          { orgId: user.orgId }, // Org-specific model
        ],
      },
      orderBy: [
        { orgId: "asc" }, // Base model first
        { trainedAt: "desc" }, // Most recent first
      ],
      select: {
        id: true,
        orgId: true,
        version: true,
        accuracy: true,
        precision: true,
        recall: true,
        f1Score: true,
        trainingSize: true,
        isActive: true,
        trainedAt: true,
        createdAt: true,
      },
    });

    // Get most recent retraining jobs
    const retrainingJobs = await prisma.sensitivityRetrainingJob.findMany({
      where: {
        OR: [{ orgId: null }, { orgId: user.orgId }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orgId: true,
        status: true,
        triggerReason: true,
        labelCount: true,
        previousVersion: true,
        newVersion: true,
        metrics: true,
        error: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    // Separate base model from org-specific
    const baseModels = models.filter((m) => m.orgId === null);
    const orgModels = models.filter((m) => m.orgId === user.orgId);

    // Find active versions
    const activeBaseModel = baseModels.find((m) => m.isActive);
    const activeOrgModel = orgModels.find((m) => m.isActive);

    return NextResponse.json({
      data: {
        organization: {
          id: user.orgId,
          name: user.orgName,
        },
        activeModel: {
          base: activeBaseModel
            ? {
                version: activeBaseModel.version,
                accuracy: activeBaseModel.accuracy,
                trainedAt: activeBaseModel.trainedAt,
              }
            : null,
          private: activeOrgModel
            ? {
                version: activeOrgModel.version,
                accuracy: activeOrgModel.accuracy,
                trainedAt: activeOrgModel.trainedAt,
              }
            : null,
        },
        models: {
          base: baseModels.map((m) => ({
            id: m.id,
            version: m.version,
            accuracy: m.accuracy,
            precision: m.precision,
            recall: m.recall,
            f1Score: m.f1Score,
            trainingSize: m.trainingSize,
            isActive: m.isActive,
            trainedAt: m.trainedAt,
          })),
          private: orgModels.map((m) => ({
            id: m.id,
            version: m.version,
            accuracy: m.accuracy,
            precision: m.precision,
            recall: m.recall,
            f1Score: m.f1Score,
            trainingSize: m.trainingSize,
            isActive: m.isActive,
            trainedAt: m.trainedAt,
          })),
        },
        retrainingJobs: retrainingJobs.map((job) => ({
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
        })),
      },
    });
  } catch (error) {
    console.error("[Sensitivity Models API] Error listing models:", error);
    return NextResponse.json(
      { error: "Failed to list sensitivity models" },
      { status: 500 }
    );
  }
}
