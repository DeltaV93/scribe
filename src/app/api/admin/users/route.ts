import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getUsersWithPhoneStatus } from "@/lib/services/phone-number-management";
import { getOrganizationUsers, searchOrganizationUsers } from "@/lib/services/user-management";

/**
 * GET /api/admin/users
 * List all users in the organization
 * Query params:
 *   - includeInactive: if "true", include inactive users
 *   - format: "phone" for phone status format, "full" for full user details
 *   - search: search string to filter by name or email (case-insensitive)
 *   - role: filter by role (e.g., "ADMIN", "CASE_MANAGER")
 *   - team: filter by team ID
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
    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") || undefined;
    const team = searchParams.get("team") || undefined;

    // Default to phone status format for backwards compatibility
    if (format !== "full" && !includeInactive && !search && !role && !team) {
      const users = await getUsersWithPhoneStatus(user.orgId);
      return NextResponse.json({ data: users });
    }

    // Full user details format with optional search/filter
    const users = await searchOrganizationUsers(user.orgId, {
      includeInactive,
      search,
      role,
      teamId: team,
    });
    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
