import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createProgram, listPrograms } from "@/lib/services/programs";
import { ProgramStatus, ProgramLabelType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a program
const createProgramSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  labelType: z.nativeEnum(ProgramLabelType).optional(),
  description: z.string().max(5000).nullable().optional(),
  requiredHours: z.number().int().min(0).nullable().optional(),
  startDate: z.string().datetime().nullable().optional().transform((val) => val ? new Date(val) : null),
  endDate: z.string().datetime().nullable().optional().transform((val) => val ? new Date(val) : null),
  schedule: z
    .object({
      daysOfWeek: z.array(z.string()).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      frequency: z.string().optional(),
      notes: z.string().optional(),
    })
    .nullable()
    .optional(),
  location: z.string().max(500).nullable().optional(),
  maxEnrollment: z.number().int().min(1).nullable().optional(),
  facilitatorId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(ProgramStatus).optional(),
});

/**
 * GET /api/programs - List programs for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ProgramStatus | null;
    const labelType = searchParams.get("labelType") as ProgramLabelType | null;
    const facilitatorId = searchParams.get("facilitatorId");
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await listPrograms(
      user.orgId,
      {
        status: status || undefined,
        labelType: labelType || undefined,
        facilitatorId: facilitatorId || undefined,
        search,
      },
      {
        page,
        limit: Math.min(limit, 100),
      }
    );

    return NextResponse.json({
      success: true,
      data: result.programs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error("Error listing programs:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list programs" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programs - Create a new program
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins and program managers can create programs
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PROGRAM_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create programs" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createProgramSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid program data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const program = await createProgram({
      orgId: user.orgId,
      createdById: user.id,
      name: validation.data.name,
      labelType: validation.data.labelType,
      description: validation.data.description,
      requiredHours: validation.data.requiredHours,
      startDate: validation.data.startDate,
      endDate: validation.data.endDate,
      schedule: validation.data.schedule,
      location: validation.data.location,
      maxEnrollment: validation.data.maxEnrollment,
      facilitatorId: validation.data.facilitatorId,
      status: validation.data.status,
    });

    return NextResponse.json(
      { success: true, data: program },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating program:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create program" } },
      { status: 500 }
    );
  }
}
