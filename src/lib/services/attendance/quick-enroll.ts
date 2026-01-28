import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit/service";
import { ensureAttendanceCode } from "./attendance-codes";
import type { AttendanceType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface QuickEnrollInput {
  programId: string;
  clientId: string;
  enrolledById: string;
  // Optional: immediately record attendance
  sessionId?: string;
  attendanceType?: AttendanceType;
  hoursAttended?: number | null;
  notes?: string | null;
}

export interface QuickEnrollResult {
  success: boolean;
  enrollmentId?: string;
  attendanceCode?: string;
  attendanceRecordId?: string;
  error?: string;
}

/**
 * Quick-enroll a client in a program during attendance review
 * Optionally record their attendance for the current session
 */
export async function quickEnrollClient(
  input: QuickEnrollInput
): Promise<QuickEnrollResult> {
  const {
    programId,
    clientId,
    enrolledById,
    sessionId,
    attendanceType,
    hoursAttended,
    notes,
  } = input;

  // Verify program exists
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      sessions: sessionId
        ? { where: { id: sessionId } }
        : undefined,
    },
  });

  if (!program) {
    return { success: false, error: "Program not found" };
  }

  // Check if client exists in same org
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId: program.orgId },
  });

  if (!client) {
    return { success: false, error: "Client not found" };
  }

  // Check if already enrolled
  const existingEnrollment = await prisma.programEnrollment.findUnique({
    where: {
      programId_clientId: {
        programId,
        clientId,
      },
    },
  });

  if (existingEnrollment) {
    // Already enrolled - just return the existing enrollment
    const code = await ensureAttendanceCode(existingEnrollment.id);

    // If session specified, record attendance
    let attendanceRecordId: string | undefined;
    if (sessionId && attendanceType) {
      const session = program.sessions?.find((s) => s.id === sessionId);
      const hoursDecimal =
        hoursAttended !== undefined && hoursAttended !== null
          ? new Decimal(hoursAttended)
          : session?.durationMinutes
          ? new Decimal(session.durationMinutes / 60)
          : null;

      const attendance = await prisma.sessionAttendance.upsert({
        where: {
          sessionId_enrollmentId: {
            sessionId,
            enrollmentId: existingEnrollment.id,
          },
        },
        create: {
          sessionId,
          enrollmentId: existingEnrollment.id,
          attended: attendanceType !== "ABSENT",
          attendanceType,
          hoursAttended: hoursDecimal,
          notes,
          recordedById: enrolledById,
        },
        update: {
          attended: attendanceType !== "ABSENT",
          attendanceType,
          hoursAttended: hoursDecimal,
          notes,
          recordedById: enrolledById,
        },
      });
      attendanceRecordId = attendance.id;
    }

    return {
      success: true,
      enrollmentId: existingEnrollment.id,
      attendanceCode: code.code,
      attendanceRecordId,
    };
  }

  // Create new enrollment
  const enrollment = await prisma.programEnrollment.create({
    data: {
      programId,
      clientId,
      enrolledById,
      status: "IN_PROGRESS",
      notes: "Quick-enrolled during attendance",
    },
  });

  // Generate attendance code
  const code = await ensureAttendanceCode(enrollment.id);

  // Record attendance if session specified
  let attendanceRecordId: string | undefined;
  if (sessionId && attendanceType) {
    const session = program.sessions?.find((s) => s.id === sessionId);
    const hoursDecimal =
      hoursAttended !== undefined && hoursAttended !== null
        ? new Decimal(hoursAttended)
        : session?.durationMinutes
        ? new Decimal(session.durationMinutes / 60)
        : null;

    const attendance = await prisma.sessionAttendance.create({
      data: {
        sessionId,
        enrollmentId: enrollment.id,
        attended: attendanceType !== "ABSENT",
        attendanceType,
        hoursAttended: hoursDecimal,
        notes,
        recordedById: enrolledById,
      },
    });
    attendanceRecordId = attendance.id;
  }

  // Create audit log
  await createAuditLog({
    orgId: program.orgId,
    userId: enrolledById,
    action: "QUICK_ENROLL",
    resource: "ATTENDANCE_RECORD",
    resourceId: enrollment.id,
    resourceName: `${client.firstName} ${client.lastName}`,
    details: {
      programId,
      programName: program.name,
      sessionId,
      attendanceType,
    },
  });

  return {
    success: true,
    enrollmentId: enrollment.id,
    attendanceCode: code.code,
    attendanceRecordId,
  };
}

