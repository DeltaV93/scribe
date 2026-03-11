/**
 * Notification Polling API (PX-725)
 * GET: Check for new notifications since a timestamp
 *
 * Optimized for 30-60 second polling intervals
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth-audit";
import { checkNewNotifications, getUnreadCount } from "@/lib/services/notifications";

/**
 * GET /api/notifications/poll
 * Check for new notifications since a given timestamp
 *
 * Query params:
 * - since: ISO timestamp (required)
 *
 * Returns minimal data for efficient polling:
 * - hasNew: boolean
 * - count: number of new notifications
 * - unreadTotal: total unread count (for badge)
 */
export const GET = withAuth(async (request, context, user) => {
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");

  if (!sinceParam) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "since parameter is required" } },
      { status: 400 }
    );
  }

  let since: Date;
  try {
    since = new Date(sinceParam);
    if (isNaN(since.getTime())) {
      throw new Error("Invalid date");
    }
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid since timestamp" } },
      { status: 400 }
    );
  }

  const [pollResult, unreadTotal] = await Promise.all([
    checkNewNotifications({ userId: user.id, since }),
    getUnreadCount(user.id),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      hasNew: pollResult.hasNew,
      count: pollResult.count,
      latestId: pollResult.latestId,
      unreadTotal,
      serverTime: new Date().toISOString(),
    },
  });
});
