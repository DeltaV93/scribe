import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getGrantById,
  getDeliverableById,
  updateDeliverable,
  deleteDeliverable,
  getProgressHistory,
} from "@/lib/services/grants";
import { MetricType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a deliverable
const updateDeliverableSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  metricType: z.nativeEnum(MetricType).optional(),
  targetValue: z.number().int().min(1).optional(),
  customConfig: z
    .object({
      formFieldSlug: z.string().optional(),
      countCondition: z.string().optional(),
      programIds: z.array(z.string().uuid()).optional(),
    })
    .nullable()
    .optional(),
  dueDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
  autoReportOnComplete: z.boolean().optional(),
  reportTemplateId: z.string().uuid().nullable().optional(),
});

interface RouteParams {
  params: Promise<{ grantId: string; deliverableId: string }>;
}

/**
 * GET /api/grants/[grantId]/deliverables/[deliverableId] - Get a deliverable
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId, deliverableId } = await params;

    // Verify grant exists and belongs to org
    const grant = await getGrantById(grantId, user.orgId);
    if (!grant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grant not found" } },
        { status: 404 }
      );
    }

    const deliverable = await getDeliverableById(deliverableId);
    if (!deliverable || deliverable.grantId !== grantId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Deliverable not found" } },
        { status: 404 }
      );
    }

    // Check if progress history is requested
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get("includeHistory") === "true";
    const historyLimit = parseInt(searchParams.get("historyLimit") || "20", 10);

    let progressHistory = null;
    if (includeHistory) {
      progressHistory = await getProgressHistory(deliverableId, { limit: historyLimit });
    }

    return NextResponse.json({
      success: true,
      data: { ...deliverable, progressHistory },
    });
  } catch (error) {
    console.error("Error fetching deliverable:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch deliverable" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/grants/[grantId]/deliverables/[deliverableId] - Update a deliverable
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId, deliverableId } = await params;

    // Only admins can update deliverables
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update deliverables" } },
        { status: 403 }
      );
    }

    // Verify grant exists and belongs to org
    const grant = await getGrantById(grantId, user.orgId);
    if (!grant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grant not found" } },
        { status: 404 }
      );
    }

    // Verify deliverable exists
    const existingDeliverable = await getDeliverableById(deliverableId);
    if (!existingDeliverable || existingDeliverable.grantId !== grantId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Deliverable not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateDeliverableSchema.safeParse(body);

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

    // Validate custom config for CUSTOM metric type
    const newMetricType = data.metricType ?? existingDeliverable.metricType;
    if (newMetricType === MetricType.CUSTOM && !data.customConfig && !existingDeliverable.customConfig) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Custom configuration is required for CUSTOM metric type",
          },
        },
        { status: 400 }
      );
    }

    const deliverable = await updateDeliverable(deliverableId, {
      name: data.name,
      description: data.description,
      metricType: data.metricType,
      targetValue: data.targetValue,
      customConfig: data.customConfig,
      dueDate: data.dueDate,
      autoReportOnComplete: data.autoReportOnComplete,
      reportTemplateId: data.reportTemplateId,
    });

    return NextResponse.json({ success: true, data: deliverable });
  } catch (error) {
    console.error("Error updating deliverable:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update deliverable" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/grants/[grantId]/deliverables/[deliverableId] - Delete a deliverable
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId, deliverableId } = await params;

    // Only admins can delete deliverables
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete deliverables" } },
        { status: 403 }
      );
    }

    // Verify grant exists and belongs to org
    const grant = await getGrantById(grantId, user.orgId);
    if (!grant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grant not found" } },
        { status: 404 }
      );
    }

    // Verify deliverable exists
    const deliverable = await getDeliverableById(deliverableId);
    if (!deliverable || deliverable.grantId !== grantId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Deliverable not found" } },
        { status: 404 }
      );
    }

    await deleteDeliverable(deliverableId);

    return NextResponse.json({ success: true, message: "Deliverable deleted successfully" });
  } catch (error) {
    console.error("Error deleting deliverable:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete deliverable" } },
      { status: 500 }
    );
  }
}
