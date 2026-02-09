import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  uploadRecording,
  getRecordingById,
} from "@/lib/services/in-person-recording";

interface RouteParams {
  params: Promise<{ recordingId: string }>;
}

/**
 * POST /api/in-person-recordings/:recordingId/upload - Upload recording audio
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { recordingId } = await params;

    // Verify recording exists and belongs to org
    const recording = await getRecordingById(recordingId, user.orgId);
    if (!recording) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Recording not found" } },
        { status: 404 }
      );
    }

    // Check if already has recording
    if (recording.recordingUrl) {
      return NextResponse.json(
        { error: { code: "ALREADY_UPLOADED", message: "Recording already has audio uploaded" } },
        { status: 409 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const durationStr = formData.get("duration") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Audio file is required" } },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      "audio/webm",
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
    ];
    if (!validTypes.some(type => audioFile.type.startsWith(type.split(";")[0]))) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid audio file type. Supported: webm, mp4, mp3, ogg, wav" } },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse duration
    const duration = durationStr ? parseInt(durationStr) : undefined;

    // Upload to S3
    const result = await uploadRecording({
      recordingId,
      audioBuffer: buffer,
      mimeType: audioFile.type,
      duration,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "UPLOAD_FAILED", message: result.error || "Failed to upload recording" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        recordingUrl: result.recordingUrl,
        duration,
      },
    });
  } catch (error) {
    console.error("Error uploading in-person recording:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to upload recording" } },
      { status: 500 }
    );
  }
}
