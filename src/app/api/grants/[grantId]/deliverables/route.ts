import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getGrantById,
  createDeliverable,
  listDeliverables,
} from "@/lib/services/grants";
import { MetricType, DeliverableStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a deliverable
const createDeliverableSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  metricType: z.nativeEnum(MetricType),
  targetValue: z.number().int().min(1, "Target value must be at least 1"),
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
  params: Promise<{ grantId: string }>;
}

/**
 * GET /api/grants/[grantId]/deliverables - List deliverables for a grant
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId } = await params;

    // Verify grant exists and belongs to org
    const grant = await getGrantById(grantId, user.orgId);
    if (!grant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grant not found" } },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as DeliverableStatus | null;

    const deliverables = await listDeliverables(grantId, {
      status: status || undefined,
    });

    return NextResponse.json({
      success: true,
      data: deliverables,
    });
  } catch (error) {
    console.error("Error listing deliverables:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list deliverables" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grants/[grantId]/deliverables - Create a new deliverable
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId } = await params;

    // Only admins can create deliverables
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create deliverables" } },
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

    const body = await request.json();
    const validation = createDeliverableSchema.safeParse(body);

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

    // Validate custom config is provided for CUSTOM metric type
    if (data.metricType === MetricType.CUSTOM && !data.customConfig) {
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

    const deliverable = await createDeliverable({
      grantId,
      name: data.name,
      description: data.description,
      metricType: data.metricType,
      targetValue: data.targetValue,
      customConfig: data.customConfig,
      dueDate: data.dueDate,
      autoReportOnComplete: data.autoReportOnComplete,
      reportTemplateId: data.reportTemplateId,
    });

    return NextResponse.json(
      { success: true, data: deliverable },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating deliverable:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create deliverable" } },
      { status: 500 }
    );
  }
}
