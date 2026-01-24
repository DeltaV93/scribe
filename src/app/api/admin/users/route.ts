import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getUsersWithPhoneStatus } from "@/lib/services/phone-number-management";
import { getOrganizationUsers } from "@/lib/services/user-management";

/**
 * GET /api/admin/users
 * List all users in the organization
 * Query params:
 *   - includeInactive: if "true", include inactive users
 *   - format: "phone" for phone status format, "full" for full user details
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
    const includeInactive = searchParams.get("includeInactive") === "true";
    const format = searchParams.get("format");

    // Default to phone status format for backwards compatibility
    if (format !== "full" && !includeInactive) {
      const users = await getUsersWithPhoneStatus(user.orgId);
      return NextResponse.json({ data: users });
    }

    // Full user details format
    const users = await getOrganizationUsers(user.orgId, includeInactive);
    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
