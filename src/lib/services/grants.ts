import { prisma } from "@/lib/db";
import {
  GrantStatus,
  MetricType,
  DeliverableStatus,
  ProgressEventType,
  Prisma,
} from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateGrantInput {
  orgId: string;
  createdById: string;
  name: string;
  funderName?: string | null;
  grantNumber?: string | null;
  description?: string | null;
  startDate: Date;
  endDate: Date;
  reportingFrequency?: string | null;
  exportTemplateId?: string | null;
  notificationSettings?: NotificationSettings;
  status?: GrantStatus;
}

export interface UpdateGrantInput {
  name?: string;
  funderName?: string | null;
  grantNumber?: string | null;
  description?: string | null;
  startDate?: Date;
  endDate?: Date;
  reportingFrequency?: string | null;
  exportTemplateId?: string | null;
  notificationSettings?: NotificationSettings;
  status?: GrantStatus;
}

export interface NotificationSettings {
  progressAlerts?: number[]; // e.g., [25, 50, 75, 100]
  daysBeforeDeadline?: number[]; // e.g., [30, 7, 1]
  recipients?: string[]; // User IDs to notify
}

export interface CreateDeliverableInput {
  grantId: string;
  name: string;
  description?: string | null;
  metricType: MetricType;
  targetValue: number;
  customConfig?: DeliverableCustomConfig | null;
  dueDate?: Date | null;
  autoReportOnComplete?: boolean;
  reportTemplateId?: string | null;
}

export interface UpdateDeliverableInput {
  name?: string;
  description?: string | null;
  metricType?: MetricType;
  targetValue?: number;
  customConfig?: DeliverableCustomConfig | null;
  dueDate?: Date | null;
  autoReportOnComplete?: boolean;
  reportTemplateId?: string | null;
}

export interface DeliverableCustomConfig {
  formFieldSlug?: string;
  countCondition?: string; // e.g., "equals:true", "gte:10"
  programIds?: string[]; // Limit to specific programs
}

