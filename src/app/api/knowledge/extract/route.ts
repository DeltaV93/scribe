/**
 * Knowledge Extraction API
 *
 * POST /api/knowledge/extract - Extract knowledge from a meeting
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { autoPopulateKnowledgeFromMeeting } from "@/lib/services/knowledge";

/**
 * Extract knowledge from a completed meeting
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    if (!body.meetingId || typeof body.meetingId !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "meetingId is required" } },
        { status: 400 }
      );
    }

    const result = await autoPopulateKnowledgeFromMeeting({
      meetingId: body.meetingId,
      orgId: user.orgId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        entriesCreated: result.entriesCreated,
        entryIds: result.entryIds,
      },
    });
  } catch (error) {
    console.error("Error extracting knowledge:", error);

    const message = error instanceof Error ? error.message : "Failed to extract knowledge";

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
