import { prisma } from "@/lib/db";
import { ClientOutcomeType, ClientGoalStatus, KpiMetricType, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/service";

// ============================================
// TYPES
// ============================================

export interface CreateClientGoalInput {
  orgId: string;
  clientId: string;
  createdById: string;
  title: string;
  description?: string | null;
  outcomeType: ClientOutcomeType;
  metricType?: KpiMetricType | null;
  targetValue?: number | null;
  unit?: string | null;
  startDate?: Date | null;
  deadline?: Date | null;
  clientVisibility?: boolean;
  clientCanEdit?: boolean;
  staffNotes?: string | null;
  assignedToId?: string | null;
  programId?: string | null;
}

export interface UpdateClientGoalInput {
  title?: string;
  description?: string | null;
  outcomeType?: ClientOutcomeType;
  metricType?: KpiMetricType | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  startDate?: Date | null;
  deadline?: Date | null;
  clientVisibility?: boolean;
  clientCanEdit?: boolean;
  clientNotes?: string | null;
  staffNotes?: string | null;
  assignedToId?: string | null;
  programId?: string | null;
  status?: ClientGoalStatus;
  progress?: number;
}

export interface ClientGoalFilters {
  status?: ClientGoalStatus;
  outcomeType?: ClientOutcomeType;
  assignedToId?: string;
  programId?: string;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface ClientGoalWithRelations {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string | null;
  outcomeType: ClientOutcomeType;
  status: ClientGoalStatus;
  metricType: KpiMetricType | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  startDate: Date | null;
  deadline: Date | null;
  achievedAt: Date | null;
  achievedNotes: string | null;
  progress: number;
  clientVisibility: boolean;
  clientCanEdit: boolean;
  clientNotes: string | null;
  staffNotes: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  programId: string | null;
  programName: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CompletionSuggestion {
  confidence: number; // 0-100
  suggestComplete: boolean; // true if confidence > 70
  evidence: string[];
  reasoning: string;
}

// ============================================
// CLIENT GOAL CRUD OPERATIONS
// ============================================

/**
 * Create a new client goal
 */
export async function createClientGoal(
  input: CreateClientGoalInput
): Promise<ClientGoalWithRelations> {
  const clientGoal = await prisma.clientGoal.create({
    data: {
      orgId: input.orgId,
      clientId: input.clientId,
      createdById: input.createdById,
      title: input.title,
      description: input.description,
      outcomeType: input.outcomeType,
      metricType: input.metricType,
      targetValue: input.targetValue,
      currentValue: 0,
      unit: input.unit,
      startDate: input.startDate,
      deadline: input.deadline,
      clientVisibility: input.clientVisibility ?? true,
      clientCanEdit: input.clientCanEdit ?? false,
      staffNotes: input.staffNotes,
      assignedToId: input.assignedToId,
      programId: input.programId,
      status: ClientGoalStatus.NOT_STARTED,
      progress: 0,
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
  });

  // Audit log - PHI involved
  await createAuditLog({
    orgId: input.orgId,
    userId: input.createdById,
    action: "CREATE",
    resource: "CLIENT_GOAL",
    resourceId: clientGoal.id,
    details: { clientId: input.clientId, outcomeType: input.outcomeType },
  });

  return transformClientGoal(clientGoal);
}

/**
 * Get a client goal by ID
 */
export async function getClientGoalById(
  clientGoalId: string,
  orgId: string,
  userId?: string
): Promise<ClientGoalWithRelations | null> {
  const clientGoal = await prisma.clientGoal.findFirst({
    where: {
      id: clientGoalId,
      orgId,
      archivedAt: null,
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
  });

  if (!clientGoal) return null;

  // Audit log - PHI access
  if (userId) {
    await createAuditLog({
      orgId,
      userId,
      action: "VIEW",
      resource: "CLIENT_GOAL",
      resourceId: clientGoalId,
      details: { clientId: clientGoal.clientId },
    });
  }

  return transformClientGoal(clientGoal);
}

/**
 * Update a client goal
 */
export async function updateClientGoal(
  clientGoalId: string,
  orgId: string,
  userId: string,
  input: UpdateClientGoalInput
): Promise<ClientGoalWithRelations> {
  const previousGoal = await prisma.clientGoal.findUnique({
    where: { id: clientGoalId },
  });

  const clientGoal = await prisma.clientGoal.update({
    where: { id: clientGoalId },
    data: {
      ...input,
      updatedAt: new Date(),
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
  });

  // Record progress if status or progress changed
  if (previousGoal && (previousGoal.status !== clientGoal.status || previousGoal.progress !== clientGoal.progress)) {
    await prisma.clientGoalProgress.create({
      data: {
        clientGoalId,
        previousValue: previousGoal.currentValue,
        newValue: clientGoal.currentValue,
        previousStatus: previousGoal.status,
        newStatus: clientGoal.status,
        notes: input.staffNotes,
        recordedById: userId,
        recordedByClient: false,
      },
    });
  }

  // Audit log - PHI involved
  await createAuditLog({
    orgId,
    userId,
    action: "UPDATE",
    resource: "CLIENT_GOAL",
    resourceId: clientGoalId,
    details: { clientId: clientGoal.clientId },
  });

  return transformClientGoal(clientGoal);
}

/**
 * Archive a client goal (soft delete)
 */
export async function archiveClientGoal(
  clientGoalId: string,
  orgId: string,
  userId: string
): Promise<void> {
  const clientGoal = await prisma.clientGoal.update({
    where: { id: clientGoalId },
    data: { archivedAt: new Date() },
  });

  // Audit log
  await createAuditLog({
    orgId,
    userId,
    action: "ARCHIVE",
    resource: "CLIENT_GOAL",
    resourceId: clientGoalId,
    details: { clientId: clientGoal.clientId },
  });
}

/**
 * List client goals for a specific client
 */
export async function listClientGoals(
  clientId: string,
  orgId: string,
  userId: string,
  filters?: ClientGoalFilters,
  pagination?: PaginationOptions
): Promise<{ goals: ClientGoalWithRelations[]; total: number; page: number; limit: number }> {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ClientGoalWhereInput = {
    clientId,
    orgId,
    archivedAt: null,
    ...(filters?.status && { status: filters.status }),
    ...(filters?.outcomeType && { outcomeType: filters.outcomeType }),
    ...(filters?.assignedToId && { assignedToId: filters.assignedToId }),
    ...(filters?.programId && { programId: filters.programId }),
    ...(filters?.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" as const } },
        { description: { contains: filters.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [goals, total] = await Promise.all([
    prisma.clientGoal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
      },
    }),
    prisma.clientGoal.count({ where }),
  ]);

  // Audit log - viewing client goals list
  await createAuditLog({
    orgId,
    userId,
    action: "VIEW",
    resource: "CLIENT_GOAL",
    resourceId: clientId,
    details: { type: "list", count: goals.length },
  });

  return {
    goals: goals.map(transformClientGoal),
    total,
    page,
    limit,
  };
}

// ============================================
// GOAL COMPLETION
// ============================================

/**
 * Mark a client goal as complete
 */
export async function markGoalComplete(
  clientGoalId: string,
  orgId: string,
  userId: string,
  notes?: string
): Promise<ClientGoalWithRelations> {
  const previousGoal = await prisma.clientGoal.findUnique({
    where: { id: clientGoalId },
  });

  const clientGoal = await prisma.clientGoal.update({
    where: { id: clientGoalId },
    data: {
      status: ClientGoalStatus.ACHIEVED,
      progress: 100,
      achievedAt: new Date(),
      achievedNotes: notes,
      updatedAt: new Date(),
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
  });

  // Record progress history
  if (previousGoal) {
    await prisma.clientGoalProgress.create({
      data: {
        clientGoalId,
        previousValue: previousGoal.currentValue,
        newValue: clientGoal.currentValue,
        previousStatus: previousGoal.status,
        newStatus: ClientGoalStatus.ACHIEVED,
        notes: notes ?? "Goal marked as complete",
        recordedById: userId,
        recordedByClient: false,
      },
    });
  }

  // Audit log
  await createAuditLog({
    orgId,
    userId,
    action: "UPDATE",
    resource: "CLIENT_GOAL",
    resourceId: clientGoalId,
    details: { clientId: clientGoal.clientId, action: "marked_complete" },
  });

  return transformClientGoal(clientGoal);
}

/**
 * Mark a client goal as abandoned
 */
export async function markGoalAbandoned(
  clientGoalId: string,
  orgId: string,
  userId: string,
  reason?: string
): Promise<ClientGoalWithRelations> {
  const previousGoal = await prisma.clientGoal.findUnique({
    where: { id: clientGoalId },
  });

  const clientGoal = await prisma.clientGoal.update({
    where: { id: clientGoalId },
    data: {
      status: ClientGoalStatus.ABANDONED,
      staffNotes: reason,
      updatedAt: new Date(),
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
  });

  // Record progress history
  if (previousGoal) {
    await prisma.clientGoalProgress.create({
      data: {
        clientGoalId,
        previousValue: previousGoal.currentValue,
        newValue: clientGoal.currentValue,
        previousStatus: previousGoal.status,
        newStatus: ClientGoalStatus.ABANDONED,
        notes: reason ?? "Goal marked as abandoned",
        recordedById: userId,
        recordedByClient: false,
      },
    });
  }

  return transformClientGoal(clientGoal);
}

/**
 * Update progress value for a client goal
 */
export async function updateGoalProgress(
  clientGoalId: string,
  orgId: string,
  clientId: string,
  newValue: number,
  notes?: string,
  userId?: string
): Promise<ClientGoalWithRelations> {
  const previousGoal = await prisma.clientGoal.findFirst({
    where: { id: clientGoalId, orgId, clientId },
  });

  if (!previousGoal) {
    throw new Error("Goal not found");
  }

  // Calculate new progress percentage
  let progress = 0;
  if (previousGoal.targetValue && previousGoal.targetValue > 0) {
    progress = Math.min(100, Math.round((newValue / previousGoal.targetValue) * 100));
  }

  // Determine new status based on progress
  let newStatus = previousGoal.status;
  if (progress >= 100 && previousGoal.status !== ClientGoalStatus.ACHIEVED) {
    newStatus = ClientGoalStatus.ACHIEVED;
  } else if (progress > 0 && previousGoal.status === ClientGoalStatus.NOT_STARTED) {
    newStatus = ClientGoalStatus.IN_PROGRESS;
  }

  const clientGoal = await prisma.clientGoal.update({
    where: { id: clientGoalId },
    data: {
      currentValue: newValue,
      progress,
      status: newStatus,
      achievedAt: newStatus === ClientGoalStatus.ACHIEVED ? new Date() : previousGoal.achievedAt,
      updatedAt: new Date(),
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
  });

  // Record progress history
  await prisma.clientGoalProgress.create({
    data: {
      clientGoalId,
      previousValue: previousGoal.currentValue,
      newValue,
      previousStatus: previousGoal.status,
      newStatus,
      notes,
      recordedById: userId,
      recordedByClient: false,
    },
  });

  // Audit log
  if (userId) {
    await createAuditLog({
      orgId,
      userId,
      action: "UPDATE",
      resource: "CLIENT_GOAL",
      resourceId: clientGoalId,
      details: { clientId, action: "progress_update", previousValue: previousGoal.currentValue, newValue },
    });
  }

  return transformClientGoal(clientGoal);
}

// ============================================
// AI COMPLETION SUGGESTION
// ============================================

/**
 * Suggest goal completion based on client data
 * Confidence threshold: 70%
 */
export async function suggestGoalCompletion(
  clientGoalId: string,
  orgId: string
): Promise<CompletionSuggestion> {
  const clientGoal = await prisma.clientGoal.findFirst({
    where: { id: clientGoalId, orgId },
    include: {
      client: {
        include: {
          notes: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          formSubmissions: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { form: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!clientGoal) {
    return {
      confidence: 0,
      suggestComplete: false,
      evidence: [],
      reasoning: "Goal not found",
    };
  }

  // Collect evidence from various sources
  const evidence: string[] = [];
  let confidenceScore = 0;

  // Check if metric target is met (if applicable)
  if (clientGoal.metricType && clientGoal.targetValue && clientGoal.currentValue) {
    if (clientGoal.currentValue >= clientGoal.targetValue) {
      evidence.push(`Target value met: ${clientGoal.currentValue}/${clientGoal.targetValue} ${clientGoal.unit || ""}`);
      confidenceScore += 40;
    } else {
      const progress = (clientGoal.currentValue / clientGoal.targetValue) * 100;
      if (progress >= 90) {
        evidence.push(`Near target: ${Math.round(progress)}% complete`);
        confidenceScore += 25;
      }
    }
  }

  // Check recent notes for completion indicators
  const completionKeywords = [
    "completed", "achieved", "obtained", "earned", "hired",
    "graduated", "certified", "placed", "housed", "employed",
  ];

  const goalKeywords = clientGoal.title.toLowerCase().split(" ");

  for (const note of clientGoal.client.notes) {
    const noteContent = (note.content || "").toLowerCase();

    // Check for completion keywords
    for (const keyword of completionKeywords) {
      if (noteContent.includes(keyword)) {
        evidence.push(`Note mentions "${keyword}": "${note.content?.substring(0, 100)}..."`);
        confidenceScore += 15;
        break;
      }
    }

    // Check for goal-specific keywords
    for (const keyword of goalKeywords) {
      if (keyword.length > 3 && noteContent.includes(keyword)) {
        confidenceScore += 5;
        break;
      }
    }
  }

  // Check form submissions for outcome data
  if (clientGoal.outcomeType === ClientOutcomeType.EMPLOYMENT) {
    const employmentForms = clientGoal.client.formSubmissions.filter((sub) =>
      sub.form.name.toLowerCase().includes("employment") ||
      sub.form.name.toLowerCase().includes("placement")
    );
    if (employmentForms.length > 0) {
      evidence.push(`Employment-related form submitted: ${employmentForms[0].form.name}`);
      confidenceScore += 20;
    }
  }

  // Cap confidence at 100
  confidenceScore = Math.min(100, confidenceScore);

  return {
    confidence: confidenceScore,
    suggestComplete: confidenceScore >= 70,
    evidence,
    reasoning: confidenceScore >= 70
      ? "Based on the evidence found, this goal appears to be complete."
      : "Not enough evidence to suggest completion. Consider reviewing manually.",
  };
}

// ============================================
// PROGRESS HISTORY
// ============================================

/**
 * Get progress history for a client goal
 */
export async function getProgressHistory(
  clientGoalId: string,
  limit: number = 20
): Promise<Array<{
  id: string;
  previousValue: number | null;
  newValue: number | null;
  previousStatus: ClientGoalStatus;
  newStatus: ClientGoalStatus;
  notes: string | null;
  recordedAt: Date;
  recordedByClient: boolean;
  recordedBy: { id: string; name: string | null } | null;
}>> {
  const history = await prisma.clientGoalProgress.findMany({
    where: { clientGoalId },
    orderBy: { recordedAt: "desc" },
    take: limit,
    include: {
      recordedBy: { select: { id: true, name: true } },
    },
  });

  return history;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function transformClientGoal(goal: any): ClientGoalWithRelations {
  return {
    id: goal.id,
    orgId: goal.orgId,
    clientId: goal.clientId,
    clientName: `${goal.client?.firstName || ""} ${goal.client?.lastName || ""}`.trim(),
    title: goal.title,
    description: goal.description,
    outcomeType: goal.outcomeType,
    status: goal.status,
    metricType: goal.metricType,
    targetValue: goal.targetValue,
    currentValue: goal.currentValue,
    unit: goal.unit,
    startDate: goal.startDate,
    deadline: goal.deadline,
    achievedAt: goal.achievedAt,
    achievedNotes: goal.achievedNotes,
    progress: goal.progress,
    clientVisibility: goal.clientVisibility,
    clientCanEdit: goal.clientCanEdit,
    clientNotes: goal.clientNotes,
    staffNotes: goal.staffNotes,
    assignedToId: goal.assignedToId,
    assignedToName: goal.assignedTo?.name ?? null,
    programId: goal.programId,
    programName: goal.program?.name ?? null,
    createdById: goal.createdById,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    archivedAt: goal.archivedAt,
  };
}
