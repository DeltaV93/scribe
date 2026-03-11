import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createObjective, listObjectives, getObjectiveTree } from "@/lib/services/okrs";
import { ObjectiveStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating an objective
const createObjectiveSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).nullable().optional(),
  ownerId: z.string().uuid().optional(), // Defaults to current user
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

/**
 * GET /api/objectives - List objectives for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ObjectiveStatus | null;
    const ownerId = searchParams.get("ownerId");
    const parentId = searchParams.get("parentId");
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const tree = searchParams.get("tree") === "true";

    // If tree view requested, return hierarchical structure
    if (tree) {
      const objectives = await getObjectiveTree(user.orgId, true);
      return NextResponse.json({
        success: true,
        data: objectives,
      });
    }

    const result = await listObjectives(
      user.orgId,
      {
        status: status || undefined,
        ownerId: ownerId || undefined,
        parentId: parentId === "null" ? null : parentId || undefined,
        search,
      },
      {
        page,
        limit: Math.min(limit, 100),
      }
    );

    return NextResponse.json({
      success: true,
      data: result.objectives,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error listing objectives:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list objectives" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/objectives - Create a new objective
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins and program managers can create objectives
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to create objectives",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createObjectiveSchema.safeParse(body);

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
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
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

    const objective = await createObjective({
      orgId: user.orgId,
      ownerId: data.ownerId || user.id, // Default to current user
      title: data.title,
      description: data.description,
      parentId: data.parentId,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
    });

    return NextResponse.json({ success: true, data: objective }, { status: 201 });
  } catch (error) {
    console.error("Error creating objective:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create objective" } },
      { status: 500 }
    );
  }
}
