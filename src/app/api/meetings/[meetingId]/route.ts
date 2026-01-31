/**
 * Meeting Detail API Routes
 *
 * GET /api/meetings/[meetingId] - Get meeting details
 * PUT /api/meetings/[meetingId] - Update meeting
 * DELETE /api/meetings/[meetingId] - Delete meeting
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMeeting, updateMeeting } from "@/lib/services/meetings";

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

/**
 * Get meeting by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { meetingId } = await params;

    const meeting = await getMeeting(meetingId, user.orgId);

    if (!meeting) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Meeting not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: meeting });
  } catch (error) {
    console.error("Error getting meeting:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get meeting" } },
      { status: 500 }
    );
  }
}

/**
 * Update meeting
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { meetingId } = await params;
    const body = await request.json();

    const meeting = await updateMeeting(meetingId, user.orgId, {
      title: body.title,
      description: body.description,
      scheduledStartAt: body.scheduledStartAt ? new Date(body.scheduledStartAt) : undefined,
      scheduledEndAt: body.scheduledEndAt ? new Date(body.scheduledEndAt) : undefined,
      participants: body.participants,
      locationId: body.locationId,
      tags: body.tags,
    });

    return NextResponse.json({ success: true, data: meeting });
  } catch (error) {
    console.error("Error updating meeting:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update meeting" } },
      { status: 500 }
    );
  }
}

/**
 * Delete meeting
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { meetingId } = await params;

    // Verify meeting exists and belongs to org
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, orgId: user.orgId },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Meeting not found" } },
        { status: 404 }
      );
    }

    // Delete related records first, then the meeting
    await prisma.$transaction([
      prisma.meetingQuestion.deleteMany({ where: { meetingId } }),
      prisma.meetingActionItem.deleteMany({ where: { meetingId } }),
      prisma.meetingSummary.deleteMany({ where: { meetingId } }),
      prisma.meetingTranscript.deleteMany({ where: { meetingId } }),
      prisma.meeting.delete({ where: { id: meetingId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete meeting" } },
      { status: 500 }
    );
  }
}
