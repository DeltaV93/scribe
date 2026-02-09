import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getPlacement,
  updatePlacement,
  deletePlacement,
  endPlacement,
} from "@/lib/services/job-placements";
import { prisma } from "@/lib/db";
import { PlacementStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a placement
const updatePlacementSchema = z.object({
  employerName: z.string().min(1).max(255).optional(),
  jobTitle: z.string().min(1).max(255).optional(),
  hourlyWage: z.number().positive().optional().nullable(),
  startDate: z.string().transform((val) => new Date(val)).optional(),
  endDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  status: z.nativeEnum(PlacementStatus).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

interface RouteContext {
  params: Promise<{ placementId: string }>;
}

/**
 * GET /api/placements/:placementId - Get a placement by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { placementId } = await context.params;

    // Check if workforce feature is enabled
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { workforceEnabled: true },
    });

    if (!org?.workforceEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Workforce features are not enabled for this organization" } },
        { status: 403 }
      );
    }

    const placement = await getPlacement(placementId, user.orgId);

    if (!placement) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Placement not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: placement,
    });
  } catch (error) {
    console.error("Error fetching placement:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch placement" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/placements/:placementId - Update a placement
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { placementId } = await context.params;

    // Viewers cannot update placements
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update placements" } },
        { status: 403 }
      );
    }

    // Check if workforce feature is enabled
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { workforceEnabled: true },
    });

    if (!org?.workforceEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Workforce features are not enabled for this organization" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updatePlacementSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid placement data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Handle end placement shortcut
    if (
      validation.data.status === PlacementStatus.ENDED ||
      validation.data.status === PlacementStatus.TERMINATED
    ) {
      const placement = await endPlacement(
        placementId,
        user.orgId,
        validation.data.status,
        validation.data.endDate ?? undefined
      );
      return NextResponse.json({
        success: true,
        data: placement,
      });
    }

    const placement = await updatePlacement(placementId, user.orgId, validation.data);

    return NextResponse.json({
      success: true,
      data: placement,
    });
  } catch (error) {
    console.error("Error updating placement:", error);
    if (error instanceof Error && error.message === "Placement not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Placement not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update placement" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/placements/:placementId - Delete a placement
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { placementId } = await context.params;

    // Only admins can delete placements
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only administrators can delete placements" } },
        { status: 403 }
      );
    }

    // Check if workforce feature is enabled
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { workforceEnabled: true },
    });

    if (!org?.workforceEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Workforce features are not enabled for this organization" } },
        { status: 403 }
      );
    }

    await deletePlacement(placementId, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Placement deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting placement:", error);
    if (error instanceof Error && error.message === "Placement not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Placement not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete placement" } },
      { status: 500 }
    );
  }
}
