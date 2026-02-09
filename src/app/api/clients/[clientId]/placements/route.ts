import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createPlacement,
  listClientPlacements,
} from "@/lib/services/job-placements";
import { PlacementStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a placement
const createPlacementSchema = z.object({
  employerName: z.string().min(1).max(255),
  jobTitle: z.string().min(1).max(255),
  hourlyWage: z.number().positive().optional().nullable(),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  status: z.nativeEnum(PlacementStatus).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/placements - List placements for a client
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;
    const { searchParams } = new URL(request.url);

    // Check if workforce feature is enabled
    const org = await prismaClient.organization.findUnique({
      where: { id: user.orgId },
      select: { workforceEnabled: true },
    });

    if (!org?.workforceEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Workforce features are not enabled for this organization" } },
        { status: 403 }
      );
    }

    // Parse query parameters
    const status = searchParams.get("status") as PlacementStatus | null;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const result = await listClientPlacements(
      clientId,
      user.orgId,
      { status: status ?? undefined },
      { page, limit }
    );

    return NextResponse.json({
      success: true,
      data: result.placements,
      pagination: {
        page,
        limit,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error listing placements:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list placements" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/:clientId/placements - Create a new placement
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Viewers cannot create placements
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create placements" } },
        { status: 403 }
      );
    }

    // Check if workforce feature is enabled
    const org = await prismaClient.organization.findUnique({
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
    const validation = createPlacementSchema.safeParse(body);

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

    const placement = await createPlacement(user.orgId, {
      clientId,
      ...validation.data,
    });

    return NextResponse.json(
      {
        success: true,
        data: placement,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating placement:", error);
    if (error instanceof Error && error.message === "Client not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create placement" } },
      { status: 500 }
    );
  }
}

// Import prisma client at module level
import { prisma as prismaClient } from "@/lib/db";
