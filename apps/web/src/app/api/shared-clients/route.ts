import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSharedWithMe } from "@/lib/services/client-sharing";

/**
 * GET /api/shared-clients - List all clients shared with the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const sharedClients = await getSharedWithMe(user.id, user.orgId);

    return NextResponse.json({
      success: true,
      data: sharedClients,
    });
  } catch (error) {
    console.error("Error fetching shared clients:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch shared clients",
        },
      },
      { status: 500 }
    );
  }
}
