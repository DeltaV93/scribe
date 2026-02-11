import { prisma } from "@/lib/db";
import {
  GoalType,
  GoalStatus,
  Prisma,
} from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateGoalInput {
  orgId: string;
  createdById: string;
  name: string;
  description?: string | null;
  type: GoalType;
  startDate?: Date | null;
  endDate?: Date | null;
  ownerId?: string | null;
  teamId?: string | null;
  autoCompleteOnProgress?: boolean;
  status?: GoalStatus;
}

export interface UpdateGoalInput {
  name?: string;
  description?: string | null;
  type?: GoalType;
  startDate?: Date | null;
  endDate?: Date | null;
  ownerId?: string | null;
  teamId?: string | null;
  autoCompleteOnProgress?: boolean;
  status?: GoalStatus;
}

export interface GoalFilters {
  type?: GoalType;
  status?: GoalStatus;
  ownerId?: string;
  teamId?: string;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface GoalWithRelations {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  type: GoalType;
  status: GoalStatus;
  startDate: Date | null;
  endDate: Date | null;
  progress: number;
  ownerId: string | null;
  ownerName: string | null;
  teamId: string | null;
  teamName: string | null;
  autoCompleteOnProgress: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  grants: LinkedGrantSummary[];
  objectives: LinkedObjectiveSummary[];
  kpis: LinkedKpiSummary[];
  programs: LinkedProgramSummary[];
  _count: {
    grants: number;
    objectives: number;
    kpis: number;
    programs: number;
  };
}

export interface LinkedGrantSummary {
  id: string;
  grantId: string;
  name: string;
  status: string;
  progress: number;
  weight: number;
}

export interface LinkedObjectiveSummary {
  id: string;
  objectiveId: string;
  title: string;
  status: string;
  progress: number;
  weight: number;
}

export interface LinkedKpiSummary {
  id: string;
  kpiId: string;
  name: string;
  progress: number;
  weight: number;
}

export interface LinkedProgramSummary {
  id: string;
  programId: string;
  name: string;
  status: string;
}

// ============================================
// GOAL CRUD OPERATIONS
// ============================================

/**
 * Create a new goal
 */
export async function createGoal(
  input: CreateGoalInput
): Promise<GoalWithRelations> {
  const goal = await prisma.goal.create({
    data: {
      orgId: input.orgId,
      createdById: input.createdById,
      name: input.name,
      description: input.description,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      ownerId: input.ownerId,
      teamId: input.teamId,
      autoCompleteOnProgress: input.autoCompleteOnProgress ?? true,
      status: input.status ?? GoalStatus.NOT_STARTED,
    },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      grantLinks: {
        include: {
          grant: {
            select: { id: true, name: true, status: true },
            include: { deliverables: true },
          },
        },
      },
      objectiveLinks: {
        include: {
          objective: { select: { id: true, title: true, status: true, progress: true } },
        },
      },
      kpiLinks: {
        include: {
          kpi: { select: { id: true, name: true, progressPercentage: true } },
        },
      },
      programLinks: {
        include: {
          program: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  return transformGoal(goal);
}

/**
 * Get a goal by ID
 */
export async function getGoalById(
  goalId: string,
  orgId: string
): Promise<GoalWithRelations | null> {
  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      orgId,
      archivedAt: null,
    },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      grantLinks: {
        include: {
          grant: {
            select: { id: true, name: true, status: true },
            include: { deliverables: true },
          },
        },
      },
      objectiveLinks: {
        include: {
          objective: { select: { id: true, title: true, status: true, progress: true } },
        },
      },
      kpiLinks: {
        include: {
          kpi: { select: { id: true, name: true, progressPercentage: true } },
        },
      },
      programLinks: {
        include: {
          program: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  if (!goal) return null;
  return transformGoal(goal);
}

/**
 * Update a goal
 */
export async function updateGoal(
  goalId: string,
  orgId: string,
  input: UpdateGoalInput
): Promise<GoalWithRelations> {
  const goal = await prisma.goal.update({
    where: { id: goalId },
    data: {
      ...input,
      updatedAt: new Date(),
    },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      grantLinks: {
        include: {
          grant: {
            select: { id: true, name: true, status: true },
            include: { deliverables: true },
          },
        },
      },
      objectiveLinks: {
        include: {
          objective: { select: { id: true, title: true, status: true, progress: true } },
        },
      },
      kpiLinks: {
        include: {
          kpi: { select: { id: true, name: true, progressPercentage: true } },
        },
      },
      programLinks: {
        include: {
          program: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  return transformGoal(goal);
}

/**
 * Archive a goal (soft delete)
 */
export async function archiveGoal(goalId: string, orgId: string): Promise<void> {
  await prisma.goal.update({
    where: { id: goalId },
    data: { archivedAt: new Date() },
  });
}

/**
 * List goals with filters and pagination
 */
export async function listGoals(
  orgId: string,
  filters?: GoalFilters,
  pagination?: PaginationOptions
): Promise<{ goals: GoalWithRelations[]; total: number; page: number; limit: number }> {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.GoalWhereInput = {
    orgId,
    archivedAt: null,
    ...(filters?.type && { type: filters.type }),
    ...(filters?.status && { status: filters.status }),
    ...(filters?.ownerId && { ownerId: filters.ownerId }),
    ...(filters?.teamId && { teamId: filters.teamId }),
    ...(filters?.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" as const } },
        { description: { contains: filters.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [goals, total] = await Promise.all([
    prisma.goal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        grantLinks: {
          include: {
            grant: {
              select: { id: true, name: true, status: true },
              include: { deliverables: true },
            },
          },
        },
        objectiveLinks: {
          include: {
            objective: { select: { id: true, title: true, status: true, progress: true } },
          },
        },
        kpiLinks: {
          include: {
            kpi: { select: { id: true, name: true, progressPercentage: true } },
          },
        },
        programLinks: {
          include: {
            program: { select: { id: true, name: true, status: true } },
          },
        },
      },
    }),
    prisma.goal.count({ where }),
  ]);

  return {
    goals: goals.map(transformGoal),
    total,
    page,
    limit,
  };
}

// ============================================
// JUNCTION TABLE OPERATIONS
// ============================================

/**
 * Link a grant to a goal
 */
export async function linkGrantToGoal(
  goalId: string,
  grantId: string,
  weight: number = 1.0
): Promise<void> {
  await prisma.goalGrant.create({
    data: { goalId, grantId, weight },
  });
  await recalculateGoalProgress(goalId);
}

/**
 * Unlink a grant from a goal
 */
export async function unlinkGrantFromGoal(goalId: string, grantId: string): Promise<void> {
  await prisma.goalGrant.deleteMany({
    where: { goalId, grantId },
  });
  await recalculateGoalProgress(goalId);
}

/**
 * Link an objective to a goal
 */
export async function linkObjectiveToGoal(
  goalId: string,
  objectiveId: string,
  weight: number = 1.0
): Promise<void> {
  await prisma.goalObjective.create({
    data: { goalId, objectiveId, weight },
  });
  await recalculateGoalProgress(goalId);
}

/**
 * Unlink an objective from a goal
 */
export async function unlinkObjectiveFromGoal(goalId: string, objectiveId: string): Promise<void> {
  await prisma.goalObjective.deleteMany({
    where: { goalId, objectiveId },
  });
  await recalculateGoalProgress(goalId);
}

/**
 * Link a KPI to a goal
 */
export async function linkKpiToGoal(
  goalId: string,
  kpiId: string,
  weight: number = 1.0
): Promise<void> {
  await prisma.goalKpi.create({
    data: { goalId, kpiId, weight },
  });
  await recalculateGoalProgress(goalId);
}

/**
 * Unlink a KPI from a goal
 */
export async function unlinkKpiFromGoal(goalId: string, kpiId: string): Promise<void> {
  await prisma.goalKpi.deleteMany({
    where: { goalId, kpiId },
  });
  await recalculateGoalProgress(goalId);
}

/**
 * Link a program to a goal
 */
export async function linkProgramToGoal(
  goalId: string,
  programId: string,
  isInherited: boolean = true
): Promise<void> {
  await prisma.goalProgramLink.create({
    data: { goalId, programId, isInherited },
  });
}

/**
 * Unlink a program from a goal
 */
export async function unlinkProgramFromGoal(goalId: string, programId: string): Promise<void> {
  await prisma.goalProgramLink.deleteMany({
    where: { goalId, programId },
  });
}

// ============================================
// GET LINKED ITEMS
// ============================================

/**
 * Get grants linked to a goal
 */
export async function getLinkedGrants(goalId: string): Promise<LinkedGrantSummary[]> {
  const links = await prisma.goalGrant.findMany({
    where: { goalId },
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
    orderBy: { sortOrder: "asc" },
  });

  return links.map((link) => {
    // Calculate grant progress from deliverables
    const deliverables = link.grant.deliverables;
    let progress = 0;
    if (deliverables.length > 0) {
      const totalProgress = deliverables.reduce((sum, d) => {
        return sum + (d.targetValue > 0 ? (d.currentValue / d.targetValue) * 100 : 0);
      }, 0);
      progress = Math.round(totalProgress / deliverables.length);
    }

    return {
      id: link.id,
      grantId: link.grant.id,
      name: link.grant.name,
      status: link.grant.status,
      progress,
      weight: link.weight,
    };
  });
}

/**
 * Get objectives linked to a goal
 */
export async function getLinkedObjectives(goalId: string): Promise<LinkedObjectiveSummary[]> {
  const links = await prisma.goalObjective.findMany({
    where: { goalId },
    include: {
      objective: {
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return links.map((link) => ({
    id: link.id,
    objectiveId: link.objective.id,
    title: link.objective.title,
    status: link.objective.status,
    progress: link.objective.progress,
    weight: link.weight,
  }));
}

/**
 * Get KPIs linked to a goal
 */
export async function getLinkedKpis(goalId: string): Promise<LinkedKpiSummary[]> {
  const links = await prisma.goalKpi.findMany({
    where: { goalId },
    include: {
      kpi: {
        select: {
          id: true,
          name: true,
          metricType: true,
          currentValue: true,
          targetValue: true,
          progressPercentage: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return links.map((link) => ({
    id: link.id,
    kpiId: link.kpi.id,
    name: link.kpi.name,
    metricType: link.kpi.metricType,
    currentValue: link.kpi.currentValue,
    targetValue: link.kpi.targetValue,
    progress: link.kpi.progressPercentage,
    weight: link.weight,
  }));
}

/**
 * Get programs linked to a goal
 */
export async function getLinkedPrograms(goalId: string): Promise<LinkedProgramSummary[]> {
  const links = await prisma.goalProgramLink.findMany({
    where: { goalId },
    include: {
      program: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  return links.map((link) => ({
    id: link.id,
    programId: link.program.id,
    name: link.program.name,
    status: link.program.status,
    isInherited: link.isInherited,
  }));
}

// ============================================
// PROGRESS CALCULATION
// ============================================

/**
 * Recalculate goal progress from children
 * Each child (grant, objective, KPI) counts equally by weight
 */
export async function recalculateGoalProgress(goalId: string): Promise<number> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      grantLinks: {
        include: {
          grant: { include: { deliverables: true } },
        },
      },
      objectiveLinks: {
        include: { objective: true },
      },
      kpiLinks: {
        include: { kpi: true },
      },
    },
  });

  if (!goal) return 0;

  let totalWeight = 0;
  let weightedProgress = 0;

  // Calculate grant progress
  for (const link of goal.grantLinks) {
    const deliverables = link.grant.deliverables;
    if (deliverables.length > 0) {
      const grantProgress = deliverables.reduce((sum, d) => {
        const progress = d.targetValue > 0 ? (d.currentValue / d.targetValue) * 100 : 0;
        return sum + Math.min(100, progress);
      }, 0) / deliverables.length;

      weightedProgress += grantProgress * link.weight;
      totalWeight += link.weight;
    }
  }

  // Calculate objective progress
  for (const link of goal.objectiveLinks) {
    weightedProgress += link.objective.progress * link.weight;
    totalWeight += link.weight;
  }

  // Calculate KPI progress
  for (const link of goal.kpiLinks) {
    weightedProgress += link.kpi.progressPercentage * link.weight;
    totalWeight += link.weight;
  }

  const progress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  // Update goal progress and status
  const previousGoal = await prisma.goal.findUnique({ where: { id: goalId } });
  const previousProgress = previousGoal?.progress ?? 0;
  const previousStatus = previousGoal?.status ?? GoalStatus.NOT_STARTED;

  let newStatus = previousStatus;
  if (clampedProgress >= 100 && goal.autoCompleteOnProgress) {
    newStatus = GoalStatus.COMPLETED;
  } else if (clampedProgress > 0 && previousStatus === GoalStatus.NOT_STARTED) {
    newStatus = GoalStatus.IN_PROGRESS;
  }

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      progress: clampedProgress,
      status: newStatus,
    },
  });

  // Record progress history if changed
  if (previousProgress !== clampedProgress || previousStatus !== newStatus) {
    await prisma.goalProgress.create({
      data: {
        goalId,
        previousValue: previousProgress,
        newValue: clampedProgress,
        previousStatus,
        newStatus,
        triggerType: "auto_calculation",
      },
    });
  }

  return clampedProgress;
}

// ============================================
// GOAL UPDATES (CHECK-INS)
// ============================================

export interface CreateGoalUpdateInput {
  goalId: string;
  content: string;
  createdById: string;
}

export async function createGoalUpdate(input: CreateGoalUpdateInput): Promise<void> {
  const goal = await prisma.goal.findUnique({
    where: { id: input.goalId },
    select: { progress: true, status: true },
  });

  await prisma.goalUpdate.create({
    data: {
      goalId: input.goalId,
      content: input.content,
      createdById: input.createdById,
      progressSnapshot: goal?.progress,
      statusSnapshot: goal?.status,
    },
  });
}

export async function listGoalUpdates(
  goalId: string,
  limit: number = 20
): Promise<Array<{
  id: string;
  content: string;
  progressSnapshot: number | null;
  statusSnapshot: GoalStatus | null;
  createdAt: Date;
  createdBy: { id: string; name: string | null };
}>> {
  const updates = await prisma.goalUpdate.findMany({
    where: { goalId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  return updates;
}

// ============================================
// GOAL DUPLICATION
// ============================================

export interface DuplicateGoalInput {
  goalId: string;
  orgId: string;
  createdById: string;
  newName: string;
  startDate: Date;
  endDate: Date;
  copyDeliverables?: boolean;
  resetProgress?: boolean;
}

export async function duplicateGoal(input: DuplicateGoalInput): Promise<GoalWithRelations> {
  const originalGoal = await prisma.goal.findFirst({
    where: { id: input.goalId, orgId: input.orgId },
    include: {
      grantLinks: true,
      objectiveLinks: true,
      kpiLinks: true,
      programLinks: true,
    },
  });

  if (!originalGoal) {
    throw new Error("Goal not found");
  }

  // Create the new goal
  const newGoal = await prisma.goal.create({
    data: {
      orgId: input.orgId,
      createdById: input.createdById,
      name: input.newName,
      description: originalGoal.description,
      type: originalGoal.type,
      startDate: input.startDate,
      endDate: input.endDate,
      ownerId: originalGoal.ownerId,
      teamId: originalGoal.teamId,
      autoCompleteOnProgress: originalGoal.autoCompleteOnProgress,
      status: GoalStatus.NOT_STARTED,
      progress: 0,
    },
  });

  // Copy program links
  if (originalGoal.programLinks.length > 0) {
    await prisma.goalProgramLink.createMany({
      data: originalGoal.programLinks.map((link) => ({
        goalId: newGoal.id,
        programId: link.programId,
        isInherited: link.isInherited,
      })),
    });
  }

  return getGoalById(newGoal.id, input.orgId) as Promise<GoalWithRelations>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function transformGoal(goal: any): GoalWithRelations {
  const grants = (goal.grantLinks || []).map((link: any) => {
    const deliverables = link.grant.deliverables || [];
    const progress = deliverables.length > 0
      ? deliverables.reduce((sum: number, d: any) => {
          return sum + (d.targetValue > 0 ? (d.currentValue / d.targetValue) * 100 : 0);
        }, 0) / deliverables.length
      : 0;

    return {
      id: link.id,
      grantId: link.grantId,
      name: link.grant.name,
      status: link.grant.status,
      progress: Math.round(Math.min(100, progress)),
      weight: link.weight,
    };
  });

  const objectives = (goal.objectiveLinks || []).map((link: any) => ({
    id: link.id,
    objectiveId: link.objectiveId,
    title: link.objective.title,
    status: link.objective.status,
    progress: link.objective.progress,
    weight: link.weight,
  }));

  const kpis = (goal.kpiLinks || []).map((link: any) => ({
    id: link.id,
    kpiId: link.kpiId,
    name: link.kpi.name,
    progress: link.kpi.progressPercentage,
    weight: link.weight,
  }));

  const programs = (goal.programLinks || []).map((link: any) => ({
    id: link.id,
    programId: link.programId,
    name: link.program.name,
    status: link.program.status,
  }));

  return {
    id: goal.id,
    orgId: goal.orgId,
    name: goal.name,
    description: goal.description,
    type: goal.type,
    status: goal.status,
    startDate: goal.startDate,
    endDate: goal.endDate,
    progress: goal.progress,
    ownerId: goal.ownerId,
    ownerName: goal.owner?.name ?? null,
    teamId: goal.teamId,
    teamName: goal.team?.name ?? null,
    autoCompleteOnProgress: goal.autoCompleteOnProgress,
    createdById: goal.createdById,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    archivedAt: goal.archivedAt,
    grants,
    objectives,
    kpis,
    programs,
    _count: {
      grants: grants.length,
      objectives: objectives.length,
      kpis: kpis.length,
      programs: programs.length,
    },
  };
}
