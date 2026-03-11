import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { createAuditLog } from "@/lib/audit/service";
import type {
  ReviewAttendanceInput,
  ReviewAttendanceResult,
  ReviewedRecord,
} from "./types";
import type { AttendanceType } from "@prisma/client";

/**
 * Submit reviewed attendance for confirmation
 */
export async function submitAttendanceReview(
  input: ReviewAttendanceInput
): Promise<ReviewAttendanceResult> {
  const { uploadId, reviewerId, records, notes } = input;

  // Get the upload to verify status
  const upload = await prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: { select: { orgId: true, id: true, name: true } },
        },
      },
      extractedRecords: true,
    },
  });

  if (!upload) {
    return { success: false, attendanceRecordsCreated: 0, attendanceRecordsUpdated: 0, errors: [{ recordId: "", error: "Upload not found" }] };
  }

  if (upload.status !== "PENDING_REVIEW" && upload.status !== "PENDING_OVERRIDE_REVIEW") {
    return {
      success: false,
      attendanceRecordsCreated: 0,
      attendanceRecordsUpdated: 0,
      errors: [{ recordId: "", error: `Upload is not ready for review (status: ${upload.status})` }],
    };
  }

  const errors: { recordId: string; error: string }[] = [];
  let attendanceRecordsCreated = 0;
  let attendanceRecordsUpdated = 0;

  // Process each reviewed record
  for (const record of records) {
    try {
      // Validate enrollment exists
      if (!record.enrollmentId) {
        errors.push({ recordId: record.extractedRecordId, error: "No enrollment ID provided" });
        continue;
      }

      const enrollment = await prisma.programEnrollment.findUnique({
        where: { id: record.enrollmentId },
        select: { id: true, programId: true },
      });

      if (!enrollment || enrollment.programId !== upload.session.program.id) {
        errors.push({ recordId: record.extractedRecordId, error: "Invalid enrollment" });
        continue;
      }

      // Calculate hours attended
      let hoursAttended: Decimal | null = null;
      if (record.attendanceType === "PRESENT" || record.attendanceType === "EXCUSED") {
        if (record.hoursAttended !== undefined && record.hoursAttended !== null) {
          hoursAttended = new Decimal(record.hoursAttended);
        } else if (record.timeIn && record.timeOut) {
          // Calculate from time in/out
          const diffMs = record.timeOut.getTime() - record.timeIn.getTime();
          const hours = diffMs / (1000 * 60 * 60);
          hoursAttended = new Decimal(Math.round(hours * 100) / 100);
        } else if (upload.session.durationMinutes) {
          // Use session duration
          hoursAttended = new Decimal(upload.session.durationMinutes / 60);
        }
      }

      // Create or update SessionAttendance record
      const existingAttendance = await prisma.sessionAttendance.findUnique({
        where: {
          sessionId_enrollmentId: {
            sessionId: upload.sessionId,
            enrollmentId: record.enrollmentId,
          },
        },
      });

      if (existingAttendance) {
        await prisma.sessionAttendance.update({
          where: { id: existingAttendance.id },
          data: {
            attended: record.attendanceType !== "ABSENT",
            attendanceType: record.attendanceType,
            hoursAttended,
            timeIn: record.timeIn,
            timeOut: record.timeOut,
            notes: record.notes,
            uploadSourceId: uploadId,
            recordedById: reviewerId,
          },
        });
        attendanceRecordsUpdated++;
      } else {
        await prisma.sessionAttendance.create({
          data: {
            sessionId: upload.sessionId,
            enrollmentId: record.enrollmentId,
            attended: record.attendanceType !== "ABSENT",
            attendanceType: record.attendanceType,
            hoursAttended,
            timeIn: record.timeIn,
            timeOut: record.timeOut,
            notes: record.notes,
            uploadSourceId: uploadId,
            recordedById: reviewerId,
          },
        });
        attendanceRecordsCreated++;
      }

      // Update extracted record as verified
      await prisma.attendanceExtractedRecord.update({
        where: { id: record.extractedRecordId },
        data: {
          enrollmentId: record.enrollmentId,
          attendanceType: record.attendanceType,
          isManuallyVerified: true,
          manuallyVerifiedById: reviewerId,
          manuallyVerifiedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Error processing record ${record.extractedRecordId}:`, error);
      errors.push({
        recordId: record.extractedRecordId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update upload status
  const newStatus = errors.length > 0 && attendanceRecordsCreated === 0 && attendanceRecordsUpdated === 0
    ? "FAILED"
    : "CONFIRMED";

  await prisma.attendanceUpload.update({
    where: { id: uploadId },
    data: {
      status: newStatus,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
      reviewNotes: notes,
    },
  });

  // Create audit log
  await createAuditLog({
    orgId: upload.session.program.orgId,
    userId: reviewerId,
    action: "CONFIRM_ATTENDANCE",
    resource: "ATTENDANCE_UPLOAD",
    resourceId: uploadId,
    details: {
      sessionId: upload.sessionId,
      programId: upload.session.program.id,
      recordsCreated: attendanceRecordsCreated,
      recordsUpdated: attendanceRecordsUpdated,
      errors: errors.length,
    },
  });

  return {
    success: errors.length === 0 || attendanceRecordsCreated > 0 || attendanceRecordsUpdated > 0,
    attendanceRecordsCreated,
    attendanceRecordsUpdated,
    errors,
  };
}

/**
 * Get upload with review data
 */
export async function getUploadForReview(uploadId: string) {
  return prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: {
            select: {
              id: true,
              name: true,
              orgId: true,
              enrollments: {
                where: { status: { in: ["ENROLLED", "IN_PROGRESS"] } },
                include: {
                  client: { select: { id: true, firstName: true, lastName: true } },
                  attendanceCode: true,
                },
                orderBy: { client: { lastName: "asc" } },
              },
            },
          },
        },
      },
      extractedRecords: {
        include: {
          enrollment: {
            include: {
              client: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      uploadedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

/**
 * Manual entry without AI (direct attendance recording from photo reference)
 */
export async function recordManualAttendance(input: {
  uploadId: string;
  userId: string;
  records: {
    enrollmentId: string;
    attendanceType: AttendanceType;
    hoursAttended?: number | null;
    notes?: string | null;
  }[];
}): Promise<ReviewAttendanceResult> {
  const { uploadId, userId, records } = input;

  // Get the upload
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
    return { success: false, attendanceRecordsCreated: 0, attendanceRecordsUpdated: 0, errors: [{ recordId: "", error: "Upload not found" }] };
  }

  const errors: { recordId: string; error: string }[] = [];
  let created = 0;
  let updated = 0;

  for (const record of records) {
    try {
      const hoursAttended = record.hoursAttended !== undefined && record.hoursAttended !== null
        ? new Decimal(record.hoursAttended)
        : upload.session.durationMinutes
        ? new Decimal(upload.session.durationMinutes / 60)
        : null;

      const existing = await prisma.sessionAttendance.findUnique({
        where: {
          sessionId_enrollmentId: {
            sessionId: upload.sessionId,
            enrollmentId: record.enrollmentId,
          },
        },
      });

      if (existing) {
        await prisma.sessionAttendance.update({
          where: { id: existing.id },
          data: {
            attended: record.attendanceType !== "ABSENT",
            attendanceType: record.attendanceType,
            hoursAttended,
            notes: record.notes,
            uploadSourceId: uploadId,
            recordedById: userId,
          },
        });
        updated++;
      } else {
        await prisma.sessionAttendance.create({
          data: {
            sessionId: upload.sessionId,
            enrollmentId: record.enrollmentId,
            attended: record.attendanceType !== "ABSENT",
            attendanceType: record.attendanceType,
            hoursAttended,
            notes: record.notes,
            uploadSourceId: uploadId,
            recordedById: userId,
          },
        });
        created++;
      }
    } catch (error) {
      errors.push({
        recordId: record.enrollmentId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update upload status to confirmed
  await prisma.attendanceUpload.update({
    where: { id: uploadId },
    data: {
      status: "CONFIRMED",
      reviewedAt: new Date(),
      reviewedById: userId,
      reviewNotes: "Manual entry",
    },
  });

  // Audit log
  await createAuditLog({
    orgId: upload.session.program.orgId,
    userId,
    action: "CONFIRM_ATTENDANCE",
    resource: "ATTENDANCE_UPLOAD",
    resourceId: uploadId,
    details: {
      manualEntry: true,
      recordsCreated: created,
      recordsUpdated: updated,
    },
  });

  return {
    success: true,
    attendanceRecordsCreated: created,
    attendanceRecordsUpdated: updated,
    errors,
  };
}

/**
 * Skip AI processing and go directly to manual review
 */
export async function skipAIProcessing(uploadId: string): Promise<void> {
  await prisma.attendanceUpload.update({
    where: { id: uploadId },
    data: {
      status: "PENDING_REVIEW",
      aiProcessingEndedAt: new Date(),
      aiError: "AI processing skipped - manual entry requested",
    },
  });
}
