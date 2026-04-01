import { prisma } from "@/lib/db";
import {
  GoalType,
  GoalStatus,
  Prisma,
} from "@prisma/client";
import mlServices from "@/lib/ml-services/client";

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

// ============================================
// GOAL EMBEDDINGS (Goal Deduplication Feature)
// ============================================

/**
 * Generate and store embedding for a goal
 * Fire-and-forget: logs errors but doesn't throw
 */
export async function updateGoalEmbedding(goalId: string): Promise<void> {
  try {
    // Fetch goal name and description
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      select: { id: true, name: true, description: true },
    });

    if (!goal) {
      console.warn(`[updateGoalEmbedding] Goal not found: ${goalId}`);
      return;
    }

    // Generate embedding via ml-services
    const response = await mlServices.goalEmbeddings.generate({
      name: goal.name,
      description: goal.description ?? undefined,
    });

    // Store embedding in goal record
    await prisma.goal.update({
      where: { id: goalId },
      data: {
        embedding: response.embedding,
        embeddingModel: response.model_name,
        embeddingUpdatedAt: new Date(),
      },
    });
  } catch (error) {
    // Log but don't throw - embeddings are non-critical
    console.error(`[updateGoalEmbedding] Failed to update embedding for goal ${goalId}:`, error);
  }
}

// ============================================
// SIMILAR GOALS SEARCH
// ============================================

export interface FindSimilarGoalsOptions {
  threshold?: number; // Default 0.5
  topK?: number; // Default 5
  excludeIds?: string[];
  excludeDrafts?: boolean; // Default true
}

export interface SimilarGoalResult {
  goalId: string;
  goalName: string;
  similarity: number;
}

/**
 * Find similar goals using embedding similarity
 */
export async function findSimilarGoals(
  orgId: string,
  queryText: string,
  options?: FindSimilarGoalsOptions
): Promise<SimilarGoalResult[]> {
  const threshold = options?.threshold ?? 0.5;
  const topK = options?.topK ?? 5;
  const excludeIds = options?.excludeIds ?? [];
  const excludeDrafts = options?.excludeDrafts ?? true;

  try {
    // Fetch goals with embeddings from this org
    const whereClause: Prisma.GoalWhereInput = {
      orgId,
      archivedAt: null,
      embedding: { not: Prisma.JsonNull },
    };

    if (excludeDrafts) {
      whereClause.status = { not: GoalStatus.DRAFT };
    }

    if (excludeIds.length > 0) {
      whereClause.id = { notIn: excludeIds };
    }

    const goals = await prisma.goal.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        embedding: true,
      },
    });

    if (goals.length === 0) {
      return [];
    }

    // Build candidates array for ml-services
    const candidates = goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      description: goal.description ?? undefined,
      embedding: goal.embedding as number[],
    }));

    // Call ml-services to find similar goals
    const response = await mlServices.goalEmbeddings.findSimilar({
      query_text: queryText,
      candidates,
      threshold,
      top_k: topK,
    });

    return response.matches.map((match) => ({
      goalId: match.goal_id,
      goalName: match.goal_name,
      similarity: match.similarity,
    }));
  } catch (error) {
    console.error(`[findSimilarGoals] Failed to find similar goals:`, error);
    // Return empty array on error - graceful degradation
    return [];
  }
}

// ============================================
// DRAFT GOAL MANAGEMENT
// ============================================

export interface CreateDraftGoalInput {
  orgId: string;
  createdById: string;
  name: string;
  description?: string | null;
  type: GoalType;
  sourceCallId?: string | null;
  visibility?: string | null; // "PRIVATE" | "TEAM" | "USERS" | "ROLE"
  visibleToRoles?: string[];
  visibleToUserIds?: string[];
  visibleToTeamIds?: string[];
}

/**
 * Create a goal with DRAFT status
 * Includes visibility controls and generates embedding async
 */
