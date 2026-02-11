import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createKpi, listKpis, getKpiTree } from "@/lib/services/kpis";
import { KpiMetricType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a KPI
const createKpiSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  parentKpiId: z.string().uuid().nullable().optional(),
  metricType: z.nativeEnum(KpiMetricType),
  targetValue: z.number().positive("Target value must be positive"),
  startValue: z.number().optional(),
  unit: z.string().max(50).nullable().optional(),
  startDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
  endDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
  trackingFrequency: z.string().max(50).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  dataSourceConfig: z
    .object({
      type: z.enum(["form_field", "enrollment", "attendance", "manual"]),
      formId: z.string().uuid().optional(),
      fieldSlug: z.string().optional(),
      aggregation: z.enum(["count", "sum", "average"]).optional(),
      programIds: z.array(z.string().uuid()).optional(),
    })
    .nullable()
    .optional(),
});

/**
 * GET /api/kpis - List KPIs for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const parentKpiId = searchParams.get("parentKpiId");
    const ownerId = searchParams.get("ownerId") || undefined;
    const teamId = searchParams.get("teamId") || undefined;
    const search = searchParams.get("search") || undefined;
    const tree = searchParams.get("tree") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // If tree view is requested, return hierarchical structure
    if (tree) {
      const kpiTree = await getKpiTree(user.orgId);
      return NextResponse.json({ success: true, data: kpiTree });
    }

    const result = await listKpis(
      user.orgId,
      {
        parentKpiId: parentKpiId === "null" ? null : parentKpiId || undefined,
        ownerId,
        teamId,
        search,
      },
      {
        page,
        limit: Math.min(limit, 100),
      }
    );

    return NextResponse.json({
      success: true,
      data: result.kpis,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error("Error listing KPIs:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list KPIs" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kpis - Create a new KPI
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins and program managers can create KPIs
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create KPIs" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createKpiSchema.safeParse(body);

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

    // Validate date range if both dates provided
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "End date must be after start date" } },
        { status: 400 }
      );
    }

    const kpi = await createKpi({
      orgId: user.orgId,
      createdById: user.id,
      name: data.name,
      description: data.description,
      parentKpiId: data.parentKpiId,
      metricType: data.metricType,
      targetValue: data.targetValue,
      startValue: data.startValue,
      unit: data.unit,
      startDate: data.startDate,
      endDate: data.endDate,
      trackingFrequency: data.trackingFrequency,
      ownerId: data.ownerId,
      teamId: data.teamId,
      dataSourceConfig: data.dataSourceConfig,
    });

    return NextResponse.json({ success: true, data: kpi }, { status: 201 });
  } catch (error) {
    console.error("Error creating KPI:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create KPI" } },
      { status: 500 }
    );
  }
}
