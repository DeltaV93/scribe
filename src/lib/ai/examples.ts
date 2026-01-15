import { prisma } from "@/lib/db";
import type { ExtractionExample } from "./types";

/**
 * Get extraction examples for a set of fields
 * Used for few-shot learning in extraction prompts
 */
export async function getExamplesForFields(
  fieldIds: string[],
  maxPerField: number = 5
): Promise<Map<string, ExtractionExample[]>> {
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
 */
export async function addExtractionExample(
  fieldId: string,
  transcriptSnippet: string,
  extractedValue: string,
  createdById: string
): Promise<ExtractionExample> {
  const example = await prisma.extractionExample.create({
    data: {
      fieldId,
      transcriptSnippet,
      extractedValue,
      createdById,
    },
  });

  return {
    id: example.id,
    fieldId: example.fieldId,
    transcriptSnippet: example.transcriptSnippet,
    extractedValue: example.extractedValue,
  };
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
  await prisma.extractionExample.create({
    data: {
      fieldId,
      transcriptSnippet: sourceSnippet,
      extractedValue: String(extractedValue),
      createdById,
    },
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

  return result.count;
}
