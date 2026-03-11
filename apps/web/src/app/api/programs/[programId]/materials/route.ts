import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById } from "@/lib/services/programs";
import {
  uploadMaterial,
  getAllProgramMaterials,
} from "@/lib/services/program-materials";
import { MaterialType, ExtractionStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for uploading a material
const uploadMaterialSchema = z.object({
  filename: z.string().min(1).max(255),
  fileUrl: z.string().url(),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().min(0),
  materialType: z.nativeEnum(MaterialType).optional(),
  sessionId: z.string().uuid().nullable().optional(),
});

type RouteParams = {
  params: Promise<{ programId: string }>;
};

/**
 * GET /api/programs/[programId]/materials - List materials
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const materialType = searchParams.get("materialType") as MaterialType | null;
    const sessionId = searchParams.get("sessionId");
    const extractionStatus = searchParams.get("extractionStatus") as ExtractionStatus | null;

    const materials = await getAllProgramMaterials(programId, {
      materialType: materialType || undefined,
      sessionId: sessionId || undefined,
      extractionStatus: extractionStatus || undefined,
    });

    return NextResponse.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    console.error("Error listing materials:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list materials" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programs/[programId]/materials - Upload a material
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Only admins and program managers can upload materials
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PROGRAM_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to upload materials" } },
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
    const validation = uploadMaterialSchema.safeParse(body);

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

    const material = await uploadMaterial({
      programId,
      filename: validation.data.filename,
      fileUrl: validation.data.fileUrl,
      mimeType: validation.data.mimeType,
      sizeBytes: validation.data.sizeBytes,
      materialType: validation.data.materialType,
      sessionId: validation.data.sessionId,
      uploadedById: user.id,
    });

    return NextResponse.json(
      { success: true, data: material },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading material:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to upload material" } },
      { status: 500 }
    );
  }
}
