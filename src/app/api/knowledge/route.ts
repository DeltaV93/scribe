/**
 * Knowledge Base API Routes
 *
 * GET /api/knowledge - Search knowledge entries (supports semantic search)
 * POST /api/knowledge - Create manual knowledge entry
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createKnowledgeEntry,
  searchKnowledge,
  semanticSearchKnowledge,
} from "@/lib/services/knowledge";
import { KnowledgeSource } from "@prisma/client";

/**
 * Search knowledge entries
 * Supports both text search and semantic search via the 'semantic' query param
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get("query") || undefined;
    const semantic = searchParams.get("semantic") === "true";
    const source = searchParams.get("source") as KnowledgeSource | undefined;
    const category = searchParams.get("category") || undefined;
    const tags = searchParams.get("tags")?.split(",").filter(Boolean);
    const meetingId = searchParams.get("meetingId") || undefined;
    const includeArchived = searchParams.get("includeArchived") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Use semantic search if requested and query is provided
    if (semantic && query) {
      const results = await semanticSearchKnowledge({
        orgId: user.orgId,
        query,
        limit,
        minScore: parseFloat(searchParams.get("minScore") || "0.5"),
        source,
        category,
        tags,
      });

      return NextResponse.json({
        success: true,
        data: results,
        total: results.length,
        searchType: "semantic",
      });
    }

    // Default text search
    const result = await searchKnowledge({
      orgId: user.orgId,
      query,
      source,
      category,
      tags,
      meetingId,
      includeArchived,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result.entries,
      total: result.total,
      searchType: "text",
    });
  } catch (error) {
    console.error("Error searching knowledge:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to search knowledge" } },
      { status: 500 }
    );
  }
}

/**
 * Create a new knowledge entry
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Title is required" } },
        { status: 400 }
      );
    }

    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Content is required" } },
        { status: 400 }
      );
    }

    // Validate source if provided
    if (body.source && !["MEETING", "DOCUMENT", "MANUAL"].includes(body.source)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid source type" } },
        { status: 400 }
      );
    }

    const entry = await createKnowledgeEntry({
      orgId: user.orgId,
      createdById: user.id,
      title: body.title,
      content: body.content,
      summary: body.summary,
      source: body.source || "MANUAL",
      meetingId: body.meetingId,
      documentPath: body.documentPath,
      tags: body.tags,
      category: body.category,
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error("Error creating knowledge entry:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create knowledge entry" } },
      { status: 500 }
    );
  }
}
