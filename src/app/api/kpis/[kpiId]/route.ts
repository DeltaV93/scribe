import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getKpiById,
  updateKpi,
  archiveKpi,
  recordKpiProgress,
  getKpiProgressHistory,
} from "@/lib/services/kpis";
import { KpiMetricType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a KPI
const updateKpiSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  parentKpiId: z.string().uuid().nullable().optional(),
  metricType: z.nativeEnum(KpiMetricType).optional(),
  targetValue: z.number().positive().optional(),
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

// Validation schema for recording progress
const recordProgressSchema = z.object({
  value: z.number(),
  notes: z.string().max(1000).optional(),
});

interface RouteParams {
  params: Promise<{ kpiId: string }>;
}

/**
 * GET /api/kpis/[kpiId] - Get a KPI by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { kpiId } = await params;

    // Check if history is requested
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get("includeHistory") === "true";

    const kpi = await getKpiById(kpiId, user.orgId);

    if (!kpi) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "KPI not found" } },
        { status: 404 }
      );
    }

    let history = null;
    if (includeHistory) {
      history = await getKpiProgressHistory(kpiId);
    }

    return NextResponse.json({
      success: true,
      data: { ...kpi, history },
    });
  } catch (error) {
    console.error("Error fetching KPI:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch KPI" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/kpis/[kpiId] - Update a KPI
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { kpiId } = await params;

    // Only admins and program managers can update KPIs
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update KPIs" } },
        { status: 403 }
      );
    }

    // Verify KPI exists and belongs to org
    const existingKpi = await getKpiById(kpiId, user.orgId);
    if (!existingKpi) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "KPI not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateKpiSchema.safeParse(body);

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

    // Validate date range if dates are provided
    const startDate = data.startDate ?? existingKpi.startDate;
    const endDate = data.endDate ?? existingKpi.endDate;
    if (startDate && endDate && endDate <= startDate) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "End date must be after start date" } },
        { status: 400 }
      );
    }

    const kpi = await updateKpi(kpiId, user.orgId, {
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

    return NextResponse.json({ success: true, data: kpi });
  } catch (error) {
    console.error("Error updating KPI:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update KPI" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kpis/[kpiId] - Archive a KPI (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { kpiId } = await params;

    // Only admins can archive KPIs
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete KPIs" } },
        { status: 403 }
      );
    }

    // Verify KPI exists
    const kpi = await getKpiById(kpiId, user.orgId);
    if (!kpi) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "KPI not found" } },
        { status: 404 }
      );
    }

    await archiveKpi(kpiId, user.orgId);

    return NextResponse.json({ success: true, message: "KPI archived successfully" });
  } catch (error) {
    console.error("Error archiving KPI:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive KPI" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kpis/[kpiId] - Record KPI progress
 * Note: Using POST on the resource to record progress (alternative: /progress sub-route)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { kpiId } = await params;

    // Verify KPI exists
    const kpi = await getKpiById(kpiId, user.orgId);
    if (!kpi) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "KPI not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = recordProgressSchema.safeParse(body);

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

    await recordKpiProgress(kpiId, validation.data.value, {
      sourceType: "manual",
      notes: validation.data.notes,
      recordedById: user.id,
    });

    // Fetch updated KPI
    const updatedKpi = await getKpiById(kpiId, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Progress recorded successfully",
      data: updatedKpi,
    });
  } catch (error) {
    console.error("Error recording KPI progress:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to record KPI progress" } },
      { status: 500 }
    );
  }
}
