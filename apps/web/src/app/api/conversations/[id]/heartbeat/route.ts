import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface HeartbeatRequest {
  deviceId: string;
  recordingState: "recording" | "paused" | "stopped";
  durationSeconds: number;
}

/**
 * POST /api/conversations/:id/heartbeat
 *
 * Updates the lastHeartbeat timestamp for an active recording session.
 * Called every 30 seconds by the frontend during recording.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body: HeartbeatRequest = await request.json();

    const { deviceId, recordingState, durationSeconds } = body;

    // Validate required fields
    if (!deviceId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "deviceId is required" } },
        { status: 400 }
      );
    }

    // Fetch conversation and verify ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        createdById: true,
        status: true,
        recordingDeviceId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    // Verify user belongs to same org
    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not authorized" } },
        { status: 403 }
      );
    }

    // Only the creator can send heartbeats for their recording
    if (conversation.createdById !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the recording creator can send heartbeats" } },
        { status: 403 }
      );
    }

    // Warn if heartbeat is coming from a different device
    // (This can happen if user opened recording in multiple tabs)
    let shouldContinue = true;
    let message: string | undefined;

    if (conversation.recordingDeviceId && conversation.recordingDeviceId !== deviceId) {
      // Different device is sending heartbeat - could be multi-tab issue
      // We'll accept it but warn the client
      message = "Recording session was started from a different device/tab";
      console.warn(
        `[Heartbeat] Device mismatch for conversation ${id}: ` +
        `expected ${conversation.recordingDeviceId}, got ${deviceId}`
      );
    }

    // Only accept heartbeats for RECORDING status conversations
    if (conversation.status !== "RECORDING") {
      shouldContinue = false;
      message = `Conversation is not in RECORDING status (current: ${conversation.status})`;
    }

    // Update heartbeat timestamp
    await prisma.conversation.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
        recordingDeviceId: conversation.recordingDeviceId || deviceId, // Set on first heartbeat
        // Update duration if provided (useful for recovery)
        ...(durationSeconds !== undefined && { durationSeconds }),
      },
    });

    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
      shouldContinue,
      message,
    });
  } catch (error) {
    console.error("Error processing heartbeat:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process heartbeat" } },
      { status: 500 }
    );
  }
}