export interface GrantFilters {
  status?: GrantStatus;
  funderName?: string;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface ProgressSource {
  sourceType: string; // "enrollment", "session", "call", "form_submission", "manual"
  sourceId?: string;
  notes?: string;
  recordedById?: string;
}

export interface GrantWithRelations {
  id: string;
  orgId: string;
  name: string;
  funderName: string | null;
  grantNumber: string | null;
  description: string | null;
  status: GrantStatus;
  startDate: Date;
  endDate: Date;
  reportingFrequency: string | null;
  exportTemplateId: string | null;
  notificationSettings: NotificationSettings;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  deliverables: DeliverableWithProgress[];
  programLinks: ProgramLinkInfo[];
  _count?: {
    deliverables: number;
    programLinks: number;
    reports: number;
  };
}

export interface DeliverableWithProgress {
  id: string;
  grantId: string;
  name: string;
  description: string | null;
  metricType: MetricType;
  targetValue: number;
  currentValue: number;
  customConfig: DeliverableCustomConfig | null;
  dueDate: Date | null;
  status: DeliverableStatus;
  completedAt: Date | null;
  autoReportOnComplete: boolean;
  reportTemplateId: string | null;
  createdAt: Date;
  updatedAt: Date;
  progressPercentage: number;
}

export interface ProgramLinkInfo {
  id: string;
  programId: string;
  programName: string;
  programStatus: string;
}

export interface GrantStats {
  totalDeliverables: number;
  completedDeliverables: number;
  inProgressDeliverables: number;
  atRiskDeliverables: number;
  overdueDeliverables: number;
  overallProgress: number; // 0-100
  linkedPrograms: number;
  daysRemaining: number;
}

// ============================================
// GRANT CRUD OPERATIONS
// ============================================

/**
 * Create a new grant
 */
export async function createGrant(
  input: CreateGrantInput
): Promise<GrantWithRelations> {
  const grant = await prisma.grant.create({
    data: {
      orgId: input.orgId,
      createdById: input.createdById,
      name: input.name,
      funderName: input.funderName,
      grantNumber: input.grantNumber,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      reportingFrequency: input.reportingFrequency,
      exportTemplateId: input.exportTemplateId,
      notificationSettings: (input.notificationSettings as Prisma.JsonObject) ?? {},
      status: input.status ?? GrantStatus.DRAFT,
    },
    include: {
      deliverables: true,
      programLinks: {
        include: {
          program: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
      _count: {
        select: {
          deliverables: true,
          programLinks: true,
          reports: true,
        },
      },
    },
  });

  return transformGrant(grant);
}

/**
 * Get a grant by ID
 */
export async function getGrantById(
  grantId: string,
  orgId: string
): Promise<GrantWithRelations | null> {
  const grant = await prisma.grant.findFirst({
    where: {
      id: grantId,
      orgId,
      archivedAt: null,
    },
    include: {
      deliverables: {
        orderBy: { createdAt: "asc" },
      },
      programLinks: {
        include: {
          program: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
      _count: {
        select: {
          deliverables: true,
          programLinks: true,
          reports: true,
        },
      },
    },
  });

  if (!grant) return null;
  return transformGrant(grant);
}

/**
 * Update a grant
 */
export async function updateGrant(
  grantId: string,
  orgId: string,
  input: UpdateGrantInput
): Promise<GrantWithRelations> {
  const grant = await prisma.grant.update({
    where: {
      id: grantId,
      orgId,
    },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.funderName !== undefined && { funderName: input.funderName }),
      ...(input.grantNumber !== undefined && { grantNumber: input.grantNumber }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate !== undefined && { endDate: input.endDate }),
      ...(input.reportingFrequency !== undefined && {
        reportingFrequency: input.reportingFrequency,
      }),
      ...(input.exportTemplateId !== undefined && {
        exportTemplateId: input.exportTemplateId,
      }),
      ...(input.notificationSettings !== undefined && {
        notificationSettings: input.notificationSettings as Prisma.JsonObject,
      }),
      ...(input.status !== undefined && { status: input.status }),
    },
    include: {
      deliverables: {
        orderBy: { createdAt: "asc" },
      },
      programLinks: {
        include: {
          program: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
      _count: {
        select: {
          deliverables: true,
          programLinks: true,
          reports: true,
        },
      },
    },
  });

  return transformGrant(grant);
}

/**
 * Archive a grant (soft delete)
 */
export async function archiveGrant(grantId: string, orgId: string): Promise<void> {
  await prisma.grant.update({
    where: {
      id: grantId,
      orgId,
    },
    data: {
      archivedAt: new Date(),
      status: GrantStatus.ARCHIVED,
    },
  });
}

/**
 * List grants with filtering and pagination
 */
export async function listGrants(
  orgId: string,
  filters: GrantFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ grants: GrantWithRelations[]; total: number; hasMore: boolean }> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where: Prisma.GrantWhereInput = {
    orgId,
    archivedAt: null,
    ...(filters.status && { status: filters.status }),
    ...(filters.funderName && {
      funderName: { contains: filters.funderName, mode: "insensitive" },
    }),
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { grantNumber: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const [grants, total] = await Promise.all([
    prisma.grant.findMany({
      where,
      include: {
        deliverables: {
          orderBy: { createdAt: "asc" },
        },
        programLinks: {
          include: {
            program: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            deliverables: true,
            programLinks: true,
            reports: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.grant.count({ where }),
  ]);

  return {
    grants: grants.map(transformGrant),
    total,
    hasMore: skip + grants.length < total,
  };
}

/**
 * Get grant statistics
 */
export async function getGrantStats(
  grantId: string,
  orgId: string
): Promise<GrantStats | null> {
  const grant = await prisma.grant.findFirst({
    where: { id: grantId, orgId, archivedAt: null },
    include: {
      deliverables: true,
      _count: {
        select: { programLinks: true },
      },
    },
  });

  if (!grant) return null;

  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((grant.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const stats: GrantStats = {
    totalDeliverables: grant.deliverables.length,
    completedDeliverables: grant.deliverables.filter(
      (d) => d.status === DeliverableStatus.COMPLETED
    ).length,
    inProgressDeliverables: grant.deliverables.filter(
      (d) => d.status === DeliverableStatus.IN_PROGRESS
    ).length,
    atRiskDeliverables: grant.deliverables.filter(
      (d) => d.status === DeliverableStatus.AT_RISK
    ).length,
    overdueDeliverables: grant.deliverables.filter(
      (d) => d.status === DeliverableStatus.OVERDUE
    ).length,
    overallProgress: calculateOverallProgress(grant.deliverables),
    linkedPrograms: grant._count.programLinks,
    daysRemaining,
  };

  return stats;
}

// ============================================
// DELIVERABLE OPERATIONS
// ============================================

/**
 * Create a deliverable for a grant
 */
export async function createDeliverable(
  input: CreateDeliverableInput
): Promise<DeliverableWithProgress> {
  const deliverable = await prisma.grantDeliverable.create({
    data: {
      grantId: input.grantId,
      name: input.name,
      description: input.description,
      metricType: input.metricType,
      targetValue: input.targetValue,
      customConfig: (input.customConfig as Prisma.JsonObject) ?? null,
      dueDate: input.dueDate,
      autoReportOnComplete: input.autoReportOnComplete ?? true,
      reportTemplateId: input.reportTemplateId,
      status: DeliverableStatus.NOT_STARTED,
    },
  });

  return transformDeliverable(deliverable);
}

/**
 * Update a deliverable
 */
export async function updateDeliverable(
  deliverableId: string,
  input: UpdateDeliverableInput
): Promise<DeliverableWithProgress> {
  const deliverable = await prisma.grantDeliverable.update({
    where: { id: deliverableId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.metricType !== undefined && { metricType: input.metricType }),
      ...(input.targetValue !== undefined && { targetValue: input.targetValue }),
      ...(input.customConfig !== undefined && {
        customConfig: input.customConfig as Prisma.JsonObject,
      }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(input.autoReportOnComplete !== undefined && {
        autoReportOnComplete: input.autoReportOnComplete,
      }),
      ...(input.reportTemplateId !== undefined && {
        reportTemplateId: input.reportTemplateId,
      }),
    },
  });

  return transformDeliverable(deliverable);
}

/**
 * Delete a deliverable
 */
export async function deleteDeliverable(deliverableId: string): Promise<void> {
  await prisma.grantDeliverable.delete({
    where: { id: deliverableId },
  });
}

/**
 * Get a deliverable by ID
 */
export async function getDeliverableById(
  deliverableId: string
): Promise<DeliverableWithProgress | null> {
  const deliverable = await prisma.grantDeliverable.findUnique({
    where: { id: deliverableId },
  });

  if (!deliverable) return null;
  return transformDeliverable(deliverable);
}

/**
 * List deliverables for a grant
 */
export async function listDeliverables(
  grantId: string,
  filters?: { status?: DeliverableStatus }
): Promise<DeliverableWithProgress[]> {
  const deliverables = await prisma.grantDeliverable.findMany({
    where: {
      grantId,
      ...(filters?.status && { status: filters.status }),
    },
    orderBy: { createdAt: "asc" },
  });

  return deliverables.map(transformDeliverable);
}

// ============================================
// PROGRESS TRACKING
// ============================================

/**
 * Increment a deliverable's progress
 */
export async function incrementDeliverable(
  deliverableId: string,
  delta: number,
  source: ProgressSource
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Get current deliverable
    const deliverable = await tx.grantDeliverable.findUnique({
      where: { id: deliverableId },
    });

    if (!deliverable) {
      throw new Error(`Deliverable ${deliverableId} not found`);
    }

    const previousValue = deliverable.currentValue;
    const newValue = Math.max(0, previousValue + delta);

    // Update deliverable
    await tx.grantDeliverable.update({
      where: { id: deliverableId },
      data: {
        currentValue: newValue,
        status: calculateDeliverableStatus(newValue, deliverable.targetValue, deliverable.dueDate),
        ...(newValue >= deliverable.targetValue &&
          !deliverable.completedAt && { completedAt: new Date() }),
      },
    });

    // Record progress event
    await tx.deliverableProgress.create({
      data: {
        deliverableId,
        eventType: delta > 0 ? ProgressEventType.INCREMENT : ProgressEventType.DECREMENT,
        delta,
        previousValue,
        newValue,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        notes: source.notes,
        recordedById: source.recordedById,
      },
    });
  });
}

/**
 * Get progress history for a deliverable
 */
export async function getProgressHistory(
  deliverableId: string,
  options?: { limit?: number; cursor?: string }
) {
  const take = options?.limit ?? 50;

  const events = await prisma.deliverableProgress.findMany({
    where: { deliverableId },
    orderBy: { recordedAt: "desc" },
    take: take + 1, // Fetch one extra to determine if there are more
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

  const hasMore = events.length > take;
  const results = hasMore ? events.slice(0, take) : events;
  const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

  return {
    events: results,
    nextCursor,
    hasMore,
  };
}

/**
 * Recalculate deliverable status based on current state
 */
export async function recalculateDeliverableStatus(
  deliverableId: string
): Promise<DeliverableStatus> {
  const deliverable = await prisma.grantDeliverable.findUnique({
    where: { id: deliverableId },
    include: {
      grant: { select: { startDate: true, endDate: true } },
    },
  });

  if (!deliverable) {
    throw new Error(`Deliverable ${deliverableId} not found`);
  }

  const status = calculateDeliverableStatus(
    deliverable.currentValue,
    deliverable.targetValue,
    deliverable.dueDate,
    deliverable.grant.startDate
  );

  if (status !== deliverable.status) {
    await prisma.grantDeliverable.update({
      where: { id: deliverableId },
      data: {
        status,
        ...(status === DeliverableStatus.COMPLETED &&
          !deliverable.completedAt && { completedAt: new Date() }),
      },
    });
  }

  return status;
}

// ============================================
// PROGRAM LINKING
// ============================================

/**
 * Link a program to a grant
 */
export async function linkProgramToGrant(
  grantId: string,
  programId: string,
  orgId: string
): Promise<void> {
  // Verify both grant and program belong to org
  const [grant, program] = await Promise.all([
    prisma.grant.findFirst({ where: { id: grantId, orgId } }),
    prisma.program.findFirst({ where: { id: programId, orgId } }),
  ]);

  if (!grant) throw new Error("Grant not found");
  if (!program) throw new Error("Program not found");

  await prisma.grantProgramLink.upsert({
    where: {
      grantId_programId: { grantId, programId },
    },
    create: { grantId, programId },
    update: {},
  });
}

/**
 * Unlink a program from a grant
 */
export async function unlinkProgramFromGrant(
  grantId: string,
  programId: string
): Promise<void> {
  await prisma.grantProgramLink.deleteMany({
    where: { grantId, programId },
  });
}

/**
 * Get programs linked to a grant
 */
export async function getLinkedPrograms(grantId: string): Promise<ProgramLinkInfo[]> {
  const links = await prisma.grantProgramLink.findMany({
    where: { grantId },
    include: {
      program: {
        select: { id: true, name: true, status: true },
      },
    },
  });

  return links.map((link) => ({
    id: link.id,
    programId: link.program.id,
    programName: link.program.name,
    programStatus: link.program.status,
  }));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function transformGrant(grant: Prisma.GrantGetPayload<{
  include: {
    deliverables: true;
    programLinks: {
      include: {
        program: { select: { id: true; name: true; status: true } };
      };
    };
    _count: { select: { deliverables: true; programLinks: true; reports: true } };
  };
}>): GrantWithRelations {
  return {
    id: grant.id,
    orgId: grant.orgId,
    name: grant.name,
    funderName: grant.funderName,
    grantNumber: grant.grantNumber,
    description: grant.description,
    status: grant.status,
    startDate: grant.startDate,
    endDate: grant.endDate,
    reportingFrequency: grant.reportingFrequency,
    exportTemplateId: grant.exportTemplateId,
    notificationSettings: (grant.notificationSettings as NotificationSettings) ?? {},
    createdById: grant.createdById,
    createdAt: grant.createdAt,
    updatedAt: grant.updatedAt,
    archivedAt: grant.archivedAt,
    deliverables: grant.deliverables.map(transformDeliverable),
    programLinks: grant.programLinks.map((link) => ({
      id: link.id,
      programId: link.program.id,
      programName: link.program.name,
      programStatus: link.program.status,
    })),
    _count: grant._count,
  };
}

function transformDeliverable(
  deliverable: Prisma.GrantDeliverableGetPayload<{}>
): DeliverableWithProgress {
  const progressPercentage =
    deliverable.targetValue > 0
      ? Math.min(100, Math.round((deliverable.currentValue / deliverable.targetValue) * 100))
      : 0;

  return {
    id: deliverable.id,
    grantId: deliverable.grantId,
    name: deliverable.name,
    description: deliverable.description,
    metricType: deliverable.metricType,
    targetValue: deliverable.targetValue,
    currentValue: deliverable.currentValue,
    customConfig: deliverable.customConfig as DeliverableCustomConfig | null,
    dueDate: deliverable.dueDate,
    status: deliverable.status,
    completedAt: deliverable.completedAt,
    autoReportOnComplete: deliverable.autoReportOnComplete,
    reportTemplateId: deliverable.reportTemplateId,
    createdAt: deliverable.createdAt,
    updatedAt: deliverable.updatedAt,
    progressPercentage,
  };
}

function calculateDeliverableStatus(
  currentValue: number,
  targetValue: number,
  dueDate: Date | null,
  grantStartDate?: Date
): DeliverableStatus {
  const progressPct = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  const now = new Date();

  if (progressPct >= 100) return DeliverableStatus.COMPLETED;
  if (progressPct === 0) return DeliverableStatus.NOT_STARTED;

  // Check if overdue
  if (dueDate && dueDate < now) {
    return DeliverableStatus.OVERDUE;
  }

  // Check if at risk (< 50% progress and > 75% time elapsed)
  if (dueDate && grantStartDate) {
    const totalDays = Math.ceil(
      (dueDate.getTime() - grantStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysElapsed = Math.ceil(
      (now.getTime() - grantStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const timeElapsedPct = (daysElapsed / totalDays) * 100;

    if (progressPct < 50 && timeElapsedPct > 75) {
      return DeliverableStatus.AT_RISK;
    }
  }

  return DeliverableStatus.IN_PROGRESS;
}

function calculateOverallProgress(
  deliverables: { currentValue: number; targetValue: number }[]
): number {
  if (deliverables.length === 0) return 0;

  const totalProgress = deliverables.reduce((sum, d) => {
    const pct = d.targetValue > 0 ? (d.currentValue / d.targetValue) * 100 : 0;
    return sum + Math.min(100, pct);
  }, 0);

  return Math.round(totalProgress / deliverables.length);
}
