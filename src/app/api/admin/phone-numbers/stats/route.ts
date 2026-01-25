import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  getOrganizationPhoneStats,
  getAssignedNumbers,
  PHONE_NUMBER_PRICING,
} from "@/lib/services/phone-number-management";

/**
 * GET /api/admin/phone-numbers/stats
 * Get phone number statistics and costs for the organization
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

    const stats = await getOrganizationPhoneStats(user.orgId);
    const assignedNumbers = await getAssignedNumbers(user.orgId);

    return NextResponse.json({
      data: {
        stats,
        assignedNumbers,
        pricing: PHONE_NUMBER_PRICING,
      },
    });
  } catch (error) {
    console.error("Error fetching phone stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch phone statistics" },
      { status: 500 }
    );
  }
}
