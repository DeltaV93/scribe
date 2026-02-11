/**
 * Goal Progress Calculation Service
 *
 * Handles progress calculation for goals based on their child items
 * (Grants, Objectives, KPIs) and triggers appropriate notifications.
 */

import { prisma } from "@/lib/db";
import { GoalStatus, GrantStatus, ObjectiveStatus, Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface ProgressCalculation {
  goalId: string;
  previousProgress: number;
  newProgress: number;
  previousStatus: GoalStatus;
  newStatus: GoalStatus;
  components: ProgressComponent[];
}

export interface ProgressComponent {
  type: "grant" | "objective" | "kpi";
  id: string;
  name: string;
  progress: number;
  weight: number;
  weightedContribution: number;
}

export interface ProgressTrigger {
  triggerType: "child_update" | "manual" | "auto_calculation";
  triggerSource?: string;
  notes?: string;
  recordedById?: string;
}

// ============================================
// PROGRESS CALCULATION
// ============================================

/**
 * Calculate goal progress based on linked items
 * Returns weighted average of all children (grants, objectives, KPIs)
 */
export async function calculateGoalProgress(goalId: string): Promise<ProgressCalculation> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      grantLinks: {
        include: {
          grant: {
            select: {
              id: true,
              name: true,
              status: true,
              deliverables: {
                select: { currentValue: true, targetValue: true },
              },
            },
          },
        },
      },
      objectiveLinks: {
        include: {
          objective: {
            select: {
              id: true,
              title: true,
              progress: true,
              status: true,
            },
          },
        },
      },
      kpiLinks: {
        include: {
          kpi: {
            select: {
              id: true,
              name: true,
              progressPercentage: true,
            },
          },
        },
      },
    },
  });

  if (!goal) {
    throw new Error(`Goal ${goalId} not found`);
  }

  const components: ProgressComponent[] = [];
  let totalWeight = 0;

  // Add grant components - calculate progress from deliverables
  for (const link of goal.grantLinks) {
    let progress = 0;
    const deliverables = link.grant.deliverables;
    if (deliverables.length > 0) {
      const totalProgress = deliverables.reduce((sum, d) => {
        return sum + (d.targetValue > 0 ? (d.currentValue / d.targetValue) * 100 : 0);
      }, 0);
      progress = Math.round(totalProgress / deliverables.length);
    }
    components.push({
      type: "grant",
      id: link.grant.id,
      name: link.grant.name,
      progress,
      weight: link.weight,
      weightedContribution: progress * link.weight,
    });
    totalWeight += link.weight;
  }

  // Add objective components - use progress field
  for (const link of goal.objectiveLinks) {
    const progress = link.objective.progress;
    components.push({
      type: "objective",
      id: link.objective.id,
      name: link.objective.title,
      progress,
      weight: link.weight,
      weightedContribution: progress * link.weight,
    });
    totalWeight += link.weight;
  }

  // Add KPI components
  for (const link of goal.kpiLinks) {
    const progress = link.kpi.progressPercentage;
    components.push({
      type: "kpi",
      id: link.kpi.id,
      name: link.kpi.name,
      progress,
      weight: link.weight,
      weightedContribution: progress * link.weight,
    });
    totalWeight += link.weight;
  }

  // Calculate weighted average
  let newProgress = 0;
  if (totalWeight > 0) {
    const totalWeightedProgress = components.reduce(
      (sum, c) => sum + c.weightedContribution,
      0
    );
    newProgress = Math.round(totalWeightedProgress / totalWeight);
  }

  // Clamp progress to 0-100
  newProgress = Math.min(100, Math.max(0, newProgress));

  // Determine new status based on progress and time
  const newStatus = determineGoalStatus(goal, newProgress);

  return {
    goalId,
    previousProgress: goal.progress,
    newProgress,
    previousStatus: goal.status,
    newStatus,
    components,
  };
}

/**
 * Determine goal status based on progress and time remaining
 */
