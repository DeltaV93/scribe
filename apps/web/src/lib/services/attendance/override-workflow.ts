import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit/service";
import type { AttendanceType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface RequestOverrideInput {
  uploadId: string;
  reason: string;
  requestedById: string;
}

export interface ApproveOverrideInput {
  uploadId: string;
  approverId: string;
  records: {
    enrollmentId: string;
    attendanceType: AttendanceType;
    hoursAttended?: number | null;
    notes?: string | null;
  }[];
}

/**
 * Request an override for confirmed attendance
 */
export async function requestAttendanceOverride(
  input: RequestOverrideInput
): Promise<{ success: boolean; error?: string }> {
  const { uploadId, reason, requestedById } = input;

  const upload = await prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: { select: { orgId: true } },
        },
      },
    },
  });

  if (!upload) {
    return { success: false, error: "Upload not found" };
  }

  if (upload.status !== "CONFIRMED") {
    return { success: false, error: "Only confirmed attendance can be overridden" };
  }

  // Update to pending override review
  await prisma.attendanceUpload.update({
    where: { id: uploadId },
    data: {
      status: "PENDING_OVERRIDE_REVIEW",
      isOverride: true,
      overrideReason: reason,
    },
  });

  // Create audit log
  await createAuditLog({
    orgId: upload.session.program.orgId,
    userId: requestedById,
    action: "OVERRIDE_ATTENDANCE",
    resource: "ATTENDANCE_UPLOAD",
    resourceId: uploadId,
    details: {
      action: "request",
      reason,
    },
  });

  return { success: true };
}

/**
 * Approve an override request (Admin only)
 */
export async function approveAttendanceOverride(
  input: ApproveOverrideInput
): Promise<{ success: boolean; recordsUpdated: number; error?: string }> {
  const { uploadId, approverId, records } = input;

  const upload = await prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: { select: { orgId: true, id: true } },
        },
      },
    },
  });

  if (!upload) {
    return { success: false, recordsUpdated: 0, error: "Upload not found" };
  }

  if (upload.status !== "PENDING_OVERRIDE_REVIEW") {
    return { success: false, recordsUpdated: 0, error: "Upload is not pending override review" };
  }

  let recordsUpdated = 0;

  // Update attendance records
  for (const record of records) {
    const hoursAttended =
      record.hoursAttended !== undefined && record.hoursAttended !== null
        ? new Decimal(record.hoursAttended)
        : upload.session.durationMinutes
        ? new Decimal(upload.session.durationMinutes / 60)
        : null;

    await prisma.sessionAttendance.upsert({
      where: {
        sessionId_enrollmentId: {
          sessionId: upload.sessionId,
          enrollmentId: record.enrollmentId,
        },
      },
      create: {
        sessionId: upload.sessionId,
        enrollmentId: record.enrollmentId,
        attended: record.attendanceType !== "ABSENT",
        attendanceType: record.attendanceType,
        hoursAttended,
        notes: record.notes,
        uploadSourceId: uploadId,
        recordedById: approverId,
      },
      update: {
        attended: record.attendanceType !== "ABSENT",
        attendanceType: record.attendanceType,
        hoursAttended,
        notes: record.notes,
        uploadSourceId: uploadId,
        recordedById: approverId,
      },
    });

    recordsUpdated++;
  }

  // Update upload status
  await prisma.attendanceUpload.update({
    where: { id: uploadId },
    data: {
      status: "CONFIRMED",
      overrideApprovedById: approverId,
      overrideApprovedAt: new Date(),
    },
  });

  // Create audit log
  await createAuditLog({
    orgId: upload.session.program.orgId,
    userId: approverId,
    action: "OVERRIDE_ATTENDANCE",
    resource: "ATTENDANCE_UPLOAD",
    resourceId: uploadId,
    details: {
      action: "approve",
      recordsUpdated,
      originalReason: upload.overrideReason,
    },
  });

  return { success: true, recordsUpdated };
}

/**
 * Reject an override request
 */
export async function rejectAttendanceOverride(
  uploadId: string,
  rejecterId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const upload = await prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: { select: { orgId: true } },
        },
      },
    },
  });

  if (!upload) {
    return { success: false, error: "Upload not found" };
  }

  if (upload.status !== "PENDING_OVERRIDE_REVIEW") {
    return { success: false, error: "Upload is not pending override review" };
  }

  // Revert to confirmed status
  await prisma.attendanceUpload.update({
    where: { id: uploadId },
    data: {
      status: "CONFIRMED",
      isOverride: false,
      overrideReason: null,
    },
  });

  // Create audit log
  await createAuditLog({
    orgId: upload.session.program.orgId,
    userId: rejecterId,
    action: "REJECT",
    resource: "ATTENDANCE_UPLOAD",
    resourceId: uploadId,
    details: {
      action: "reject_override",
      reason,
      originalReason: upload.overrideReason,
    },
  });

  return { success: true };
}

/**
 * Get all pending override requests for an organization
 */
export async function getPendingOverrideRequests(orgId: string) {
  return prisma.attendanceUpload.findMany({
    where: {
      orgId,
      status: "PENDING_OVERRIDE_REVIEW",
    },
    include: {
      session: {
        include: {
          program: { select: { id: true, name: true } },
        },
      },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Direct edit of confirmed attendance (Admin with mandatory reason)
 */
export async function editConfirmedAttendance(input: {
  sessionId: string;
  enrollmentId: string;
  attendanceType: AttendanceType;
  hoursAttended?: number | null;
  notes?: string | null;
  editReason: string;
  editorId: string;
  orgId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { sessionId, enrollmentId, attendanceType, hoursAttended, notes, editReason, editorId, orgId } = input;

  // Verify session belongs to org
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: { select: { orgId: true } },
    },
  });

  if (!session || session.program.orgId !== orgId) {
    return { success: false, error: "Session not found" };
  }

  // Get existing attendance
  const existing = await prisma.sessionAttendance.findUnique({
    where: {
      sessionId_enrollmentId: {
        sessionId,
        enrollmentId,
      },
    },
  });

  const previousValues = existing
    ? {
        attended: existing.attended,
        attendanceType: existing.attendanceType,
        hoursAttended: existing.hoursAttended?.toNumber(),
        notes: existing.notes,
      }
    : null;

  const hoursDecimal =
    hoursAttended !== undefined && hoursAttended !== null
      ? new Decimal(hoursAttended)
      : session.durationMinutes
      ? new Decimal(session.durationMinutes / 60)
      : null;

  // Update or create
  await prisma.sessionAttendance.upsert({
    where: {
      sessionId_enrollmentId: {
        sessionId,
        enrollmentId,
      },
    },
    create: {
      sessionId,
      enrollmentId,
      attended: attendanceType !== "ABSENT",
      attendanceType,
      hoursAttended: hoursDecimal,
      notes,
      recordedById: editorId,
    },
    update: {
      attended: attendanceType !== "ABSENT",
      attendanceType,
      hoursAttended: hoursDecimal,
      notes,
      recordedById: editorId,
    },
  });

  // Create audit log
  await createAuditLog({
    orgId,
    userId: editorId,
    action: "UPDATE",
    resource: "ATTENDANCE_RECORD",
    resourceId: `${sessionId}:${enrollmentId}`,
    details: {
      editReason,
      previousValues,
      newValues: {
        attended: attendanceType !== "ABSENT",
        attendanceType,
        hoursAttended: hoursDecimal?.toNumber(),
        notes,
      },
    },
  });

  return { success: true };
}
