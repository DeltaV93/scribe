/**
 * Meeting Processing API
 *
 * POST /api/meetings/[meetingId]/process - Start processing a meeting recording
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startMeetingProcessing } from "@/lib/services/meetings";

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

/**
 * Start async processing of a meeting
 * Expects recordingPath in the request body
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Check if already processing
    if (meeting.status === "PROCESSING") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Meeting is already being processed" } },
        { status: 409 }
      );
    }

    const body = await request.json();

    if (!body.recordingPath) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "recordingPath is required" } },
        { status: 400 }
      );
    }

    const result = await startMeetingProcessing({
      meetingId,
      orgId: user.orgId,
      userId: user.id,
      recordingPath: body.recordingPath,
      options: {
        skipTranscription: body.skipTranscription,
        skipSummarization: body.skipSummarization,
        skipEmailDistribution: body.skipEmailDistribution,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Processing started",
      data: {
        jobProgressId: result.jobProgressId,
        meetingId: result.meetingId,
      },
    });
  } catch (error) {
    console.error("Error starting meeting processing:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to start meeting processing" } },
      { status: 500 }
    );
  }
}
