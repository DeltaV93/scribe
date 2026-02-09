/**
 * Note Approvals Service
 *
 * Service for managing the approval workflow for shareable notes.
 * Shareable notes require supervisor/admin approval before becoming visible to clients.
 */

import { prisma } from "@/lib/db";
import { createNotification } from "./notifications";

// ============================================
// Types
// ============================================

export interface PendingNoteApproval {
  id: string;
  content: string;
  tags: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export type RejectionReason =
  | "INAPPROPRIATE_CONTENT"
  | "INTERNAL_JARGON"
  | "MISSING_CONTEXT"
  | "FACTUAL_ERROR"
  | "FORMATTING_ISSUES"
  | "WRONG_CLIENT"
  | "DUPLICATE"
  | "OTHER";

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  INAPPROPRIATE_CONTENT: "Content not appropriate for client viewing",
  INTERNAL_JARGON: "Contains internal jargon or abbreviations",
  MISSING_CONTEXT: "Lacks sufficient context for client",
  FACTUAL_ERROR: "Contains factual errors that need correction",
  FORMATTING_ISSUES: "Formatting or grammar needs improvement",
  WRONG_CLIENT: "Note appears to be for wrong client",
  DUPLICATE: "Duplicates existing information",
  OTHER: "Other (requires custom feedback)",
};

// ============================================
// Queries
// ============================================

/**
 * Get all notes pending approval for an organization
 */
export async function getPendingApprovals(
  orgId: string
): Promise<PendingNoteApproval[]> {
  const notes = await prisma.note.findMany({
    where: {
      orgId,
      type: "SHAREABLE",
      status: "PENDING_APPROVAL",
      deletedAt: null,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" }, // Oldest first (FIFO queue)
  });

  return notes.map((note) => ({
    id: note.id,
    content: note.content,
    tags: note.tags,
    status: note.status,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    author: {
      id: note.author.id,
      name: note.author.name,
      email: note.author.email,
    },
    client: {
      id: note.client.id,
      firstName: note.client.firstName,
      lastName: note.client.lastName,
    },
  }));
}

/**
 * Count pending approvals for an organization (for badge display)
 */
export async function countPendingApprovals(orgId: string): Promise<number> {
  return prisma.note.count({
    where: {
      orgId,
      type: "SHAREABLE",
      status: "PENDING_APPROVAL",
      deletedAt: null,
    },
  });
}

/**
 * Get a single note by ID for approval review
 */
export async function getNoteForApproval(
  noteId: string,
  orgId: string
): Promise<PendingNoteApproval | null> {
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      orgId,
      type: "SHAREABLE",
      status: "PENDING_APPROVAL",
      deletedAt: null,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!note) return null;

  return {
    id: note.id,
    content: note.content,
    tags: note.tags,
    status: note.status,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    author: {
      id: note.author.id,
      name: note.author.name,
      email: note.author.email,
    },
    client: {
      id: note.client.id,
      firstName: note.client.firstName,
      lastName: note.client.lastName,
    },
  };
}

// ============================================
// Mutations
// ============================================

/**
 * Approve a shareable note
 */
export async function approveNote(
  noteId: string,
  approverId: string,
  orgId: string
): Promise<{ success: boolean; note: PendingNoteApproval }> {
  // Verify note exists and is pending approval
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      orgId,
      type: "SHAREABLE",
      status: "PENDING_APPROVAL",
      deletedAt: null,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!note) {
    throw new Error("Note not found or not pending approval");
  }

  // Update note status
  const updatedNote = await prisma.note.update({
    where: { id: noteId },
    data: {
      status: "PUBLISHED",
      approvedById: approverId,
      approvedAt: new Date(),
      isDraft: false,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  // Notify the author that their note was approved
  await createNotification({
    orgId,
    userId: note.authorId,
    type: "APPROVAL_RESULT",
    title: "Shareable note approved",
    body: `Your shareable note for ${note.client.firstName} ${note.client.lastName} has been approved and is now visible.`,
    actionUrl: `/clients/${note.clientId}?tab=notes&note=${note.id}`,
    metadata: {
      noteId: note.id,
      clientId: note.clientId,
      action: "NOTE_APPROVED",
    },
  });

  return {
    success: true,
    note: {
      id: updatedNote.id,
      content: updatedNote.content,
      tags: updatedNote.tags,
      status: updatedNote.status,
      createdAt: updatedNote.createdAt,
      updatedAt: updatedNote.updatedAt,
      author: {
        id: updatedNote.author.id,
        name: updatedNote.author.name,
        email: updatedNote.author.email,
      },
      client: {
        id: updatedNote.client.id,
        firstName: updatedNote.client.firstName,
        lastName: updatedNote.client.lastName,
      },
    },
  };
}

/**
 * Reject a shareable note
 */
export async function rejectNote(
  noteId: string,
  approverId: string,
  orgId: string,
  reason: RejectionReason,
  customFeedback?: string
): Promise<{ success: boolean; note: PendingNoteApproval }> {
  // Verify note exists and is pending approval
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      orgId,
      type: "SHAREABLE",
      status: "PENDING_APPROVAL",
      deletedAt: null,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!note) {
    throw new Error("Note not found or not pending approval");
  }

  // Build rejection reason string
  const rejectionReasonText =
    reason === "OTHER"
      ? customFeedback || "No reason provided"
      : `${REJECTION_REASON_LABELS[reason]}${customFeedback ? ` - ${customFeedback}` : ""}`;

  // Update note status to REJECTED (reverts to draft state for editing)
  const updatedNote = await prisma.note.update({
    where: { id: noteId },
    data: {
      status: "REJECTED",
      rejectionReason: rejectionReasonText,
      isDraft: true, // Allow author to edit and resubmit
    },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  // Notify the author that their note was rejected
  await createNotification({
    orgId,
    userId: note.authorId,
    type: "APPROVAL_RESULT",
    title: "Shareable note rejected",
    body: `Your shareable note for ${note.client.firstName} ${note.client.lastName} was not approved. Reason: ${REJECTION_REASON_LABELS[reason]}`,
    actionUrl: `/clients/${note.clientId}?tab=notes&note=${note.id}`,
    metadata: {
      noteId: note.id,
      clientId: note.clientId,
      action: "NOTE_REJECTED",
      reason,
      feedback: customFeedback,
    },
  });

  return {
    success: true,
    note: {
      id: updatedNote.id,
      content: updatedNote.content,
      tags: updatedNote.tags,
      status: updatedNote.status,
      createdAt: updatedNote.createdAt,
      updatedAt: updatedNote.updatedAt,
      author: {
        id: updatedNote.author.id,
        name: updatedNote.author.name,
        email: updatedNote.author.email,
      },
      client: {
        id: updatedNote.client.id,
        firstName: updatedNote.client.firstName,
        lastName: updatedNote.client.lastName,
      },
    },
  };
}
