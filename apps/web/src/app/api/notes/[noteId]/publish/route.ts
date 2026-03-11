import { NextRequest, NextResponse } from "next/server";
import { withAuthAndAudit, type RouteContext } from "@/lib/auth/with-auth-audit";
import { prisma } from "@/lib/db";
import { NoteType, NoteStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";
import { createNotification } from "@/lib/services/notifications";

// Validation schema for publishing a note
const publishNoteSchema = z.object({
  type: z.nativeEnum(NoteType).optional(),
});

/**
 * POST /api/notes/:noteId/publish - Publish a draft note
 *
 * Publishes a draft or rejected note:
 * - INTERNAL notes are published immediately
 * - SHAREABLE notes go to PENDING_APPROVAL status for supervisor review
 *
 * Request Body:
 * - type: NoteType (optional) - INTERNAL (default) or SHAREABLE
 */
export const POST = withAuthAndAudit(
  async (request: NextRequest, context: RouteContext, user) => {
    try {
      const { noteId } = await context.params;

      // Parse and validate request body
      let body = {};
      try {
        body = await request.json();
      } catch {
        // Empty body is allowed
      }

      const validation = publishNoteSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid publish data",
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
            select: { mentionedUserId: true, notified: true },
          },
        },
      });

      if (!existingNote) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Note not found" } },
          { status: 404 }
        );
      }

      // Only the author can publish the note
      if (existingNote.authorId !== user.id) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Only the author can publish this note" } },
          { status: 403 }
        );
      }

      // Check if note is in a publishable state
      if (existingNote.status !== NoteStatus.DRAFT && existingNote.status !== NoteStatus.REJECTED) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Note is not in a publishable state" } },
          { status: 400 }
        );
      }

      // Determine the note type (from request or existing)
      const noteType = validation.data.type || existingNote.type;

      // Determine new status based on note type
      let newStatus: NoteStatus;
      if (noteType === NoteType.SHAREABLE) {
        // Shareable notes require supervisor approval
        newStatus = NoteStatus.PENDING_APPROVAL;
      } else {
        // Internal notes are published immediately
        newStatus = NoteStatus.PUBLISHED;
      }

      // Update the note
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

      // If publishing as SHAREABLE, notify admins/program managers about the pending approval
      if (newStatus === NoteStatus.PENDING_APPROVAL) {
        await notifyApproversAboutPendingNote(
          user.orgId,
          noteId,
          existingNote.clientId,
          existingNote.client,
          user.id
        );
      }

      // Send notifications for any unnotified mentions now that note is published
      if (newStatus === NoteStatus.PUBLISHED) {
        const unnotifiedMentions = existingNote.mentions.filter(m => !m.notified);
        if (unnotifiedMentions.length > 0) {
          await notifyMentions(
            noteId,
            unnotifiedMentions.map(m => m.mentionedUserId),
            user.id,
            user.orgId,
            existingNote.clientId,
            existingNote.client
          );
        }
      }

      return NextResponse.json({
        success: true,
        data: updatedNote,
        message: newStatus === NoteStatus.PENDING_APPROVAL
          ? "Note submitted for approval"
          : "Note published successfully",
      });
    } catch (error) {
      console.error("Error publishing note:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to publish note" } },
        { status: 500 }
      );
    }
  },
  {
    action: "PUBLISH",
    resource: "NOTE",
    getResourceId: ({ params }) => params.noteId,
  }
);

/**
 * Notify admins and program managers about a pending shareable note
 */
async function notifyApproversAboutPendingNote(
  orgId: string,
  noteId: string,
  clientId: string,
  client: { firstName: string; lastName: string },
  authorId: string
): Promise<void> {
  // Get author info
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { name: true, email: true },
  });

  const authorName = author?.name || author?.email || "A case manager";
  const clientName = `${client.firstName} ${client.lastName}`;

  // Find admins and program managers in the org who can approve
  const approvers = await prisma.user.findMany({
    where: {
      orgId,
      role: {
        in: ["ADMIN", "SUPER_ADMIN", "PROGRAM_MANAGER"],
      },
      id: {
        not: authorId, // Don't notify the author
      },
    },
    select: { id: true },
  });

  // Create notifications for approvers
  for (const approver of approvers) {
    await createNotification({
      orgId,
      userId: approver.id,
      type: "APPROVAL_REQUEST",
      title: "Shareable note pending approval",
      body: `${authorName} submitted a shareable note for ${clientName} that needs your review.`,
      actionUrl: `/admin?tab=note-approvals&noteId=${noteId}`,
      metadata: {
        noteId,
        clientId,
        authorId,
      },
    });
  }
}

/**
 * Notify mentioned users when a note is published
 */
async function notifyMentions(
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

  // Update mention records and create notifications
  for (const userId of uniqueMentions) {
    // Update mention as notified
    await prisma.noteMention.updateMany({
      where: {
        noteId,
        mentionedUserId: userId,
      },
      data: {
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
