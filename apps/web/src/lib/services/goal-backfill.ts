/**
 * Goal Backfill Service
 *
 * Handles historical data backfill when linking programs to goals.
 * Counts existing enrollments, completions, sessions, etc. within
 * the goal's date range and updates metric values accordingly.
 */

import { prisma } from "@/lib/db";
import { MetricType, KpiMetricType } from "@prisma/client";
import { incrementDeliverable, ProgressSource } from "./grants";
import { incrementKpi, ProgressSource as KpiProgressSource } from "./kpis";

// ============================================
// TYPES
// ============================================

export interface BackfillResult {
  goalId: string;
  programId: string;
  metrics: BackfillMetricResult[];
  totalUpdated: number;
}

export interface BackfillMetricResult {
  type: string;
  resourceType: "deliverable" | "kpi";
  resourceId: string;
  resourceName: string;
  previousValue: number;
  backfilledCount: number;
  newValue: number;
}

export interface BackfillOptions {
  startDate?: Date;
  endDate?: Date;
  dryRun?: boolean;
}

// ============================================
// BACKFILL OPERATIONS
// ============================================

/**
 * Backfill historical data when linking a program to a goal
 */
export async function backfillProgramData(
  goalId: string,
  programId: string,
  options?: BackfillOptions
): Promise<BackfillResult> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      grantLinks: {
        include: {
          grant: {
            include: {
              deliverables: true,
            },
          },
        },
      },
      kpiLinks: {
        include: {
          kpi: true,
        },
      },
    },
  });

  if (!goal) {
    throw new Error(`Goal ${goalId} not found`);
  }

  const startDate = options?.startDate ?? goal.startDate ?? new Date(0);
  const endDate = options?.endDate ?? goal.endDate ?? new Date();
  const dryRun = options?.dryRun ?? false;

  const metrics: BackfillMetricResult[] = [];

  // Backfill grant deliverables
  for (const link of goal.grantLinks) {
    for (const deliverable of link.grant.deliverables) {
      const count = await countMetricForProgram(
        programId,
        deliverable.metricType,
        startDate,
        endDate
      );

      if (count > 0) {
        const result: BackfillMetricResult = {
          type: deliverable.metricType,
          resourceType: "deliverable",
          resourceId: deliverable.id,
          resourceName: deliverable.name,
          previousValue: deliverable.currentValue,
          backfilledCount: count,
          newValue: deliverable.currentValue + count,
        };

        if (!dryRun) {
          await incrementDeliverable(deliverable.id, count, {
            sourceType: "backfill",
            sourceId: programId,
            notes: `Backfilled from program link`,
          });
        }

        metrics.push(result);
      }
    }
  }

  // Backfill KPIs
  for (const link of goal.kpiLinks) {
    const kpi = link.kpi;
    if (!kpi.dataSourceConfig) continue;

    const config = kpi.dataSourceConfig as { type?: string; programIds?: string[] };
    if (config.type === "manual") continue;

    const count = await countKpiMetricForProgram(
      programId,
      kpi.metricType,
      config,
      startDate,
      endDate
    );

    if (count > 0) {
      const result: BackfillMetricResult = {
        type: kpi.metricType,
        resourceType: "kpi",
        resourceId: kpi.id,
        resourceName: kpi.name,
        previousValue: kpi.currentValue,
        backfilledCount: count,
        newValue: kpi.currentValue + count,
      };

      if (!dryRun) {
        await incrementKpi(kpi.id, count, {
          sourceType: "backfill",
          sourceId: programId,
          notes: `Backfilled from program link`,
        });
      }

      metrics.push(result);
    }
  }

  return {
    goalId,
    programId,
    metrics,
    totalUpdated: metrics.length,
  };
}

/**
 * Count metric value for a specific program within date range
 */
