/**
 * Knowledge Entry Detail API Routes
 *
 * GET /api/knowledge/[id] - Get entry details
 * PUT /api/knowledge/[id] - Update entry
 * DELETE /api/knowledge/[id] - Delete entry
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
} from "@/lib/services/knowledge";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get knowledge entry by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const entry = await getKnowledgeEntry(id, user.orgId);

    if (!entry) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Knowledge entry not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error("Error getting knowledge entry:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get knowledge entry" } },
      { status: 500 }
    );
  }
}

/**
 * Update knowledge entry
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Verify entry exists
    const existing = await getKnowledgeEntry(id, user.orgId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Knowledge entry not found" } },
        { status: 404 }
      );
    }

    const entry = await updateKnowledgeEntry(id, user.orgId, user.id, {
      title: body.title,
      content: body.content,
      summary: body.summary,
      tags: body.tags,
      category: body.category,
      isArchived: body.isArchived,
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error("Error updating knowledge entry:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update knowledge entry" } },
      { status: 500 }
    );
  }
}

/**
 * Delete knowledge entry
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Verify entry exists
    const existing = await getKnowledgeEntry(id, user.orgId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Knowledge entry not found" } },
        { status: 404 }
      );
    }

    await deleteKnowledgeEntry(id, user.orgId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting knowledge entry:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete knowledge entry" } },
      { status: 500 }
    );
  }
}
