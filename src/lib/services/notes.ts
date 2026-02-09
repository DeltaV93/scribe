/**
 * Notes Service
 *
 * CRUD operations for client notes with support for:
 * - Full-text search (PostgreSQL FTS)
 * - Tag filtering
 * - Version history (HIPAA compliance)
 * - @mentions with notifications
 * - Shareable note approval workflow
 * - Field-level encryption for content
 */

import { prisma } from "@/lib/db";
import { NoteType, NoteStatus, Prisma } from "@prisma/client";
import { createNotification } from "./notifications";

// ============================================
// TYPES
// ============================================

export interface CreateNoteInput {
  orgId: string;
  clientId: string;
  authorId: string;
  content: string;
  type?: NoteType;
  tags?: string[];
  isDraft?: boolean;
  callId?: string;
  sessionId?: string;
  mentions?: string[]; // Array of user IDs
}

export interface UpdateNoteInput {
  content?: string;
  tags?: string[];
  type?: NoteType;
  mentions?: string[];
}

export interface ListNotesFilters {
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  status?: NoteStatus;
  authorId?: string;
}

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

export interface NoteWithRelations {
  id: string;
  orgId: string;
  clientId: string;
  callId: string | null;
  sessionId: string | null;
  authorId: string;
  type: NoteType;
  status: NoteStatus;
  content: string;
  tags: string[];
  isMassNote: boolean;
  isDraft: boolean;
  approvedById: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  approvedBy?: {
    id: string;
    name: string | null;
  } | null;
  mentions?: {
    id: string;
    mentionedUserId: string;
    mentionedUser: {
      id: string;
      name: string | null;
      email: string;
    };
  }[];
  _count?: {
    versions: number;
  };
}

export interface NoteVersionWithRelations {
  id: string;
  noteId: string;
  editedById: string;
  content: string;
  createdAt: Date;
  editedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

// ============================================
// NOTE CRUD
// ============================================

/**
 * Create a new note
 */
export async function createNote(input: CreateNoteInput): Promise<NoteWithRelations> {
  const status = input.isDraft ? NoteStatus.DRAFT : NoteStatus.PUBLISHED;

  const note = await prisma.note.create({
    data: {
      orgId: input.orgId,
      clientId: input.clientId,
      authorId: input.authorId,
      callId: input.callId,
      sessionId: input.sessionId,
      content: input.content,
      type: input.type || NoteType.INTERNAL,
      status,
      tags: input.tags || [],
      isDraft: input.isDraft || false,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { versions: true },
      },
    },
  });

  // Handle mentions
  if (input.mentions && input.mentions.length > 0 && !input.isDraft) {
    await handleMentions(note.id, input.mentions, input.authorId, input.orgId, input.clientId);
  }

  return transformNote(note);
}

/**
 * Get a note by ID with access control
 */
export async function getNoteById(
  noteId: string,
  orgId: string
): Promise<NoteWithRelations | null> {
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      orgId: orgId,
      deletedAt: null,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
      mentions: {
        include: {
          mentionedUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      _count: {
        select: { versions: true },
      },
    },
  });

  if (!note) return null;
  return transformNote(note);
}

/**
 * Update a note (author only)
 * Creates a version snapshot before update
 */
export async function updateNote(
  noteId: string,
  orgId: string,
  userId: string,
  input: UpdateNoteInput
): Promise<NoteWithRelations> {
  // First verify the note exists and user is author
  const existingNote = await prisma.note.findFirst({
    where: {
      id: noteId,
      orgId: orgId,
      deletedAt: null,
    },
  });

  if (!existingNote) {
    throw new Error("Note not found");
  }

  if (existingNote.authorId !== userId) {
    throw new Error("Only the author can edit this note");
  }

  // Cannot edit notes pending approval
  if (existingNote.status === NoteStatus.PENDING_APPROVAL) {
    throw new Error("Cannot edit a note that is pending approval");
  }

  // Create a version snapshot of the current content
  await prisma.noteVersion.create({
    data: {
      noteId: noteId,
      editedById: userId,
      content: existingNote.content,
    },
  });

  // Build update data
  const updateData: Prisma.NoteUpdateInput = {};
  if (input.content !== undefined) updateData.content = input.content;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.type !== undefined) updateData.type = input.type;

  const updatedNote = await prisma.note.update({
    where: { id: noteId },
    data: updateData,
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
      mentions: {
        include: {
          mentionedUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      _count: {
        select: { versions: true },
      },
    },
  });

  // Handle new mentions
  if (input.mentions && input.mentions.length > 0) {
    // Get existing mention user IDs
    const existingMentionUserIds = updatedNote.mentions.map(m => m.mentionedUserId);
    // Find new mentions
    const newMentions = input.mentions.filter(id => !existingMentionUserIds.includes(id));
    if (newMentions.length > 0) {
      await handleMentions(noteId, newMentions, userId, orgId, updatedNote.clientId);
    }
  }

  return transformNote(updatedNote);
}

