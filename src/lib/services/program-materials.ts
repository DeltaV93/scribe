import { prisma } from "@/lib/db";
import { MaterialType, ExtractionStatus, Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface UploadMaterialInput {
  programId: string;
  sessionId?: string | null;
  filename: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  materialType?: MaterialType;
  uploadedById: string;
}

export interface UpdateMaterialInput {
  materialType?: MaterialType;
  sessionId?: string | null;
}

export interface MaterialFilters {
  materialType?: MaterialType;
  sessionId?: string | null;
  extractionStatus?: ExtractionStatus;
}

export interface MaterialWithRelations {
  id: string;
  programId: string;
  sessionId: string | null;
  filename: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  materialType: MaterialType;
  extractionStatus: ExtractionStatus;
  extractedData: any | null;
  extractionError: string | null;
  uploadedById: string;
  uploadedAt: Date;
  uploadedBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  session?: {
    id: string;
    sessionNumber: number;
    title: string;
  } | null;
}

export interface ExtractedSyllabusData {
  programName?: string;
  description?: string;
  sessions: {
    number: number;
    title: string;
    topic?: string;
    durationMinutes?: number;
  }[];
  totalHours?: number;
  learningObjectives?: string[];
  prerequisites?: string[];
  extractionConfidence: number;
}

// ============================================
// MATERIAL CRUD
// ============================================

/**
 * Upload a new material
 */
export async function uploadMaterial(
  input: UploadMaterialInput
): Promise<MaterialWithRelations> {
  // Determine material type based on file name if not provided
  let materialType = input.materialType || MaterialType.OTHER;
  if (!input.materialType) {
    const lowerFilename = input.filename.toLowerCase();
    if (lowerFilename.includes("syllabus")) {
      materialType = MaterialType.SYLLABUS;
    } else if (lowerFilename.includes("handout")) {
      materialType = MaterialType.HANDOUT;
    } else if (
      lowerFilename.includes("presentation") ||
      lowerFilename.includes("slides")
    ) {
      materialType = MaterialType.PRESENTATION;
    } else if (lowerFilename.includes("worksheet")) {
      materialType = MaterialType.WORKSHEET;
    } else if (
      lowerFilename.includes("assessment") ||
      lowerFilename.includes("quiz") ||
      lowerFilename.includes("test")
    ) {
      materialType = MaterialType.ASSESSMENT;
    } else if (lowerFilename.includes("certificate")) {
      materialType = MaterialType.CERTIFICATE_TEMPLATE;
    }
  }

  const material = await prisma.programMaterial.create({
    data: {
      programId: input.programId,
      sessionId: input.sessionId || null,
      filename: input.filename,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      materialType,
      extractionStatus: ExtractionStatus.PENDING,
      uploadedById: input.uploadedById,
    },
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      session: {
        select: { id: true, sessionNumber: true, title: true },
      },
    },
  });

  return transformMaterial(material);
}

/**
 * Get a material by ID
 */
export async function getMaterialById(
  materialId: string,
  programId: string
): Promise<MaterialWithRelations | null> {
  const material = await prisma.programMaterial.findFirst({
    where: {
      id: materialId,
      programId: programId,
    },
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      session: {
        select: { id: true, sessionNumber: true, title: true },
      },
    },
  });

  if (!material) return null;
  return transformMaterial(material);
}

/**
 * Update a material
 */
export async function updateMaterial(
  materialId: string,
  programId: string,
  input: UpdateMaterialInput
): Promise<MaterialWithRelations> {
  const updateData: Prisma.ProgramMaterialUpdateInput = {};

  if (input.materialType !== undefined) updateData.materialType = input.materialType;
  if (input.sessionId !== undefined) {
    if (input.sessionId) {
      updateData.session = { connect: { id: input.sessionId } };
    } else {
      updateData.session = { disconnect: true };
    }
  }

  const material = await prisma.programMaterial.update({
    where: {
      id: materialId,
      programId: programId,
    },
    data: updateData,
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      session: {
        select: { id: true, sessionNumber: true, title: true },
      },
    },
  });

  return transformMaterial(material);
}

/**
 * Delete a material
 */
export async function deleteMaterial(materialId: string, programId: string): Promise<void> {
  await prisma.programMaterial.delete({
    where: {
      id: materialId,
      programId: programId,
    },
  });
}

/**
 * List materials for a program
 */
