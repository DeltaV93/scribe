import { NextRequest, NextResponse } from "next/server";
import { processAllPendingCalls } from "@/lib/services/call-processing";

/**
 * POST /api/jobs/process-calls - Background job to process pending calls
 *
 * This endpoint should be called by a cron job or background task runner.
 * It processes calls that have completed but haven't been AI-processed yet.
 *
 * Security: Protected by API key in production
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API key in production
    if (process.env.NODE_ENV === "production") {
      const authHeader = request.headers.get("authorization");
      const expectedKey = process.env.JOBS_API_KEY;

      if (!expectedKey) {
        return NextResponse.json(
          { error: "Jobs API key not configured" },
          { status: 500 }
        );
      }

      if (authHeader !== `Bearer ${expectedKey}`) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    console.log("[ProcessCallsJob] Starting batch processing");

    const result = await processAllPendingCalls();

    console.log(
      `[ProcessCallsJob] Completed: ${result.processed} processed, ${result.failed} failed`
    );

    return NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        failed: result.failed,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("[ProcessCallsJob] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs/process-calls - Health check for the job
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    job: "process-calls",
    description: "Processes pending call recordings for transcription and AI extraction",
  });
}
