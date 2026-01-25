import { prisma } from "@/lib/db";
import { ProgramStatus, ProgramLabelType, Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateProgramInput {
  orgId: string;
  createdById: string;
  name: string;
  labelType?: ProgramLabelType;
  description?: string | null;
  requiredHours?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  schedule?: ProgramSchedule | null;
  location?: string | null;
  maxEnrollment?: number | null;
  facilitatorId?: string | null;
  status?: ProgramStatus;
}

export interface UpdateProgramInput {
  name?: string;
  labelType?: ProgramLabelType;
  description?: string | null;
  requiredHours?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  schedule?: ProgramSchedule | null;
  location?: string | null;
  maxEnrollment?: number | null;
  facilitatorId?: string | null;
  status?: ProgramStatus;
}

export interface ProgramSchedule {
  daysOfWeek?: string[]; // e.g., ["Monday", "Wednesday"]
  startTime?: string; // e.g., "09:00"
  endTime?: string; // e.g., "12:00"
  frequency?: string; // e.g., "weekly", "biweekly"
  notes?: string;
}

export interface CreateSessionInput {
  programId: string;
  sessionNumber: number;
  title: string;
  topic?: string | null;
  date?: Date | null;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface UpdateSessionInput {
  sessionNumber?: number;
  title?: string;
  topic?: string | null;
  date?: Date | null;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface BulkSessionInput {
  title: string;
  topic?: string | null;
  date?: Date | null;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface ProgramFilters {
  status?: ProgramStatus;
  labelType?: ProgramLabelType;
  facilitatorId?: string;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface ProgramWithRelations {
  id: string;
  orgId: string;
  name: string;
  labelType: ProgramLabelType;
  description: string | null;
  requiredHours: number | null;
  startDate: Date | null;
  endDate: Date | null;
  schedule: ProgramSchedule | null;
  location: string | null;
  maxEnrollment: number | null;
  facilitatorId: string | null;
  status: ProgramStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  facilitator?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  _count?: {
    sessions: number;
    enrollments: number;
    materials: number;
  };
}

export interface SessionWithRelations {
  id: string;
  programId: string;
  sessionNumber: number;
  title: string;
  topic: string | null;
  date: Date | null;
  durationMinutes: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    attendance: number;
    materials: number;
  };
}

// ============================================
// PROGRAM CRUD
// ============================================

/**
 * Create a new program
 */
export async function createProgram(input: CreateProgramInput): Promise<ProgramWithRelations> {
  const program = await prisma.program.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      labelType: input.labelType || ProgramLabelType.PROGRAM,
      description: input.description || null,
      requiredHours: input.requiredHours || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      schedule: input.schedule ? (input.schedule as unknown as Prisma.JsonObject) : Prisma.JsonNull,
      location: input.location || null,
      maxEnrollment: input.maxEnrollment || null,
      facilitatorId: input.facilitatorId || null,
      status: input.status || ProgramStatus.DRAFT,
      createdById: input.createdById,
    },
    include: {
      facilitator: {
        select: { id: true, name: true, email: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { sessions: true, enrollments: true, materials: true },
      },
    },
  });

  return transformProgram(program);
}

/**
 * Get a program by ID
 */
export async function getProgramById(
  programId: string,
  orgId: string
): Promise<ProgramWithRelations | null> {
  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      orgId: orgId,
    },
    include: {
      facilitator: {
        select: { id: true, name: true, email: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { sessions: true, enrollments: true, materials: true },
      },
    },
  });

  if (!program) return null;
  return transformProgram(program);
}

/**
 * Update a program
 */
export async function updateProgram(
  programId: string,
  orgId: string,
  input: UpdateProgramInput
): Promise<ProgramWithRelations> {
  const updateData: Prisma.ProgramUpdateInput = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.labelType !== undefined) updateData.labelType = input.labelType;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.requiredHours !== undefined) updateData.requiredHours = input.requiredHours;
  if (input.startDate !== undefined) updateData.startDate = input.startDate;
  if (input.endDate !== undefined) updateData.endDate = input.endDate;
  if (input.schedule !== undefined)
    updateData.schedule = input.schedule
      ? (input.schedule as unknown as Prisma.JsonObject)
      : Prisma.JsonNull;
  if (input.location !== undefined) updateData.location = input.location;
  if (input.maxEnrollment !== undefined) updateData.maxEnrollment = input.maxEnrollment;
  if (input.facilitatorId !== undefined) {
    if (input.facilitatorId) {
      updateData.facilitator = { connect: { id: input.facilitatorId } };
    } else {
      updateData.facilitator = { disconnect: true };
    }
  }
  if (input.status !== undefined) updateData.status = input.status;

  const program = await prisma.program.update({
    where: {
      id: programId,
      orgId: orgId,
    },
    data: updateData,
    include: {
      facilitator: {
        select: { id: true, name: true, email: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { sessions: true, enrollments: true, materials: true },
      },
    },
  });

  return transformProgram(program);
}

