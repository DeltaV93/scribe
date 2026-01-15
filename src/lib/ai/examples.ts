import { prisma } from "@/lib/db";
import type { ExtractionExample } from "./types";

// Embedding model configuration (disabled until OpenAI or alternative embedding service is configured)
// const EMBEDDING_MODEL = "text-embedding-3-small";
// const EMBEDDING_DIMENSION = 1536;

/**
 * Check if pgvector is available
 */
export async function isPgvectorAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM pg_extension WHERE extname = 'vector'`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate embedding for a text snippet
 * NOTE: Embeddings are disabled until an embedding service (OpenAI, Voyage, etc.) is configured
 * This function is a placeholder that returns null to skip vector similarity search
 */
export async function generateEmbedding(_text: string): Promise<number[] | null> {
  // TODO: Configure an embedding service (OpenAI, Voyage AI, or similar)
  // const response = await openai.embeddings.create({
  //   model: EMBEDDING_MODEL,
  //   input: text.trim(),
  //   dimensions: EMBEDDING_DIMENSION,
  // });
  // return response.data[0].embedding;
  return null;
}

/**
 * Find similar examples using vector similarity search
 * Falls back to basic search if pgvector is not available
 */
export async function findSimilarExamples(
  transcriptSnippet: string,
  fieldIds: string[],
  limit: number = 5
): Promise<ExtractionExample[]> {
  // Check if pgvector is available
  const hasPgvector = await isPgvectorAvailable();

  if (!hasPgvector) {
    // Fall back to basic search
    return findExamplesBasic(fieldIds, limit);
  }

  try {
    // Generate embedding for the input
    const embedding = await generateEmbedding(transcriptSnippet);
    if (!embedding) {
      // Embeddings not configured, fall back to basic search
      return findExamplesBasic(fieldIds, limit);
    }
    const embeddingStr = `[${embedding.join(",")}]`;

    // Perform cosine similarity search
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        field_id: string;
        transcript_snippet: string;
        extracted_value: string;
        similarity: number;
      }>
    >`
      SELECT
        id,
        "fieldId" as field_id,
        "transcriptSnippet" as transcript_snippet,
        "extractedValue" as extracted_value,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM "ExtractionExample"
      WHERE "fieldId" = ANY(${fieldIds})
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      id: r.id,
      fieldId: r.field_id,
      transcriptSnippet: r.transcript_snippet,
      extractedValue: r.extracted_value,
      similarity: r.similarity,
    }));
  } catch (error) {
    console.error("Vector search failed, falling back to basic search:", error);
    return findExamplesBasic(fieldIds, limit);
  }
}

/**
 * Basic example retrieval without vector search
 */
