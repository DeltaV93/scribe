/**
 * Note Tags Service
 *
 * CRUD operations for predefined note tags.
 * Tags can be org-wide or program-specific.
 * Auto-generates consistent colors from tag names.
 */

import { prisma } from "@/lib/db";

// ============================================
// Types
// ============================================

export interface NoteTag {
  id: string;
  orgId: string;
  programId: string | null;
  programName: string | null;
  name: string;
  colorHash: string;
  isRestricted: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface CreateNoteTagInput {
  orgId: string;
  programId?: string | null;
  name: string;
  isRestricted?: boolean;
  sortOrder?: number;
}

export interface UpdateNoteTagInput {
  name?: string;
  isRestricted?: boolean;
  sortOrder?: number;
}

// ============================================
// Color Hash Generation
// ============================================

/**
 * Generate a consistent color hash from a string.
 * Uses a simple hash function to map any string to a hex color.
 * Colors are chosen from a curated palette for good visual distinction.
 */
const COLOR_PALETTE = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Green
  "#8B5CF6", // Purple
  "#F97316", // Orange
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#84CC16", // Lime
  "#6366F1", // Indigo
  "#F59E0B", // Amber
  "#14B8A6", // Teal
  "#A855F7", // Violet
  "#F43F5E", // Rose
  "#22C55E", // Emerald
  "#0EA5E9", // Sky
  "#D946EF", // Fuchsia
];

export function generateColorHash(name: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to get an index
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}

// ============================================
// Tag Queries
// ============================================

/**
 * Get all tags for an organization (including program-specific)
 */
export async function getNoteTags(orgId: string): Promise<NoteTag[]> {
  const tags = await prisma.noteTag.findMany({
    where: { orgId },
    include: {
      program: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { programId: "asc" }, // Org-wide first (null programId)
      { sortOrder: "asc" },
      { name: "asc" },
    ],
  });

  // Get usage counts for each tag
  const tagNames = tags.map((t) => t.name);
  const usageCounts = await prisma.note.groupBy({
    by: ["tags"],
    where: {
      orgId,
      tags: { hasSome: tagNames },
    },
  });

  // Calculate usage count per tag name
  const tagUsage: Record<string, number> = {};
  for (const row of usageCounts) {
    for (const tagName of row.tags) {
      tagUsage[tagName] = (tagUsage[tagName] || 0) + 1;
    }
  }

  return tags.map((tag) => ({
    id: tag.id,
    orgId: tag.orgId,
    programId: tag.programId,
    programName: tag.program?.name || null,
    name: tag.name,
    colorHash: tag.colorHash,
    isRestricted: tag.isRestricted,
    sortOrder: tag.sortOrder,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
    usageCount: tagUsage[tag.name] || 0,
  }));
}

/**
 * Get tags available for a specific program (org-wide + program-specific)
 */
