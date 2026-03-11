import { prisma } from "@/lib/db";
import type {
  ClientAttendanceReport,
  SessionAttendanceReport,
  ProgramAttendanceReport,
} from "./types";
import type { AttendanceType } from "@prisma/client";

/**
 * Get attendance report for a specific client
 */
export async function getClientAttendanceReport(
  clientId: string,
  orgId: string
): Promise<ClientAttendanceReport | null> {
  // Get client with enrollments
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      programEnrollments: {
        include: {
          program: {
            select: {
              id: true,
              name: true,
              requiredHours: true,
              sessions: {
                select: {
                  id: true,
                  sessionNumber: true,
                  title: true,
                  date: true,
                  durationMinutes: true,
                },
                orderBy: { sessionNumber: "asc" },
              },
            },
          },
          attendance: {
            select: {
              sessionId: true,
              attended: true,
              attendanceType: true,
              hoursAttended: true,
              notes: true,
            },
          },
        },
        orderBy: { enrolledDate: "desc" },
      },
    },
  });

  if (!client) return null;

  const programs = client.programEnrollments.map((enrollment) => {
    const totalSessions = enrollment.program.sessions.length;

    // Build attendance map
    const attendanceMap = new Map(
      enrollment.attendance.map((a) => [a.sessionId, a])
    );

    // Calculate hours
    let hoursCompleted = 0;
    enrollment.attendance.forEach((a) => {
      if (a.attended && a.hoursAttended) {
        hoursCompleted += a.hoursAttended.toNumber();
      }
    });

    // Sessions attended
    const sessionsAttended = enrollment.attendance.filter((a) => a.attended).length;
    const attendanceRate = totalSessions > 0 ? (sessionsAttended / totalSessions) * 100 : 0;

    // Hours remaining
    const hoursRemaining = enrollment.program.requiredHours
      ? Math.max(0, enrollment.program.requiredHours - hoursCompleted)
      : null;

    // Build session details
    const sessions = enrollment.program.sessions.map((session) => {
      const attendance = attendanceMap.get(session.id);
      return {
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        sessionTitle: session.title,
        sessionDate: session.date,
        attendanceType: attendance?.attendanceType || null,
        hoursAttended: attendance?.hoursAttended?.toNumber() || null,
        notes: attendance?.notes || null,
      };
    });

    return {
      programId: enrollment.program.id,
      programName: enrollment.program.name,
      enrollmentId: enrollment.id,
      enrollmentStatus: enrollment.status,
      requiredHours: enrollment.program.requiredHours,
      hoursCompleted: Math.round(hoursCompleted * 100) / 100,
      hoursRemaining,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      sessions,
    };
  });

  return {
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
    },
    programs,
  };
}

/**
 * Get attendance report for a specific session
 */
