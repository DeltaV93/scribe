import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCallTranscript as getLiveTranscript } from "@/lib/deepgram/live-transcribe";

/**
 * GET /api/calls/[callId]/transcript/stream - Server-Sent Events for live transcript
 *
 * This endpoint streams live transcript updates to the client during an active call.
 * Uses Server-Sent Events (SSE) for real-time updates.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const user = await requireAuth();
    const { callId } = await params;

    // Verify call exists and belongs to org
    const call = await prisma.call.findFirst({
      where: { id: callId, client: { orgId: user.orgId } },
      select: { id: true, status: true },
    });

    if (!call) {
      return new Response(
        JSON.stringify({ error: { code: "NOT_FOUND", message: "Call not found" } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected", callId })}\n\n`)
        );

        // Send current transcript state
        const currentSegments = getLiveTranscript(callId);
        if (currentSegments.length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "history", segments: currentSegments })}\n\n`
            )
          );
        }

        // Set up polling interval for new transcript segments
        // In production, this would be replaced with a proper pub/sub system
        let lastSegmentCount = currentSegments.length;
        const intervalId = setInterval(() => {
          const segments = getLiveTranscript(callId);
          if (segments.length > lastSegmentCount) {
            // Send only new segments
            const newSegments = segments.slice(lastSegmentCount);
            for (const segment of newSegments) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "transcript", segment: { ...segment, isFinal: true } })}\n\n`
                )
              );
            }
            lastSegmentCount = segments.length;
          }

          // Keep connection alive
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        }, 1000);

        // Clean up on close
        request.signal.addEventListener("abort", () => {
          clearInterval(intervalId);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in transcript stream:", error);
    return new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Stream error" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
