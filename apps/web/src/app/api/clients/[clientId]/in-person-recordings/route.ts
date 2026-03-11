import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listRecordingsForClient } from "@/lib/services/in-person-recording";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/in-person-recordings - List recordings for a client
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { clientId } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Verify client exists and belongs to org
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        orgId: user.orgId,
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    const result = await listRecordingsForClient(clientId, user.orgId, {
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.recordings,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error("Error listing client recordings:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list recordings" } },
      { status: 500 }
    );
  }
}
