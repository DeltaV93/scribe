/**
 * Meeting Transcript API
 *
 * GET /api/meetings/[meetingId]/transcript - Get meeting transcript
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

/**
 * Get transcript for a meeting
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const transcript = await prisma.meetingTranscript.findUnique({
      where: { meetingId },
    });

    if (!transcript) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Transcript not available" } },
        { status: 404 }
      );
    }

    // Check if formatted text is requested
    const format = request.nextUrl.searchParams.get("format");

    if (format === "text") {
      return new NextResponse(transcript.fullText, {
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }

    return NextResponse.json({ success: true, data: transcript });
  } catch (error) {
    console.error("Error getting transcript:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get transcript" } },
      { status: 500 }
    );
  }
}
