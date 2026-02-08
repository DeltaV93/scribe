import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createGrant, listGrants } from "@/lib/services/grants";
import { GrantStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a grant
const createGrantSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  funderName: z.string().max(200).nullable().optional(),
  grantNumber: z.string().max(100).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  startDate: z.string().datetime().transform((val) => new Date(val)),
  endDate: z.string().datetime().transform((val) => new Date(val)),
  reportingFrequency: z.enum(["monthly", "quarterly", "annually"]).nullable().optional(),
  exportTemplateId: z.string().uuid().nullable().optional(),
  notificationSettings: z
    .object({
      progressAlerts: z.array(z.number().min(0).max(100)).optional(),
      daysBeforeDeadline: z.array(z.number().int().min(0)).optional(),
      recipients: z.array(z.string().uuid()).optional(),
    })
    .nullable()
    .optional(),
  status: z.nativeEnum(GrantStatus).optional(),
});

/**
 * GET /api/grants - List grants for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as GrantStatus | null;
    const funderName = searchParams.get("funderName");
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await listGrants(
      user.orgId,
      {
        status: status || undefined,
        funderName: funderName || undefined,
        search,
      },
      {
        page,
        limit: Math.min(limit, 100),
      }
    );

    return NextResponse.json({
      success: true,
      data: result.grants,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error listing grants:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list grants" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grants - Create a new grant
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins can create grants
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create grants" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createGrantSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validate date range
    if (data.endDate <= data.startDate) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "End date must be after start date" } },
        { status: 400 }
      );
    }

    const grant = await createGrant({
      orgId: user.orgId,
      createdById: user.id,
      name: data.name,
      funderName: data.funderName,
      grantNumber: data.grantNumber,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      reportingFrequency: data.reportingFrequency,
      exportTemplateId: data.exportTemplateId,
      notificationSettings: data.notificationSettings ?? undefined,
      status: data.status,
    });

    return NextResponse.json(
      { success: true, data: grant },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating grant:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create grant" } },
      { status: 500 }
    );
  }
}
