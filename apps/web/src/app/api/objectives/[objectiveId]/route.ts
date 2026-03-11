import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getObjectiveById,
  updateObjective,
  archiveObjective,
} from "@/lib/services/okrs";
import { ObjectiveStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating an objective
const updateObjectiveSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  ownerId: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
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
  status: z.nativeEnum(ObjectiveStatus).optional(),
});

interface RouteParams {
  params: Promise<{ objectiveId: string }>;
}

/**
 * GET /api/objectives/[objectiveId] - Get an objective by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { objectiveId } = await params;

    const objective = await getObjectiveById(objectiveId, user.orgId);

    if (!objective) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Objective not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: objective,
    });
  } catch (error) {
    console.error("Error fetching objective:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch objective" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/objectives/[objectiveId] - Update an objective
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { objectiveId } = await params;

    // Only admins and program managers can update objectives
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to update objectives",
          },
        },
        { status: 403 }
      );
    }

    // Verify objective exists and belongs to org
    const existingObjective = await getObjectiveById(objectiveId, user.orgId);
    if (!existingObjective) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Objective not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateObjectiveSchema.safeParse(body);

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
    const startDate = data.startDate ?? existingObjective.startDate;
    const endDate = data.endDate ?? existingObjective.endDate;
    if (startDate && endDate && endDate <= startDate) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "End date must be after start date",
          },
        },
        { status: 400 }
      );
    }

    // Prevent circular parent reference
    if (data.parentId === objectiveId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Objective cannot be its own parent",
          },
        },
        { status: 400 }
      );
    }

    const objective = await updateObjective(objectiveId, user.orgId, {
      title: data.title,
      description: data.description,
      ownerId: data.ownerId,
      parentId: data.parentId,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
    });

    return NextResponse.json({ success: true, data: objective });
  } catch (error) {
    console.error("Error updating objective:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update objective" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/objectives/[objectiveId] - Archive an objective (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { objectiveId } = await params;

    // Only admins can archive objectives
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to delete objectives",
          },
        },
        { status: 403 }
      );
    }

    // Verify objective exists
    const objective = await getObjectiveById(objectiveId, user.orgId);
    if (!objective) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Objective not found" } },
        { status: 404 }
      );
    }

    await archiveObjective(objectiveId, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Objective archived successfully",
    });
  } catch (error) {
    console.error("Error archiving objective:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive objective" } },
      { status: 500 }
    );
  }
}