export async function getProgramMaterials(
  programId: string,
  filters: MaterialFilters = {}
): Promise<MaterialWithRelations[]> {
  const where: Prisma.ProgramMaterialWhereInput = {
    programId,
    sessionId: null, // Program-level only
  };

  if (filters.materialType) {
    where.materialType = filters.materialType;
  }

  if (filters.extractionStatus) {
    where.extractionStatus = filters.extractionStatus;
  }

  const materials = await prisma.programMaterial.findMany({
    where,
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      session: {
        select: { id: true, sessionNumber: true, title: true },
      },
    },
    orderBy: { uploadedAt: "desc" },
  });

  return materials.map(transformMaterial);
}

/**
 * List materials for a specific session
 */
export async function getSessionMaterials(
  sessionId: string
): Promise<MaterialWithRelations[]> {
  const materials = await prisma.programMaterial.findMany({
    where: { sessionId },
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      session: {
        select: { id: true, sessionNumber: true, title: true },
      },
    },
    orderBy: { uploadedAt: "desc" },
  });

  return materials.map(transformMaterial);
}

/**
 * Get all materials for a program (both program-level and session-level)
 */
export async function getAllProgramMaterials(
  programId: string,
  filters: MaterialFilters = {}
): Promise<MaterialWithRelations[]> {
  const where: Prisma.ProgramMaterialWhereInput = {
    programId,
  };

  if (filters.materialType) {
    where.materialType = filters.materialType;
  }

  if (filters.sessionId !== undefined) {
    where.sessionId = filters.sessionId;
  }

  if (filters.extractionStatus) {
    where.extractionStatus = filters.extractionStatus;
  }

  const materials = await prisma.programMaterial.findMany({
    where,
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      session: {
        select: { id: true, sessionNumber: true, title: true },
      },
    },
    orderBy: [{ sessionId: "asc" }, { uploadedAt: "desc" }],
  });

  return materials.map(transformMaterial);
}

// ============================================
// EXTRACTION STATUS MANAGEMENT
// ============================================

/**
 * Update extraction status for a material
 */
export async function updateExtractionStatus(
  materialId: string,
  status: ExtractionStatus,
  extractedData?: ExtractedSyllabusData | null,
  error?: string | null
): Promise<MaterialWithRelations> {
  const material = await prisma.programMaterial.update({
    where: { id: materialId },
    data: {
      extractionStatus: status,
      extractedData: extractedData
        ? (extractedData as unknown as Prisma.JsonObject)
        : Prisma.JsonNull,
      extractionError: error || null,
    },
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      session: {
        select: { id: true, sessionNumber: true, title: true },
      },
    },
  });

  return transformMaterial(material);
}

/**
 * Get materials pending extraction
 */
export async function getPendingExtractions(
  limit: number = 10
): Promise<MaterialWithRelations[]> {
  const materials = await prisma.programMaterial.findMany({
    where: {
      extractionStatus: ExtractionStatus.PENDING,
      materialType: MaterialType.SYLLABUS,
    },
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      session: {
        select: { id: true, sessionNumber: true, title: true },
      },
      program: {
        select: { id: true, orgId: true },
      },
    },
    take: limit,
    orderBy: { uploadedAt: "asc" },
  });

  return materials.map(transformMaterial);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get material type display name
 */
export function getMaterialTypeDisplayName(type: MaterialType): string {
  const displayNames: Record<MaterialType, string> = {
    SYLLABUS: "Syllabus",
    HANDOUT: "Handout",
    PRESENTATION: "Presentation",
    WORKSHEET: "Worksheet",
    ASSESSMENT: "Assessment",
    CERTIFICATE_TEMPLATE: "Certificate Template",
    OTHER: "Other",
  };
  return displayNames[type];
}

/**
 * Get supported MIME types for syllabus extraction
 */
export function getSupportedMimeTypes(): string[] {
  return [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/msword", // .doc
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
}

/**
 * Check if a material can be processed for extraction
 */
export function canExtract(mimeType: string, materialType: MaterialType): boolean {
  if (materialType !== MaterialType.SYLLABUS) {
    return false;
  }
  return getSupportedMimeTypes().includes(mimeType);
}

/**
 * Transform Prisma material to our type
 */
function transformMaterial(material: any): MaterialWithRelations {
  return {
    id: material.id,
    programId: material.programId,
    sessionId: material.sessionId,
    filename: material.filename,
    fileUrl: material.fileUrl,
    mimeType: material.mimeType,
    sizeBytes: material.sizeBytes,
    materialType: material.materialType,
    extractionStatus: material.extractionStatus,
    extractedData: material.extractedData,
    extractionError: material.extractionError,
    uploadedById: material.uploadedById,
    uploadedAt: material.uploadedAt,
    uploadedBy: material.uploadedBy,
    session: material.session,
  };
}
