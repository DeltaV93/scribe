import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById } from "@/lib/services/programs";
import {
  quickEnrollClient,
  searchClientsForQuickEnroll,
  quickCreateAndEnroll,
} from "@/lib/services/attendance";
import { UserRole } from "@/types";
import { z } from "zod";

const quickEnrollSchema = z.object({
  programId: z.string().uuid(),
  clientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  attendanceType: z.enum(["PRESENT", "EXCUSED", "ABSENT"]).optional(),
  hoursAttended: z.number().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const quickCreateSchema = z.object({
  programId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  sessionId: z.string().uuid().optional(),
  attendanceType: z.enum(["PRESENT", "EXCUSED", "ABSENT"]).optional(),
});

/**
 * GET /api/attendance/quick-enroll - Search clients for quick enrollment
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("programId");
    const query = searchParams.get("q") || "";

    if (!programId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "programId is required" } },
        { status: 400 }
      );
    }

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const clients = await searchClientsForQuickEnroll(
      user.orgId,
      programId,
      query
    );

    return NextResponse.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    console.error("Error searching clients:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to search clients" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attendance/quick-enroll - Quick enroll a client
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins, program managers, and case managers can quick-enroll
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to enroll clients" } },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Check if this is creating a new client
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "create") {
      // Create new client and enroll
      const validation = quickCreateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request data",
              details: validation.error.flatten(),
            },
          },
          { status: 400 }
        );
      }

      // Verify program exists and belongs to org
      const program = await getProgramById(validation.data.programId, user.orgId);
      if (!program) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Program not found" } },
          { status: 404 }
        );
      }

      const result = await quickCreateAndEnroll({
        orgId: user.orgId,
        programId: validation.data.programId,
        firstName: validation.data.firstName,
        lastName: validation.data.lastName,
        phone: validation.data.phone,
        email: validation.data.email,
        createdById: user.id,
        sessionId: validation.data.sessionId,
        attendanceType: validation.data.attendanceType,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: { code: "OPERATION_FAILED", message: result.error } },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            enrollmentId: result.enrollmentId,
            attendanceCode: result.attendanceCode,
            attendanceRecordId: result.attendanceRecordId,
          },
        },
        { status: 201 }
      );
    }

    // Default: enroll existing client
    const validation = quickEnrollSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Verify program exists and belongs to org
    const program = await getProgramById(validation.data.programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const result = await quickEnrollClient({
      programId: validation.data.programId,
      clientId: validation.data.clientId,
      enrolledById: user.id,
      sessionId: validation.data.sessionId,
      attendanceType: validation.data.attendanceType,
      hoursAttended: validation.data.hoursAttended,
      notes: validation.data.notes,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "OPERATION_FAILED", message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          enrollmentId: result.enrollmentId,
          attendanceCode: result.attendanceCode,
          attendanceRecordId: result.attendanceRecordId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error quick-enrolling client:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to enroll client" } },
      { status: 500 }
    );
  }
}
