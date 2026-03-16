/**
 * Integration Resources API (PX-1002)
 *
 * Manages discovered resources (teams, projects, databases) for integrations.
 * Resources are used for destination selection when pushing outputs.
 *
 * GET  - Get resources for a platform connection
 * POST - Trigger resource discovery for a platform
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { IntegrationPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getOrgPlatformResources,
  discoverAndStoreResources,
} from "@/lib/integrations/base/resource-discovery";

// Schema for GET query params
const getResourcesSchema = z.object({
  platform: z.enum(["LINEAR", "JIRA", "NOTION", "GOOGLE_DOCS", "GOOGLE_CALENDAR", "OUTLOOK_CALENDAR"]),
});

// Schema for POST body
const discoverResourcesSchema = z.object({
  platform: z.enum(["LINEAR", "JIRA", "NOTION", "GOOGLE_DOCS", "GOOGLE_CALENDAR", "OUTLOOK_CALENDAR"]),
});

/**
 * GET /api/integrations/resources?platform=LINEAR
 *
 * Get discovered resources for a platform connection.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // 2. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform");

    const parseResult = getResourcesSchema.safeParse({ platform });
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid platform parameter",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    // 3. Get resources
    const resources = await getOrgPlatformResources(
      user.orgId,
      parseResult.data.platform as IntegrationPlatform
    );

    if (!resources) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `No active ${platform} connection found`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ resources });
  } catch (error) {
    console.error("[Integration Resources] GET Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get resources" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/resources
 *
 * Trigger resource discovery for a platform.
 * Body: { platform: "LINEAR" | "JIRA" | "NOTION" | ... }
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

    // 2. Parse body
    const body = await request.json();
    const parseResult = discoverResourcesSchema.safeParse(body);
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

    // 3. Get connection
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        orgId: user.orgId,
        platform: platform as IntegrationPlatform,
        isActive: true,
      },
    });

    if (!connection) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `No active ${platform} connection found`,
          },
        },
        { status: 404 }
      );
    }

    // 4. Discover resources
    const result = await discoverAndStoreResources(connection.id);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "DISCOVERY_FAILED",
            message: result.error || "Failed to discover resources",
          },
        },
        { status: 500 }
      );
    }

    // 5. Get updated resources
    const resources = await getOrgPlatformResources(
      user.orgId,
      platform as IntegrationPlatform
    );

    return NextResponse.json({
      success: true,
      count: result.count,
      resources,
    });
  } catch (error) {
    console.error("[Integration Resources] POST Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to discover resources" } },
      { status: 500 }
    );
  }
}
