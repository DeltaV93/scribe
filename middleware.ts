import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import {
  getCorrelationId,
  CORRELATION_ID_HEADER,
} from "@/lib/logging/correlation";
import { randomBytes } from "crypto";

// Cookie name for storing the CSP nonce (accessible by the app for inline scripts)
// Exported so components can read the nonce from cookies
export const CSP_NONCE_COOKIE = "__csp_nonce";

/**
 * Generates a cryptographically secure random nonce for CSP
 * @returns Base64-encoded 16-byte random nonce
 */
function generateNonce(): string {
  return randomBytes(16).toString("base64");
}

/**
 * Builds the Content-Security-Policy header value with nonce support
 * @param nonce - The generated nonce for inline script authorization
 * @returns CSP policy string
 */
function buildCSPHeader(nonce: string): string {
  // Define allowed domains for various directives
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).hostname : "";

  // Construct the CSP directives
  const directives: Record<string, string[]> = {
    // Default fallback - restrict to same origin
    "default-src": ["'self'"],

    // Scripts: self + nonce-based (no unsafe-inline/unsafe-eval for better security)
    // cdn.jsdelivr.net included for potential CDN-hosted scripts
    "script-src": ["'self'", `'nonce-${nonce}'`, "https://js.stripe.com", "https://*.sentry.io"],

    // Styles: self + unsafe-inline (required for Tailwind CSS and styled-jsx)
    "style-src": ["'self'", "'unsafe-inline'"],

    // Images: self + data URIs + https + blob (for uploads, avatars, etc.)
    "img-src": ["'self'", "data:", "https:", "blob:"],

    // Fonts: self only
    "font-src": ["'self'"],

    // Connections: self + required external APIs
    "connect-src": [
      "'self'",
      // Supabase for auth and database
      supabaseDomain ? `https://${supabaseDomain}` : "",
      "https://*.supabase.co",
      // Anthropic for AI features
      "https://api.anthropic.com",
      // Stripe for payments
      "https://api.stripe.com",
      // Deepgram for transcription (WebSocket)
      "wss://*.deepgram.com",
      "https://*.deepgram.com",
      // Sentry for error tracking
      "https://*.sentry.io",
      "https://*.ingest.sentry.io",
      // Twilio for voice
      "wss://*.twilio.com",
      "https://*.twilio.com",
    ].filter(Boolean),

    // Frames: only Stripe checkout
    "frame-src": ["https://js.stripe.com"],

    // Prevent framing of this site (clickjacking protection)
    "frame-ancestors": ["'none'"],

    // Restrict base URI to prevent base tag injection
    "base-uri": ["'self'"],

    // Restrict form submissions to same origin
    "form-action": ["'self'"],

    // Upgrade insecure requests in production
    ...(process.env.NODE_ENV === "production" ? { "upgrade-insecure-requests": [] } : {}),
  };

  // Build the CSP string
  return Object.entries(directives)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(" ")}`;
    })
    .join("; ");
}

/**
 * Adds security headers to a NextResponse for HTML page responses
 * These headers provide defense-in-depth against XSS, clickjacking, and other attacks
 *
 * @param response - The NextResponse to add headers to
 * @param nonce - The CSP nonce for this request
 * @returns The response with security headers added
 */
function addSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  // Content Security Policy with nonce
  response.headers.set("Content-Security-Policy", buildCSPHeader(nonce));

  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Prevent framing (defense in depth, also in CSP)
  response.headers.set("X-Frame-Options", "DENY");

  // Legacy XSS protection (for older browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Control referrer information leakage
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict browser features/permissions
  // - camera: disabled (not needed)
  // - microphone: allowed for self (needed for call recording)
  // - geolocation: disabled (not needed)
  response.headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");

  // Store nonce in a cookie for app access (needed for inline scripts)
  // httpOnly: true prevents JS access (but we need to read it server-side)
  // secure: true in production ensures HTTPS-only transmission
  // sameSite: strict prevents CSRF
  response.cookies.set(CSP_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    // Short-lived - only needed for this request
    maxAge: 60,
  });

  return response;
}

/**
 * Determines if a request is for an HTML page (not an API route or static asset)
 * Security headers with nonces should only be added to HTML responses
 */
function isHtmlRequest(pathname: string): boolean {
  // Skip API routes
  if (pathname.startsWith("/api")) {
    return false;
  }

  // Skip static files and assets
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") // Has file extension (e.g., .js, .css, .ico)
  ) {
    return false;
  }

  return true;
}

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/forms",
  "/clients",
  "/calls",
  "/settings",
  "/billing",
  "/templates",
];

// Auth routes - redirect to dashboard if already authenticated
const authRoutes = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate or extract correlation ID for request tracing
  const correlationId = getCorrelationId(request.headers);

  // Generate a unique nonce for this request (used for CSP)
  const nonce = generateNonce();

  // Helper to finalize response with appropriate headers
  const finalizeResponse = (response: NextResponse): NextResponse => {
    response.headers.set(CORRELATION_ID_HEADER, correlationId);

    // Add security headers only to HTML page responses
    if (isHtmlRequest(pathname)) {
      addSecurityHeaders(response, nonce);
    }

    return response;
  };

  // Apply rate limiting first (before any other processing)
  // This protects all routes including API routes
  const rateLimitResponse = await rateLimitMiddleware(request);
  if (rateLimitResponse) {
    // Add correlation ID to rate limit response (no security headers for rate limit responses)
    rateLimitResponse.headers.set(CORRELATION_ID_HEADER, correlationId);
    return rateLimitResponse;
  }

  // Skip auth middleware for API routes - they handle their own auth
  // Rate limiting is still applied above
  // API routes don't get CSP headers (they return JSON, not HTML)
  if (pathname.startsWith("/api")) {
    const response = NextResponse.next();
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    return response;
  }

  // Skip middleware for public routes - let them through without auth check
  const isPublicRoute = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/auth/callback",
    "/demo",
    "/privacy",
    "/terms",
    "/contact",
    "/mfa-setup",
    "/mfa-verify",
  ].includes(pathname);

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // If not a protected route and not an auth route, just pass through
  if (!isProtectedRoute && !authRoutes.includes(pathname)) {
    const response = NextResponse.next();
    return finalizeResponse(response);
  }

  // Check if Supabase env vars are set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // If no Supabase config, allow access to auth pages but block protected routes
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const response = NextResponse.redirect(url);
      return finalizeResponse(response);
    }
    const response = NextResponse.next();
    return finalizeResponse(response);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get user - wrap in try/catch to handle Supabase errors
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    // On error, allow access to public/auth routes, block protected
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const response = NextResponse.redirect(url);
      return finalizeResponse(response);
    }
    const response = NextResponse.next();
    return finalizeResponse(response);
  }

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(url);
    return finalizeResponse(response);
  }

  // Redirect authenticated users from auth routes to dashboard
  if (authRoutes.includes(pathname) && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const response = NextResponse.redirect(url);
    return finalizeResponse(response);
  }

  // Return successful response with security headers
  return finalizeResponse(supabaseResponse);
}

// Use Node.js runtime instead of Edge to support ioredis for distributed rate limiting
// This is required for HIPAA/SOC 2 compliance - rate limiting must work across all instances
export const runtime = 'nodejs'

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