async function findExamplesBasic(
  fieldIds: string[],
  limit: number
): Promise<ExtractionExample[]> {
  const examples = await prisma.extractionExample.findMany({
    where: {
      fieldId: { in: fieldIds },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return examples.map((e) => ({
    id: e.id,
    fieldId: e.fieldId,
    transcriptSnippet: e.transcriptSnippet,
    extractedValue: e.extractedValue,
  }));
}

/**
 * Get extraction examples for a set of fields
 * Uses vector similarity if available, otherwise falls back to basic retrieval
 */
export async function getExamplesForFields(
  fieldIds: string[],
  maxPerField: number = 5,
  transcriptContext?: string
): Promise<Map<string, ExtractionExample[]>> {
  // If we have transcript context, try vector similarity
  if (transcriptContext) {
    const hasPgvector = await isPgvectorAvailable();
    if (hasPgvector) {
      const similarExamples = await findSimilarExamples(
        transcriptContext,
        fieldIds,
        fieldIds.length * maxPerField
      );

      // Group by fieldId
      const groupedExamples = new Map<string, ExtractionExample[]>();
      for (const example of similarExamples) {
        const fieldExamples = groupedExamples.get(example.fieldId) || [];
        if (fieldExamples.length < maxPerField) {
          fieldExamples.push(example);
          groupedExamples.set(example.fieldId, fieldExamples);
        }
      }
      return groupedExamples;
    }
  }

  // Fall back to basic retrieval
  const examples = await prisma.extractionExample.findMany({
    where: {
      fieldId: { in: fieldIds },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: fieldIds.length * maxPerField,
  });

  // Group by fieldId
  const groupedExamples = new Map<string, ExtractionExample[]>();

  for (const example of examples) {
    const fieldExamples = groupedExamples.get(example.fieldId) || [];
    if (fieldExamples.length < maxPerField) {
      fieldExamples.push({
        id: example.id,
        fieldId: example.fieldId,
        transcriptSnippet: example.transcriptSnippet,
        extractedValue: example.extractedValue,
      });
      groupedExamples.set(example.fieldId, fieldExamples);
    }
  }

  return groupedExamples;
}

/**
 * Add a new extraction example for learning
 * Generates and stores embedding for vector similarity search
 */
export async function addExtractionExample(
  fieldId: string,
  transcriptSnippet: string,
  extractedValue: string,
  createdById: string
): Promise<ExtractionExample> {
  // Create the example first
  const example = await prisma.extractionExample.create({
    data: {
      fieldId,
      transcriptSnippet,
      extractedValue,
      createdById,
    },
  });

  // Try to generate and store embedding asynchronously
  generateAndStoreEmbedding(example.id, transcriptSnippet).catch((error) => {
    console.error("Failed to generate embedding for example:", example.id, error);
  });

  return {
    id: example.id,
    fieldId: example.fieldId,
    transcriptSnippet: example.transcriptSnippet,
    extractedValue: example.extractedValue,
  };
}

/**
 * Generate embedding and store it in the database
 */
async function generateAndStoreEmbedding(
  exampleId: string,
  text: string
): Promise<void> {
  const hasPgvector = await isPgvectorAvailable();
  if (!hasPgvector) {
    return; // Skip if pgvector not available
  }

  try {
    const embedding = await generateEmbedding(text);
    if (!embedding) {
      return; // Embeddings not configured
    }
    const embeddingStr = `[${embedding.join(",")}]`;

    await prisma.$executeRaw`
      UPDATE "ExtractionExample"
      SET embedding = ${embeddingStr}::vector
      WHERE id = ${exampleId}
    `;
  } catch (error) {
    console.error("Failed to store embedding:", error);
  }
}

/**
 * Update an extraction example
 */
export async function updateExtractionExample(
  exampleId: string,
  updates: {
    transcriptSnippet?: string;
    extractedValue?: string;
  }
): Promise<ExtractionExample> {
  const example = await prisma.extractionExample.update({
    where: { id: exampleId },
    data: updates,
  });

  return {
    id: example.id,
    fieldId: example.fieldId,
    transcriptSnippet: example.transcriptSnippet,
    extractedValue: example.extractedValue,
  };
}

/**
 * Delete an extraction example
 */
export async function deleteExtractionExample(exampleId: string): Promise<void> {
  await prisma.extractionExample.delete({
    where: { id: exampleId },
  });
}

/**
 * Get all examples for a specific field
 */
export async function getFieldExamples(
  fieldId: string
): Promise<ExtractionExample[]> {
  const examples = await prisma.extractionExample.findMany({
    where: { fieldId },
    orderBy: { createdAt: "desc" },
  });

  return examples.map((e) => ({
    id: e.id,
    fieldId: e.fieldId,
    transcriptSnippet: e.transcriptSnippet,
    extractedValue: e.extractedValue,
  }));
}

/**
 * Count examples per field for a form
 */
export async function countExamplesForForm(
  formId: string
): Promise<Map<string, number>> {
  const counts = await prisma.extractionExample.groupBy({
    by: ["fieldId"],
    where: {
      field: {
        formId,
      },
    },
    _count: {
      id: true,
    },
  });

  const countMap = new Map<string, number>();
  for (const count of counts) {
    countMap.set(count.fieldId, count._count.id);
  }

  return countMap;
}

/**
 * Learn from a successful extraction
 * Called when a user confirms an extraction is correct
 * Generates embedding for vector similarity search
 */
export async function learnFromExtraction(
  fieldId: string,
  sourceSnippet: string,
  extractedValue: string,
  createdById: string,
  maxExamplesPerField: number = 20
): Promise<void> {
  // Check if we already have a similar example
  const existingExamples = await prisma.extractionExample.findMany({
    where: { fieldId },
    orderBy: { createdAt: "desc" },
  });

  // Avoid duplicate examples
  const isDuplicate = existingExamples.some(
    (ex) =>
      ex.transcriptSnippet.toLowerCase().trim() ===
        sourceSnippet.toLowerCase().trim() ||
      (ex.extractedValue === extractedValue &&
        ex.transcriptSnippet.length === sourceSnippet.length)
  );

  if (isDuplicate) {
    return;
  }

  // Add the new example
  const newExample = await prisma.extractionExample.create({
    data: {
      fieldId,
      transcriptSnippet: sourceSnippet,
      extractedValue: String(extractedValue),
      createdById,
    },
  });

  // Generate and store embedding asynchronously
  generateAndStoreEmbedding(newExample.id, sourceSnippet).catch((error) => {
    console.error("Failed to generate embedding:", error);
  });

  // Prune old examples if we have too many
  if (existingExamples.length >= maxExamplesPerField) {
    const oldestExamples = existingExamples.slice(maxExamplesPerField - 1);
    await prisma.extractionExample.deleteMany({
      where: {
        id: { in: oldestExamples.map((e) => e.id) },
      },
    });
  }
}

/**
 * Bulk import examples (for form templates)
 */
export async function importExamples(
  examples: Array<{
    fieldId: string;
    transcriptSnippet: string;
    extractedValue: string;
  }>,
  createdById: string
): Promise<number> {
  const result = await prisma.extractionExample.createMany({
    data: examples.map((ex) => ({
      ...ex,
      createdById,
    })),
    skipDuplicates: true,
  });

  // Generate embeddings for imported examples in background
  backfillEmbeddings().catch((error) => {
    console.error("Failed to backfill embeddings:", error);
  });

  return result.count;
}

/**
 * Backfill embeddings for examples that don't have them
 * Useful for migrating existing data after enabling pgvector
 */
export async function backfillEmbeddings(
  batchSize: number = 10
): Promise<{ processed: number; failed: number }> {
  const hasPgvector = await isPgvectorAvailable();
  if (!hasPgvector) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  // Find examples without embeddings
  const examplesWithoutEmbeddings = await prisma.$queryRaw<
    Array<{ id: string; transcript_snippet: string }>
  >`
    SELECT id, "transcriptSnippet" as transcript_snippet
    FROM "ExtractionExample"
    WHERE embedding IS NULL
    LIMIT ${batchSize}
  `;

  for (const example of examplesWithoutEmbeddings) {
    try {
      await generateAndStoreEmbedding(example.id, example.transcript_snippet);
      processed++;
    } catch (error) {
      console.error(`Failed to generate embedding for ${example.id}:`, error);
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Get RAG system status for health checks
 */
export async function getRAGStatus(): Promise<{
  available: boolean;
  pgvectorEnabled: boolean;
  totalExamples: number;
  examplesWithEmbeddings: number;
}> {
  const hasPgvector = await isPgvectorAvailable();

  const totalExamples = await prisma.extractionExample.count();

  let examplesWithEmbeddings = 0;
  if (hasPgvector) {
    try {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM "ExtractionExample"
        WHERE embedding IS NOT NULL
      `;
      examplesWithEmbeddings = Number(result[0].count);
    } catch {
      examplesWithEmbeddings = 0;
    }
  }

  return {
    available: hasPgvector,
    pgvectorEnabled: hasPgvector,
    totalExamples,
    examplesWithEmbeddings,
  };
}
