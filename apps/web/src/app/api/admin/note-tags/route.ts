import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getNoteTags, createNoteTag } from "@/lib/services/note-tags";

/**
 * GET /api/admin/note-tags
 * List all tags for the organization (org-wide + program-specific)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tags = await getNoteTags(user.orgId);

    return NextResponse.json({ data: tags });
  } catch (error) {
    console.error("Error fetching note tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch note tags" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/note-tags
 * Create a new tag
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, programId, isRestricted } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: "Tag name must be 50 characters or less" },
        { status: 400 }
      );
    }

    const tag = await createNoteTag({
      orgId: user.orgId,
      programId: programId || null,
      name: name.trim(),
      isRestricted: isRestricted ?? false,
    });

    return NextResponse.json({ data: tag }, { status: 201 });
  } catch (error) {
    console.error("Error creating note tag:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create tag" },
      { status: 500 }
    );
  }
}
