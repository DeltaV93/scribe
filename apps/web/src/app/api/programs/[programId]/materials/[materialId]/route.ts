import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById } from "@/lib/services/programs";
import {
  getMaterialById,
  updateMaterial,
  deleteMaterial,
} from "@/lib/services/program-materials";
import { MaterialType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a material
const updateMaterialSchema = z.object({
  materialType: z.nativeEnum(MaterialType).optional(),
  sessionId: z.string().uuid().nullable().optional(),
});

type RouteParams = {
  params: Promise<{ programId: string; materialId: string }>;
};

/**
 * GET /api/programs/[programId]/materials/[materialId] - Get material details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, materialId } = await params;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const material = await getMaterialById(materialId, programId);
    if (!material) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Material not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: material });
  } catch (error) {
    console.error("Error getting material:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get material" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/programs/[programId]/materials/[materialId] - Update material
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, materialId } = await params;

    // Only admins and program managers can update materials
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PROGRAM_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update materials" } },
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

    // Verify material exists
    const existing = await getMaterialById(materialId, programId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Material not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateMaterialSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid material data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const material = await updateMaterial(materialId, programId, validation.data);

    return NextResponse.json({ success: true, data: material });
  } catch (error) {
    console.error("Error updating material:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update material" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/programs/[programId]/materials/[materialId] - Delete material
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, materialId } = await params;

    // Only admins and program managers can delete materials
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PROGRAM_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete materials" } },
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

    // Verify material exists
    const existing = await getMaterialById(materialId, programId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Material not found" } },
        { status: 404 }
      );
    }

    await deleteMaterial(materialId, programId);

    return NextResponse.json({ success: true, message: "Material deleted" });
  } catch (error) {
    console.error("Error deleting material:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete material" } },
      { status: 500 }
    );
  }
}
