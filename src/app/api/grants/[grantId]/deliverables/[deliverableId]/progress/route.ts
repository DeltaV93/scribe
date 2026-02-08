import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getGrantById,
  getDeliverableById,
  incrementDeliverable,
  getProgressHistory,
} from "@/lib/services/grants";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for logging manual progress
const logProgressSchema = z.object({
  delta: z.number().int(),
  notes: z.string().max(1000).optional(),
});

interface RouteParams {
  params: Promise<{ grantId: string; deliverableId: string }>;
}

/**
 * GET /api/grants/[grantId]/deliverables/[deliverableId]/progress - Get progress history
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

    // Verify deliverable exists
    const deliverable = await getDeliverableById(deliverableId);
    if (!deliverable || deliverable.grantId !== grantId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Deliverable not found" } },
        { status: 404 }
      );
    }

    // Parse pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const cursor = searchParams.get("cursor") || undefined;

    const history = await getProgressHistory(deliverableId, { limit, cursor });

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching progress history:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch progress history" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grants/[grantId]/deliverables/[deliverableId]/progress - Log manual progress
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId, deliverableId } = await params;

    // Only admins and program managers can log progress
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to log progress" } },
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

    const body = await request.json();
    const validation = logProgressSchema.safeParse(body);

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

    const { delta, notes } = validation.data;

    const updated = await incrementDeliverable(deliverableId, delta, {
      sourceType: "manual",
      notes,
      recordedById: user.id,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error logging progress:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to log progress" } },
      { status: 500 }
    );
  }
}
