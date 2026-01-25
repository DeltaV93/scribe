import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById } from "@/lib/services/programs";
import {
  enrollClient,
  bulkEnrollClients,
  listEnrollments,
} from "@/lib/services/program-enrollments";
import { EnrollmentStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for enrolling a client
const enrollClientSchema = z.object({
  clientId: z.string().uuid(),
  enrolledDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  status: z.nativeEnum(EnrollmentStatus).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// Validation schema for bulk enrollment
const bulkEnrollSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1),
  enrolledDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  status: z.nativeEnum(EnrollmentStatus).optional(),
});

type RouteParams = {
  params: Promise<{ programId: string }>;
};

/**
 * GET /api/programs/[programId]/enrollments - List enrollments
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as EnrollmentStatus | null;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await listEnrollments(
      programId,
      {
        status: status || undefined,
        search,
      },
      {
        page,
        limit: Math.min(limit, 100),
      }
    );

    return NextResponse.json({
      success: true,
      data: result.enrollments,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error("Error listing enrollments:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list enrollments" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programs/[programId]/enrollments - Enroll client(s)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Only admins, program managers, and case managers can enroll clients
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to enroll clients" } },
        { status: 403 }
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

    const body = await request.json();

    // Check if bulk enrollment
    if (body.clientIds && Array.isArray(body.clientIds)) {
      const validation = bulkEnrollSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid enrollment data",
              details: validation.error.flatten(),
            },
          },
          { status: 400 }
        );
      }

      const result = await bulkEnrollClients({
        programId,
        clientIds: validation.data.clientIds,
        enrolledById: user.id,
        enrolledDate: validation.data.enrolledDate,
        status: validation.data.status,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            successful: result.successful,
            failed: result.failed,
            totalSuccessful: result.successful.length,
            totalFailed: result.failed.length,
          },
        },
        { status: 201 }
      );
    }

    // Single enrollment
    const validation = enrollClientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid enrollment data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const enrollment = await enrollClient({
      programId,
      clientId: validation.data.clientId,
      enrolledById: user.id,
      enrolledDate: validation.data.enrolledDate,
      status: validation.data.status,
      notes: validation.data.notes,
    });

    return NextResponse.json(
      { success: true, data: enrollment },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error enrolling client:", error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Client is already enrolled in this program" } },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to enroll client" } },
      { status: 500 }
    );
  }
}