async function countMetricForProgram(
  programId: string,
  metricType: MetricType,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const dateFilter = {
    gte: startDate,
    lte: endDate,
  };

  switch (metricType) {
    case MetricType.CLIENTS_ENROLLED:
      return prisma.programEnrollment.count({
        where: {
          programId,
          enrolledDate: dateFilter,
        },
      });

    case MetricType.PROGRAM_COMPLETIONS:
      return prisma.programEnrollment.count({
        where: {
          programId,
          status: "COMPLETED",
          completionDate: dateFilter,
        },
      });

    case MetricType.SESSIONS_DELIVERED:
      return prisma.programSession.count({
        where: {
          programId,
          date: dateFilter,
        },
      });

    case MetricType.CLIENT_CONTACTS:
      // Contacts aren't directly tied to programs, so count all calls
      // for clients enrolled in this program
      const enrolledClients = await prisma.programEnrollment.findMany({
        where: { programId },
        select: { clientId: true },
      });
      const clientIds = enrolledClients.map((e) => e.clientId);

      return prisma.call.count({
        where: {
          clientId: { in: clientIds },
          status: "COMPLETED",
          startedAt: dateFilter,
        },
      });

    case MetricType.FORM_SUBMISSIONS:
      // Count form submissions for clients enrolled in program
      const enrolledForForms = await prisma.programEnrollment.findMany({
        where: { programId },
        select: { clientId: true },
      });
      const formClientIds = enrolledForForms.map((e) => e.clientId);

      return prisma.formSubmission.count({
        where: {
          clientId: { in: formClientIds },
          createdAt: dateFilter,
        },
      });

    case MetricType.CLIENTS_HOUSED:
    case MetricType.CUSTOM:
      // These require custom configuration
      return 0;

    default:
      return 0;
  }
}

/**
 * Count KPI metric value for a specific program
 */
async function countKpiMetricForProgram(
  programId: string,
  metricType: KpiMetricType,
  dataSourceConfig: { type?: string; formId?: string; fieldSlug?: string; aggregation?: string },
  startDate: Date,
  endDate: Date
): Promise<number> {
  const dateFilter = {
    gte: startDate,
    lte: endDate,
  };

  // Handle different data source types
  switch (dataSourceConfig.type) {
    case "enrollment":
      return prisma.programEnrollment.count({
        where: {
          programId,
          enrolledDate: dateFilter,
        },
      });

    case "attendance":
      return prisma.sessionAttendance.count({
        where: {
          attended: true,
          session: {
            programId,
            date: dateFilter,
          },
        },
      });

    case "form_field":
      if (!dataSourceConfig.formId || !dataSourceConfig.fieldSlug) {
        return 0;
      }

      // Get enrolled clients
      const enrolled = await prisma.programEnrollment.findMany({
        where: { programId },
        select: { clientId: true },
      });
      const clientIds = enrolled.map((e) => e.clientId);

      // Count or sum form submissions with the specified field
      const submissions = await prisma.formSubmission.findMany({
        where: {
          formId: dataSourceConfig.formId,
          clientId: { in: clientIds },
          createdAt: dateFilter,
        },
        select: { data: true },
      });

      if (dataSourceConfig.aggregation === "count") {
        return submissions.length;
      } else if (dataSourceConfig.aggregation === "sum") {
        let sum = 0;
        for (const sub of submissions) {
          const data = sub.data as Record<string, unknown>;
          const value = data[dataSourceConfig.fieldSlug];
          if (typeof value === "number") {
            sum += value;
          }
        }
        return sum;
      } else if (dataSourceConfig.aggregation === "average") {
        let sum = 0;
        let count = 0;
        for (const sub of submissions) {
          const data = sub.data as Record<string, unknown>;
          const value = data[dataSourceConfig.fieldSlug];
          if (typeof value === "number") {
            sum += value;
            count++;
          }
        }
        return count > 0 ? sum / count : 0;
      }
      return submissions.length;

    default:
      return 0;
  }
}

// ============================================
// BULK BACKFILL
// ============================================

/**
 * Backfill all linked programs for a goal
 */
export async function backfillAllProgramsForGoal(
  goalId: string,
  options?: BackfillOptions
): Promise<BackfillResult[]> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      programLinks: {
        select: { programId: true },
      },
    },
  });

  if (!goal) {
    throw new Error(`Goal ${goalId} not found`);
  }

  const results: BackfillResult[] = [];

  for (const link of goal.programLinks) {
    const result = await backfillProgramData(goalId, link.programId, options);
    results.push(result);
  }

  return results;
}

/**
 * Preview backfill without making changes
 */
