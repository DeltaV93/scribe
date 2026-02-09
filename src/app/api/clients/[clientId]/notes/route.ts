import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withAuthAndAudit, type RouteContext } from "@/lib/auth/with-auth-audit";
import { getClientById } from "@/lib/services/clients";
import { prisma } from "@/lib/db";
import { NoteType, NoteStatus, Prisma } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";
import { createNotification } from "@/lib/services/notifications";

// Validation schema for creating a note
const createNoteSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000),
  type: z.nativeEnum(NoteType).optional().default(NoteType.INTERNAL),
  callId: z.string().uuid().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  isDraft: z.boolean().optional().default(false),
  mentions: z.array(z.string().uuid()).optional().default([]),
});

/**
 * GET /api/clients/:clientId/notes - Get notes for a client
 *
 * Supports filtering by:
 * - tags[]: array of tag names (can be repeated: ?tags[]=tag1&tags[]=tag2)
 * - tags: comma-separated list of tag names (legacy support)
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - search: full-text search string (PostgreSQL FTS)
 * - status: note status (DRAFT, PENDING_APPROVAL, PUBLISHED, REJECTED)
 * - limit: max results (default 50, max 100)
 * - cursor: pagination cursor (note ID)
 */
export const GET = withAuthAndAudit(
  async (request: NextRequest, context: RouteContext, user) => {
    try {
      const { clientId } = await context.params;
      const { searchParams } = new URL(request.url);

      // Parse query parameters
      // Support both tags[] array format and comma-separated tags
      const tagsArray = searchParams.getAll("tags[]");
      const tagsParam = searchParams.get("tags");
      let tags: string[] = [];
      if (tagsArray.length > 0) {
        tags = tagsArray;
      } else if (tagsParam) {
        tags = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
      }

      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const search = searchParams.get("search");
      const status = searchParams.get("status");
      const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
      const cursor = searchParams.get("cursor");

      // Validate status if provided
      if (status && !Object.values(NoteStatus).includes(status as NoteStatus)) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid status value" } },
          { status: 400 }
        );
      }

      // Validate dates if provided
      if (startDate && isNaN(new Date(startDate).getTime())) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid startDate format" } },
          { status: 400 }
        );
      }
      if (endDate && isNaN(new Date(endDate).getTime())) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid endDate format" } },
          { status: 400 }
        );
      }

      // Check client exists and user has access
      const client = await getClientById(clientId, user.orgId);

      if (!client) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Client not found" } },
          { status: 404 }
        );
      }

      // Viewers cannot access notes (PHI)
      if (user.role === UserRole.VIEWER) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "You do not have permission to view notes" } },
          { status: 403 }
        );
      }

      // Case managers can only view their own assigned clients
      if (
        user.role === UserRole.CASE_MANAGER &&
        client.assignedTo !== user.id
      ) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "You do not have permission to view this client's notes" } },
          { status: 403 }
        );
      }

      // Build where clause with filters
      const where: Prisma.NoteWhereInput = {
        clientId,
        orgId: user.orgId,
        deletedAt: null,
      };

      // Filter by tags (any of the specified tags)
      if (tags.length > 0) {
        where.tags = { hasSome: tags };
      }

      // Filter by date range
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      // Filter by status
      if (status) {
        where.status = status as NoteStatus;
      }

      // Full-text search on content (PostgreSQL FTS)
      // For proper FTS with ranking, consider using raw query with to_tsvector
      if (search && search.trim()) {
        where.content = {
          contains: search.trim(),
          mode: "insensitive",
        };
      }

      // For case managers viewing drafts, only show their own drafts
      // Other users' drafts should not be visible
      if (status === NoteStatus.DRAFT && user.role === UserRole.CASE_MANAGER) {
        where.authorId = user.id;
      }

      // Build query with pagination
      const notes = await prisma.note.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1, // Fetch one extra to check if there are more
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
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

      // Check if there are more results
      const hasMore = notes.length > limit;
      const resultNotes = hasMore ? notes.slice(0, limit) : notes;
      const nextCursor = hasMore ? resultNotes[resultNotes.length - 1]?.id : null;

      return NextResponse.json({
        success: true,
        data: {
          notes: resultNotes,
          cursor: nextCursor,
          hasMore,
        },
      });
    } catch (error) {
      console.error("Error fetching client notes:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to fetch client notes" } },
        { status: 500 }
      );
    }
  },
  {
    action: "VIEW",
    resource: "NOTE",
    getResourceId: ({ params }) => params.clientId,
    getDetails: ({ params }) => ({ clientId: params.clientId }),
  }
);

interface NotesRouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * POST /api/clients/:clientId/notes - Create a note for a client
 *
 * Request Body:
 * - content: string (required) - HTML content, max 10000 chars
 * - type: NoteType (optional) - INTERNAL (default) or SHAREABLE
 * - tags: string[] (optional) - Tag names
 * - isDraft: boolean (optional) - Save as draft (default: false)
 * - mentions: string[] (optional) - User IDs to mention
 * - callId: string (optional) - Link to a call
 * - sessionId: string (optional) - Link to a program session
 */
export async function POST(request: NextRequest, context: NotesRouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Viewers cannot create notes
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create notes" } },
        { status: 403 }
      );
    }

    // Check client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Case managers can only add notes to their own assigned clients
    if (
      user.role === UserRole.CASE_MANAGER &&
      client.assignedTo !== user.id
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to add notes to this client" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createNoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid note data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { content, type, callId, sessionId, tags, isDraft, mentions } = validation.data;

    // Determine initial status based on draft flag
    const status = isDraft ? NoteStatus.DRAFT : NoteStatus.PUBLISHED;

    // Create the note
    const note = await prisma.note.create({
      data: {
        orgId: user.orgId,
        clientId,
        authorId: user.id,
        content,
        type,
        status,
        callId: callId || null,
        sessionId: sessionId || null,
        tags,
        isDraft,
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

    // Handle mentions (create mention records and notifications)
    if (mentions.length > 0 && !isDraft) {
      await handleMentions(
        note.id,
        mentions,
        user.id,
        user.orgId,
        clientId,
        client
      );
    }

    // Fetch note with mentions included
    const noteWithMentions = await prisma.note.findUnique({
      where: { id: note.id },
      include: {
        author: {
          select: { id: true, name: true, email: true },
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

    return NextResponse.json(
      { success: true, data: noteWithMentions },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create note" } },
      { status: 500 }
    );
  }
}

/**
 * Handle creating mentions and sending notifications
 */
async function handleMentions(
  noteId: string,
  mentionedUserIds: string[],
  authorId: string,
  orgId: string,
  clientId: string,
  client: { firstName: string; lastName: string }
): Promise<void> {
  // Filter out self-mentions and dedupe
  const uniqueMentions = [...new Set(mentionedUserIds)].filter(id => id !== authorId);

  if (uniqueMentions.length === 0) return;

  // Get author name for notification
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { name: true, email: true },
  });

  const authorName = author?.name || author?.email || "Someone";
  const clientName = `${client.firstName} ${client.lastName}`;

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