/**
 * Publish a draft note
 */
export async function publishNote(
  noteId: string,
  orgId: string,
  userId: string,
  type?: NoteType
): Promise<NoteWithRelations> {
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      orgId: orgId,
      deletedAt: null,
    },
  });

  if (!note) {
    throw new Error("Note not found");
  }

  if (note.authorId !== userId) {
    throw new Error("Only the author can publish this note");
  }

  if (note.status !== NoteStatus.DRAFT && note.status !== NoteStatus.REJECTED) {
    throw new Error("Note is not in a publishable state");
  }

  // Determine new status based on note type
  const noteType = type || note.type;
  let newStatus: NoteStatus;

  if (noteType === NoteType.SHAREABLE) {
    // Shareable notes require approval
    newStatus = NoteStatus.PENDING_APPROVAL;
  } else {
    // Internal notes are published immediately
    newStatus = NoteStatus.PUBLISHED;
  }

  const updatedNote = await prisma.note.update({
    where: { id: noteId },
    data: {
      status: newStatus,
      type: noteType,
      isDraft: false,
      // Clear rejection reason if re-submitting after rejection
      rejectionReason: null,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
      mentions: {
        include: {
          mentionedUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      _count: {
        select: { versions: true },
      },
    },
  });

  return transformNote(updatedNote);
}

/**
 * List notes for a client with filtering and pagination
 */
export async function listClientNotes(
  clientId: string,
  orgId: string,
  filters: ListNotesFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ notes: NoteWithRelations[]; cursor: string | null; hasMore: boolean }> {
  const limit = Math.min(pagination.limit || 50, 100);

  const where: Prisma.NoteWhereInput = {
    clientId,
    orgId,
    deletedAt: null,
  };

  // Filter by status
  if (filters.status) {
    where.status = filters.status;
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    where.tags = {
      hasSome: filters.tags,
    };
  }

  // Filter by date range
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  // Filter by author
  if (filters.authorId) {
    where.authorId = filters.authorId;
  }

  // Full-text search using PostgreSQL
  // Note: For proper FTS, consider using a raw query with to_tsvector
  // This is a simpler contains search for now
  if (filters.search) {
    where.content = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  // Build query options
  const queryOptions: Prisma.NoteFindManyArgs = {
    where,
    take: limit + 1, // Fetch one extra to determine if there are more
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
      mentions: {
        include: {
          mentionedUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      _count: {
        select: { versions: true },
      },
    },
  };

  // Add cursor if provided
  if (pagination.cursor) {
    queryOptions.cursor = { id: pagination.cursor };
    queryOptions.skip = 1;
  }

  const notes = await prisma.note.findMany(queryOptions);

  const hasMore = notes.length > limit;
  const resultNotes = hasMore ? notes.slice(0, limit) : notes;
  const nextCursor = hasMore && resultNotes.length > 0
    ? resultNotes[resultNotes.length - 1].id
    : null;

  return {
    notes: resultNotes.map(transformNote),
    cursor: nextCursor,
    hasMore,
  };
}

/**
 * Get version history for a note
 */
export async function getNoteVersions(
  noteId: string,
  orgId: string
): Promise<NoteVersionWithRelations[]> {
  // First verify the note exists and belongs to org
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      orgId: orgId,
      deletedAt: null,
    },
  });

  if (!note) {
    throw new Error("Note not found");
  }

  const versions = await prisma.noteVersion.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
    include: {
      editedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return versions;
}

// ============================================
// MENTIONS HANDLING
// ============================================

/**
 * Handle creating mentions and notifications
 */
async function handleMentions(
  noteId: string,
  mentionedUserIds: string[],
  authorId: string,
  orgId: string,
  clientId: string
): Promise<void> {
  // Filter out self-mentions
  const uniqueMentions = [...new Set(mentionedUserIds)].filter(id => id !== authorId);

  if (uniqueMentions.length === 0) return;

  // Get author name for notification
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { name: true, email: true },
  });

  // Get client name for context
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true },
  });

  const authorName = author?.name || author?.email || "Someone";
  const clientName = client ? `${client.firstName} ${client.lastName}` : "a client";

  // Create mention records and notifications
  for (const userId of uniqueMentions) {
    // Check if mention already exists
    const existingMention = await prisma.noteMention.findUnique({
      where: {
        noteId_mentionedUserId: {
          noteId,
          mentionedUserId: userId,
        },
      },
    });

    if (!existingMention) {
      // Create mention record
      await prisma.noteMention.create({
        data: {
          noteId,
          mentionedUserId: userId,
          notified: true,
        },
      });

      // Create notification
      await createNotification({
        orgId,
        userId,
        type: "MENTION",
        title: `${authorName} mentioned you in a note`,
        body: `You were mentioned in a note for ${clientName}`,
        actionUrl: `/clients/${clientId}?tab=notes&noteId=${noteId}`,
        metadata: {
          noteId,
          clientId,
          authorId,
        },
      });
    }
  }
}

