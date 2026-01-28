import { prisma } from "@/lib/db";
import { generateAttendanceSheetPdf, generateAttendanceSheetFilename } from "@/lib/pdf/attendance-sheet";
import { generateAttendanceQRCode } from "@/lib/pdf/qr-generator";
import { ensureAttendanceCode, getProgramAttendanceCodes } from "./attendance-codes";
import { uploadAttendanceSheet, getAttendanceSheetKey } from "./storage";
import type {
  GenerateSheetInput,
  GenerateSheetResult,
  BatchGenerateSheetInput,
  BatchGenerateSheetResult,
  AttendanceSheetData,
  AttendanceSheetConfigInput,
  AttendanceSheetConfig,
} from "./types";

// ============================================
// SHEET CONFIG MANAGEMENT
// ============================================

/**
 * Get or create default attendance sheet config for a program
 */
export async function getOrCreateSheetConfig(
  programId: string
): Promise<AttendanceSheetConfig> {
  let config = await prisma.attendanceSheetConfig.findUnique({
    where: { programId },
  });

  if (!config) {
    // Create default config
    config = await prisma.attendanceSheetConfig.create({
      data: {
        programId,
        includeTimeInOut: true,
        includeClientSignature: true,
        includeNotes: true,
      },
    });
  }

  return config;
}

/**
 * Update attendance sheet config for a program
 */
export async function updateSheetConfig(
  input: AttendanceSheetConfigInput
): Promise<AttendanceSheetConfig> {
  const config = await prisma.attendanceSheetConfig.upsert({
    where: { programId: input.programId },
    create: {
      programId: input.programId,
      includeTimeInOut: input.includeTimeInOut ?? true,
      includeClientSignature: input.includeClientSignature ?? true,
      includeNotes: input.includeNotes ?? true,
      customInstructions: input.customInstructions ?? null,
    },
    update: {
      ...(input.includeTimeInOut !== undefined && {
        includeTimeInOut: input.includeTimeInOut,
      }),
      ...(input.includeClientSignature !== undefined && {
        includeClientSignature: input.includeClientSignature,
      }),
      ...(input.includeNotes !== undefined && {
        includeNotes: input.includeNotes,
      }),
      ...(input.customInstructions !== undefined && {
        customInstructions: input.customInstructions,
      }),
    },
  });

  return config;
}

// ============================================
// SHEET DATA PREPARATION
// ============================================

/**
 * Prepare data for attendance sheet generation
 */