function determineGoalStatus(
  goal: { progress: number; startDate: Date | null; endDate: Date | null; status: GoalStatus },
  newProgress: number
): GoalStatus {
  // If already completed, stay completed
  if (goal.status === GoalStatus.COMPLETED) {
    return GoalStatus.COMPLETED;
  }

  // If progress is 100%, mark as completed
  if (newProgress >= 100) {
    return GoalStatus.COMPLETED;
  }

  // If no progress yet
  if (newProgress === 0) {
    return GoalStatus.NOT_STARTED;
  }

  // Calculate expected progress based on time elapsed
  if (goal.startDate && goal.endDate) {
    const now = new Date();
    const start = new Date(goal.startDate);
    const end = new Date(goal.endDate);

    // If before start date, consider not started
    if (now < start) {
      return GoalStatus.NOT_STARTED;
    }

    // If past end date and not complete, consider behind
    if (now > end && newProgress < 100) {
      return GoalStatus.BEHIND;
    }

    // Calculate expected progress
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const expectedProgress = Math.min(100, (elapsed / totalDuration) * 100);

    // Compare actual vs expected
    const progressDelta = newProgress - expectedProgress;

    if (progressDelta >= -5) {
      // Within 5% of expected = on track
      return GoalStatus.ON_TRACK;
    } else if (progressDelta >= -20) {
      // Between 5-20% behind = at risk
      return GoalStatus.AT_RISK;
    } else {
      // More than 20% behind = behind
      return GoalStatus.BEHIND;
    }
  }

  // No dates set, just use progress-based status
  return GoalStatus.IN_PROGRESS;
}

/**
 * Recalculate and update goal progress
 * Called when child items are updated
 */
export async function recalculateGoalProgress(
  goalId: string,
  trigger?: ProgressTrigger
): Promise<ProgressCalculation> {
  const calculation = await calculateGoalProgress(goalId);

  // Only update if progress or status changed
  if (
    calculation.newProgress !== calculation.previousProgress ||
    calculation.newStatus !== calculation.previousStatus
  ) {
    await prisma.$transaction([
      // Update goal
      prisma.goal.update({
        where: { id: goalId },
        data: {
          progress: calculation.newProgress,
          status: calculation.newStatus,
          updatedAt: new Date(),
        },
      }),
      // Record progress history
      prisma.goalProgress.create({
        data: {
          goalId,
          previousValue: calculation.previousProgress,
          newValue: calculation.newProgress,
          previousStatus: calculation.previousStatus,
          newStatus: calculation.newStatus,
          triggerType: trigger?.triggerType ?? "auto_calculation",
          triggerSource: trigger?.triggerSource,
          notes: trigger?.notes,
          recordedById: trigger?.recordedById,
        },
      }),
    ]);

    // Trigger notifications if needed
    await checkAndTriggerNotifications(goalId, calculation);
  }

  return calculation;
}

/**
 * Check and trigger notifications based on progress changes
 */
async function checkAndTriggerNotifications(
  goalId: string,
  calculation: ProgressCalculation
): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { triggerGoalProgressNotification } = await import("./goal-notifications");

  // Check for milestone notifications (25%, 50%, 75%, 100%)
  const milestones = [25, 50, 75, 100];
  for (const milestone of milestones) {
    if (
      calculation.previousProgress < milestone &&
      calculation.newProgress >= milestone
    ) {
      await triggerGoalProgressNotification(goalId, "milestone", {
        milestone,
        previousProgress: calculation.previousProgress,
        newProgress: calculation.newProgress,
      });
    }
  }

  // Check for status change notifications
  if (calculation.newStatus !== calculation.previousStatus) {
    if (calculation.newStatus === GoalStatus.AT_RISK) {
      await triggerGoalProgressNotification(goalId, "at_risk", {
        previousStatus: calculation.previousStatus,
        newStatus: calculation.newStatus,
      });
    } else if (calculation.newStatus === GoalStatus.BEHIND) {
      await triggerGoalProgressNotification(goalId, "behind", {
        previousStatus: calculation.previousStatus,
        newStatus: calculation.newStatus,
      });
    } else if (calculation.newStatus === GoalStatus.COMPLETED) {
      await triggerGoalProgressNotification(goalId, "completed", {
        completedAt: new Date().toISOString(),
      });
    }
  }
}

