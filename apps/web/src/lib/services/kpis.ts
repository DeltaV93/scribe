import { prisma } from "@/lib/db";
import { KpiMetricType, Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateKpiInput {
  orgId: string;
  createdById: string;
  name: string;
  description?: string | null;
  parentKpiId?: string | null;
  metricType: KpiMetricType;
  targetValue: number;
  startValue?: number;
  unit?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  trackingFrequency?: string | null;
  ownerId?: string | null;
  teamId?: string | null;
  dataSourceConfig?: KpiDataSourceConfig | null;
}

export interface UpdateKpiInput {
  name?: string;
  description?: string | null;
  parentKpiId?: string | null;
  metricType?: KpiMetricType;
  targetValue?: number;
  startValue?: number;
  unit?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  trackingFrequency?: string | null;
  ownerId?: string | null;
  teamId?: string | null;
  dataSourceConfig?: KpiDataSourceConfig | null;
}

export interface KpiDataSourceConfig {
  type: "form_field" | "enrollment" | "attendance" | "manual";
  formId?: string;
  fieldSlug?: string;
  aggregation?: "count" | "sum" | "average";
  programIds?: string[];
}

export interface KpiFilters {
  parentKpiId?: string | null;
  ownerId?: string;
  teamId?: string;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface KpiWithRelations {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  parentKpiId: string | null;
  metricType: KpiMetricType;
  targetValue: number;
  currentValue: number;
  startValue: number;
  unit: string | null;
  startDate: Date | null;
  endDate: Date | null;
  trackingFrequency: string | null;
  progressPercentage: number;
  ownerId: string | null;
  ownerName: string | null;
  teamId: string | null;
  teamName: string | null;
  dataSourceConfig: KpiDataSourceConfig | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  childCount: number;
  linkedGoalsCount: number;
}

export interface KpiTreeNode extends KpiWithRelations {
  children: KpiTreeNode[];
}

export interface ProgressSource {
  sourceType: string; // "manual", "form_submission", "api", "scheduled"
  sourceId?: string;
  notes?: string;
  recordedById?: string;
}

// ============================================
// KPI CRUD OPERATIONS
// ============================================

/**
 * Create a new KPI
 */
export async function createKpi(input: CreateKpiInput): Promise<KpiWithRelations> {
  const kpi = await prisma.kpi.create({
    data: {
      orgId: input.orgId,
      createdById: input.createdById,
      name: input.name,
      description: input.description,
      parentKpiId: input.parentKpiId,
      metricType: input.metricType,
      targetValue: input.targetValue,
      startValue: input.startValue ?? 0,
      currentValue: input.startValue ?? 0,
      unit: input.unit,
      startDate: input.startDate,
      endDate: input.endDate,
      trackingFrequency: input.trackingFrequency,
      ownerId: input.ownerId,
      teamId: input.teamId,
      dataSourceConfig: input.dataSourceConfig as any,
      progressPercentage: 0,
    },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      _count: {
        select: { childKpis: true, goalLinks: true },
      },
    },
  });

  return transformKpi(kpi);
}

/**
 * Get a KPI by ID
 */
export async function getKpiById(
  kpiId: string,
  orgId: string
): Promise<KpiWithRelations | null> {
  const kpi = await prisma.kpi.findFirst({
    where: {
      id: kpiId,
      orgId,
      archivedAt: null,
    },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      _count: {
        select: { childKpis: true, goalLinks: true },
      },
    },
  });

  if (!kpi) return null;
  return transformKpi(kpi);
}

/**
 * Update a KPI
 */
export async function updateKpi(
  kpiId: string,
  orgId: string,
  input: UpdateKpiInput
): Promise<KpiWithRelations> {
  const kpi = await prisma.kpi.update({
    where: { id: kpiId },
    data: {
      ...input,
      dataSourceConfig: input.dataSourceConfig as any,
      updatedAt: new Date(),
    },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      _count: {
        select: { childKpis: true, goalLinks: true },
      },
    },
  });

  // Recalculate progress if target changed
  if (input.targetValue !== undefined) {
    await recalculateKpiProgress(kpiId);
  }

  return transformKpi(kpi);
}

