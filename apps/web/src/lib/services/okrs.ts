import { prisma } from "@/lib/db";
import {
  ObjectiveStatus,
  KeyResultStatus,
  Prisma,
} from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateObjectiveInput {
  orgId: string;
  ownerId: string;
  title: string;
  description?: string | null;
  parentId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: ObjectiveStatus;
}

export interface UpdateObjectiveInput {
  title?: string;
  description?: string | null;
  ownerId?: string;
  parentId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: ObjectiveStatus;
}

export interface CreateKeyResultInput {
  objectiveId: string;
  title: string;
  description?: string | null;
  targetValue: number;
  startValue?: number;
  unit?: string | null;
  weight?: number;
}

export interface UpdateKeyResultInput {
  title?: string;
  description?: string | null;
  targetValue?: number;
  startValue?: number;
  unit?: string | null;
  weight?: number;
}

export interface ObjectiveFilters {
  status?: ObjectiveStatus;
  ownerId?: string;
  parentId?: string | null;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface ObjectiveWithRelations {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  parentId: string | null;
  status: ObjectiveStatus;
  startDate: Date | null;
  endDate: Date | null;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  keyResults: KeyResultWithProgress[];
  childCount: number;
}

export interface KeyResultWithProgress {
  id: string;
  objectiveId: string;
  title: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  startValue: number;
  unit: string | null;
  weight: number;
  status: KeyResultStatus;
  progressPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ObjectiveTreeNode extends ObjectiveWithRelations {
  children: ObjectiveTreeNode[];
}

export interface ObjectiveUpdateWithUser {
  id: string;
  objectiveId: string;
  content: string;
  progressSnapshot: number | null;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

// ============================================
// OBJECTIVE CRUD OPERATIONS
// ============================================

/**
 * Create a new objective
 */
export async function createObjective(
  input: CreateObjectiveInput
): Promise<ObjectiveWithRelations> {
  const objective = await prisma.objective.create({
    data: {
      orgId: input.orgId,
      ownerId: input.ownerId,
      title: input.title,
      description: input.description,
      parentId: input.parentId,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status ?? ObjectiveStatus.DRAFT,
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      keyResults: true,
      _count: {
        select: { children: true },
      },
    },
  });

  return transformObjective(objective);
}

/**
 * Get an objective by ID
 */
export async function getObjectiveById(
  objectiveId: string,
  orgId: string
): Promise<ObjectiveWithRelations | null> {
  const objective = await prisma.objective.findFirst({
    where: {
      id: objectiveId,
      orgId,
      archivedAt: null,
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      keyResults: {
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { children: true },
      },
    },
  });

  if (!objective) return null;
  return transformObjective(objective);
}

/**
 * Update an objective
 */
export async function updateObjective(
  objectiveId: string,
  orgId: string,
  input: UpdateObjectiveInput
): Promise<ObjectiveWithRelations> {
  const objective = await prisma.objective.update({
    where: {
      id: objectiveId,
      orgId,
    },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.ownerId !== undefined && { ownerId: input.ownerId }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate !== undefined && { endDate: input.endDate }),
      ...(input.status !== undefined && { status: input.status }),
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      keyResults: {
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { children: true },
      },
    },
  });

