import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { checkUserLimit } from "@/lib/services/user-invitation";

/**
 * GET /api/admin/users/limits
 * Get user limits for the organization
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limits = await checkUserLimit(user.orgId);

    return NextResponse.json({ data: limits });
  } catch (error) {
    console.error("Error fetching user limits:", error);
    return NextResponse.json(
      { error: "Failed to fetch user limits" },
      { status: 500 }
    );
  }
}
