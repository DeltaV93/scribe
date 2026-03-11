import { prisma } from "@/lib/db";
import type {
  AttendanceCodeInfo,
  GenerateCodesInput,
  GenerateCodesResult,
} from "./types";

// Consonants that don't look like numbers (no I, O, S, Z)
const CONSONANTS = "BCDFGHJKLMNPQRTVWXY";
// Numbers that don't look like letters (no 0, 1)
const NUMBERS = "23456789";

/**
 * Generate a single attendance code in format: XX9999 (e.g., BK2847)
 * Uses consonants + numbers to avoid OCR confusion
 */
function generateCode(): string {
  let code = "";

  // First 2 characters: consonants
  for (let i = 0; i < 2; i++) {
    code += CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)];
  }

  // Last 4 characters: numbers
  for (let i = 0; i < 4; i++) {
    code += NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
  }

  return code;
}

/**
 * Check if a code already exists for a program
 */
async function codeExistsForProgram(
  code: string,
  programId: string
): Promise<boolean> {
  const existing = await prisma.attendanceCode.findFirst({
    where: {
      code,
      enrollment: {
        programId,
      },
    },
  });
  return !!existing;
}

/**
 * Generate a unique code for a program
 */
async function generateUniqueCode(programId: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const code = generateCode();
    const exists = await codeExistsForProgram(code, programId);
    if (!exists) {
      return code;
    }
    attempts++;
  }

  throw new Error("Failed to generate unique attendance code after 100 attempts");
}

/**
 * Get attendance code for an enrollment
 */
export async function getAttendanceCode(
  enrollmentId: string
): Promise<AttendanceCodeInfo | null> {
  const code = await prisma.attendanceCode.findUnique({
    where: { enrollmentId },
    include: {
      enrollment: {
        include: {
          client: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!code) return null;

  return {
    id: code.id,
    enrollmentId: code.enrollmentId,
    code: code.code,
    clientName: `${code.enrollment.client.firstName} ${code.enrollment.client.lastName}`,
    createdAt: code.createdAt,
  };
}

/**
 * Generate or get existing attendance code for an enrollment
 */
export async function ensureAttendanceCode(
  enrollmentId: string
): Promise<AttendanceCodeInfo> {
  // Check if code already exists
  const existing = await getAttendanceCode(enrollmentId);
  if (existing) {
    return existing;
  }

  // Get enrollment to find program
  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      client: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!enrollment) {
    throw new Error("Enrollment not found");
  }

  // Generate unique code for this program
  const code = await generateUniqueCode(enrollment.programId);

  // Create the code
  const created = await prisma.attendanceCode.create({
    data: {
      enrollmentId,
      code,
    },
  });

  return {
    id: created.id,
    enrollmentId: created.enrollmentId,
    code: created.code,
    clientName: `${enrollment.client.firstName} ${enrollment.client.lastName}`,
    createdAt: created.createdAt,
  };
}

/**
 * Generate attendance codes for multiple enrollments
 */
export async function generateAttendanceCodes(
  input: GenerateCodesInput
): Promise<GenerateCodesResult> {
  const { programId, enrollmentIds } = input;

  // Get enrollments to generate codes for
  let enrollments;
  if (enrollmentIds && enrollmentIds.length > 0) {
    enrollments = await prisma.programEnrollment.findMany({
      where: {
        id: { in: enrollmentIds },
        programId,
      },
      include: {
        client: {
          select: { firstName: true, lastName: true },
        },
        attendanceCode: true,
      },
    });
  } else {
    // Get all active enrollments for the program
    enrollments = await prisma.programEnrollment.findMany({
      where: {
        programId,
        status: { in: ["ENROLLED", "IN_PROGRESS"] },
      },
      include: {
        client: {
          select: { firstName: true, lastName: true },
        },
        attendanceCode: true,
      },
    });
  }

  const generated: AttendanceCodeInfo[] = [];
  const skipped: { enrollmentId: string; reason: string }[] = [];

  for (const enrollment of enrollments) {
    // Skip if already has a code
    if (enrollment.attendanceCode) {
      skipped.push({
        enrollmentId: enrollment.id,
        reason: "Code already exists",
      });
      continue;
    }

    try {
      const code = await generateUniqueCode(programId);
      const created = await prisma.attendanceCode.create({
        data: {
          enrollmentId: enrollment.id,
          code,
        },
      });

      generated.push({
        id: created.id,
        enrollmentId: created.enrollmentId,
        code: created.code,
        clientName: `${enrollment.client.firstName} ${enrollment.client.lastName}`,
        createdAt: created.createdAt,
      });
    } catch (error) {
      skipped.push({
        enrollmentId: enrollment.id,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { generated, skipped };
}

/**
 * Find enrollment by attendance code within a program
 */
export async function findEnrollmentByCode(
  code: string,
  programId: string
): Promise<{
  enrollmentId: string;
  clientId: string;
  clientName: string;
} | null> {
  const attendanceCode = await prisma.attendanceCode.findFirst({
    where: {
      code: code.toUpperCase(),
      enrollment: {
        programId,
      },
    },
    include: {
      enrollment: {
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!attendanceCode) return null;

  return {
    enrollmentId: attendanceCode.enrollment.id,
    clientId: attendanceCode.enrollment.client.id,
    clientName: `${attendanceCode.enrollment.client.firstName} ${attendanceCode.enrollment.client.lastName}`,
  };
}

/**
 * Get all attendance codes for a program
 */
export async function getProgramAttendanceCodes(
  programId: string
): Promise<AttendanceCodeInfo[]> {
  const codes = await prisma.attendanceCode.findMany({
    where: {
      enrollment: {
        programId,
        status: { in: ["ENROLLED", "IN_PROGRESS"] },
      },
    },
    include: {
      enrollment: {
        include: {
          client: {
            select: { firstName: true, lastName: true },
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

  return codes.map((code) => ({
    id: code.id,
    enrollmentId: code.enrollmentId,
    code: code.code,
    clientName: `${code.enrollment.client.firstName} ${code.enrollment.client.lastName}`,
    createdAt: code.createdAt,
  }));
}

/**
 * Delete attendance code (e.g., when enrollment is cancelled)
 */
export async function deleteAttendanceCode(enrollmentId: string): Promise<void> {
  await prisma.attendanceCode.deleteMany({
    where: { enrollmentId },
  });
}
