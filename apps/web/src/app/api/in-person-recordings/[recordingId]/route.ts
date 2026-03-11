import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getRecordingById,
  getRecordingPlaybackUrl,
} from "@/lib/services/in-person-recording";
import { AuditLogger } from "@/lib/audit/service";

interface RouteParams {
  params: Promise<{ recordingId: string }>;
}

/**
 * GET /api/in-person-recordings/:recordingId - Get recording details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { recordingId } = await params;

    const recording = await getRecordingById(recordingId, user.orgId);

    if (!recording) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Recording not found" } },
        { status: 404 }
      );
    }

    // Get playback URL if recording exists
    let playbackUrl: string | null = null;
    if (recording.recordingUrl) {
      playbackUrl = await getRecordingPlaybackUrl(recordingId, user.orgId);
    }

    // Audit log access
    await AuditLogger.inPersonRecordingAccessed(
      user.orgId,
      user.id,
      recordingId,
      recording.clientId
    );

    return NextResponse.json({
      success: true,
      data: {
        ...recording,
        playbackUrl,
      },
    });
  } catch (error) {
    console.error("Error getting in-person recording:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get recording" } },
      { status: 500 }
    );
  }
}
