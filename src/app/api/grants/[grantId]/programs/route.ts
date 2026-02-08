import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getGrantById,
  linkProgramToGrant,
  unlinkProgramFromGrant,
  getLinkedPrograms,
} from "@/lib/services/grants";
import { UserRole } from "@/types";
import { z } from "zod";

const linkProgramSchema = z.object({
  programId: z.string().uuid(),
});

interface RouteParams {
  params: Promise<{ grantId: string }>;
}

/**
 * GET /api/grants/[grantId]/programs - Get programs linked to a grant
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

    const programs = await getLinkedPrograms(grantId);

    return NextResponse.json({
      success: true,
      data: programs,
    });
  } catch (error) {
    console.error("Error fetching linked programs:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch linked programs" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grants/[grantId]/programs - Link a program to a grant
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId } = await params;

    // Only admins can link programs
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to link programs" } },
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
    const validation = linkProgramSchema.safeParse(body);

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

    await linkProgramToGrant(grantId, validation.data.programId, user.orgId);

    return NextResponse.json(
      { success: true, message: "Program linked successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error linking program:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to link program" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/grants/[grantId]/programs - Unlink a program from a grant
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId } = await params;

    // Only admins can unlink programs
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to unlink programs" } },
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
    const validation = linkProgramSchema.safeParse(body);

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

    await unlinkProgramFromGrant(grantId, validation.data.programId);

    return NextResponse.json({
      success: true,
      message: "Program unlinked successfully",
    });
  } catch (error) {
    console.error("Error unlinking program:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to unlink program" } },
      { status: 500 }
    );
  }
}