async function prepareSheetData(
  sessionId: string,
  overrideDate?: Date
): Promise<AttendanceSheetData> {
  // Get session with program
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: {
        include: {
          attendanceSheetConfig: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Get or create config
  const config = session.program.attendanceSheetConfig || {
    includeTimeInOut: true,
    includeClientSignature: true,
    includeNotes: true,
    customInstructions: null,
  };

  // Get active enrollments for the program
  const enrollments = await prisma.programEnrollment.findMany({
    where: {
      programId: session.programId,
      status: { in: ["ENROLLED", "IN_PROGRESS"] },
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
      attendanceCode: true,
    },
    orderBy: {
      client: { lastName: "asc" },
    },
  });

  // Ensure all enrollments have attendance codes and generate QR codes
  const enrollmentData = await Promise.all(
    enrollments.map(async (enrollment) => {
      // Ensure attendance code exists
      const codeInfo = await ensureAttendanceCode(enrollment.id);

      // Generate QR code
      const qrCodeDataUrl = await generateAttendanceQRCode(
        enrollment.id,
        codeInfo.code,
        { width: 80, errorCorrectionLevel: "H" }
      );

      return {
        enrollmentId: enrollment.id,
        clientName: `${enrollment.client.lastName}, ${enrollment.client.firstName}`,
        attendanceCode: codeInfo.code,
        qrCodeDataUrl,
      };
    })
  );

  // Use override date, session date, or current date
  const sheetDate = overrideDate || session.date || new Date();

  return {
    program: {
      id: session.program.id,
      name: session.program.name,
      labelType: session.program.labelType,
    },
    session: {
      id: session.id,
      sessionNumber: session.sessionNumber,
      title: session.title,
      date: sheetDate,
      durationMinutes: session.durationMinutes,
    },
    config: {
      includeTimeInOut: config.includeTimeInOut,
      includeClientSignature: config.includeClientSignature,
      includeNotes: config.includeNotes,
      customInstructions: config.customInstructions,
    },
    enrollments: enrollmentData,
    generatedAt: new Date(),
  };
}

// ============================================
// SHEET GENERATION
// ============================================

/**
 * Generate attendance sheet for a session
 */
export async function generateAttendanceSheet(
  input: GenerateSheetInput
): Promise<GenerateSheetResult> {
  const { sessionId, date, userId } = input;

  // Get session to verify it exists and get org ID
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: {
        select: { id: true, name: true, orgId: true },
      },
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Prepare sheet data
  const sheetData = await prepareSheetData(sessionId, date);

  // Generate PDF
  const pdfBuffer = await generateAttendanceSheetPdf(sheetData);

  // Generate filename
  const fileName = generateAttendanceSheetFilename(
    session.program.name,
    session.sessionNumber,
    sheetData.session.date
  );

  // Create attendance upload record
  const upload = await prisma.attendanceUpload.create({
    data: {
      sessionId,
      orgId: session.program.orgId,
      status: "SHEET_GENERATED",
      sheetGeneratedAt: new Date(),
      uploadedById: userId,
    },
  });

  // Upload to S3 (optional - can be skipped if just returning buffer)
  let s3Key: string | undefined;
  try {
    s3Key = await uploadAttendanceSheet(
      session.program.orgId,
      upload.id,
      pdfBuffer,
      fileName
    );

    // Update upload record with S3 path
    await prisma.attendanceUpload.update({
      where: { id: upload.id },
      data: { sheetPath: s3Key },
    });
  } catch (error) {
    // S3 upload is optional - sheet can still be downloaded directly
    console.error("Failed to upload sheet to S3:", error);
  }

  return {
    uploadId: upload.id,
    pdfBuffer,
    fileName,
    s3Key,
  };
}

/**
 * Batch generate attendance sheets for sessions in a date range
 */
export async function batchGenerateAttendanceSheets(
  input: BatchGenerateSheetInput
): Promise<BatchGenerateSheetResult> {
  const { programId, startDate, endDate, userId } = input;

  // Get sessions in the date range
  const sessions = await prisma.programSession.findMany({
    where: {
      programId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      program: {
        select: { name: true, orgId: true },
      },
    },
    orderBy: { sessionNumber: "asc" },
  });

  const generated: BatchGenerateSheetResult["generated"] = [];
  const failed: BatchGenerateSheetResult["failed"] = [];

  for (const session of sessions) {
    try {
      const result = await generateAttendanceSheet({
        sessionId: session.id,
        date: session.date || undefined,
        userId,
      });

      generated.push({
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        uploadId: result.uploadId,
        fileName: result.fileName,
        s3Key: result.s3Key,
      });
    } catch (error) {
      failed.push({
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { generated, failed };
}

/**
 * Re-generate an existing attendance sheet
 */
export async function regenerateAttendanceSheet(
  uploadId: string,
  userId: string
): Promise<GenerateSheetResult> {
  const upload = await prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: {
            select: { name: true, orgId: true },
          },
        },
      },
    },
  });

  if (!upload) {
    throw new Error("Upload not found");
  }

  // Re-generate with the same session
  return generateAttendanceSheet({
    sessionId: upload.sessionId,
    userId,
  });
}

/**
 * Get attendance upload by ID
 */
export async function getAttendanceUpload(uploadId: string) {
  return prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: {
            select: { id: true, name: true, orgId: true },
          },
        },
      },
      extractedRecords: {
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
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      reviewedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Get all attendance uploads for a session
 */
export async function getSessionAttendanceUploads(sessionId: string) {
  return prisma.attendanceUpload.findMany({
    where: { sessionId },
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      reviewedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
