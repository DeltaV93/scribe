/**
 * GET /api/chat/availability - Check if within business hours
 *
 * @see PX-713 - Real-Time Chat
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isWithinBusinessHours,
  getOnlineCaseManagers,
  getRoomAvailability,
} from "@/lib/services/realtime-chat";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get("roomId");

    // Get org chat settings
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: {
        realTimeChatEnabled: true,
        businessHoursStart: true,
        businessHoursEnd: true,
        businessHoursTimezone: true,
        businessHoursDays: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Check business hours
    const businessHoursStatus = await isWithinBusinessHours(user.orgId);

    // Get online case managers
    const onlineCaseManagers = await getOnlineCaseManagers(user.orgId);
    const onlineCount = onlineCaseManagers.filter((cm) => cm.online).length;

    // If a specific room is requested, get room-specific availability
    let roomAvailability = null;
    if (roomId) {
      roomAvailability = await getRoomAvailability(roomId, user.orgId);
    }

    return NextResponse.json({
      enabled: org.realTimeChatEnabled,
      businessHours: {
        configured: !!(org.businessHoursStart && org.businessHoursEnd),
        start: org.businessHoursStart,
        end: org.businessHoursEnd,
        timezone: org.businessHoursTimezone || "UTC",
        days: org.businessHoursDays || [1, 2, 3, 4, 5],
        isWithinHours: businessHoursStatus.isWithinHours,
        message: businessHoursStatus.message,
        nextAvailable: businessHoursStatus.nextAvailableTime,
      },
      presence: {
        onlineCaseManagerCount: onlineCount,
        caseManagers: onlineCaseManagers,
      },
      roomAvailability,
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
