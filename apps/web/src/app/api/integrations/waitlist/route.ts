/**
 * Integration Waitlist API (PX-1003)
 *
 * Allows users to join/leave waitlist for upcoming integrations.
 *
 * GET  - Get user's waitlist status for all platforms
 * POST - Join waitlist for a platform
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Request schema for joining waitlist
const joinWaitlistSchema = z.object({
  platform: z.string().min(1).max(50),
});

/**
 * GET /api/integrations/waitlist
 *
 * Returns waitlist status for all coming-soon platforms.
 */
export async function GET(): Promise<NextResponse> {
  try {
    // 1. Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // 2. Get user's waitlist entries
    const userWaitlist = await prisma.integrationWaitlist.findMany({
      where: {
        userId: user.id,
        orgId: user.orgId,
      },
      select: {
        platform: true,
      },
    });

    const userPlatforms = new Set(userWaitlist.map((w) => w.platform));

    // 3. Get waitlist counts for all platforms
    const waitlistCounts = await prisma.integrationWaitlist.groupBy({
      by: ["platform"],
      _count: {
        platform: true,
      },
    });

    const countMap = new Map(
      waitlistCounts.map((c) => [c.platform, c._count.platform])
    );

    // 4. Build response with all coming-soon platforms
    const COMING_SOON_PLATFORMS = [
      "SALESFORCE",
      "HUBSPOT",
      "BAMBOOHR",
      "EPIC",
      "CLIO",
      "APRICOT",
      "GMAIL",
      "OUTLOOK",
      "TEAMS",
    ];

    const statuses = COMING_SOON_PLATFORMS.map((platform) => ({
      platform,
      isOnWaitlist: userPlatforms.has(platform),
      waitlistCount: countMap.get(platform) || 0,
    }));

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("[Integration Waitlist] GET Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get waitlist status" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/waitlist
 *
 * Join the waitlist for a platform.
 * Body: { platform: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const parseResult = joinWaitlistSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { platform } = parseResult.data;

    // 3. Check if already on waitlist
    const existing = await prisma.integrationWaitlist.findUnique({
      where: {
        orgId_userId_platform: {
          orgId: user.orgId,
          userId: user.id,
          platform,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        platform,
        message: "Already on waitlist",
        alreadyJoined: true,
      });
    }

    // 4. Add to waitlist
    await prisma.integrationWaitlist.create({
      data: {
        orgId: user.orgId,
        userId: user.id,
        platform,
        email: user.email,
      },
    });

    console.log(
      `[Integration Waitlist] User ${user.id} joined waitlist for ${platform}`
    );

    // 5. Get updated count
    const waitlistCount = await prisma.integrationWaitlist.count({
      where: { platform },
    });

    return NextResponse.json({
      success: true,
      platform,
      waitlistCount,
    });
  } catch (error) {
    console.error("[Integration Waitlist] POST Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to join waitlist" } },
      { status: 500 }
    );
  }
}
