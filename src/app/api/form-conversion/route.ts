import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listConversions } from "@/lib/services/form-conversion";
import { ConversionStatus } from "@prisma/client";

/**
 * GET /api/form-conversion - List form conversions for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ConversionStatus | null;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const result = await listConversions(user.orgId, {
      status: status ?? undefined,
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
    console.error("Error listing conversions:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list conversions" } },
      { status: 500 }
    );
  }
}
