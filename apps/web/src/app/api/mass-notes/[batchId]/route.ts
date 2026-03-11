import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMassNoteBatch, getMassNoteBatchNotes } from "@/lib/services/mass-notes";

interface RouteParams {
  params: Promise<{ batchId: string }>;
}

/**
 * GET /api/mass-notes/[batchId] - Get mass note batch status and details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { batchId } = await params;

    const { searchParams } = new URL(request.url);
    const includeNotes = searchParams.get("includeNotes") === "true";
    const notesLimit = parseInt(searchParams.get("notesLimit") ?? "50", 10);
    const notesOffset = parseInt(searchParams.get("notesOffset") ?? "0", 10);

    const batch = await getMassNoteBatch(batchId, user.orgId);

    if (!batch) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Batch not found" } },
        { status: 404 }
      );
    }

    let notes = undefined;
    if (includeNotes && batch.status === "COMPLETED") {
      try {
        notes = await getMassNoteBatchNotes(batchId, user.orgId, {
          limit: Math.min(notesLimit, 100),
          offset: notesOffset,
        });
      } catch {
        // Notes might not be available, continue without them
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...batch,
        notes,
      },
    });
  } catch (error) {
    console.error("Error getting mass note batch:", error);

    if (error instanceof Error) {
      if (error.message === "Access denied") {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Access denied" } },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get batch" } },
      { status: 500 }
    );
  }
}