/**
 * Archive a program
 */
export async function archiveProgram(programId: string, orgId: string): Promise<void> {
  await prisma.program.update({
    where: {
      id: programId,
      orgId: orgId,
    },
    data: {
      status: ProgramStatus.ARCHIVED,
      archivedAt: new Date(),
    },
  });
}

/**
 * Delete a program (hard delete - use with caution)
 */
export async function deleteProgram(programId: string, orgId: string): Promise<void> {
  await prisma.program.delete({
    where: {
      id: programId,
      orgId: orgId,
    },
  });
}

/**
 * List programs with filters and pagination
 */
export async function listPrograms(
  orgId: string,
  filters: ProgramFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ programs: ProgramWithRelations[]; total: number; page: number; limit: number }> {
  const { status, labelType, facilitatorId, search } = filters;
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ProgramWhereInput = {
    orgId,
  };

  if (status) {
    where.status = status;
  }

  if (labelType) {
    where.labelType = labelType;
  }

  if (facilitatorId) {
    where.facilitatorId = facilitatorId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
  }

  const [programs, total] = await Promise.all([
    prisma.program.findMany({
      where,
      include: {
        facilitator: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { sessions: true, enrollments: true, materials: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.program.count({ where }),
  ]);

  return {
    programs: programs.map(transformProgram),
    total,
    page,
    limit,
  };
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a session
 */
export async function createSession(input: CreateSessionInput): Promise<SessionWithRelations> {
  const session = await prisma.programSession.create({
    data: {
      programId: input.programId,
      sessionNumber: input.sessionNumber,
      title: input.title,
      topic: input.topic || null,
      date: input.date || null,
      durationMinutes: input.durationMinutes || null,
      notes: input.notes || null,
    },
    include: {
      _count: {
        select: { attendance: true, materials: true },
      },
    },
  });

  return transformSession(session);
}

/**
 * Get a session by ID
 */
export async function getSessionById(
  sessionId: string,
  programId: string
): Promise<SessionWithRelations | null> {
  const session = await prisma.programSession.findFirst({
    where: {
      id: sessionId,
      programId: programId,
    },
    include: {
      _count: {
        select: { attendance: true, materials: true },
      },
    },
  });

  if (!session) return null;
  return transformSession(session);
}

/**
 * Update a session
 */
export async function updateSession(
  sessionId: string,
  programId: string,
  input: UpdateSessionInput
): Promise<SessionWithRelations> {
  const updateData: Prisma.ProgramSessionUpdateInput = {};

  if (input.sessionNumber !== undefined) updateData.sessionNumber = input.sessionNumber;
  if (input.title !== undefined) updateData.title = input.title;
  if (input.topic !== undefined) updateData.topic = input.topic;
  if (input.date !== undefined) updateData.date = input.date;
  if (input.durationMinutes !== undefined) updateData.durationMinutes = input.durationMinutes;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const session = await prisma.programSession.update({
    where: {
      id: sessionId,
      programId: programId,
    },
    data: updateData,
    include: {
      _count: {
        select: { attendance: true, materials: true },
      },
    },
  });

  return transformSession(session);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string, programId: string): Promise<void> {
  await prisma.programSession.delete({
    where: {
      id: sessionId,
      programId: programId,
    },
  });
}

/**
 * List sessions for a program
 */
export async function listSessions(programId: string): Promise<SessionWithRelations[]> {
  const sessions = await prisma.programSession.findMany({
    where: { programId },
    include: {
      _count: {
        select: { attendance: true, materials: true },
      },
    },
    orderBy: { sessionNumber: "asc" },
  });

  return sessions.map(transformSession);
}

/**
 * Bulk create sessions (e.g., from syllabus extraction)
 */
export async function bulkCreateSessions(
  programId: string,
  sessions: BulkSessionInput[]
): Promise<SessionWithRelations[]> {
  // Get the current max session number
  const maxSession = await prisma.programSession.findFirst({
    where: { programId },
    orderBy: { sessionNumber: "desc" },
    select: { sessionNumber: true },
  });

  const startNumber = (maxSession?.sessionNumber || 0) + 1;

  const createdSessions = await prisma.$transaction(
    sessions.map((session, index) =>
      prisma.programSession.create({
        data: {
          programId,
          sessionNumber: startNumber + index,
          title: session.title,
          topic: session.topic || null,
          date: session.date || null,
          durationMinutes: session.durationMinutes || null,
          notes: session.notes || null,
        },
        include: {
          _count: {
            select: { attendance: true, materials: true },
          },
        },
      })
    )
  );

  return createdSessions.map(transformSession);
}

/**
 * Reorder sessions
 */
export async function reorderSessions(
  programId: string,
  sessionOrders: { sessionId: string; sessionNumber: number }[]
): Promise<void> {
  await prisma.$transaction(
    sessionOrders.map((order) =>
      prisma.programSession.update({
        where: {
          id: order.sessionId,
          programId: programId,
        },
        data: {
          sessionNumber: order.sessionNumber,
        },
      })
    )
  );
}

// ============================================
// PROGRAM STATISTICS
// ============================================

export interface ProgramStats {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  withdrawnEnrollments: number;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  totalHoursOffered: number;
  averageAttendanceRate: number;
}

/**
 * Get program statistics
 */
export async function getProgramStats(programId: string, orgId: string): Promise<ProgramStats> {
  const [enrollmentCounts, sessions, attendanceStats] = await Promise.all([
    // Count enrollments by status
    prisma.programEnrollment.groupBy({
      by: ["status"],
      where: { programId },
      _count: { status: true },
    }),
    // Get all sessions with attendance
    prisma.programSession.findMany({
      where: { programId },
      select: {
        id: true,
        date: true,
        durationMinutes: true,
        _count: {
          select: { attendance: true },
        },
      },
    }),
    // Get attendance statistics
    prisma.sessionAttendance.aggregate({
      where: {
        session: { programId },
        attended: true,
      },
      _count: { id: true },
    }),
  ]);

  const now = new Date();
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.date && s.date < now).length;
  const upcomingSessions = sessions.filter((s) => s.date && s.date >= now).length;
  const totalHoursOffered = sessions.reduce(
    (sum, s) => sum + (s.durationMinutes || 0) / 60,
    0
  );

  // Calculate enrollment counts
  const enrollmentMap: Record<string, number> = {};
  let totalEnrollments = 0;
  for (const ec of enrollmentCounts) {
    enrollmentMap[ec.status] = ec._count.status;
    totalEnrollments += ec._count.status;
  }

  // Calculate average attendance rate
  const totalPossibleAttendance = totalEnrollments * completedSessions;
  const actualAttendance = attendanceStats._count.id;
  const averageAttendanceRate =
    totalPossibleAttendance > 0 ? (actualAttendance / totalPossibleAttendance) * 100 : 0;

  return {
    totalEnrollments,
    activeEnrollments:
      (enrollmentMap["ENROLLED"] || 0) + (enrollmentMap["IN_PROGRESS"] || 0),
    completedEnrollments: enrollmentMap["COMPLETED"] || 0,
    withdrawnEnrollments: enrollmentMap["WITHDRAWN"] || 0,
    totalSessions,
    completedSessions,
    upcomingSessions,
    totalHoursOffered: Math.round(totalHoursOffered * 10) / 10,
    averageAttendanceRate: Math.round(averageAttendanceRate * 10) / 10,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Transform Prisma program to our type
 */
function transformProgram(program: any): ProgramWithRelations {
  return {
    id: program.id,
    orgId: program.orgId,
    name: program.name,
    labelType: program.labelType,
    description: program.description,
    requiredHours: program.requiredHours,
    startDate: program.startDate,
    endDate: program.endDate,
    schedule: program.schedule as ProgramSchedule | null,
    location: program.location,
    maxEnrollment: program.maxEnrollment,
    facilitatorId: program.facilitatorId,
    status: program.status,
    createdById: program.createdById,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
    archivedAt: program.archivedAt,
    facilitator: program.facilitator,
    createdBy: program.createdBy,
    _count: program._count,
  };
}

/**
 * Transform Prisma session to our type
 */
function transformSession(session: any): SessionWithRelations {
  return {
    id: session.id,
    programId: session.programId,
    sessionNumber: session.sessionNumber,
    title: session.title,
    topic: session.topic,
    date: session.date,
    durationMinutes: session.durationMinutes,
    notes: session.notes,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    _count: session._count,
  };
}
