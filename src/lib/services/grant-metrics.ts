import { prisma } from "@/lib/db";
import { MetricType, DeliverableStatus, KpiMetricType } from "@prisma/client";
import { incrementDeliverable, ProgressSource } from "./grants";
import { recordKpiProgress } from "./kpis";

// ============================================
// TYPES
// ============================================

export interface MetricEvent {
  orgId: string;
  metricType: MetricType;
  programId?: string;
  clientId?: string;
  sourceType: string;
  sourceId: string;
  delta?: number; // Default: 1
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Track a metric event and update applicable deliverables and KPIs
 * This function is called from other services when trackable events occur
 */
export async function trackMetricEvent(event: MetricEvent): Promise<void> {
  const delta = event.delta ?? 1;

  // Find all applicable deliverables
  const deliverables = await findApplicableDeliverables(
    event.orgId,
    event.metricType,
    event.programId
  );

  // Find all applicable KPIs
  const kpis = await findApplicableKpis(
    event.orgId,
    event.metricType,
    event.programId
  );

  // Update deliverables
  const source: ProgressSource = {
    sourceType: event.sourceType,
    sourceId: event.sourceId,
  };

  const deliverableUpdates = deliverables.map((d) =>
    incrementDeliverable(d.id, delta, source).catch((err) => {
      // Log error but don't fail the entire operation
      console.error(`Failed to increment deliverable ${d.id}:`, err);
    })
  );

  // Update KPIs
  const kpiUpdates = kpis.map(async (kpi) => {
    try {
      await recordKpiProgress(kpi.id, kpi.currentValue + delta, {
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        notes: `Auto-tracked from ${event.sourceType}`,
      });
    } catch (err) {
      console.error(`Failed to increment KPI ${kpi.id}:`, err);
    }
  });

  await Promise.all([...deliverableUpdates, ...kpiUpdates]);
}

/**
 * Called when a client enrollment is created
 */
export async function onEnrollmentCreated(enrollment: {
  id: string;
  clientId: string;
  programId: string;
  orgId: string;
}): Promise<void> {
  await trackMetricEvent({
    orgId: enrollment.orgId,
    metricType: MetricType.CLIENTS_ENROLLED,
    programId: enrollment.programId,
    clientId: enrollment.clientId,
    sourceType: "enrollment",
    sourceId: enrollment.id,
  });
}

/**
 * Called when a client completes a program
 */
export async function onEnrollmentCompleted(enrollment: {
  id: string;
  clientId: string;
  programId: string;
  orgId: string;
}): Promise<void> {
  await trackMetricEvent({
    orgId: enrollment.orgId,
    metricType: MetricType.PROGRAM_COMPLETIONS,
    programId: enrollment.programId,
    clientId: enrollment.clientId,
    sourceType: "enrollment",
    sourceId: enrollment.id,
  });
}

/**
 * Called when a program session is delivered
 */
export async function onSessionDelivered(session: {
  id: string;
  programId: string;
  orgId: string;
}): Promise<void> {
  await trackMetricEvent({
    orgId: session.orgId,
    metricType: MetricType.SESSIONS_DELIVERED,
    programId: session.programId,
    sourceType: "session",
    sourceId: session.id,
  });
}

/**
 * Called when a call is completed
 */
export async function onCallCompleted(call: {
  id: string;
  clientId: string;
  orgId: string;
}): Promise<void> {
  await trackMetricEvent({
    orgId: call.orgId,
    metricType: MetricType.CLIENT_CONTACTS,
    clientId: call.clientId,
    sourceType: "call",
    sourceId: call.id,
  });
}

/**
 * Called when a form submission is created
 */
export async function onFormSubmitted(submission: {
  id: string;
  clientId?: string;
  orgId: string;
  formId: string;
}): Promise<void> {
  await trackMetricEvent({
    orgId: submission.orgId,
    metricType: MetricType.FORM_SUBMISSIONS,
    clientId: submission.clientId,
    sourceType: "form_submission",
    sourceId: submission.id,
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find all deliverables that should be updated for a given metric event
 */
async function findApplicableDeliverables(
  orgId: string,
  metricType: MetricType,
  programId?: string
): Promise<{ id: string; grantId: string }[]> {
  // Get all active grants for this org
  const grants = await prisma.grant.findMany({
    where: {
      orgId,
      status: { in: ["DRAFT", "ACTIVE"] },
      archivedAt: null,
    },
    select: {
      id: true,
      programLinks: {
        select: { programId: true },
      },
      deliverables: {
        where: {
          metricType,
          status: { notIn: [DeliverableStatus.COMPLETED] },
        },
        select: { id: true },
      },
    },
  });

  const applicableDeliverables: { id: string; grantId: string }[] = [];

  for (const grant of grants) {
    // If programId is provided, check if the grant is linked to that program
    if (programId) {
      const isLinked = grant.programLinks.some((link) => link.programId === programId);
      if (!isLinked && grant.programLinks.length > 0) {
        // Grant has program links but not to this program - skip
        continue;
      }
      // If grant has no program links, it applies to all programs in the org
    }

    // Add all matching deliverables
    for (const deliverable of grant.deliverables) {
      applicableDeliverables.push({
        id: deliverable.id,
        grantId: grant.id,
      });
    }
  }

  return applicableDeliverables;
}

/**
 * Find all KPIs that should be updated for a given metric event
 */
async function findApplicableKpis(
  orgId: string,
  metricType: MetricType,
  programId?: string
): Promise<{ id: string; currentValue: number }[]> {
  // Map MetricType to KpiMetricType - COUNT-based metrics map to COUNT
  const kpiMetricType = mapMetricTypeToKpiMetricType(metricType);

  if (!kpiMetricType) {
    return [];
  }

  // Get all active KPIs for this org that match the metric type
  const kpis = await prisma.kpi.findMany({
    where: {
      orgId,
      metricType: kpiMetricType,
      archivedAt: null,
      // Only include KPIs within their active date range
      OR: [
        { startDate: null, endDate: null },
        {
          startDate: { lte: new Date() },
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
      ],
    },
    select: {
      id: true,
      currentValue: true,
      programLinks: {
        select: { programId: true },
      },
      // Check if KPI has dataSourceConfig matching this metric type
      dataSourceConfig: true,
    },
  });

  const applicableKpis: { id: string; currentValue: number }[] = [];

  for (const kpi of kpis) {
    // Check dataSourceConfig to see if this KPI should track this metric type
    const config = kpi.dataSourceConfig as { metricType?: string } | null;
    if (config?.metricType && config.metricType !== metricType) {
      continue;
    }

    // If programId is provided, check if the KPI is linked to that program
    if (programId && kpi.programLinks.length > 0) {
      const isLinked = kpi.programLinks.some((link) => link.programId === programId);
      if (!isLinked) {
        // KPI has program links but not to this program - skip
        continue;
      }
    }

    applicableKpis.push({
      id: kpi.id,
      currentValue: kpi.currentValue,
    });
  }

  return applicableKpis;
}

/**
 * Map MetricType enum to KpiMetricType enum
 */
function mapMetricTypeToKpiMetricType(metricType: MetricType): KpiMetricType | null {
  switch (metricType) {
    case MetricType.CLIENTS_ENROLLED:
    case MetricType.PROGRAM_COMPLETIONS:
    case MetricType.SESSIONS_DELIVERED:
    case MetricType.CLIENT_CONTACTS:
    case MetricType.FORM_SUBMISSIONS:
    case MetricType.CLIENTS_HOUSED:
      return KpiMetricType.COUNT;
    case MetricType.CUSTOM:
      return null; // Custom metrics need specific handling
    default:
      return null;
  }
}

/**
 * Recalculate all deliverable values for a grant
 * Useful for data corrections or initial setup
 */
export async function recalculateAllDeliverables(
  grantId: string,
  userId?: string
): Promise<void> {
  const grant = await prisma.grant.findUnique({
    where: { id: grantId },
    include: {
      deliverables: true,
      programLinks: { select: { programId: true } },
    },
  });

  if (!grant) {
    throw new Error(`Grant ${grantId} not found`);
  }

  const linkedProgramIds = grant.programLinks.map((l) => l.programId);

  for (const deliverable of grant.deliverables) {
    const count = await countMetricValue(
      grant.orgId,
      deliverable.metricType,
      grant.startDate,
      grant.endDate,
      linkedProgramIds.length > 0 ? linkedProgramIds : undefined
    );

    const previousValue = deliverable.currentValue;
    const delta = count - previousValue;

    if (delta !== 0) {
      await incrementDeliverable(deliverable.id, delta, {
        sourceType: "manual",
        notes: "Recalculated from system data",
        recordedById: userId,
      });
    }
  }
}

/**
 * Count the actual metric value from the database
 */
async function countMetricValue(
  orgId: string,
  metricType: MetricType,
  startDate: Date,
  endDate: Date,
  programIds?: string[]
): Promise<number> {
  const dateFilter = {
    gte: startDate,
    lte: endDate,
  };

  switch (metricType) {
    case MetricType.CLIENTS_ENROLLED:
      return prisma.programEnrollment.count({
        where: {
          program: {
            orgId,
            ...(programIds && { id: { in: programIds } }),
          },
          enrolledDate: dateFilter,
        },
      });

    case MetricType.PROGRAM_COMPLETIONS:
      return prisma.programEnrollment.count({
        where: {
          program: {
            orgId,
            ...(programIds && { id: { in: programIds } }),
          },
          status: "COMPLETED",
          completionDate: dateFilter,
        },
      });

    case MetricType.SESSIONS_DELIVERED:
      return prisma.programSession.count({
        where: {
          program: {
            orgId,
            ...(programIds && { id: { in: programIds } }),
          },
          date: dateFilter,
        },
      });

    case MetricType.CLIENT_CONTACTS:
      return prisma.call.count({
        where: {
          client: { orgId },
          status: "COMPLETED",
          startedAt: dateFilter,
        },
      });

    case MetricType.FORM_SUBMISSIONS:
      return prisma.formSubmission.count({
        where: {
          form: { orgId },
          createdAt: dateFilter,
        },
      });

    case MetricType.CLIENTS_HOUSED:
      // Custom metric - would need specific form field tracking
      // For now return 0, will be implemented with custom config
      return 0;

    case MetricType.CUSTOM:
      // Custom metrics need specific configuration
      return 0;

    default:
      return 0;
  }
}

/**
 * Get a summary of metric activity for a grant
 */
export async function getMetricSummary(
  grantId: string
): Promise<{
  byType: Record<MetricType, { target: number; current: number; percentage: number }>;
  recentEvents: Array<{
    deliverableId: string;
    deliverableName: string;
    delta: number;
    sourceType: string;
    recordedAt: Date;
  }>;
}> {
  const grant = await prisma.grant.findUnique({
    where: { id: grantId },
    include: {
      deliverables: {
        include: {
          progressEvents: {
            orderBy: { recordedAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!grant) {
    throw new Error(`Grant ${grantId} not found`);
  }

  // Aggregate by metric type
  const byType: Record<MetricType, { target: number; current: number; percentage: number }> =
    {} as Record<MetricType, { target: number; current: number; percentage: number }>;

  for (const deliverable of grant.deliverables) {
    if (!byType[deliverable.metricType]) {
      byType[deliverable.metricType] = { target: 0, current: 0, percentage: 0 };
    }
    byType[deliverable.metricType].target += deliverable.targetValue;
    byType[deliverable.metricType].current += deliverable.currentValue;
  }

  // Calculate percentages
  for (const type of Object.keys(byType) as MetricType[]) {
    const { target, current } = byType[type];
    byType[type].percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  }

  // Collect recent events
  const recentEvents = grant.deliverables.flatMap((d) =>
    d.progressEvents.map((e) => ({
      deliverableId: d.id,
      deliverableName: d.name,
      delta: e.delta,
      sourceType: e.sourceType,
      recordedAt: e.recordedAt,
    }))
  );

  // Sort by date and take top 10
  recentEvents.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

  return {
    byType,
    recentEvents: recentEvents.slice(0, 10),
  };
}
