/**
 * GET /api/chatbot/widget-config/[orgSlug] - Get widget configuration
 *
 * Returns the chatbot widget configuration for an organization.
 * This is a public endpoint used by the embeddable widget.
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { NextRequest, NextResponse } from "next/server";
import { getWidgetConfig } from "@/lib/services/chatbot";

interface RouteContext {
  params: Promise<{
    orgSlug: string;
  }>;
}

/**
 * GET /api/chatbot/widget-config/[orgSlug] - Get widget config
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { orgSlug } = await context.params;

    const config = await getWidgetConfig(orgSlug);

    if (!config) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Organization not found" } },
        { status: 404 }
      );
    }

    // Return config (even if disabled, so widget can show appropriate message)
    return NextResponse.json({
      success: true,
      data: {
        enabled: config.enabled,
        formId: config.formId,
        authRequired: config.authRequired,
        orgName: config.orgName,
        primaryColor: config.primaryColor || "#4F46E5", // Default indigo
        logoUrl: config.logoUrl,
      },
    });
  } catch (error) {
    console.error("Error getting widget config:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get widget configuration" } },
      { status: 500 }
    );
  }
}