/**
 * Search for clients to quick-enroll
 */
export async function searchClientsForQuickEnroll(
  orgId: string,
  programId: string,
  query: string,
  limit: number = 10
): Promise<
  {
    clientId: string;
    firstName: string;
    lastName: string;
    isEnrolled: boolean;
    enrollmentId?: string;
  }[]
> {
  // Search clients
  const clients = await prisma.client.findMany({
    where: {
      orgId,
      deletedAt: null,
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      programEnrollments: {
        where: { programId },
        select: { id: true },
      },
    },
    take: limit,
    orderBy: { lastName: "asc" },
  });

  return clients.map((client) => ({
    clientId: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    isEnrolled: client.programEnrollments.length > 0,
    enrollmentId: client.programEnrollments[0]?.id,
  }));
}

/**
 * Create a new client and enroll them in one step
 */
export async function quickCreateAndEnroll(input: {
  orgId: string;
  programId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  createdById: string;
  sessionId?: string;
  attendanceType?: AttendanceType;
}): Promise<QuickEnrollResult> {
  const {
    orgId,
    programId,
    firstName,
    lastName,
    phone,
    email,
    createdById,
    sessionId,
    attendanceType,
  } = input;

  // Verify program exists and belongs to org
  const program = await prisma.program.findFirst({
    where: { id: programId, orgId },
  });

  if (!program) {
    return { success: false, error: "Program not found" };
  }

  // Create client
  const client = await prisma.client.create({
    data: {
      orgId,
      firstName,
      lastName,
      phone,
      email,
      assignedTo: createdById,
      createdBy: createdById,
      status: "ACTIVE",
    },
  });

  // Create enrollment
  const enrollment = await prisma.programEnrollment.create({
    data: {
      programId,
      clientId: client.id,
      enrolledById: createdById,
      status: "IN_PROGRESS",
      notes: "Quick-enrolled during attendance (new client)",
    },
  });

  // Generate attendance code
  const code = await ensureAttendanceCode(enrollment.id);

  // Record attendance if session specified
  let attendanceRecordId: string | undefined;
  if (sessionId && attendanceType) {
    const session = await prisma.programSession.findUnique({
      where: { id: sessionId },
    });

    const hoursDecimal = session?.durationMinutes
      ? new Decimal(session.durationMinutes / 60)
      : null;

    const attendance = await prisma.sessionAttendance.create({
      data: {
        sessionId,
        enrollmentId: enrollment.id,
        attended: attendanceType !== "ABSENT",
        attendanceType,
        hoursAttended: hoursDecimal,
        recordedById: createdById,
      },
    });
    attendanceRecordId = attendance.id;
  }

  // Create audit logs
  await createAuditLog({
    orgId,
    userId: createdById,
    action: "CREATE",
    resource: "CLIENT",
    resourceId: client.id,
    resourceName: `${firstName} ${lastName}`,
    details: { quickCreate: true, programId },
  });

  await createAuditLog({
    orgId,
    userId: createdById,
    action: "QUICK_ENROLL",
    resource: "ATTENDANCE_RECORD",
    resourceId: enrollment.id,
    resourceName: `${firstName} ${lastName}`,
    details: {
      programId,
      programName: program.name,
      newClient: true,
    },
  });

  return {
    success: true,
    enrollmentId: enrollment.id,
    attendanceCode: code.code,
    attendanceRecordId,
  };
}
