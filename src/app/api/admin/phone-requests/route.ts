import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getPendingRequests, countPendingRequests } from "@/lib/services/phone-requests";

/**
 * GET /api/admin/phone-requests
 * List all pending phone number requests for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("countOnly") === "true";

    if (countOnly) {
      const count = await countPendingRequests(user.orgId);
      return NextResponse.json({ data: { count } });
    }

    const requests = await getPendingRequests(user.orgId);

    return NextResponse.json({ data: requests });
  } catch (error) {
    console.error("Error fetching phone requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch phone requests" },
      { status: 500 }
    );
  }
}
