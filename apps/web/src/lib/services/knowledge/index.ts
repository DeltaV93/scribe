/**
 * Knowledge Base / Institutional Memory Service
 *
 * Main entry point for knowledge management functionality.
 * Handles CRUD operations, search, and integration with meetings.
 */

import { prisma } from "@/lib/db";
import { KnowledgeSource, Prisma } from "@prisma/client";
import {
  CreateKnowledgeEntryParams,
  UpdateKnowledgeEntryParams,
  KnowledgeSearchParams,
  SemanticSearchParams,
  SimilarityResult,
} from "./types";
import {
  generateEmbedding,
  prepareTextForEmbedding,
  findTopKSimilar,
} from "./embeddings";

// Re-export modules
export * from "./types";
export * from "./embeddings";
export * from "./extraction";

// ============================================
// KNOWLEDGE ENTRY CRUD
// ============================================

/**
 * Create a new knowledge entry
 */
export async function createKnowledgeEntry(params: CreateKnowledgeEntryParams) {
  const {
    orgId,
    createdById,
    title,
    content,
    summary,
    source = "MANUAL",
    meetingId,
    documentPath,
    tags,
    category,
  } = params;

  // Generate embedding for semantic search
  const textForEmbedding = prepareTextForEmbedding(title, content, summary);
  const embeddingResult = await generateEmbedding(textForEmbedding);

  const entry = await prisma.knowledgeEntry.create({
    data: {
      orgId,
      title,
      content,
      summary,
      source,
      meetingId,
      documentPath,
      tags: tags || [],
      category,
      embeddingVector: embeddingResult.embedding,
      createdById,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      meeting: { select: { id: true, title: true } },
    },
  });

  return entry;
}

/**
 * Get a knowledge entry by ID
 */
export async function getKnowledgeEntry(entryId: string, orgId: string) {
  return prisma.knowledgeEntry.findFirst({
    where: { id: entryId, orgId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      lastUpdatedBy: { select: { id: true, name: true, email: true } },
      meeting: { select: { id: true, title: true, actualStartAt: true } },
    },
  });
}

/**
 * Update a knowledge entry
 */
export async function updateKnowledgeEntry(
  entryId: string,
  orgId: string,
  userId: string,
  params: UpdateKnowledgeEntryParams
) {
  const { title, content, summary, tags, category, isArchived } = params;

  // Prepare update data
  const updateData: Prisma.KnowledgeEntryUpdateInput = {
    title,
    summary,
    tags,
    category,
    lastUpdatedBy: { connect: { id: userId } },
  };

  // Handle archive/unarchive
  if (isArchived !== undefined) {
    updateData.isArchived = isArchived;
    updateData.archivedAt = isArchived ? new Date() : null;
  }

  // If content changed, regenerate embedding
  if (content !== undefined) {
    updateData.content = content;

    // Get current entry to build embedding text
    const currentEntry = await prisma.knowledgeEntry.findUnique({
      where: { id: entryId },
      select: { title: true, summary: true },
    });

    if (currentEntry) {
      const textForEmbedding = prepareTextForEmbedding(
        title || currentEntry.title,
        content,
        summary || currentEntry.summary
      );
      const embeddingResult = await generateEmbedding(textForEmbedding);
      updateData.embeddingVector = embeddingResult.embedding;
    }
  }

  const entry = await prisma.knowledgeEntry.update({
    where: { id: entryId, orgId },
    data: updateData,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      lastUpdatedBy: { select: { id: true, name: true, email: true } },
      meeting: { select: { id: true, title: true } },
    },
  });

  return entry;
}

/**
 * Delete a knowledge entry (hard delete)
 */
export async function deleteKnowledgeEntry(entryId: string, orgId: string) {
  await prisma.knowledgeEntry.delete({
    where: { id: entryId, orgId },
  });
}

/**
 * Archive a knowledge entry (soft delete)
 */
export async function archiveKnowledgeEntry(
  entryId: string,
  orgId: string,
  userId: string
) {
  return updateKnowledgeEntry(entryId, orgId, userId, { isArchived: true });
}

// ============================================
// SEARCH OPERATIONS
// ============================================

/**
 * Search knowledge entries with filters
 */
