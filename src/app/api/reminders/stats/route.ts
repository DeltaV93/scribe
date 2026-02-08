import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getReminderStats, getUpcomingReminders } from "@/lib/services/reminders";

/**
 * GET /api/reminders/stats - Get reminder stats for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const includeUpcoming = searchParams.get("includeUpcoming") === "true";
    const upcomingDays = parseInt(searchParams.get("upcomingDays") || "7", 10);

    const stats = await getReminderStats(user.id, user.orgId);

    let upcoming = null;
    if (includeUpcoming) {
      upcoming = await getUpcomingReminders(user.id, user.orgId, upcomingDays);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        upcoming,
      },
    });
  } catch (error) {
    console.error("Error fetching reminder stats:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch reminder stats" } },
      { status: 500 }
    );
  }
}
