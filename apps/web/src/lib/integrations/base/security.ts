/**
 * Workflow Integrations - Security Utilities (PX-882)
 *
 * Provides security middleware and helpers for OAuth flows:
 * - Authentication checks
 * - RBAC permission validation
 * - Redirect URL validation (prevent open redirects)
 * - OAuth state validation
 * - Rate limiting integration
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkApiPermission } from "@/lib/rbac";
import type { SessionUser } from "@/types";
import type { OAuthState } from "./types";

// State expiration: 10 minutes
const STATE_EXPIRATION_MS = 10 * 60 * 1000;

// ============================================
// Authentication Helpers
// ============================================

/**
 * Get current user with standard error response
 */
export async function requireIntegrationAuth(): Promise<
  | { user: SessionUser }
  | { user: null; response: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      ),
    };
  }

  return { user };
}

/**
 * Check if user has permission to manage integrations
 */
export async function requireIntegrationPermission(
  user: SessionUser
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  // Use the settings resource for integration management
  const check = await checkApiPermission(user, "settings", "update");

  if (!check.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to manage integrations",
          },
        },
        { status: 403 }
      ),
    };
  }

  return { allowed: true };
}

// ============================================
// Redirect URL Validation
// ============================================

/**
 * Validate redirect URL to prevent open redirects
 *
 * Only allows:
 * - Relative paths starting with /
 * - Same-origin URLs matching NEXT_PUBLIC_APP_URL
 *
 * Falls back to /settings/integrations for invalid URLs
 */
export function validateRedirectUrl(url: string | undefined | null): string {
  const defaultUrl = "/settings/integrations";

  if (!url) {
    return defaultUrl;
  }

  // Allow relative paths
  if (url.startsWith("/") && !url.startsWith("//")) {
    // Basic XSS prevention - no javascript: or data: schemes in path
    if (url.includes("javascript:") || url.includes("data:")) {
      return defaultUrl;
    }
    return url;
  }

  // Check for same-origin absolute URLs
  try {
    const parsed = new URL(url);
    const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

    if (parsed.origin === appUrl.origin) {
      return url;
    }
  } catch {
    // Invalid URL format
  }

  return defaultUrl;
}

// ============================================
// OAuth State Management
// ============================================

/**
 * Generate OAuth state parameter
 *
 * Encodes platform, org, user, and redirect URL in a time-limited
 * base64url token for CSRF protection.
 */
export function generateOAuthState(
  platform: "LINEAR" | "NOTION" | "JIRA",
  orgId: string,
  userId: string,
  redirectUrl?: string
): string {
  const state: OAuthState = {
    platform,
    orgId,
    userId,
    redirectUrl: validateRedirectUrl(redirectUrl),
    createdAt: Date.now(),
  };
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

/**
 * Parse and validate OAuth state parameter
 *
 * Returns null if:
 * - State is malformed
 * - State has expired (10 minute limit)
 * - Required fields are missing
 */
export function parseOAuthState(stateParam: string): OAuthState | null {
  try {
    const decoded = Buffer.from(stateParam, "base64url").toString("utf-8");
    const state = JSON.parse(decoded) as OAuthState;

    // Validate expiration
    if (Date.now() - state.createdAt > STATE_EXPIRATION_MS) {
      console.error("[OAuth] State expired");
      return null;
    }

    // Validate required fields
    if (!state.platform || !state.orgId || !state.userId) {
      console.error("[OAuth] Invalid state: missing required fields");
      return null;
    }

    // Validate platform is valid
    if (!["LINEAR", "NOTION", "JIRA"].includes(state.platform)) {
      console.error("[OAuth] Invalid platform in state");
      return null;
    }

    return state;
  } catch (error) {
    console.error("[OAuth] Failed to parse state:", error);
    return null;
  }
}

// ============================================
// Error Response Helpers
// ============================================

/**
 * Create redirect response with error parameter
 */
export function redirectWithError(
  baseUrl: string,
  error: string,
  platform: string
): NextResponse {
  const url = new URL(baseUrl, process.env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("error", error);
  url.searchParams.set("platform", platform.toLowerCase());
  return NextResponse.redirect(url);
}

/**
 * Create redirect response with success parameter
 */
export function redirectWithSuccess(
  baseUrl: string,
  platform: string
): NextResponse {
  const url = new URL(baseUrl, process.env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("success", "true");
  url.searchParams.set("platform", platform.toLowerCase());
  return NextResponse.redirect(url);
}

/**
 * Standard error response for integration APIs
 */
export function integrationErrorResponse(
  code: string,
  message: string,
  status: number = 500
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status }
  );
}

// ============================================
// Request Helpers
// ============================================

/**
 * Extract IP address from request for audit logging
 */
export function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return null;
}

/**
 * Extract user agent from request for audit logging
 */
export function getUserAgent(request: NextRequest): string | null {
  return request.headers.get("user-agent");
}
