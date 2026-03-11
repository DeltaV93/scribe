import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listJobProgress } from "@/lib/jobs";
import { JobStatus } from "@prisma/client";

/**
 * GET /api/jobs - List job progress records for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? undefined;
    const statusParam = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const status = statusParam
      ? (statusParam.toUpperCase() as JobStatus)
      : undefined;

    const result = await listJobProgress({
      userId: user.id,
      orgId: user.orgId,
      type,
      status,
      limit: Math.min(limit, 100),
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error listing jobs:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list jobs" } },
      { status: 500 }
    );
  }
}
