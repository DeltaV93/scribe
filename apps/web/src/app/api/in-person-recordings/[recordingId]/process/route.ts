import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  processRecording,
  getRecordingById,
} from "@/lib/services/in-person-recording";

interface RouteParams {
  params: Promise<{ recordingId: string }>;
}

/**
 * POST /api/in-person-recordings/:recordingId/process - Trigger transcription and extraction
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

    // Check if recording has audio
    if (!recording.recordingUrl) {
      return NextResponse.json(
        { error: { code: "NO_AUDIO", message: "No audio file uploaded. Please upload audio first." } },
        { status: 400 }
      );
    }

    // Check if already processed
    if (recording.processingStatus === "COMPLETED") {
      return NextResponse.json(
        { error: { code: "ALREADY_PROCESSED", message: "Recording has already been processed" } },
        { status: 409 }
      );
    }

    // Check if currently processing
    if (recording.processingStatus === "PROCESSING") {
      return NextResponse.json(
        { error: { code: "PROCESSING_IN_PROGRESS", message: "Recording is currently being processed" } },
        { status: 409 }
      );
    }

    // Process the recording
    const result = await processRecording(recordingId);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "PROCESSING_FAILED", message: result.error || "Failed to process recording" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        recordingId: result.recordingId,
        transcript: result.transcript,
        extractedFields: result.extractedFields,
        confidenceScores: result.confidenceScores,
      },
    });
  } catch (error) {
    console.error("Error processing in-person recording:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process recording" } },
      { status: 500 }
    );
  }
}
