import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById } from "@/lib/services/programs";
import {
  getOrCreateSheetConfig,
  updateSheetConfig,
} from "@/lib/services/attendance";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating config
const updateConfigSchema = z.object({
  includeTimeInOut: z.boolean().optional(),
  includeClientSignature: z.boolean().optional(),
  includeNotes: z.boolean().optional(),
  customInstructions: z.string().max(500).nullable().optional(),
});

type RouteParams = {
  params: Promise<{ programId: string }>;
};

/**
 * GET /api/programs/[programId]/attendance-config - Get sheet config
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const config = await getOrCreateSheetConfig(programId);

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error getting attendance config:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get attendance config" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/programs/[programId]/attendance-config - Update sheet config
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Only admins and program managers can update config
    if (user.role === UserRole.VIEWER || user.role === UserRole.CASE_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update attendance config" } },
        { status: 403 }
      );
    }

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid config data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const config = await updateSheetConfig({
      programId,
      ...validation.data,
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error updating attendance config:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update attendance config" } },
      { status: 500 }
    );
  }
}
