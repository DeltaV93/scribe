import { NextRequest, NextResponse } from "next/server";

// ============================================
// CONFIGURATION
// ============================================

// Cookie name for portal session
const SESSION_COOKIE_NAME = "portal_session";

// Cookie settings
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/portal",
  maxAge: 60 * 60 * 24, // 24 hours in seconds
};

// ============================================
// COOKIE MANAGEMENT
// ============================================

/**
 * Set the portal session cookie on a response
 */
export function setSessionCookie(
  response: NextResponse,
  sessionToken: string
): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
}

/**
 * Clear the portal session cookie
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
}

/**
 * Get session token from request cookies
 */
export function getSessionFromCookie(request: NextRequest): string | null {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Get session token from headers (for API routes that receive request)
 */
export function getSessionFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  // Parse cookies manually
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      acc[name] = value;
    }
    return acc;
  }, {} as Record<string, string>);

  return cookies[SESSION_COOKIE_NAME] || null;
}

/**
 * Create a response with the session cookie set
 */
export function createResponseWithSession<T>(
  data: T,
  sessionToken: string,
  status = 200
): NextResponse {
  const response = NextResponse.json(data, { status });
  setSessionCookie(response, sessionToken);
  return response;
}

/**
 * Create a response with the session cookie cleared (logout)
 */
export function createLogoutResponse<T>(data: T, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  clearSessionCookie(response);
  return response;
}

// ============================================
// EXPORTS
// ============================================

export { SESSION_COOKIE_NAME };
