import { NextRequest, NextResponse } from "next/server";
import { withAuthAndAudit, type RouteContext } from "@/lib/auth/with-auth-audit";
import { prisma } from "@/lib/db";
import { NoteStatus } from "@prisma/client";
import { UserRole } from "@/types";

/**
 * GET /api/notes/:noteId/versions - Get version history for a note
 *
 * Returns the edit history of a note for HIPAA audit compliance.
 * Each version represents the content before an edit was made.
 *
 * Response includes:
 * - Version ID
 * - Content at that version
 * - Editor info
 * - Timestamp
 */
export const GET = withAuthAndAudit(
  async (request: NextRequest, context: RouteContext, user) => {
    try {
      const { noteId } = await context.params;

      // First, verify the note exists and user has access
      const note = await prisma.note.findFirst({
        where: {
          id: noteId,
          orgId: user.orgId,
          deletedAt: null,
        },
        include: {
          client: {
            select: {
              id: true,
              assignedTo: true,
            },
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
          { error: { code: "FORBIDDEN", message: "You do not have permission to view note versions" } },
          { status: 403 }
        );
      }

      // Case managers can only view notes for their assigned clients
      if (
        user.role === UserRole.CASE_MANAGER &&
        note.client.assignedTo !== user.id
      ) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "You do not have permission to view this note's versions" } },
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

      // Fetch all versions for this note
      const versions = await prisma.noteVersion.findMany({
        where: {
          noteId,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          editedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Also include the current version as the "latest" for completeness
      const response = {
        noteId,
        currentContent: note.content,
        currentUpdatedAt: note.updatedAt,
        versions: versions.map(v => ({
          id: v.id,
          content: v.content,
          editedBy: v.editedBy,
          editedAt: v.createdAt,
        })),
        totalVersions: versions.length,
      };

      return NextResponse.json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error("Error fetching note versions:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to fetch note versions" } },
        { status: 500 }
      );
    }
  },
  {
    action: "VIEW",
    resource: "NOTE",
    getResourceId: ({ params }) => params.noteId,
    getDetails: () => ({ action: "view_version_history" }),
  }
);
