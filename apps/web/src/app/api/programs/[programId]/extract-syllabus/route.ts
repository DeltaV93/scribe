import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById, bulkCreateSessions, updateProgram } from "@/lib/services/programs";
import {
  getMaterialById,
  updateExtractionStatus,
} from "@/lib/services/program-materials";
import {
  processFileForExtraction,
  extractionToSessionInputs,
  estimateExtractionQuality,
} from "@/lib/ai/syllabus-extraction";
import { ExtractionStatus, MaterialType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for extraction request
const extractSyllabusSchema = z.object({
  materialId: z.string().uuid(),
  applyToProgram: z.boolean().optional().default(false),
  createSessions: z.boolean().optional().default(false),
});

type RouteParams = {
  params: Promise<{ programId: string }>;
};

/**
 * POST /api/programs/[programId]/extract-syllabus - Extract syllabus data from a material
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Only admins and program managers can trigger extraction
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PROGRAM_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to extract syllabus data" } },
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
    const validation = extractSyllabusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { materialId, applyToProgram, createSessions } = validation.data;

    // Verify material exists and is a syllabus
    const material = await getMaterialById(materialId, programId);
    if (!material) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Material not found" } },
        { status: 404 }
      );
    }

    if (material.materialType !== MaterialType.SYLLABUS) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Material must be marked as a syllabus" } },
        { status: 400 }
      );
    }

    // Check if already processing
    if (material.extractionStatus === ExtractionStatus.PROCESSING) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Extraction is already in progress" } },
        { status: 409 }
      );
    }

    // Mark as processing
    await updateExtractionStatus(materialId, ExtractionStatus.PROCESSING);

    try {
      // Fetch the file content
      const fileResponse = await fetch(material.fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.status}`);
      }
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

      // Process the file
      const result = await processFileForExtraction(
        fileBuffer,
        material.mimeType,
        { programName: program.name }
      );

      if (!result.success || !result.data) {
        await updateExtractionStatus(
          materialId,
          ExtractionStatus.FAILED,
          null,
          result.error || "Extraction failed"
        );

        return NextResponse.json({
          success: false,
          error: {
            code: "EXTRACTION_FAILED",
            message: result.error || "Failed to extract syllabus data",
          },
        });
      }

      // Evaluate extraction quality
      const quality = estimateExtractionQuality(result.data);

      // Update material with extraction results
      await updateExtractionStatus(
        materialId,
        ExtractionStatus.COMPLETED,
        result.data as any
      );

      // Optionally apply to program
      let updatedProgram = program;
      let createdSessions: any[] = [];

      if (applyToProgram && result.data.programName) {
        updatedProgram = await updateProgram(programId, user.orgId, {
          description: result.data.description || program.description,
          requiredHours: result.data.totalHours || program.requiredHours,
        });
      }

      if (createSessions && result.data.sessions.length > 0) {
        const sessionInputs = extractionToSessionInputs(result.data);
        createdSessions = await bulkCreateSessions(programId, sessionInputs);
      }

      return NextResponse.json({
        success: true,
        data: {
          extraction: result.data,
          quality,
          tokensUsed: result.tokensUsed,
          processingTimeMs: result.processingTimeMs,
          programUpdated: applyToProgram,
          sessionsCreated: createdSessions.length,
        },
      });
    } catch (extractionError) {
      // Mark as failed
      await updateExtractionStatus(
        materialId,
        ExtractionStatus.FAILED,
        null,
        extractionError instanceof Error ? extractionError.message : "Unknown error"
      );

      throw extractionError;
    }
  } catch (error) {
    console.error("Error extracting syllabus:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to extract syllabus",
        },
      },
      { status: 500 }
    );
  }
}
