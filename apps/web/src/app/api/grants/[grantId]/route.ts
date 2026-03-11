import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGrantById, updateGrant, archiveGrant, getGrantStats } from "@/lib/services/grants";
import { GrantStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a grant
const updateGrantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  funderName: z.string().max(200).nullable().optional(),
  grantNumber: z.string().max(100).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  startDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .optional(),
  endDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .optional(),
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

interface RouteParams {
  params: Promise<{ grantId: string }>;
}

/**
 * GET /api/grants/[grantId] - Get a grant by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId } = await params;

    // Check if stats are requested
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("includeStats") === "true";

    const grant = await getGrantById(grantId, user.orgId);

    if (!grant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grant not found" } },
        { status: 404 }
      );
    }

    let stats = null;
    if (includeStats) {
      stats = await getGrantStats(grantId, user.orgId);
    }

    return NextResponse.json({
      success: true,
      data: { ...grant, stats },
    });
  } catch (error) {
    console.error("Error fetching grant:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch grant" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/grants/[grantId] - Update a grant
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId } = await params;

    // Only admins can update grants
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update grants" } },
        { status: 403 }
      );
    }

    // Verify grant exists and belongs to org
    const existingGrant = await getGrantById(grantId, user.orgId);
    if (!existingGrant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grant not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateGrantSchema.safeParse(body);

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

    // Validate date range if both dates are provided
    const startDate = data.startDate ?? existingGrant.startDate;
    const endDate = data.endDate ?? existingGrant.endDate;
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "End date must be after start date" } },
        { status: 400 }
      );
    }

    const grant = await updateGrant(grantId, user.orgId, {
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

    return NextResponse.json({ success: true, data: grant });
  } catch (error) {
    console.error("Error updating grant:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update grant" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/grants/[grantId] - Archive a grant (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId } = await params;

    // Only admins can archive grants
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete grants" } },
        { status: 403 }
      );
    }

    // Verify grant exists
    const grant = await getGrantById(grantId, user.orgId);
    if (!grant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grant not found" } },
        { status: 404 }
      );
    }

    await archiveGrant(grantId, user.orgId);

    return NextResponse.json({ success: true, message: "Grant archived successfully" });
  } catch (error) {
    console.error("Error archiving grant:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive grant" } },
      { status: 500 }
    );
  }
}