/**
 * Archive a KPI (soft delete)
 */
export async function archiveKpi(kpiId: string, orgId: string): Promise<void> {
  await prisma.kpi.update({
    where: { id: kpiId },
    data: { archivedAt: new Date() },
  });
}

/**
 * List KPIs with filters and pagination
 */
export async function listKpis(
  orgId: string,
  filters?: KpiFilters,
  pagination?: PaginationOptions
): Promise<{ kpis: KpiWithRelations[]; total: number; page: number; limit: number }> {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.KpiWhereInput = {
    orgId,
    archivedAt: null,
    ...(filters?.parentKpiId !== undefined && { parentKpiId: filters.parentKpiId }),
    ...(filters?.ownerId && { ownerId: filters.ownerId }),
    ...(filters?.teamId && { teamId: filters.teamId }),
    ...(filters?.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" as const } },
        { description: { contains: filters.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [kpis, total] = await Promise.all([
    prisma.kpi.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        _count: {
          select: { childKpis: true, goalLinks: true },
        },
      },
    }),
    prisma.kpi.count({ where }),
  ]);

  return {
    kpis: kpis.map(transformKpi),
    total,
    page,
    limit,
  };
}

// ============================================
// HIERARCHICAL OPERATIONS
// ============================================

/**
 * Get KPI tree (root KPIs with nested children)
 */
export async function getKpiTree(orgId: string): Promise<KpiTreeNode[]> {
  const allKpis = await prisma.kpi.findMany({
    where: { orgId, archivedAt: null },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      _count: {
        select: { childKpis: true, goalLinks: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const kpiMap = new Map<string, KpiTreeNode>();
  const rootKpis: KpiTreeNode[] = [];

  // First pass: create all nodes
  for (const kpi of allKpis) {
    kpiMap.set(kpi.id, { ...transformKpi(kpi), children: [] });
  }

  // Second pass: build tree structure
  for (const kpi of allKpis) {
    const node = kpiMap.get(kpi.id)!;
    if (kpi.parentKpiId && kpiMap.has(kpi.parentKpiId)) {
      kpiMap.get(kpi.parentKpiId)!.children.push(node);
    } else {
      rootKpis.push(node);
    }
  }

  return rootKpis;
}

/**
 * Get child KPIs
 */
export async function getChildKpis(
  parentKpiId: string,
  orgId: string
): Promise<KpiWithRelations[]> {
  const kpis = await prisma.kpi.findMany({
    where: {
      parentKpiId,
      orgId,
      archivedAt: null,
    },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      _count: {
        select: { childKpis: true, goalLinks: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return kpis.map(transformKpi);
}

// ============================================
// PROGRESS TRACKING
// ============================================

/**
 * Increment KPI value
 */
export async function incrementKpi(
  kpiId: string,
  delta: number,
  source: ProgressSource
): Promise<void> {
  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
  });

  if (!kpi) return;

  const previousValue = kpi.currentValue;
  const newValue = previousValue + delta;

  await prisma.$transaction([
    prisma.kpi.update({
      where: { id: kpiId },
      data: { currentValue: newValue },
    }),
    prisma.kpiProgress.create({
      data: {
        kpiId,
        previousValue,
        newValue,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        notes: source.notes,
        recordedById: source.recordedById,
      },
    }),
  ]);

  await recalculateKpiProgress(kpiId);
}

/**
 * Record KPI progress (set absolute value)
 */
export async function recordKpiProgress(
  kpiId: string,
  newValue: number,
  source: ProgressSource
): Promise<void> {
  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
  });

  if (!kpi) return;

  const previousValue = kpi.currentValue;

  await prisma.$transaction([
    prisma.kpi.update({
      where: { id: kpiId },
      data: { currentValue: newValue },
    }),
    prisma.kpiProgress.create({
      data: {
        kpiId,
        previousValue,
        newValue,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        notes: source.notes,
        recordedById: source.recordedById,
      },
    }),
  ]);

  await recalculateKpiProgress(kpiId);
}

/**
 * Get KPI progress history
 */
export async function getKpiProgressHistory(
  kpiId: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  previousValue: number;
  newValue: number;
  notes: string | null;
  sourceType: string | null;
  sourceId: string | null;
  recordedAt: Date;
  recordedBy: { id: string; name: string | null } | null;
}>> {
  const history = await prisma.kpiProgress.findMany({
    where: { kpiId },
    orderBy: { recordedAt: "desc" },
    take: limit,
    include: {
      recordedBy: { select: { id: true, name: true } },
    },
  });

  return history;
}

/**
 * Recalculate KPI progress percentage
 */
export async function recalculateKpiProgress(kpiId: string): Promise<number> {
  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
    include: { goalLinks: true },
  });

  if (!kpi) return 0;

  // Calculate progress percentage
  let progress = 0;
  if (kpi.targetValue > 0) {
    progress = ((kpi.currentValue - kpi.startValue) / (kpi.targetValue - kpi.startValue)) * 100;
  }
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  await prisma.kpi.update({
    where: { id: kpiId },
    data: { progressPercentage: clampedProgress },
  });

  // Trigger goal progress recalculation for linked goals
  for (const link of kpi.goalLinks) {
    // Import dynamically to avoid circular dependency
    const { recalculateGoalProgress } = await import("./goals");
    await recalculateGoalProgress(link.goalId);
  }

  return clampedProgress;
}

// ============================================
// PROGRAM LINKING
// ============================================

/**
 * Link a program to a KPI
 */
export async function linkProgramToKpi(kpiId: string, programId: string): Promise<void> {
  await prisma.kpiProgramLink.create({
    data: { kpiId, programId },
  });
}

/**
 * Unlink a program from a KPI
 */
export async function unlinkProgramFromKpi(kpiId: string, programId: string): Promise<void> {
  await prisma.kpiProgramLink.deleteMany({
    where: { kpiId, programId },
  });
}

/**
 * Get programs linked to a KPI
 */
export async function getLinkedPrograms(
  kpiId: string
): Promise<Array<{ id: string; programId: string; programName: string; status: string }>> {
  const links = await prisma.kpiProgramLink.findMany({
    where: { kpiId },
    include: {
      program: { select: { id: true, name: true, status: true } },
    },
  });

  return links.map((link) => ({
    id: link.id,
    programId: link.programId,
    programName: link.program.name,
    status: link.program.status,
  }));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function transformKpi(kpi: any): KpiWithRelations {
  return {
    id: kpi.id,
    orgId: kpi.orgId,
    name: kpi.name,
    description: kpi.description,
    parentKpiId: kpi.parentKpiId,
    metricType: kpi.metricType,
    targetValue: kpi.targetValue,
    currentValue: kpi.currentValue,
    startValue: kpi.startValue,
    unit: kpi.unit,
    startDate: kpi.startDate,
    endDate: kpi.endDate,
    trackingFrequency: kpi.trackingFrequency,
    progressPercentage: kpi.progressPercentage,
    ownerId: kpi.ownerId,
    ownerName: kpi.owner?.name ?? null,
    teamId: kpi.teamId,
    teamName: kpi.team?.name ?? null,
    dataSourceConfig: kpi.dataSourceConfig as KpiDataSourceConfig | null,
    createdById: kpi.createdById,
    createdAt: kpi.createdAt,
    updatedAt: kpi.updatedAt,
    archivedAt: kpi.archivedAt,
    childCount: kpi._count?.childKpis ?? 0,
    linkedGoalsCount: kpi._count?.goalLinks ?? 0,
  };
}
