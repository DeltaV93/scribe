import { prisma } from "@/lib/db";
import { EnrollmentStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ============================================
// TYPES
// ============================================

export interface EnrollClientInput {
  programId: string;
  clientId: string;
  enrolledById: string;
  enrolledDate?: Date;
  status?: EnrollmentStatus;
  notes?: string | null;
}

export interface BulkEnrollInput {
  programId: string;
  clientIds: string[];
  enrolledById: string;
  enrolledDate?: Date;
  status?: EnrollmentStatus;
}

export interface UpdateEnrollmentInput {
  status?: EnrollmentStatus;
  hoursOverride?: number | null;
  completionDate?: Date | null;
  withdrawalDate?: Date | null;
  withdrawalReason?: string | null;
  notes?: string | null;
}

export interface EnrollmentFilters {
  status?: EnrollmentStatus;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface EnrollmentWithRelations {
  id: string;
  programId: string;
  clientId: string;
  enrolledDate: Date;
  status: EnrollmentStatus;
  hoursCompleted: number; // Calculated from attendance
  hoursOverride: number | null; // Manual override
  effectiveHours: number; // hoursOverride ?? hoursCompleted
  completionDate: Date | null;
  withdrawalDate: Date | null;
  withdrawalReason: string | null;
  enrolledById: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
  enrolledBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  program?: {
    id: string;
    name: string;
    requiredHours: number | null;
  };
  _count?: {
    attendance: number;
  };
}

export interface ClientEnrollmentSummary {
  enrollment: EnrollmentWithRelations;
  programName: string;
  progressPercentage: number;
  sessionsAttended: number;
  totalSessions: number;
}

// ============================================
// ENROLLMENT CRUD
// ============================================

/**
 * Enroll a client in a program
 */
export async function enrollClient(input: EnrollClientInput): Promise<EnrollmentWithRelations> {
  const enrollment = await prisma.programEnrollment.create({
    data: {
      programId: input.programId,
      clientId: input.clientId,
      enrolledById: input.enrolledById,
      enrolledDate: input.enrolledDate || new Date(),
      status: input.status || EnrollmentStatus.ENROLLED,
      notes: input.notes || null,
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      enrolledBy: {
        select: { id: true, name: true, email: true },
      },
      program: {
        select: { id: true, name: true, requiredHours: true },
      },
      _count: {
        select: { attendance: true },
      },
    },
  });

  const hoursCompleted = await calculateCompletedHours(enrollment.id);
  return transformEnrollment(enrollment, hoursCompleted);
}

/**
 * Bulk enroll clients in a program
 */
export async function bulkEnrollClients(
  input: BulkEnrollInput
): Promise<{ successful: string[]; failed: { clientId: string; error: string }[] }> {
  const successful: string[] = [];
  const failed: { clientId: string; error: string }[] = [];

  for (const clientId of input.clientIds) {
    try {
      // Check if already enrolled
      const existing = await prisma.programEnrollment.findUnique({
        where: {
          programId_clientId: {
            programId: input.programId,
            clientId: clientId,
          },
        },
      });

      if (existing) {
        failed.push({ clientId, error: "Already enrolled" });
        continue;
      }

      await prisma.programEnrollment.create({
        data: {
          programId: input.programId,
          clientId: clientId,
          enrolledById: input.enrolledById,
          enrolledDate: input.enrolledDate || new Date(),
          status: input.status || EnrollmentStatus.ENROLLED,
        },
      });

      successful.push(clientId);
    } catch (error) {
      failed.push({
        clientId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { successful, failed };
}

/**
 * Get an enrollment by ID
 */
export async function getEnrollmentById(
  enrollmentId: string,
  programId: string
): Promise<EnrollmentWithRelations | null> {
  const enrollment = await prisma.programEnrollment.findFirst({
    where: {
      id: enrollmentId,
      programId: programId,
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      enrolledBy: {
        select: { id: true, name: true, email: true },
      },
      program: {
        select: { id: true, name: true, requiredHours: true },
      },
      _count: {
        select: { attendance: true },
      },
    },
  });

  if (!enrollment) return null;

  const hoursCompleted = await calculateCompletedHours(enrollment.id);
  return transformEnrollment(enrollment, hoursCompleted);
}

/**
 * Update an enrollment
 */
export async function updateEnrollment(
  enrollmentId: string,
  programId: string,
  input: UpdateEnrollmentInput
): Promise<EnrollmentWithRelations> {
  const updateData: Prisma.ProgramEnrollmentUpdateInput = {};

  if (input.status !== undefined) updateData.status = input.status;
  if (input.hoursOverride !== undefined) {
    updateData.hoursOverride = input.hoursOverride !== null
      ? new Decimal(input.hoursOverride)
      : null;
  }
  if (input.completionDate !== undefined) updateData.completionDate = input.completionDate;
  if (input.withdrawalDate !== undefined) updateData.withdrawalDate = input.withdrawalDate;
  if (input.withdrawalReason !== undefined) updateData.withdrawalReason = input.withdrawalReason;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const enrollment = await prisma.programEnrollment.update({
    where: {
      id: enrollmentId,
      programId: programId,
    },
    data: updateData,
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      enrolledBy: {
        select: { id: true, name: true, email: true },
      },
      program: {
        select: { id: true, name: true, requiredHours: true },
      },
      _count: {
        select: { attendance: true },
      },
    },
  });

  const hoursCompleted = await calculateCompletedHours(enrollment.id);
  return transformEnrollment(enrollment, hoursCompleted);
}

/**
 * Withdraw a client from a program
 */
export async function withdrawClient(
  enrollmentId: string,
  programId: string,
  reason?: string
): Promise<EnrollmentWithRelations> {
  return updateEnrollment(enrollmentId, programId, {
    status: EnrollmentStatus.WITHDRAWN,
    withdrawalDate: new Date(),
    withdrawalReason: reason || null,
  });
}

/**
 * Delete an enrollment (hard delete)
 */
export async function deleteEnrollment(enrollmentId: string, programId: string): Promise<void> {
  await prisma.programEnrollment.delete({
    where: {
      id: enrollmentId,
      programId: programId,
    },
  });
}

/**
 * List enrollments for a program
 */
export async function listEnrollments(
  programId: string,
  filters: EnrollmentFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ enrollments: EnrollmentWithRelations[]; total: number; page: number; limit: number }> {
  const { status, search } = filters;
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ProgramEnrollmentWhereInput = {
    programId,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.client = {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const [enrollments, total] = await Promise.all([
    prisma.programEnrollment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        enrolledBy: {
          select: { id: true, name: true, email: true },
        },
        program: {
          select: { id: true, name: true, requiredHours: true },
        },
        _count: {
          select: { attendance: true },
        },
      },
      orderBy: { enrolledDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.programEnrollment.count({ where }),
  ]);

  // Calculate hours for each enrollment
  const enrollmentsWithHours = await Promise.all(
    enrollments.map(async (enrollment) => {
      const hoursCompleted = await calculateCompletedHours(enrollment.id);
      return transformEnrollment(enrollment, hoursCompleted);
    })
  );

  return {
    enrollments: enrollmentsWithHours,
    total,
    page,
    limit,
  };
}

/**
 * Get all enrollments for a specific client
 */
export async function getClientEnrollments(
  clientId: string,
  orgId: string
): Promise<ClientEnrollmentSummary[]> {
  const enrollments = await prisma.programEnrollment.findMany({
    where: {
      clientId,
      program: {
        orgId,
      },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      enrolledBy: {
        select: { id: true, name: true, email: true },
      },
      program: {
        select: {
          id: true,
          name: true,
          requiredHours: true,
          _count: {
            select: { sessions: true },
          },
        },
      },
      _count: {
        select: { attendance: true },
      },
    },
    orderBy: { enrolledDate: "desc" },
  });

  const summaries: ClientEnrollmentSummary[] = [];

  for (const enrollment of enrollments) {
    const hoursCompleted = await calculateCompletedHours(enrollment.id);
    const transformed = transformEnrollment(enrollment, hoursCompleted);

    // Calculate attendance count
    const attendanceCount = await prisma.sessionAttendance.count({
      where: {
        enrollmentId: enrollment.id,
        attended: true,
      },
    });

    const requiredHours = enrollment.program.requiredHours || 0;
    const effectiveHours = transformed.effectiveHours;
    const progressPercentage =
      requiredHours > 0 ? Math.min((effectiveHours / requiredHours) * 100, 100) : 0;

    summaries.push({
      enrollment: transformed,
      programName: enrollment.program.name,
      progressPercentage: Math.round(progressPercentage * 10) / 10,
      sessionsAttended: attendanceCount,
      totalSessions: (enrollment.program as any)._count?.sessions || 0,
    });
  }

  return summaries;
}

// ============================================
// HOURS TRACKING
// ============================================

/**
 * Calculate completed hours from attendance records
 */
export async function calculateCompletedHours(enrollmentId: string): Promise<number> {
  const result = await prisma.sessionAttendance.aggregate({
    where: {
      enrollmentId,
      attended: true,
    },
    _sum: {
      hoursAttended: true,
    },
  });

  return result._sum.hoursAttended?.toNumber() || 0;
}

/**
 * Set manual hours override
 */
export async function setHoursOverride(
  enrollmentId: string,
  programId: string,
  hours: number | null
): Promise<EnrollmentWithRelations> {
  return updateEnrollment(enrollmentId, programId, {
    hoursOverride: hours,
  });
}

/**
 * Get hours summary for an enrollment
 */
export async function getHoursSummary(enrollmentId: string): Promise<{
  hoursCompleted: number;
  hoursOverride: number | null;
  effectiveHours: number;
  requiredHours: number | null;
  progressPercentage: number;
}> {
  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      program: {
        select: { requiredHours: true },
      },
    },
  });

  if (!enrollment) {
    throw new Error("Enrollment not found");
  }

  const hoursCompleted = await calculateCompletedHours(enrollmentId);
  const hoursOverride = enrollment.hoursOverride?.toNumber() || null;
  const effectiveHours = hoursOverride ?? hoursCompleted;
  const requiredHours = enrollment.program.requiredHours;
  const progressPercentage =
    requiredHours && requiredHours > 0
      ? Math.min((effectiveHours / requiredHours) * 100, 100)
      : 0;

  return {
    hoursCompleted,
    hoursOverride,
    effectiveHours,
    requiredHours,
    progressPercentage: Math.round(progressPercentage * 10) / 10,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Transform Prisma enrollment to our type
 */
function transformEnrollment(
  enrollment: any,
  hoursCompleted: number
): EnrollmentWithRelations {
  const hoursOverride = enrollment.hoursOverride?.toNumber() || null;

  return {
    id: enrollment.id,
    programId: enrollment.programId,
    clientId: enrollment.clientId,
    enrolledDate: enrollment.enrolledDate,
    status: enrollment.status,
    hoursCompleted,
    hoursOverride,
    effectiveHours: hoursOverride ?? hoursCompleted,
    completionDate: enrollment.completionDate,
    withdrawalDate: enrollment.withdrawalDate,
    withdrawalReason: enrollment.withdrawalReason,
    enrolledById: enrollment.enrolledById,
    notes: enrollment.notes,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
    client: enrollment.client,
    enrolledBy: enrollment.enrolledBy,
    program: enrollment.program,
    _count: enrollment._count,
  };
}