export async function getSessionAttendanceReport(
  sessionId: string,
  orgId: string
): Promise<SessionAttendanceReport | null> {
  // Get session with program and attendance
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: {
        select: {
          id: true,
          name: true,
          orgId: true,
          enrollments: {
            where: { status: { in: ["ENROLLED", "IN_PROGRESS", "COMPLETED"] } },
            include: {
              client: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
      attendance: {
        include: {
          enrollment: {
            include: {
              client: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.program.orgId !== orgId) return null;

  // Build attendance map
  const attendanceMap = new Map(
    session.attendance.map((a) => [a.enrollmentId, a])
  );

  // Count by type
  let presentCount = 0;
  let excusedCount = 0;
  let absentCount = 0;
  let notRecordedCount = 0;
  let totalHours = 0;

  // Build records for all enrolled clients
  const records = session.program.enrollments.map((enrollment) => {
    const attendance = attendanceMap.get(enrollment.id);

    if (!attendance) {
      notRecordedCount++;
      return {
        enrollmentId: enrollment.id,
        clientName: `${enrollment.client.lastName}, ${enrollment.client.firstName}`,
        attendanceType: null as AttendanceType | null,
        hoursAttended: null,
        timeIn: null,
        timeOut: null,
        signatureVerified: false,
        notes: null,
        uploadSourceId: null,
      };
    }

    // Count by type
    if (attendance.attendanceType === "PRESENT") {
      presentCount++;
    } else if (attendance.attendanceType === "EXCUSED") {
      excusedCount++;
    } else if (attendance.attendanceType === "ABSENT" || !attendance.attended) {
      absentCount++;
    } else if (attendance.attended) {
      presentCount++;
    } else {
      absentCount++;
    }

    if (attendance.hoursAttended) {
      totalHours += attendance.hoursAttended.toNumber();
    }

    return {
      enrollmentId: enrollment.id,
      clientName: `${enrollment.client.lastName}, ${enrollment.client.firstName}`,
      attendanceType: attendance.attendanceType,
      hoursAttended: attendance.hoursAttended?.toNumber() || null,
      timeIn: attendance.timeIn,
      timeOut: attendance.timeOut,
      signatureVerified: attendance.signatureVerified,
      notes: attendance.notes,
      uploadSourceId: attendance.uploadSourceId,
    };
  });

  // Sort by client name
  records.sort((a, b) => a.clientName.localeCompare(b.clientName));

  const totalEnrolled = session.program.enrollments.length;
  const recordedCount = totalEnrolled - notRecordedCount;
  const attendanceRate =
    recordedCount > 0 ? ((presentCount + excusedCount) / recordedCount) * 100 : 0;

  return {
    session: {
      id: session.id,
      sessionNumber: session.sessionNumber,
      title: session.title,
      date: session.date,
      durationMinutes: session.durationMinutes,
    },
    program: {
      id: session.program.id,
      name: session.program.name,
    },
    summary: {
      totalEnrolled,
      presentCount,
      excusedCount,
      absentCount,
      notRecordedCount,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      totalHours: Math.round(totalHours * 100) / 100,
    },
    records,
  };
}

/**
 * Get comprehensive attendance report for a program
 */
export async function getProgramAttendanceReport(
  programId: string,
  orgId: string
): Promise<ProgramAttendanceReport | null> {
  // Get program with all related data
  const program = await prisma.program.findFirst({
    where: { id: programId, orgId },
    include: {
      sessions: {
        orderBy: { sessionNumber: "asc" },
        include: {
          attendance: true,
        },
      },
      enrollments: {
        include: {
          client: {
            select: { firstName: true, lastName: true },
          },
          attendance: true,
        },
      },
    },
  });

  if (!program) return null;

  // Program summary
  const totalEnrollments = program.enrollments.length;
  const activeEnrollments = program.enrollments.filter(
    (e) => e.status === "ENROLLED" || e.status === "IN_PROGRESS"
  ).length;
  const completedEnrollments = program.enrollments.filter(
    (e) => e.status === "COMPLETED"
  ).length;
  const totalSessions = program.sessions.length;

  // Session summaries
  const sessionSummaries = program.sessions.map((session) => {
    let presentCount = 0;
    let excusedCount = 0;
    let absentCount = 0;

    session.attendance.forEach((a) => {
      if (a.attendanceType === "PRESENT" || (a.attended && !a.attendanceType)) {
        presentCount++;
      } else if (a.attendanceType === "EXCUSED") {
        excusedCount++;
      } else {
        absentCount++;
      }
    });

    const total = session.attendance.length;
    const attendanceRate = total > 0 ? ((presentCount + excusedCount) / total) * 100 : 0;

    return {
      sessionId: session.id,
      sessionNumber: session.sessionNumber,
      sessionTitle: session.title,
      sessionDate: session.date,
      presentCount,
      excusedCount,
      absentCount,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
    };
  });

  // Sessions with attendance recorded
  const sessionsWithAttendance = sessionSummaries.filter(
    (s) => s.presentCount + s.excusedCount + s.absentCount > 0
  ).length;

  // Overall attendance rate
  const totalAttendanceRecords = sessionSummaries.reduce(
    (sum, s) => sum + s.presentCount + s.excusedCount + s.absentCount,
    0
  );
  const totalPresent = sessionSummaries.reduce(
    (sum, s) => sum + s.presentCount + s.excusedCount,
    0
  );
  const overallAttendanceRate =
    totalAttendanceRecords > 0 ? (totalPresent / totalAttendanceRecords) * 100 : 0;

  // Enrollment summaries
  const enrollmentSummaries = program.enrollments.map((enrollment) => {
    const attendedSessions = enrollment.attendance.filter(
      (a) => a.attendanceType === "PRESENT" || a.attendanceType === "EXCUSED" || a.attended
    ).length;
    const recordedSessions = enrollment.attendance.length;
    const attendanceRate =
      recordedSessions > 0 ? (attendedSessions / recordedSessions) * 100 : 0;

    let hoursCompleted = 0;
    enrollment.attendance.forEach((a) => {
      if (a.hoursAttended) {
        hoursCompleted += a.hoursAttended.toNumber();
      }
    });

    const hoursRemaining = program.requiredHours
      ? Math.max(0, program.requiredHours - hoursCompleted)
      : null;

    return {
      enrollmentId: enrollment.id,
      clientName: `${enrollment.client.lastName}, ${enrollment.client.firstName}`,
      status: enrollment.status,
      sessionsAttended: attendedSessions,
      totalSessions: recordedSessions,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      hoursCompleted: Math.round(hoursCompleted * 100) / 100,
      hoursRemaining,
    };
  });

  // Sort by client name
  enrollmentSummaries.sort((a, b) => a.clientName.localeCompare(b.clientName));

  // Total hours recorded
  const totalHoursRecorded = enrollmentSummaries.reduce(
    (sum, e) => sum + e.hoursCompleted,
    0
  );
  const averageHoursPerEnrollment =
    activeEnrollments > 0 ? totalHoursRecorded / activeEnrollments : 0;

  return {
    program: {
      id: program.id,
      name: program.name,
      requiredHours: program.requiredHours,
      startDate: program.startDate,
      endDate: program.endDate,
    },
    summary: {
      totalEnrollments,
      activeEnrollments,
      completedEnrollments,
      totalSessions,
      sessionsWithAttendance,
      overallAttendanceRate: Math.round(overallAttendanceRate * 10) / 10,
      totalHoursRecorded: Math.round(totalHoursRecorded * 100) / 100,
      averageHoursPerEnrollment: Math.round(averageHoursPerEnrollment * 100) / 100,
    },
    sessionSummaries,
    enrollmentSummaries,
  };
}

/**
 * Export attendance data as CSV
 */
export async function exportSessionAttendanceCSV(
  sessionId: string,
  orgId: string
): Promise<string | null> {
  const report = await getSessionAttendanceReport(sessionId, orgId);
  if (!report) return null;

  const headers = [
    "Client Name",
    "Attendance Status",
    "Hours Attended",
    "Time In",
    "Time Out",
    "Signature Verified",
    "Notes",
  ];

  const rows = report.records.map((r) => [
    r.clientName,
    r.attendanceType || "Not Recorded",
    r.hoursAttended?.toString() || "",
    r.timeIn ? r.timeIn.toLocaleTimeString() : "",
    r.timeOut ? r.timeOut.toLocaleTimeString() : "",
    r.signatureVerified ? "Yes" : "No",
    r.notes || "",
  ]);

  // Build CSV
  const csvLines = [
    `# Session Attendance Report`,
    `# Program: ${report.program.name}`,
    `# Session: #${report.session.sessionNumber} - ${report.session.title}`,
    `# Date: ${report.session.date?.toLocaleDateString() || "Not scheduled"}`,
    `# Generated: ${new Date().toISOString()}`,
    ``,
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
    ``,
    `# Summary`,
    `# Total Enrolled: ${report.summary.totalEnrolled}`,
    `# Present: ${report.summary.presentCount}`,
    `# Excused: ${report.summary.excusedCount}`,
    `# Absent: ${report.summary.absentCount}`,
    `# Not Recorded: ${report.summary.notRecordedCount}`,
    `# Attendance Rate: ${report.summary.attendanceRate}%`,
    `# Total Hours: ${report.summary.totalHours}`,
  ];

  return csvLines.join("\n");
}

/**
 * Export program attendance data as CSV
 */
export async function exportProgramAttendanceCSV(
  programId: string,
  orgId: string
): Promise<string | null> {
  const report = await getProgramAttendanceReport(programId, orgId);
  if (!report) return null;

  const headers = [
    "Client Name",
    "Status",
    "Sessions Attended",
    "Total Sessions",
    "Attendance Rate (%)",
    "Hours Completed",
    "Hours Remaining",
  ];

  const rows = report.enrollmentSummaries.map((e) => [
    e.clientName,
    e.status,
    e.sessionsAttended.toString(),
    e.totalSessions.toString(),
    e.attendanceRate.toString(),
    e.hoursCompleted.toString(),
    e.hoursRemaining?.toString() || "N/A",
  ]);

  const csvLines = [
    `# Program Attendance Report`,
    `# Program: ${report.program.name}`,
    `# Required Hours: ${report.program.requiredHours || "N/A"}`,
    `# Period: ${report.program.startDate?.toLocaleDateString() || "N/A"} - ${report.program.endDate?.toLocaleDateString() || "N/A"}`,
    `# Generated: ${new Date().toISOString()}`,
    ``,
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
    ``,
    `# Summary`,
    `# Total Enrollments: ${report.summary.totalEnrollments}`,
    `# Active: ${report.summary.activeEnrollments}`,
    `# Completed: ${report.summary.completedEnrollments}`,
    `# Total Sessions: ${report.summary.totalSessions}`,
    `# Sessions With Attendance: ${report.summary.sessionsWithAttendance}`,
    `# Overall Attendance Rate: ${report.summary.overallAttendanceRate}%`,
    `# Total Hours Recorded: ${report.summary.totalHoursRecorded}`,
  ];

  return csvLines.join("\n");
}

/**
 * Helper to escape CSV values
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
