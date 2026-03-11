/**
 * GET /api/chatbot/widget-config/[orgSlug] - Get widget configuration
 *
 * Returns the chatbot widget configuration for an organization.
 * This is a public endpoint used by the embeddable widget.
 *
 * Security:
 * - Strict rate limiting (10 requests/minute per IP)
 * - Honeypot org detection for threat intelligence
 * - formId is NOT exposed (internal use only)
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { NextRequest, NextResponse } from "next/server";
import { getWidgetConfig } from "@/lib/services/chatbot";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

interface RouteContext {
  params: Promise<{
    orgSlug: string;
  }>;
}

/**
 * Strict rate limit config for widget config endpoint
 * 10 requests per minute per IP - stricter than default public endpoints
 */
const WIDGET_CONFIG_RATE_LIMIT = {
  limit: 10,
  windowSeconds: 60,
  name: "Widget Config",
  trackByUser: false,
  trackByIp: true,
  message: "Too many requests",
};

/**
 * List of honeypot org slugs for threat detection
 * These orgs don't exist but are monitored for access attempts
 * TODO: Move to environment variable or database config
 */
const HONEYPOT_ORG_SLUGS: string[] = [
  // Add honeypot org slugs here
  // Example: "test-org-xyz", "admin-demo"
];

/**
 * Check if the org slug is a honeypot for threat detection
 */
function isHoneypotOrg(orgSlug: string): boolean {
  return HONEYPOT_ORG_SLUGS.includes(orgSlug.toLowerCase());
}

/**
 * GET /api/chatbot/widget-config/[orgSlug] - Get widget config
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const clientIp = getClientIp(request) || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    const { orgSlug } = await context.params;

    // Strict rate limit check (10 requests/minute per IP)
    const rateLimitResult = await checkRateLimit(
      "public",
      WIDGET_CONFIG_RATE_LIMIT,
      { ip: clientIp }
    );

    if (!rateLimitResult.allowed) {
      console.warn(
        `[SECURITY] Widget config rate limit exceeded: IP=${clientIp}, orgSlug=${orgSlug}, userAgent=${userAgent}`
      );
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfter.toString(),
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        }
      );
    }

    // Honeypot check - log security alert and return fake disabled config
    if (isHoneypotOrg(orgSlug)) {
      console.warn(
        `[SECURITY] Honeypot org accessed: orgSlug=${orgSlug}, IP=${clientIp}, userAgent=${userAgent}`
      );
      // Return fake disabled config to not tip off attacker
      return NextResponse.json({
        success: true,
        data: { enabled: false },
      });
    }

    const config = await getWidgetConfig(orgSlug);

    if (!config) {
      // Log warning for repeated 404s (potential enumeration attack)
      console.warn(
        `[SECURITY] Widget config not found: orgSlug=${orgSlug}, IP=${clientIp}`
      );
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Organization not found" } },
        { status: 404 }
      );
    }

    // Return config WITHOUT formId (security risk - internal ID should not be exposed)
    // The widget backend will resolve formId server-side using orgSlug
    return NextResponse.json({
      success: true,
      data: {
        enabled: config.enabled,
        // formId: REMOVED - security risk, internal ID should not be exposed publicly
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