// ============================================
// SEARCH HELPERS
// ============================================

/**
 * Full-text search for notes using PostgreSQL
 * For better performance, consider adding a search_vector column with a GIN index
 */
export async function searchNotes(
  clientId: string,
  orgId: string,
  query: string,
  pagination: PaginationOptions = {}
): Promise<{ notes: NoteWithRelations[]; cursor: string | null; hasMore: boolean }> {
  const limit = Math.min(pagination.limit || 50, 100);

  // Use PostgreSQL full-text search with raw query
  // This assumes content is stored as plain text (decrypted by middleware)
  const searchTerms = query.trim().split(/\s+/).filter(Boolean);

  if (searchTerms.length === 0) {
    return { notes: [], cursor: null, hasMore: false };
  }

  // For now, use simple contains search
  // TODO: Implement proper FTS with search_vector column
  return listClientNotes(
    clientId,
    orgId,
    { search: query },
    pagination
  );
}

// ============================================
// HELPERS
// ============================================

/**
 * Transform Prisma note to our type
 */
function transformNote(note: any): NoteWithRelations {
  return {
    id: note.id,
    orgId: note.orgId,
    clientId: note.clientId,
    callId: note.callId,
    sessionId: note.sessionId,
    authorId: note.authorId,
    type: note.type,
    status: note.status,
    content: note.content,
    tags: note.tags,
    isMassNote: note.isMassNote,
    isDraft: note.isDraft,
    approvedById: note.approvedById,
    approvedAt: note.approvedAt,
    rejectionReason: note.rejectionReason,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
    author: note.author,
    approvedBy: note.approvedBy,
    mentions: note.mentions,
    _count: note._count,
  };
}

/**
 * Check if user has access to a client's notes
 * Case managers can only see their assigned clients
 */
export async function canAccessClientNotes(
  userId: string,
  userRole: string,
  clientId: string,
  orgId: string
): Promise<boolean> {
  // Admins and program managers can see all clients
  if (["SUPER_ADMIN", "ADMIN", "PROGRAM_MANAGER"].includes(userRole)) {
    // Just verify client belongs to org
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        orgId: orgId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return !!client;
  }

  // Case managers can only see their assigned clients
  if (userRole === "CASE_MANAGER") {
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        orgId: orgId,
        assignedTo: userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return !!client;
  }

  // Viewers cannot access notes
  return false;
}