export async function createDraftGoal(
  input: CreateDraftGoalInput
): Promise<GoalWithRelations> {
  const goal = await prisma.$transaction(async (tx) => {
    // Create the draft goal
    const newGoal = await tx.goal.create({
      data: {
        orgId: input.orgId,
        createdById: input.createdById,
        name: input.name,
        description: input.description,
        type: input.type,
        status: GoalStatus.DRAFT,
        sourceType: input.sourceCallId ? "call_extraction" : "manual",
        sourceCallId: input.sourceCallId,
        visibility: input.visibility ?? "PRIVATE",
        visibleToRoles: input.visibleToRoles ?? [],
      },
      include: {
        owner: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        grantLinks: {
          include: {
            grant: {
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

    // Create user visibility records
    if (input.visibleToUserIds && input.visibleToUserIds.length > 0) {
      await tx.goalUserVisibility.createMany({
        data: input.visibleToUserIds.map((userId) => ({
          goalId: newGoal.id,
          userId,
          canEdit: false,
        })),
      });
    }

    // Create team visibility records
    if (input.visibleToTeamIds && input.visibleToTeamIds.length > 0) {
      await tx.goalTeamVisibility.createMany({
        data: input.visibleToTeamIds.map((teamId) => ({
          goalId: newGoal.id,
          teamId,
          canEdit: false,
        })),
      });
    }

    return newGoal;
  });

  // Fire-and-forget: generate embedding asynchronously
  updateGoalEmbedding(goal.id).catch(() => {
    // Already logged in updateGoalEmbedding
  });

  return transformGoal(goal);
}

export interface PublishDraftGoalOptions {
  mergeIntoGoalId?: string; // If provided, merge into existing goal instead of publishing
}

/**
 * Publish a draft goal or merge it into an existing goal
 */
export async function publishDraftGoal(
  draftGoalId: string,
  orgId: string,
  options?: PublishDraftGoalOptions
): Promise<GoalWithRelations> {
  const draftGoal = await prisma.goal.findFirst({
    where: {
      id: draftGoalId,
      orgId,
      status: GoalStatus.DRAFT,
    },
    include: {
      mentioningCalls: true,
    },
  });

  if (!draftGoal) {
    throw new Error("Draft goal not found");
  }

  if (options?.mergeIntoGoalId) {
    // Merge into existing goal
    return await mergeDraftIntoGoal(draftGoal, options.mergeIntoGoalId, orgId);
  }

  // Publish as new goal
  const publishedGoal = await prisma.$transaction(async (tx) => {
    // Update draft to published status
    const goal = await tx.goal.update({
      where: { id: draftGoalId },
      data: {
        status: GoalStatus.NOT_STARTED,
        // Clear draft-specific visibility fields
        visibility: null,
        visibleToRoles: [],
      },
      include: {
        owner: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        grantLinks: {
          include: {
            grant: {
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
        mentioningCalls: true,
      },
    });

    // Delete visibility junction records (no longer needed for published goals)
    await tx.goalUserVisibility.deleteMany({
      where: { goalId: draftGoalId },
    });
    await tx.goalTeamVisibility.deleteMany({
      where: { goalId: draftGoalId },
    });

    // Create CallGoalDraft records for all mentioning calls
    if (goal.mentioningCalls.length > 0) {
      for (const mention of goal.mentioningCalls) {
        await tx.callGoalDraft.create({
          data: {
            callId: mention.callId,
            goalId: goal.id,
            narrative: `Goal mentioned in call: ${mention.mentionedText}`,
            actionItems: [],
            keyPoints: [],
            topics: [],
            mappingType: "embedding_matched",
            confidence: mention.confidence,
            status: "APPROVED",
          },
        });
      }

      // Clear the draft mentions
      await tx.draftGoalCallMention.deleteMany({
        where: { goalId: draftGoalId },
      });
    }

    return goal;
  });

  return transformGoal(publishedGoal);
}

/**
 * Merge a draft goal into an existing goal
 * Links all mentioning calls to the target goal, then deletes the draft
 */
async function mergeDraftIntoGoal(
  draftGoal: any,
  targetGoalId: string,
  orgId: string
): Promise<GoalWithRelations> {
  const targetGoal = await prisma.goal.findFirst({
    where: {
      id: targetGoalId,
      orgId,
      archivedAt: null,
    },
  });

  if (!targetGoal) {
    throw new Error("Target goal not found");
  }

  const updatedGoal = await prisma.$transaction(async (tx) => {
    // Create CallGoalDraft records linking mentioning calls to target goal
    if (draftGoal.mentioningCalls && draftGoal.mentioningCalls.length > 0) {
      for (const mention of draftGoal.mentioningCalls) {
        // Check if CallGoalDraft already exists for this call+goal combo
        const existing = await tx.callGoalDraft.findFirst({
          where: {
            callId: mention.callId,
            goalId: targetGoalId,
          },
        });

        if (!existing) {
          await tx.callGoalDraft.create({
            data: {
              callId: mention.callId,
              goalId: targetGoalId,
              narrative: `Goal mentioned in call: ${mention.mentionedText}`,
              actionItems: [],
              keyPoints: [],
              topics: [],
              mappingType: "embedding_matched",
              confidence: mention.confidence,
              status: "APPROVED",
            },
          });
        }
      }
    }

    // Delete the draft goal and its related records (cascade handles junctions)
    await tx.draftGoalCallMention.deleteMany({
      where: { goalId: draftGoal.id },
    });
    await tx.goalUserVisibility.deleteMany({
      where: { goalId: draftGoal.id },
    });
    await tx.goalTeamVisibility.deleteMany({
      where: { goalId: draftGoal.id },
    });
    await tx.goal.delete({
      where: { id: draftGoal.id },
    });

    // Return the updated target goal
    return tx.goal.findUnique({
      where: { id: targetGoalId },
      include: {
        owner: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        grantLinks: {
          include: {
            grant: {
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
  });

  if (!updatedGoal) {
    throw new Error("Failed to fetch merged goal");
  }

  return transformGoal(updatedGoal);
}

// ============================================
// DRAFT GOAL VISIBILITY
// ============================================

/**
 * Check if a user can view a draft goal
 * Checks creator, visibility settings, user/team visibility, and role-based access
 */
export async function canViewDraftGoal(
  userId: string,
  goalId: string
): Promise<boolean> {
  // Fetch the goal and user info
  const [goal, user] = await Promise.all([
    prisma.goal.findUnique({
      where: { id: goalId },
      select: {
        id: true,
        createdById: true,
        status: true,
        visibility: true,
        visibleToRoles: true,
        visibleToUsers: {
          where: { userId },
          select: { id: true },
        },
        visibleToTeams: {
          select: { teamId: true },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        teamMemberships: {
          select: { teamId: true },
        },
      },
    }),
  ]);

  if (!goal || !user) {
    return false;
  }

  // Non-draft goals are visible through normal permission checks
  if (goal.status !== GoalStatus.DRAFT) {
    return true;
  }

  // Creator always has access
  if (goal.createdById === userId) {
    return true;
  }

  const visibility = goal.visibility;

  // PRIVATE: only creator (already checked above)
  if (visibility === "PRIVATE" || !visibility) {
    return false;
  }

  // USERS: check explicit user visibility
  if (visibility === "USERS") {
    return goal.visibleToUsers.length > 0;
  }

  // TEAM: check team membership visibility
  if (visibility === "TEAM") {
    const userTeamIds = user.teamMemberships.map((m) => m.teamId);
    const goalTeamIds = goal.visibleToTeams.map((t) => t.teamId);
    return goalTeamIds.some((teamId) => userTeamIds.includes(teamId));
  }

  // ROLE: check role-based visibility
  if (visibility === "ROLE") {
    const userRole = user.role as string;
    return goal.visibleToRoles.includes(userRole);
  }

  return false;
}