/**
 * Trigger progress recalculation for all goals linked to a grant
 */
export async function onGrantProgressUpdated(grantId: string): Promise<void> {
  const links = await prisma.goalGrant.findMany({
    where: { grantId },
    select: { goalId: true },
  });

  await Promise.all(
    links.map((link) =>
      recalculateGoalProgress(link.goalId, {
        triggerType: "child_update",
        triggerSource: `grant:${grantId}`,
      })
    )
  );
}

/**
 * Trigger progress recalculation for all goals linked to an objective
 */
export async function onObjectiveProgressUpdated(objectiveId: string): Promise<void> {
  const links = await prisma.goalObjective.findMany({
    where: { objectiveId },
    select: { goalId: true },
  });

  await Promise.all(
    links.map((link) =>
      recalculateGoalProgress(link.goalId, {
        triggerType: "child_update",
        triggerSource: `objective:${objectiveId}`,
      })
    )
  );
}

/**
 * Trigger progress recalculation for all goals linked to a KPI
 */
export async function onKpiProgressUpdated(kpiId: string): Promise<void> {
  const links = await prisma.goalKpi.findMany({
    where: { kpiId },
    select: { goalId: true },
  });

  await Promise.all(
    links.map((link) =>
      recalculateGoalProgress(link.goalId, {
        triggerType: "child_update",
        triggerSource: `kpi:${kpiId}`,
      })
    )
  );
}

// ============================================
// AGGREGATION HELPERS
// ============================================

/**
 * Get aggregated progress statistics for multiple goals
 */
export async function getGoalsProgressSummary(
  goalIds: string[]
): Promise<{
  totalGoals: number;
  averageProgress: number;
  byStatus: Record<GoalStatus, number>;
  atRiskCount: number;
  completedCount: number;
}> {
  const goals = await prisma.goal.findMany({
    where: { id: { in: goalIds } },
    select: { progress: true, status: true },
  });

  const byStatus: Record<GoalStatus, number> = {
    [GoalStatus.NOT_STARTED]: 0,
    [GoalStatus.IN_PROGRESS]: 0,
    [GoalStatus.ON_TRACK]: 0,
    [GoalStatus.AT_RISK]: 0,
    [GoalStatus.BEHIND]: 0,
    [GoalStatus.COMPLETED]: 0,
  };

  let totalProgress = 0;
  for (const goal of goals) {
    totalProgress += goal.progress;
    byStatus[goal.status]++;
  }

  return {
    totalGoals: goals.length,
    averageProgress: goals.length > 0 ? Math.round(totalProgress / goals.length) : 0,
    byStatus,
    atRiskCount: byStatus[GoalStatus.AT_RISK] + byStatus[GoalStatus.BEHIND],
    completedCount: byStatus[GoalStatus.COMPLETED],
  };
}

/**
 * Get detailed progress breakdown for a goal
 */
export async function getGoalProgressBreakdown(
  goalId: string
): Promise<{
  goal: { id: string; name: string; progress: number; status: GoalStatus };
  components: ProgressComponent[];
  history: Array<{
    previousValue: number;
    newValue: number;
    triggerType: string;
    recordedAt: Date;
  }>;
}> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { id: true, name: true, progress: true, status: true },
  });

  if (!goal) {
    throw new Error(`Goal ${goalId} not found`);
  }

  const calculation = await calculateGoalProgress(goalId);

  const history = await prisma.goalProgress.findMany({
    where: { goalId },
    orderBy: { recordedAt: "desc" },
    take: 20,
    select: {
      previousValue: true,
      newValue: true,
      triggerType: true,
      recordedAt: true,
    },
  });

  return {
    goal,
    components: calculation.components,
    history,
  };
}