  return transformObjective(objective);
}

/**
 * Archive an objective (soft delete)
 */
export async function archiveObjective(
  objectiveId: string,
  orgId: string
): Promise<void> {
  await prisma.objective.update({
    where: {
      id: objectiveId,
      orgId,
    },
    data: {
      archivedAt: new Date(),
      status: ObjectiveStatus.CANCELLED,
    },
  });
}

/**
 * List objectives with filtering and pagination
 */
export async function listObjectives(
  orgId: string,
  filters: ObjectiveFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ objectives: ObjectiveWithRelations[]; total: number; hasMore: boolean }> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where: Prisma.ObjectiveWhereInput = {
    orgId,
    archivedAt: null,
    ...(filters.status && { status: filters.status }),
    ...(filters.ownerId && { ownerId: filters.ownerId }),
    ...(filters.parentId !== undefined && { parentId: filters.parentId }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const [objectives, total] = await Promise.all([
    prisma.objective.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        keyResults: {
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { children: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.objective.count({ where }),
  ]);

  return {
    objectives: objectives.map(transformObjective),
    total,
    hasMore: skip + objectives.length < total,
  };
}

/**
 * Get hierarchical tree view of objectives
 */
export async function getObjectiveTree(
  orgId: string,
  rootOnly: boolean = true
): Promise<ObjectiveTreeNode[]> {
  // Fetch all objectives for the org
  const allObjectives = await prisma.objective.findMany({
    where: {
      orgId,
      archivedAt: null,
      ...(rootOnly && { parentId: null }),
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      keyResults: {
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { children: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (rootOnly) {
    // For root-only, fetch children recursively
    const buildTree = async (parentId: string | null): Promise<ObjectiveTreeNode[]> => {
      const objectives = await prisma.objective.findMany({
        where: {
          orgId,
          parentId,
          archivedAt: null,
        },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          keyResults: {
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: { children: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const nodes: ObjectiveTreeNode[] = [];
      for (const obj of objectives) {
        const children = await buildTree(obj.id);
        nodes.push({
          ...transformObjective(obj),
          children,
        });
      }
      return nodes;
    };

    return buildTree(null);
  }

  // Non-recursive: return flat list with no children
  return allObjectives.map((obj) => ({
    ...transformObjective(obj),
    children: [],
  }));
}

// ============================================
// KEY RESULT OPERATIONS
// ============================================

/**
 * Create a key result for an objective
 */
export async function createKeyResult(
  input: CreateKeyResultInput
): Promise<KeyResultWithProgress> {
  const keyResult = await prisma.keyResult.create({
    data: {
      objectiveId: input.objectiveId,
      title: input.title,
      description: input.description,
      targetValue: input.targetValue,
      startValue: input.startValue ?? 0,
      currentValue: input.startValue ?? 0,
      unit: input.unit,
      weight: input.weight ?? 1.0,
      status: KeyResultStatus.NOT_STARTED,
    },
  });

  // Recalculate objective progress
  await calculateObjectiveProgress(input.objectiveId);

  return transformKeyResult(keyResult);
}

/**
 * Update a key result
 */
export async function updateKeyResult(
  keyResultId: string,
  input: UpdateKeyResultInput
): Promise<KeyResultWithProgress> {
  const keyResult = await prisma.keyResult.update({
    where: { id: keyResultId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.targetValue !== undefined && { targetValue: input.targetValue }),
      ...(input.startValue !== undefined && { startValue: input.startValue }),
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.weight !== undefined && { weight: input.weight }),
    },
  });

  // Recalculate objective progress
  await calculateObjectiveProgress(keyResult.objectiveId);

  return transformKeyResult(keyResult);
}

/**
 * Delete a key result
 */
export async function deleteKeyResult(keyResultId: string): Promise<void> {
  const keyResult = await prisma.keyResult.findUnique({
    where: { id: keyResultId },
    select: { objectiveId: true },
  });

  await prisma.keyResult.delete({
    where: { id: keyResultId },
  });

  // Recalculate objective progress
  if (keyResult) {
    await calculateObjectiveProgress(keyResult.objectiveId);
  }
}

/**
 * Get a key result by ID
 */
export async function getKeyResultById(
  keyResultId: string
): Promise<KeyResultWithProgress | null> {
  const keyResult = await prisma.keyResult.findUnique({
    where: { id: keyResultId },
  });

  if (!keyResult) return null;
  return transformKeyResult(keyResult);
}

/**
 * List key results for an objective
 */
export async function listKeyResults(
  objectiveId: string
): Promise<KeyResultWithProgress[]> {
  const keyResults = await prisma.keyResult.findMany({
    where: { objectiveId },
    orderBy: { createdAt: "asc" },
  });

  return keyResults.map(transformKeyResult);
}

/**
 * Update key result progress value
 */
export async function updateKeyResultProgress(
  keyResultId: string,
  newValue: number,
  recordedById: string,
  notes?: string
): Promise<KeyResultWithProgress> {
  const keyResult = await prisma.keyResult.findUnique({
    where: { id: keyResultId },
  });

  if (!keyResult) {
    throw new Error(`Key result ${keyResultId} not found`);
  }

  const previousValue = keyResult.currentValue;

  // Calculate new status based on progress
  const progressPct = calculateKeyResultProgress(newValue, keyResult.startValue, keyResult.targetValue);
  let newStatus: KeyResultStatus;
  if (progressPct >= 100) {
    newStatus = KeyResultStatus.COMPLETED;
  } else if (progressPct === 0) {
    newStatus = KeyResultStatus.NOT_STARTED;
  } else if (progressPct < 50) {
    newStatus = KeyResultStatus.AT_RISK;
  } else {
    newStatus = KeyResultStatus.IN_PROGRESS;
  }

  // Update key result and create progress record in transaction
  const [updatedKeyResult] = await prisma.$transaction([
    prisma.keyResult.update({
      where: { id: keyResultId },
      data: {
        currentValue: newValue,
        status: newStatus,
      },
    }),
    prisma.keyResultProgress.create({
      data: {
        keyResultId,
        previousValue,
        newValue,
        notes,
        recordedById,
      },
    }),
  ]);

  // Recalculate objective progress
  await calculateObjectiveProgress(keyResult.objectiveId);

  return transformKeyResult(updatedKeyResult);
}

/**
 * Get progress history for a key result
 */
export async function getKeyResultProgressHistory(
  keyResultId: string,
  options?: { limit?: number; cursor?: string }
) {
  const take = options?.limit ?? 50;

  const history = await prisma.keyResultProgress.findMany({
    where: { keyResultId },
    orderBy: { recordedAt: "desc" },
    take: take + 1,
    ...(options?.cursor && {
      cursor: { id: options.cursor },
      skip: 1,
    }),
    include: {
      recordedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  const hasMore = history.length > take;
  const results = hasMore ? history.slice(0, take) : history;
  const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

  return {
    history: results,
    nextCursor,
    hasMore,
  };
}

// ============================================
// PROGRESS CALCULATION
// ============================================

/**
 * Calculate and update objective progress based on key results
 */
export async function calculateObjectiveProgress(
  objectiveId: string
): Promise<number> {
  const keyResults = await prisma.keyResult.findMany({
    where: { objectiveId },
  });

  if (keyResults.length === 0) {
    await prisma.objective.update({
      where: { id: objectiveId },
      data: { progress: 0 },
    });
    return 0;
  }

  // Calculate weighted average progress
  let totalWeight = 0;
  let weightedProgress = 0;

  for (const kr of keyResults) {
    const progress = calculateKeyResultProgress(kr.currentValue, kr.startValue, kr.targetValue);
    weightedProgress += progress * kr.weight;
    totalWeight += kr.weight;
  }

  const overallProgress = totalWeight > 0
    ? Math.round(weightedProgress / totalWeight)
    : 0;

  // Update objective progress
  await prisma.objective.update({
    where: { id: objectiveId },
    data: { progress: Math.min(100, Math.max(0, overallProgress)) },
  });

  return overallProgress;
}

/**
 * Calculate progress percentage for a key result
 */
function calculateKeyResultProgress(
  currentValue: number,
  startValue: number,
  targetValue: number
): number {
  const range = targetValue - startValue;
  if (range === 0) return currentValue >= targetValue ? 100 : 0;

  const progress = ((currentValue - startValue) / range) * 100;
  return Math.min(100, Math.max(0, progress));
}

// ============================================
// OBJECTIVE UPDATES (CHECK-INS)
// ============================================

/**
 * Add a check-in update to an objective
 */
export async function addObjectiveUpdate(
  objectiveId: string,
  content: string,
  createdById: string
): Promise<ObjectiveUpdateWithUser> {
  // Get current progress for snapshot
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    select: { progress: true },
  });

  const update = await prisma.objectiveUpdate.create({
    data: {
      objectiveId,
      content,
      progressSnapshot: objective?.progress ?? 0,
      createdById,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return {
    id: update.id,
    objectiveId: update.objectiveId,
    content: update.content,
    progressSnapshot: update.progressSnapshot,
    createdAt: update.createdAt,
    createdBy: update.createdBy,
  };
}

/**
 * List updates for an objective
 */
export async function listObjectiveUpdates(
  objectiveId: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ updates: ObjectiveUpdateWithUser[]; nextCursor?: string; hasMore: boolean }> {
  const take = options?.limit ?? 20;

  const updates = await prisma.objectiveUpdate.findMany({
    where: { objectiveId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(options?.cursor && {
      cursor: { id: options.cursor },
      skip: 1,
    }),
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  const hasMore = updates.length > take;
  const results = hasMore ? updates.slice(0, take) : updates;
  const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

  return {
    updates: results.map((u) => ({
      id: u.id,
      objectiveId: u.objectiveId,
      content: u.content,
      progressSnapshot: u.progressSnapshot,
      createdAt: u.createdAt,
      createdBy: u.createdBy,
    })),
    nextCursor,
    hasMore,
  };
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get OKR statistics for an organization
 */
export async function getOKRStats(orgId: string) {
  const [
    totalObjectives,
    activeObjectives,
    completedObjectives,
    totalKeyResults,
    completedKeyResults,
  ] = await Promise.all([
    prisma.objective.count({ where: { orgId, archivedAt: null } }),
    prisma.objective.count({
      where: { orgId, archivedAt: null, status: ObjectiveStatus.ACTIVE },
    }),
    prisma.objective.count({
      where: { orgId, archivedAt: null, status: ObjectiveStatus.COMPLETED },
    }),
    prisma.keyResult.count({
      where: { objective: { orgId, archivedAt: null } },
    }),
    prisma.keyResult.count({
      where: {
        objective: { orgId, archivedAt: null },
        status: KeyResultStatus.COMPLETED,
      },
    }),
  ]);

  // Calculate average progress of active objectives
  const activeObjectivesData = await prisma.objective.findMany({
    where: { orgId, archivedAt: null, status: ObjectiveStatus.ACTIVE },
    select: { progress: true },
  });

  const averageProgress = activeObjectivesData.length > 0
    ? Math.round(
        activeObjectivesData.reduce((sum, o) => sum + o.progress, 0) /
          activeObjectivesData.length
      )
    : 0;

  return {
    totalObjectives,
    activeObjectives,
    completedObjectives,
    draftObjectives: totalObjectives - activeObjectives - completedObjectives,
    totalKeyResults,
    completedKeyResults,
    averageProgress,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function transformObjective(
  objective: Prisma.ObjectiveGetPayload<{
    include: {
      owner: { select: { id: true; name: true; email: true } };
      keyResults: true;
      _count: { select: { children: true } };
    };
  }>
): ObjectiveWithRelations {
  return {
    id: objective.id,
    orgId: objective.orgId,
    title: objective.title,
    description: objective.description,
    ownerId: objective.ownerId,
    ownerName: objective.owner.name,
    ownerEmail: objective.owner.email,
    parentId: objective.parentId,
    status: objective.status,
    startDate: objective.startDate,
    endDate: objective.endDate,
    progress: objective.progress,
    createdAt: objective.createdAt,
    updatedAt: objective.updatedAt,
    archivedAt: objective.archivedAt,
    keyResults: objective.keyResults.map(transformKeyResult),
    childCount: objective._count.children,
  };
}

function transformKeyResult(
  keyResult: Prisma.KeyResultGetPayload<{}>
): KeyResultWithProgress {
  const progressPercentage = calculateKeyResultProgress(
    keyResult.currentValue,
    keyResult.startValue,
    keyResult.targetValue
  );

  return {
    id: keyResult.id,
    objectiveId: keyResult.objectiveId,
    title: keyResult.title,
    description: keyResult.description,
    targetValue: keyResult.targetValue,
    currentValue: keyResult.currentValue,
    startValue: keyResult.startValue,
    unit: keyResult.unit,
    weight: keyResult.weight,
    status: keyResult.status,
    progressPercentage: Math.round(progressPercentage),
    createdAt: keyResult.createdAt,
    updatedAt: keyResult.updatedAt,
  };
}
