/**
 * OAuth Callback Handler
 *
 * GET /api/integrations/meetings/callback/[platform]
 *
 * Handles OAuth redirects from Teams, Zoom, and Google Meet.
 */

import { NextRequest, NextResponse } from "next/server";
import { MeetingPlatform } from "@prisma/client";
import {
  parseOAuthState,
  completeOAuthFlow,
} from "@/lib/services/meetings/integrations";

interface RouteParams {
  params: Promise<{
    platform: string;
  }>;
}

/**
 * Parse and validate platform parameter
 */
function parsePlatform(platformParam: string): MeetingPlatform | null {
  const normalized = platformParam.toUpperCase().replace("-", "_");
  if (Object.values(MeetingPlatform).includes(normalized as MeetingPlatform)) {
    return normalized as MeetingPlatform;
  }
  return null;
}

/**
 * GET /api/integrations/meetings/callback/[platform]
 * Handle OAuth callback from meeting platforms
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const searchParams = request.nextUrl.searchParams;
  const resolvedParams = await params;

  // Get platform from route
  const platform = parsePlatform(resolvedParams.platform);

  if (!platform) {
    return redirectWithError(
      "/settings/integrations",
      "Invalid platform"
    );
  }

  // Check for OAuth error
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    console.error(`[OAuth ${platform}] Error:`, error, errorDescription);
    return redirectWithError(
      "/settings/integrations",
      errorDescription || error
    );
  }

  // Get authorization code
  const code = searchParams.get("code");
  if (!code) {
    return redirectWithError(
      "/settings/integrations",
      "Authorization code missing"
    );
  }

  // Get and validate state
  const stateParam = searchParams.get("state");
  if (!stateParam) {
    return redirectWithError(
      "/settings/integrations",
      "State parameter missing"
    );
  }

  const state = parseOAuthState(stateParam);
  if (!state) {
    return redirectWithError(
      "/settings/integrations",
      "Invalid or expired state parameter"
    );
  }

  // Verify platform matches
  if (state.platform !== platform) {
    return redirectWithError(
      "/settings/integrations",
      "Platform mismatch in callback"
    );
  }

  try {
    // Complete OAuth flow
    const integration = await completeOAuthFlow(code, state);

    console.log(`[OAuth ${platform}] Successfully connected for org ${state.orgId}`);

    // Redirect to success page or custom redirect URL
    const redirectUrl = state.redirectUrl || "/settings/integrations";
    const successUrl = new URL(redirectUrl, process.env.NEXT_PUBLIC_APP_URL);
    successUrl.searchParams.set("success", "true");
    successUrl.searchParams.set("platform", platform);
    successUrl.searchParams.set("integrationId", integration.id);

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error(`[OAuth ${platform}] Error completing flow:`, error);

    return redirectWithError(
      state.redirectUrl || "/settings/integrations",
      error instanceof Error ? error.message : "Failed to complete connection"
    );
  }
}

/**
 * Redirect with error message
 */
function redirectWithError(basePath: string, errorMessage: string): NextResponse {
  const url = new URL(basePath, process.env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("error", errorMessage);
  return NextResponse.redirect(url);
}