export async function getTagsForProgram(
  orgId: string,
  programId: string
): Promise<NoteTag[]> {
  const tags = await prisma.noteTag.findMany({
    where: {
      orgId,
      OR: [
        { programId: null }, // Org-wide tags
        { programId }, // Program-specific tags
      ],
    },
    include: {
      program: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { programId: "asc" },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
  });

  return tags.map((tag) => ({
    id: tag.id,
    orgId: tag.orgId,
    programId: tag.programId,
    programName: tag.program?.name || null,
    name: tag.name,
    colorHash: tag.colorHash,
    isRestricted: tag.isRestricted,
    sortOrder: tag.sortOrder,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
    usageCount: 0, // Not computing usage for this query
  }));
}

/**
 * Get a single tag by ID
 */
export async function getNoteTagById(tagId: string): Promise<NoteTag | null> {
  const tag = await prisma.noteTag.findUnique({
    where: { id: tagId },
    include: {
      program: {
        select: { id: true, name: true },
      },
    },
  });

  if (!tag) return null;

  // Get usage count
  const usageCount = await prisma.note.count({
    where: {
      orgId: tag.orgId,
      tags: { has: tag.name },
    },
  });

  return {
    id: tag.id,
    orgId: tag.orgId,
    programId: tag.programId,
    programName: tag.program?.name || null,
    name: tag.name,
    colorHash: tag.colorHash,
    isRestricted: tag.isRestricted,
    sortOrder: tag.sortOrder,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
    usageCount,
  };
}

// ============================================
// Tag Mutations
// ============================================

/**
 * Create a new tag
 */
export async function createNoteTag(input: CreateNoteTagInput): Promise<NoteTag> {
  // Check for duplicate name within scope
  const existing = await prisma.noteTag.findFirst({
    where: {
      orgId: input.orgId,
      programId: input.programId || null,
      name: input.name,
    },
  });

  if (existing) {
    throw new Error(
      input.programId
        ? "A tag with this name already exists for this program"
        : "An org-wide tag with this name already exists"
    );
  }

  // Validate program exists if specified
  if (input.programId) {
    const program = await prisma.program.findFirst({
      where: {
        id: input.programId,
        orgId: input.orgId,
      },
    });

    if (!program) {
      throw new Error("Program not found");
    }
  }

  // Auto-generate color from name
  const colorHash = generateColorHash(input.name);

  // Get max sortOrder for this scope
  const maxSortOrder = await prisma.noteTag.aggregate({
    _max: { sortOrder: true },
    where: {
      orgId: input.orgId,
      programId: input.programId || null,
    },
  });

  const tag = await prisma.noteTag.create({
    data: {
      orgId: input.orgId,
      programId: input.programId || null,
      name: input.name,
      colorHash,
      isRestricted: input.isRestricted ?? false,
      sortOrder: input.sortOrder ?? (maxSortOrder._max.sortOrder ?? 0) + 1,
    },
    include: {
      program: {
        select: { id: true, name: true },
      },
    },
  });

  return {
    id: tag.id,
    orgId: tag.orgId,
    programId: tag.programId,
    programName: tag.program?.name || null,
    name: tag.name,
    colorHash: tag.colorHash,
    isRestricted: tag.isRestricted,
    sortOrder: tag.sortOrder,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
    usageCount: 0,
  };
}

/**
 * Update a tag
 */
export async function updateNoteTag(
  tagId: string,
  input: UpdateNoteTagInput
): Promise<NoteTag> {
  const existing = await prisma.noteTag.findUnique({
    where: { id: tagId },
  });

  if (!existing) {
    throw new Error("Tag not found");
  }

  // If renaming, check for duplicate
  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.noteTag.findFirst({
      where: {
        orgId: existing.orgId,
        programId: existing.programId,
        name: input.name,
        id: { not: tagId },
      },
    });

    if (duplicate) {
      throw new Error("A tag with this name already exists");
    }
  }

  // If renaming, regenerate color
  const colorHash = input.name ? generateColorHash(input.name) : undefined;

  // If renaming, update all notes that use this tag
  if (input.name && input.name !== existing.name) {
    // Get all notes with this tag
    const notesWithTag = await prisma.note.findMany({
      where: {
        orgId: existing.orgId,
        tags: { has: existing.name },
      },
      select: { id: true, tags: true },
    });

    // Update tags array in each note
    for (const note of notesWithTag) {
      const updatedTags = note.tags.map((t) =>
        t === existing.name ? input.name! : t
      );
      await prisma.note.update({
        where: { id: note.id },
        data: { tags: updatedTags },
      });
    }
  }

  const tag = await prisma.noteTag.update({
    where: { id: tagId },
    data: {
      ...(input.name && { name: input.name }),
      ...(colorHash && { colorHash }),
      ...(input.isRestricted !== undefined && { isRestricted: input.isRestricted }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
    include: {
      program: {
        select: { id: true, name: true },
      },
    },
  });

  // Get usage count
  const usageCount = await prisma.note.count({
    where: {
      orgId: tag.orgId,
      tags: { has: tag.name },
    },
  });

  return {
    id: tag.id,
    orgId: tag.orgId,
    programId: tag.programId,
    programName: tag.program?.name || null,
    name: tag.name,
    colorHash: tag.colorHash,
    isRestricted: tag.isRestricted,
    sortOrder: tag.sortOrder,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
    usageCount,
  };
}

/**
 * Delete a tag
 * If the tag is in use, it will be "soft deleted" by just removing the tag definition.
 * Notes will retain the tag name string but it won't be selectable for new notes.
 * Returns true if deleted, false if tag was in use and notes were affected.
 */
export async function deleteNoteTag(tagId: string): Promise<{
  deleted: boolean;
  notesAffected: number;
}> {
  const tag = await prisma.noteTag.findUnique({
    where: { id: tagId },
  });

  if (!tag) {
    throw new Error("Tag not found");
  }

  // Check if tag is in use
  const usageCount = await prisma.note.count({
    where: {
      orgId: tag.orgId,
      tags: { has: tag.name },
    },
  });

  // Delete the tag definition regardless
  await prisma.noteTag.delete({
    where: { id: tagId },
  });

  // If the tag was in use, remove it from all notes
  if (usageCount > 0) {
    const notesWithTag = await prisma.note.findMany({
      where: {
        orgId: tag.orgId,
        tags: { has: tag.name },
      },
      select: { id: true, tags: true },
    });

    for (const note of notesWithTag) {
      const updatedTags = note.tags.filter((t) => t !== tag.name);
      await prisma.note.update({
        where: { id: note.id },
        data: { tags: updatedTags },
      });
    }
  }

  return {
    deleted: true,
    notesAffected: usageCount,
  };
}

/**
 * Reorder tags within a scope
 */
export async function reorderNoteTags(
  orgId: string,
  programId: string | null,
  tagIds: string[]
): Promise<void> {
  // Update sortOrder for each tag
  await Promise.all(
    tagIds.map((tagId, index) =>
      prisma.noteTag.update({
        where: { id: tagId },
        data: { sortOrder: index },
      })
    )
  );
}

// ============================================
// Default Tags
// ============================================

/**
 * Default starter tags for new organizations
 */
export const DEFAULT_ORG_TAGS = [
  { name: "Follow-up", isRestricted: false },
  { name: "Urgent", isRestricted: false },
  { name: "Resolved", isRestricted: false },
  { name: "Internal Review", isRestricted: true },
  { name: "Confidential", isRestricted: true },
];

/**
 * Create default tags for a new organization
 */
export async function createDefaultTagsForOrg(orgId: string): Promise<void> {
  const existingCount = await prisma.noteTag.count({
    where: { orgId },
  });

  // Only create if no tags exist
  if (existingCount > 0) return;

  await prisma.noteTag.createMany({
    data: DEFAULT_ORG_TAGS.map((tag, index) => ({
      orgId,
      name: tag.name,
      colorHash: generateColorHash(tag.name),
      isRestricted: tag.isRestricted,
      sortOrder: index,
    })),
  });
}
