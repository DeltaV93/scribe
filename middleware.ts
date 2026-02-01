import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import {
  getCorrelationId,
  CORRELATION_ID_HEADER,
} from "@/lib/logging/correlation";

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

  // Apply rate limiting first (before any other processing)
  // This protects all routes including API routes
  const rateLimitResponse = await rateLimitMiddleware(request);
  if (rateLimitResponse) {
    // Add correlation ID to rate limit response
    rateLimitResponse.headers.set(CORRELATION_ID_HEADER, correlationId);
    return rateLimitResponse;
  }

  // Skip auth middleware for API routes - they handle their own auth
  // Rate limiting is still applied above
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
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    return response;
  }

  // Check if Supabase env vars are set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // If no Supabase config, allow access to auth pages but block protected routes
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const response = NextResponse.redirect(url);
      response.headers.set(CORRELATION_ID_HEADER, correlationId);
      return response;
    }
    const response = NextResponse.next();
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    return response;
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
      response.headers.set(CORRELATION_ID_HEADER, correlationId);
      return response;
    }
    const response = NextResponse.next();
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    return response;
  }

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(url);
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    return response;
  }

  // Redirect authenticated users from auth routes to dashboard
  if (authRoutes.includes(pathname) && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const response = NextResponse.redirect(url);
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    return response;
  }

  // Add correlation ID to the successful response
  supabaseResponse.headers.set(CORRELATION_ID_HEADER, correlationId);
  return supabaseResponse;
}

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
