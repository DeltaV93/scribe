import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getJobProgress, deleteJobProgress, removeJob } from "@/lib/jobs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/jobs/[jobId] - Get job progress details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { jobId } = await params;

    const job = await getJobProgress(jobId);

    if (!job) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    // Verify the job belongs to the user's organization
    if (job.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("Error getting job:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get job" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/jobs/[jobId] - Cancel/delete a job
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { jobId } = await params;

    const job = await getJobProgress(jobId);

    if (!job) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    // Verify the job belongs to the user
    if (job.userId !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You can only cancel your own jobs" } },
        { status: 403 }
      );
    }

    // Can only cancel pending or processing jobs
    if (job.status !== "PENDING" && job.status !== "PROCESSING") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: "Can only cancel pending or processing jobs"
          }
        },
        { status: 400 }
      );
    }

    // Try to remove from queue if it exists
    try {
      await removeJob(jobId);
    } catch {
      // Job might not be in queue, that's ok
    }

    // Delete the progress record
    await deleteJobProgress(jobId);

    return NextResponse.json({
      success: true,
      message: "Job cancelled",
    });
  } catch (error) {
    console.error("Error cancelling job:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to cancel job" } },
      { status: 500 }
    );
  }
}