export async function previewBackfill(
  goalId: string,
  programId: string
): Promise<BackfillResult> {
  return backfillProgramData(goalId, programId, { dryRun: true });
}

// ============================================
// MIGRATION HELPERS
// ============================================

/**
 * Create Goals for existing Grants (one-time migration)
 */
export async function migrateGrantsToGoals(orgId: string): Promise<{ created: number }> {
  const grants = await prisma.grant.findMany({
    where: {
      orgId,
      archivedAt: null,
    },
    include: {
      programLinks: true,
    },
  });

  let created = 0;

  for (const grant of grants) {
    // Check if Goal already exists for this grant
    const existingLink = await prisma.goalGrant.findFirst({
      where: { grantId: grant.id },
    });

    if (existingLink) continue;

    // Create Goal wrapper
    // Note: Grant doesn't have progressPercentage - calculate from deliverables
    const goal = await prisma.goal.create({
      data: {
        orgId: grant.orgId,
        name: grant.name,
        description: grant.description,
        type: "GRANT",
        status: mapGrantStatus(grant.status),
        startDate: grant.startDate,
        endDate: grant.endDate,
        progress: 0, // Will be calculated from deliverables
        createdById: grant.createdById,
        createdAt: grant.createdAt,
      },
    });

    // Create link
    await prisma.goalGrant.create({
      data: {
        goalId: goal.id,
        grantId: grant.id,
      },
    });

    // Copy program links
    for (const programLink of grant.programLinks) {
      await prisma.goalProgramLink.create({
        data: {
          goalId: goal.id,
          programId: programLink.programId,
          isInherited: true,
        },
      });
    }

    created++;
  }

  return { created };
}

/**
 * Create Goals for existing Objectives (one-time migration)
 */
export async function migrateObjectivesToGoals(orgId: string): Promise<{ created: number }> {
  const objectives = await prisma.objective.findMany({
    where: {
      orgId,
      archivedAt: null,
    },
  });

  let created = 0;

  for (const objective of objectives) {
    // Check if Goal already exists for this objective
    const existingLink = await prisma.goalObjective.findFirst({
      where: { objectiveId: objective.id },
    });

    if (existingLink) continue;

    // Create Goal wrapper
    // Note: Objective uses 'progress' (not progressPercentage) and 'endDate' (not dueDate)
    // Objective doesn't have teamId or createdById fields
    const goal = await prisma.goal.create({
      data: {
        orgId: objective.orgId,
        name: objective.title,
        description: objective.description,
        type: "OKR",
        status: mapObjectiveStatus(objective.status),
        startDate: objective.startDate,
        endDate: objective.endDate,
        progress: objective.progress,
        ownerId: objective.ownerId,
        createdById: objective.ownerId, // Use owner as creator
        createdAt: objective.createdAt,
      },
    });

    // Create link
    await prisma.goalObjective.create({
      data: {
        goalId: goal.id,
        objectiveId: objective.id,
      },
    });

    created++;
  }

  return { created };
}

/**
 * Map Grant status to Goal status
 */
function mapGrantStatus(status: string): "NOT_STARTED" | "IN_PROGRESS" | "ON_TRACK" | "AT_RISK" | "BEHIND" | "COMPLETED" {
  switch (status) {
    case "DRAFT":
      return "NOT_STARTED";
    case "ACTIVE":
      return "IN_PROGRESS";
    case "ON_HOLD":
      return "AT_RISK";
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED":
      return "BEHIND";
    default:
      return "NOT_STARTED";
  }
}

/**
 * Map Objective status to Goal status
 */
function mapObjectiveStatus(status: string): "NOT_STARTED" | "IN_PROGRESS" | "ON_TRACK" | "AT_RISK" | "BEHIND" | "COMPLETED" {
  switch (status) {
    case "DRAFT":
      return "NOT_STARTED";
    case "ACTIVE":
      return "IN_PROGRESS";
    case "ON_TRACK":
      return "ON_TRACK";
    case "AT_RISK":
      return "AT_RISK";
    case "BEHIND":
      return "BEHIND";
    case "ACHIEVED":
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED":
      return "BEHIND";
    default:
      return "NOT_STARTED";
  }
}
