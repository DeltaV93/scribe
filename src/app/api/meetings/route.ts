/**
 * Meetings API Routes
 *
 * GET /api/meetings - List meetings
 * POST /api/meetings - Create meeting
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createMeeting, searchMeetings } from "@/lib/services/meetings";

/**
 * List meetings with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const searchParams = request.nextUrl.searchParams;

    const result = await searchMeetings({
      orgId: user.orgId,
      query: searchParams.get("query") || undefined,
      status: searchParams.get("status") as "SCHEDULED" | "PROCESSING" | "COMPLETED" | "FAILED" | undefined,
      source: searchParams.get("source") as "UPLOAD" | "TEAMS" | "ZOOM" | "GOOGLE_MEET" | undefined,
      locationId: searchParams.get("locationId") || undefined,
      fromDate: searchParams.get("fromDate") ? new Date(searchParams.get("fromDate")!) : undefined,
      toDate: searchParams.get("toDate") ? new Date(searchParams.get("toDate")!) : undefined,
      participantEmail: searchParams.get("participantEmail") || undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean),
      limit: Math.min(parseInt(searchParams.get("limit") || "20"), 100),
      offset: parseInt(searchParams.get("offset") || "0"),
    });

    return NextResponse.json({
      success: true,
      data: result.meetings,
      total: result.total,
    });
  } catch (error) {
    console.error("Error listing meetings:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list meetings" } },
      { status: 500 }
    );
  }
}

/**
 * Create a new meeting
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Title is required" } },
        { status: 400 }
      );
    }

    const meeting = await createMeeting({
      orgId: user.orgId,
      createdById: user.id,
      title: body.title,
      description: body.description,
      source: body.source || "UPLOAD",
      scheduledStartAt: body.scheduledStartAt ? new Date(body.scheduledStartAt) : undefined,
      scheduledEndAt: body.scheduledEndAt ? new Date(body.scheduledEndAt) : undefined,
      participants: body.participants,
      locationId: body.locationId,
      tags: body.tags,
      externalMeetingId: body.externalMeetingId,
      externalJoinUrl: body.externalJoinUrl,
    });

    return NextResponse.json({ success: true, data: meeting }, { status: 201 });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create meeting" } },
      { status: 500 }
    );
  }
}
