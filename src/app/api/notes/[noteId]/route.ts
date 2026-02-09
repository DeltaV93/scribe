import { NextRequest, NextResponse } from "next/server";
import { withAuthAndAudit, type RouteContext } from "@/lib/auth/with-auth-audit";
import { prisma } from "@/lib/db";
import { NoteType, NoteStatus, Prisma } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";
import { createNotification } from "@/lib/services/notifications";

// Validation schema for updating a note
const updateNoteSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  tags: z.array(z.string()).optional(),
  type: z.nativeEnum(NoteType).optional(),
  mentions: z.array(z.string().uuid()).optional(),
});

/**
 * GET /api/notes/:noteId - Get a single note with version info
 *
 * Returns the note with:
 * - Author info
 * - Approval info (if applicable)
 * - Mention info
 * - Version count for audit purposes
 */
export const GET = withAuthAndAudit(
  async (request: NextRequest, context: RouteContext, user) => {
    try {
      const { noteId } = await context.params;

      // Fetch the note with all related info
      const note = await prisma.note.findFirst({
        where: {
          id: noteId,
          orgId: user.orgId,
          deletedAt: null,
        },
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
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              assignedTo: true,
            },
          },
          _count: {
            select: { versions: true },
          },
        },
      });

      if (!note) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Note not found" } },
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

      // Case managers can only view notes for their assigned clients
      if (
        user.role === UserRole.CASE_MANAGER &&
        note.client.assignedTo !== user.id
      ) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "You do not have permission to view this note" } },
          { status: 403 }
        );
      }

      // Don't expose draft notes from other users
      if (
        note.status === NoteStatus.DRAFT &&
        note.authorId !== user.id
      ) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Note not found" } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: note,
      });
    } catch (error) {
      console.error("Error fetching note:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to fetch note" } },
        { status: 500 }
      );
    }
  },
  {
    action: "VIEW",
    resource: "NOTE",
    getResourceId: ({ params }) => params.noteId,
  }
);

/**
 * PATCH /api/notes/:noteId - Update an existing note (author only)
 *
 * Creates a version snapshot before updating.
 * Only the original author can edit a note.
 * Notes in PENDING_APPROVAL status cannot be edited.
 *
 * Request Body:
 * - content: string (optional) - Updated HTML content
 * - tags: string[] (optional) - Updated tags
 * - type: NoteType (optional) - Updated type (INTERNAL/SHAREABLE)
 * - mentions: string[] (optional) - User IDs to mention
 */
export const PATCH = withAuthAndAudit(
  async (request: NextRequest, context: RouteContext, user) => {
    try {
      const { noteId } = await context.params;

      // Parse and validate request body
      const body = await request.json();
      const validation = updateNoteSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid update data",
              details: validation.error.flatten(),
            },
          },
          { status: 400 }
        );
      }

      // Fetch the existing note
      const existingNote = await prisma.note.findFirst({
        where: {
          id: noteId,
          orgId: user.orgId,
          deletedAt: null,
        },
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true },
          },
          mentions: {
            select: { mentionedUserId: true },
          },
        },
      });

      if (!existingNote) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Note not found" } },
          { status: 404 }
        );
      }

      // Only the author can edit the note
      if (existingNote.authorId !== user.id) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Only the author can edit this note" } },
          { status: 403 }
        );
      }

      // Cannot edit notes pending approval
      if (existingNote.status === NoteStatus.PENDING_APPROVAL) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Cannot edit a note that is pending approval" } },
          { status: 403 }
        );
      }

      const { content, tags, type, mentions } = validation.data;

      // Create a version snapshot of the current content before updating
      if (content !== undefined && content !== existingNote.content) {
        await prisma.noteVersion.create({
          data: {
            noteId: noteId,
            editedById: user.id,
            content: existingNote.content,
          },
        });
      }

      // Build update data
      const updateData: Prisma.NoteUpdateInput = {};
      if (content !== undefined) updateData.content = content;
      if (tags !== undefined) updateData.tags = tags;
      if (type !== undefined) updateData.type = type;

      // Update the note
      const updatedNote = await prisma.note.update({
        where: { id: noteId },
        data: updateData,
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

      // Handle new mentions
      if (mentions && mentions.length > 0) {
        const existingMentionUserIds = existingNote.mentions.map(m => m.mentionedUserId);
        const newMentions = mentions.filter(id => !existingMentionUserIds.includes(id));

        if (newMentions.length > 0) {
          await handleNewMentions(
            noteId,
            newMentions,
            user.id,
            user.orgId,
            existingNote.clientId,
            existingNote.client
          );
        }
      }

      // Re-fetch to include any new mentions
      const finalNote = await prisma.note.findUnique({
        where: { id: noteId },
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

      return NextResponse.json({
        success: true,
        data: finalNote,
      });
    } catch (error) {
      console.error("Error updating note:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to update note" } },
        { status: 500 }
      );
    }
  },
  {
    action: "UPDATE",
    resource: "NOTE",
    getResourceId: ({ params }) => params.noteId,
  }
);

/**
 * Handle creating new mentions and sending notifications
 */
async function handleNewMentions(
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
