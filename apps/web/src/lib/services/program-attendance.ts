import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ============================================
// TYPES
// ============================================

export interface RecordAttendanceInput {
  sessionId: string;
  enrollmentId: string;
  attended: boolean;
  hoursAttended?: number | null;
  notes?: string | null;
  recordedById: string;
}

export interface BulkAttendanceInput {
  sessionId: string;
  recordedById: string;
  records: {
    enrollmentId: string;
    attended: boolean;
    hoursAttended?: number | null;
    notes?: string | null;
  }[];
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  enrollmentId: string;
  attended: boolean;
  hoursAttended: number | null;
  notes: string | null;
  recordedById: string;
  recordedAt: Date;
  updatedAt: Date;
  recordedBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  enrollment?: {
    id: string;
    client: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
  session?: {
    id: string;
    sessionNumber: number;
    title: string;
    date: Date | null;
    durationMinutes: number | null;
  };
}

export interface SessionAttendanceSummary {
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string;
  sessionDate: Date | null;
  totalEnrolled: number;
  attendedCount: number;
  absentCount: number;
  attendanceRate: number;
  totalHours: number;
}

export interface EnrollmentAttendanceHistory {
  enrollmentId: string;
  clientName: string;
  totalSessions: number;
  sessionsAttended: number;
  sessionsAbsent: number;
  attendanceRate: number;
  totalHoursAttended: number;
  records: AttendanceRecord[];
}

export interface AttendanceSheetData {
  program: {
    id: string;
    name: string;
  };
  session: {
    id: string;
    sessionNumber: number;
    title: string;
    date: Date | null;
    durationMinutes: number | null;
  };
  enrollments: {
    id: string;
    clientName: string;
    attended: boolean | null; // null if not yet recorded
    hoursAttended: number | null;
    notes: string | null;
  }[];
}

// ============================================
// ATTENDANCE CRUD
// ============================================

/**
 * Record attendance for a single enrollment
 */
export async function recordAttendance(
  input: RecordAttendanceInput
): Promise<AttendanceRecord> {
  const attendance = await prisma.sessionAttendance.upsert({
    where: {
      sessionId_enrollmentId: {
        sessionId: input.sessionId,
        enrollmentId: input.enrollmentId,
      },
    },
    create: {
      sessionId: input.sessionId,
      enrollmentId: input.enrollmentId,
      attended: input.attended,
      hoursAttended: input.hoursAttended != null ? new Decimal(input.hoursAttended) : null,
      notes: input.notes || null,
      recordedById: input.recordedById,
    },
    update: {
      attended: input.attended,
      hoursAttended: input.hoursAttended != null ? new Decimal(input.hoursAttended) : null,
      notes: input.notes || null,
      recordedById: input.recordedById,
    },
    include: {
      recordedBy: {
        select: { id: true, name: true, email: true },
      },
      enrollment: {
        select: {
          id: true,
          client: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      session: {
        select: {
          id: true,
          sessionNumber: true,
          title: true,
          date: true,
          durationMinutes: true,
        },
      },
    },
  });

  return transformAttendance(attendance);
}

/**
 * Bulk record attendance for a session
 */
export async function bulkRecordAttendance(
  input: BulkAttendanceInput
): Promise<{ successful: number; failed: { enrollmentId: string; error: string }[] }> {
  const failed: { enrollmentId: string; error: string }[] = [];
  let successful = 0;

  for (const record of input.records) {
    try {
      await prisma.sessionAttendance.upsert({
        where: {
          sessionId_enrollmentId: {
            sessionId: input.sessionId,
            enrollmentId: record.enrollmentId,
          },
        },
        create: {
          sessionId: input.sessionId,
          enrollmentId: record.enrollmentId,
          attended: record.attended,
          hoursAttended: record.hoursAttended != null ? new Decimal(record.hoursAttended) : null,
          notes: record.notes || null,
          recordedById: input.recordedById,
        },
        update: {
          attended: record.attended,
          hoursAttended: record.hoursAttended != null ? new Decimal(record.hoursAttended) : null,
          notes: record.notes || null,
          recordedById: input.recordedById,
        },
      });
      successful++;
    } catch (error) {
      failed.push({
        enrollmentId: record.enrollmentId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { successful, failed };
}

/**
 * Get attendance record by session and enrollment
 */
export async function getAttendance(
  sessionId: string,
  enrollmentId: string
): Promise<AttendanceRecord | null> {
  const attendance = await prisma.sessionAttendance.findUnique({
    where: {
      sessionId_enrollmentId: {
        sessionId,
        enrollmentId,
      },
    },
    include: {
      recordedBy: {
        select: { id: true, name: true, email: true },
      },
      enrollment: {
        select: {
          id: true,
          client: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      session: {
        select: {
          id: true,
          sessionNumber: true,
          title: true,
          date: true,
          durationMinutes: true,
        },
      },
    },
  });

  if (!attendance) return null;
  return transformAttendance(attendance);
}

/**
 * Delete attendance record
 */
export async function deleteAttendance(
  sessionId: string,
  enrollmentId: string
): Promise<void> {
  await prisma.sessionAttendance.delete({
    where: {
      sessionId_enrollmentId: {
        sessionId,
        enrollmentId,
      },
    },
  });
}

// ============================================
// ATTENDANCE QUERIES
// ============================================

/**
 * Get all attendance records for a session
 */
export async function getSessionAttendance(
  sessionId: string
): Promise<AttendanceRecord[]> {
  const records = await prisma.sessionAttendance.findMany({
    where: { sessionId },
    include: {
      recordedBy: {
        select: { id: true, name: true, email: true },
      },
      enrollment: {
        select: {
          id: true,
          client: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: {
      enrollment: {
        client: { lastName: "asc" },
      },
    },
  });

  return records.map(transformAttendance);
}

/**
 * Get session attendance summary
 */
export async function getSessionAttendanceSummary(
  sessionId: string
): Promise<SessionAttendanceSummary> {
  const [session, attendanceStats, enrollmentCount] = await Promise.all([
    prisma.programSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        sessionNumber: true,
        title: true,
        date: true,
        programId: true,
      },
    }),
    prisma.sessionAttendance.aggregate({
      where: { sessionId },
      _count: { id: true },
      _sum: { hoursAttended: true },
    }),
    prisma.programEnrollment.count({
      where: {
        programId: (
          await prisma.programSession.findUnique({
            where: { id: sessionId },
            select: { programId: true },
          })
        )?.programId,
        status: { in: ["ENROLLED", "IN_PROGRESS"] },
      },
    }),
  ]);

  if (!session) {
    throw new Error("Session not found");
  }

  const attendedCount = await prisma.sessionAttendance.count({
    where: { sessionId, attended: true },
  });

  const absentCount = await prisma.sessionAttendance.count({
    where: { sessionId, attended: false },
  });

  const attendanceRate =
    enrollmentCount > 0 ? (attendedCount / enrollmentCount) * 100 : 0;

  return {
    sessionId: session.id,
    sessionNumber: session.sessionNumber,
    sessionTitle: session.title,
    sessionDate: session.date,
    totalEnrolled: enrollmentCount,
    attendedCount,
    absentCount,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    totalHours: attendanceStats._sum.hoursAttended?.toNumber() || 0,
  };
}

/**
 * Get all attendance records for an enrollment
 */
export async function getEnrollmentAttendance(
  enrollmentId: string
): Promise<EnrollmentAttendanceHistory> {
  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      client: {
        select: { firstName: true, lastName: true },
      },
      program: {
        select: {
          _count: { select: { sessions: true } },
        },
      },
    },
  });

  if (!enrollment) {
    throw new Error("Enrollment not found");
  }

  const records = await prisma.sessionAttendance.findMany({
    where: { enrollmentId },
    include: {
      recordedBy: {
        select: { id: true, name: true, email: true },
      },
      session: {
        select: {
          id: true,
          sessionNumber: true,
          title: true,
          date: true,
          durationMinutes: true,
        },
      },
    },
    orderBy: {
      session: { sessionNumber: "asc" },
    },
  });

  const sessionsAttended = records.filter((r) => r.attended).length;
  const sessionsAbsent = records.filter((r) => !r.attended).length;
  const totalHoursAttended = records
    .filter((r) => r.attended)
    .reduce((sum, r) => sum + (r.hoursAttended?.toNumber() || 0), 0);

  const totalSessions = (enrollment.program as any)._count?.sessions || 0;
  const attendanceRate =
    totalSessions > 0 ? (sessionsAttended / totalSessions) * 100 : 0;

  return {
    enrollmentId,
    clientName: `${enrollment.client.firstName} ${enrollment.client.lastName}`,
    totalSessions,
    sessionsAttended,
    sessionsAbsent,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    totalHoursAttended: Math.round(totalHoursAttended * 100) / 100,
    records: records.map(transformAttendance),
  };
}

/**
 * Get attendance sheet data for a session (printable view)
 */
export async function getAttendanceSheet(
  sessionId: string
): Promise<AttendanceSheetData> {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: {
        select: { id: true, name: true },
      },
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Get all enrollments for the program
  const enrollments = await prisma.programEnrollment.findMany({
    where: {
      programId: session.programId,
      status: { in: ["ENROLLED", "IN_PROGRESS"] },
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: {
      client: { lastName: "asc" },
    },
  });

  // Get existing attendance records
  const attendanceRecords = await prisma.sessionAttendance.findMany({
    where: { sessionId },
    select: {
      enrollmentId: true,
      attended: true,
      hoursAttended: true,
      notes: true,
    },
  });

  const attendanceMap = new Map(
    attendanceRecords.map((r) => [
      r.enrollmentId,
      {
        attended: r.attended,
        hoursAttended: r.hoursAttended?.toNumber() || null,
        notes: r.notes,
      },
    ])
  );

  return {
    program: session.program,
    session: {
      id: session.id,
      sessionNumber: session.sessionNumber,
      title: session.title,
      date: session.date,
      durationMinutes: session.durationMinutes,
    },
    enrollments: enrollments.map((e) => {
      const attendance = attendanceMap.get(e.id);
      return {
        id: e.id,
        clientName: `${e.client.lastName}, ${e.client.firstName}`,
        attended: attendance?.attended ?? null,
        hoursAttended: attendance?.hoursAttended ?? null,
        notes: attendance?.notes ?? null,
      };
    }),
  };
}

/**
 * Get program-wide attendance summary
 */
export async function getProgramAttendanceSummary(
  programId: string
): Promise<{
  sessions: SessionAttendanceSummary[];
  overallAttendanceRate: number;
  totalHoursRecorded: number;
}> {
  const sessions = await prisma.programSession.findMany({
    where: { programId },
    orderBy: { sessionNumber: "asc" },
    select: { id: true },
  });

  const summaries: SessionAttendanceSummary[] = [];
  let totalAttended = 0;
  let totalPossible = 0;
  let totalHours = 0;

  for (const session of sessions) {
    const summary = await getSessionAttendanceSummary(session.id);
    summaries.push(summary);
    totalAttended += summary.attendedCount;
    totalPossible += summary.totalEnrolled;
    totalHours += summary.totalHours;
  }

  const overallAttendanceRate =
    totalPossible > 0 ? (totalAttended / totalPossible) * 100 : 0;

  return {
    sessions: summaries,
    overallAttendanceRate: Math.round(overallAttendanceRate * 10) / 10,
    totalHoursRecorded: Math.round(totalHours * 100) / 100,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Transform Prisma attendance to our type
 */
function transformAttendance(attendance: any): AttendanceRecord {
  return {
    id: attendance.id,
    sessionId: attendance.sessionId,
    enrollmentId: attendance.enrollmentId,
    attended: attendance.attended,
    hoursAttended: attendance.hoursAttended?.toNumber() || null,
    notes: attendance.notes,
    recordedById: attendance.recordedById,
    recordedAt: attendance.recordedAt,
    updatedAt: attendance.updatedAt,
    recordedBy: attendance.recordedBy,
    enrollment: attendance.enrollment,
    session: attendance.session,
  };
}