export async function searchKnowledge(params: KnowledgeSearchParams) {
  const {
    orgId,
    query,
    source,
    category,
    tags,
    meetingId,
    includeArchived = false,
    limit = 20,
    offset = 0,
  } = params;

  const where: Prisma.KnowledgeEntryWhereInput = {
    orgId,
    ...(source && { source }),
    ...(category && { category }),
    ...(meetingId && { meetingId }),
    ...(tags?.length && { tags: { hasSome: tags } }),
    ...(!includeArchived && { isArchived: false }),
  };

  // Add text search on title/content
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { content: { contains: query, mode: "insensitive" } },
      { summary: { contains: query, mode: "insensitive" } },
    ];
  }

  const [entries, total] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        createdBy: { select: { id: true, name: true } },
        meeting: { select: { id: true, title: true } },
      },
    }),
    prisma.knowledgeEntry.count({ where }),
  ]);

  return { entries, total };
}

/**
 * Semantic search using vector embeddings
 */
export async function semanticSearchKnowledge(
  params: SemanticSearchParams
): Promise<SimilarityResult[]> {
  const {
    orgId,
    query,
    limit = 10,
    minScore = 0.5,
    source,
    category,
    tags,
  } = params;

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Build filter
  const where: Prisma.KnowledgeEntryWhereInput = {
    orgId,
    isArchived: false,
    embeddingVector: { isEmpty: false },
    ...(source && { source }),
    ...(category && { category }),
    ...(tags?.length && { tags: { hasSome: tags } }),
  };

  // Get all entries with embeddings (for in-memory search)
  // In production, this should use a vector database like Pinecone or pgvector
  const entries = await prisma.knowledgeEntry.findMany({
    where,
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      source: true,
      category: true,
      tags: true,
      createdAt: true,
      embeddingVector: true,
    },
  });

  // Prepare entries for similarity search
  const entriesWithVectors = entries
    .filter((e) => e.embeddingVector.length > 0)
    .map((e) => ({
      id: e.id,
      vector: e.embeddingVector,
    }));

  // Find similar entries
  const similarIds = findTopKSimilar(
    queryEmbedding.embedding,
    entriesWithVectors,
    limit,
    minScore
  );

  // Build results with full entry data
  const results: SimilarityResult[] = [];
  for (const sim of similarIds) {
    const entry = entries.find((e) => e.id === sim.id);
    if (entry) {
      results.push({
        entryId: entry.id,
        score: sim.score,
        title: entry.title,
        content: entry.content,
        summary: entry.summary,
        source: entry.source,
        category: entry.category,
        tags: entry.tags,
        createdAt: entry.createdAt,
      });
    }
  }

  return results;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get knowledge statistics for an organization
 */
export async function getKnowledgeStats(orgId: string) {
  const [totalEntries, bySource, byCategory, recentEntries] = await Promise.all([
    prisma.knowledgeEntry.count({ where: { orgId, isArchived: false } }),

    prisma.knowledgeEntry.groupBy({
      by: ["source"],
      where: { orgId, isArchived: false },
      _count: true,
    }),

    prisma.knowledgeEntry.groupBy({
      by: ["category"],
      where: { orgId, isArchived: false, category: { not: null } },
      _count: true,
    }),

    prisma.knowledgeEntry.findMany({
      where: { orgId, isArchived: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, source: true, createdAt: true },
    }),
  ]);

  return {
    totalEntries,
    bySource: bySource.reduce(
      (acc, item) => ({ ...acc, [item.source]: item._count }),
      {} as Record<KnowledgeSource, number>
    ),
    byCategory: byCategory.reduce(
      (acc, item) => ({ ...acc, [item.category || "Uncategorized"]: item._count }),
      {} as Record<string, number>
    ),
    recentEntries,
  };
}

/**
 * Get all unique tags used in knowledge entries
 */
export async function getKnowledgeTags(orgId: string): Promise<string[]> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { orgId, isArchived: false },
    select: { tags: true },
  });

  const allTags = entries.flatMap((e) => e.tags);
  const uniqueTags = [...new Set(allTags)].sort();

  return uniqueTags;
}

/**
 * Get all unique categories used in knowledge entries
 */
export async function getKnowledgeCategories(orgId: string): Promise<string[]> {
  const entries = await prisma.knowledgeEntry.groupBy({
    by: ["category"],
    where: { orgId, isArchived: false, category: { not: null } },
  });

  return entries.map((e) => e.category!).sort();
}
