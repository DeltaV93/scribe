import { prisma } from "@/lib/db";
import { ReminderStatus, ReminderType, Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateReminderInput {
  orgId: string;
  clientId: string;
  assignedToId: string;
  title: string;
  description?: string | null;
  dueDate: Date;
  priority?: number; // 1=High, 2=Normal, 3=Low
  workflowRuleId?: string | null;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string | null;
  dueDate?: Date;
  priority?: number;
  assignedToId?: string;
  status?: ReminderStatus;
}

export interface ReminderFilters {
  status?: ReminderStatus | ReminderStatus[];
  assignedToId?: string;
  clientId?: string;
  priority?: number;
  dueBefore?: Date;
  dueAfter?: Date;
  isOverdue?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

// ============================================
// REMINDER CRUD
// ============================================

/**
 * Create a new reminder
 */
export async function createReminder(input: CreateReminderInput) {
  return prisma.reminder.create({
    data: {
      orgId: input.orgId,
      clientId: input.clientId,
      assignedToId: input.assignedToId,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      priority: input.priority ?? 2,
      workflowRuleId: input.workflowRuleId,
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Get a reminder by ID
 */
export async function getReminderById(reminderId: string, orgId: string) {
  return prisma.reminder.findFirst({
    where: {
      id: reminderId,
      orgId,
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      workflowRule: {
        select: { id: true, name: true },
      },
      completedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * List reminders with filtering and pagination
 */
export async function listReminders(
  orgId: string,
  filters?: ReminderFilters,
  pagination?: PaginationOptions
) {
  const page = pagination?.page ?? 1;
  const limit = Math.min(pagination?.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.ReminderWhereInput = {
    orgId,
  };

  if (filters?.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }

  if (filters?.assignedToId) {
    where.assignedToId = filters.assignedToId;
  }

  if (filters?.clientId) {
    where.clientId = filters.clientId;
  }

  if (filters?.priority) {
    where.priority = filters.priority;
  }

  if (filters?.dueBefore || filters?.dueAfter) {
    where.dueDate = {};
    if (filters.dueBefore) {
      where.dueDate.lte = filters.dueBefore;
    }
    if (filters.dueAfter) {
      where.dueDate.gte = filters.dueAfter;
    }
  }

  if (filters?.isOverdue) {
    where.dueDate = { lt: new Date() };
    where.status = { in: [ReminderStatus.PENDING, ReminderStatus.SENT] };
  }

  const [reminders, total] = await Promise.all([
    prisma.reminder.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.reminder.count({ where }),
  ]);

  return {
    reminders,
    total,
    hasMore: skip + reminders.length < total,
  };
}

/**
 * Get reminders for a specific user
 */
export async function getMyReminders(
  userId: string,
  orgId: string,
  filters?: { status?: ReminderStatus | ReminderStatus[]; includeOverdue?: boolean },
  pagination?: PaginationOptions
) {
  return listReminders(
    orgId,
    {
      assignedToId: userId,
      status: filters?.status,
      isOverdue: filters?.includeOverdue,
    },
    pagination
  );
}

/**
 * Update a reminder
 */
export async function updateReminder(
  reminderId: string,
  orgId: string,
  input: UpdateReminderInput
) {
  return prisma.reminder.update({
    where: { id: reminderId },
    data: {
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      priority: input.priority,
      assignedToId: input.assignedToId,
      status: input.status,
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Acknowledge a reminder
 */
export async function acknowledgeReminder(reminderId: string, orgId: string) {
  const reminder = await getReminderById(reminderId, orgId);
  if (!reminder) {
    throw new Error("Reminder not found");
  }

  return prisma.reminder.update({
    where: { id: reminderId },
    data: {
      status: ReminderStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
    },
  });
}

/**
 * Complete a reminder
 */
export async function completeReminder(
  reminderId: string,
  orgId: string,
  completedById: string
) {
  const reminder = await getReminderById(reminderId, orgId);
  if (!reminder) {
    throw new Error("Reminder not found");
  }

  return prisma.reminder.update({
    where: { id: reminderId },
    data: {
      status: ReminderStatus.COMPLETED,
      completedAt: new Date(),
      completedById,
    },
  });
}

/**
 * Cancel a reminder
 */
export async function cancelReminder(reminderId: string, orgId: string) {
  const reminder = await getReminderById(reminderId, orgId);
  if (!reminder) {
    throw new Error("Reminder not found");
  }

  return prisma.reminder.update({
    where: { id: reminderId },
    data: {
      status: ReminderStatus.CANCELLED,
    },
  });
}

/**
 * Delete a reminder
 */
export async function deleteReminder(reminderId: string, orgId: string) {
  const reminder = await getReminderById(reminderId, orgId);
  if (!reminder) {
    throw new Error("Reminder not found");
  }

  return prisma.reminder.delete({
    where: { id: reminderId },
  });
}

// ============================================
// REMINDER STATS
// ============================================

/**
 * Get reminder counts by status for a user
 */
export async function getReminderStats(userId: string, orgId: string) {
  const now = new Date();

  const [pending, acknowledged, overdue, completedToday] = await Promise.all([
    prisma.reminder.count({
      where: {
        orgId,
        assignedToId: userId,
        status: ReminderStatus.PENDING,
      },
    }),
    prisma.reminder.count({
      where: {
        orgId,
        assignedToId: userId,
        status: ReminderStatus.ACKNOWLEDGED,
      },
    }),
    prisma.reminder.count({
      where: {
        orgId,
        assignedToId: userId,
        status: { in: [ReminderStatus.PENDING, ReminderStatus.SENT] },
        dueDate: { lt: now },
      },
    }),
    prisma.reminder.count({
      where: {
        orgId,
        assignedToId: userId,
        status: ReminderStatus.COMPLETED,
        completedAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
    }),
  ]);

  return {
    pending,
    acknowledged,
    overdue,
    completedToday,
    total: pending + acknowledged,
  };
}

/**
 * Get upcoming reminders for a user (next 7 days)
 */
export async function getUpcomingReminders(userId: string, orgId: string, days = 7) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return prisma.reminder.findMany({
    where: {
      orgId,
      assignedToId: userId,
      status: { in: [ReminderStatus.PENDING, ReminderStatus.SENT] },
      dueDate: {
        gte: now,
        lte: futureDate,
      },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
}

// ============================================
// OVERDUE PROCESSING
// ============================================

/**
 * Mark overdue reminders (called by scheduled job)
 */
export async function markOverdueReminders() {
  const now = new Date();

  const result = await prisma.reminder.updateMany({
    where: {
      status: { in: [ReminderStatus.PENDING, ReminderStatus.SENT] },
      dueDate: { lt: now },
    },
    data: {
      status: ReminderStatus.OVERDUE,
    },
  });

  return result.count;
}

/**
 * Get all overdue reminders for notification
 */
export async function getOverdueReminders(orgId?: string) {
  const where: Prisma.ReminderWhereInput = {
    status: ReminderStatus.OVERDUE,
  };

  if (orgId) {
    where.orgId = orgId;
  }

  return prisma.reminder.findMany({
    where,
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Bulk acknowledge reminders
 */
export async function bulkAcknowledgeReminders(
  reminderIds: string[],
  orgId: string
) {
  return prisma.reminder.updateMany({
    where: {
      id: { in: reminderIds },
      orgId,
    },
    data: {
      status: ReminderStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
    },
  });
}

/**
 * Bulk complete reminders
 */
export async function bulkCompleteReminders(
  reminderIds: string[],
  orgId: string,
  completedById: string
) {
  return prisma.reminder.updateMany({
    where: {
      id: { in: reminderIds },
      orgId,
    },
    data: {
      status: ReminderStatus.COMPLETED,
      completedAt: new Date(),
      completedById,
    },
  });
}
