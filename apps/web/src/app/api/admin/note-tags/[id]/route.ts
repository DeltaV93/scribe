import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  getNoteTagById,
  updateNoteTag,
  deleteNoteTag,
} from "@/lib/services/note-tags";

/**
 * GET /api/admin/note-tags/[id]
 * Get a single tag by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const tag = await getNoteTagById(id);

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Ensure tag belongs to user's org
    if (tag.orgId !== user.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: tag });
  } catch (error) {
    console.error("Error fetching note tag:", error);
    return NextResponse.json(
      { error: "Failed to fetch note tag" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/note-tags/[id]
 * Update a tag
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check tag exists and belongs to org
    const existingTag = await getNoteTagById(id);
    if (!existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (existingTag.orgId !== user.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, isRestricted, sortOrder } = body;

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Tag name cannot be empty" },
          { status: 400 }
        );
      }

      if (name.length > 50) {
        return NextResponse.json(
          { error: "Tag name must be 50 characters or less" },
          { status: 400 }
        );
      }
    }

    const tag = await updateNoteTag(id, {
      ...(name && { name: name.trim() }),
      ...(isRestricted !== undefined && { isRestricted }),
      ...(sortOrder !== undefined && { sortOrder }),
    });

    return NextResponse.json({ data: tag });
  } catch (error) {
    console.error("Error updating note tag:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update tag" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/note-tags/[id]
 * Delete a tag
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check tag exists and belongs to org
    const existingTag = await getNoteTagById(id);
    if (!existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (existingTag.orgId !== user.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await deleteNoteTag(id);

    return NextResponse.json({
      data: {
        deleted: result.deleted,
        notesAffected: result.notesAffected,
        message:
          result.notesAffected > 0
            ? `Tag deleted and removed from ${result.notesAffected} note(s)`
            : "Tag deleted",
      },
    });
  } catch (error) {
    console.error("Error deleting note tag:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete tag" },
      { status: 500 }
    );
  }
}
