import { NextRequest } from "next/server";

// ============================================
// CONFIGURATION
// ============================================

// Header name for CSRF token
const CSRF_HEADER_NAME = "X-CSRF-Token";

// ============================================
// CSRF VALIDATION
// ============================================

/**
 * Get CSRF token from request headers
 */
export function getCSRFToken(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

/**
 * Validate CSRF token against session
 * Returns true if valid, false if invalid
 */
export function validateCSRF(
  request: NextRequest,
  sessionCsrfToken: string
): boolean {
  const requestToken = getCSRFToken(request);

  if (!requestToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(requestToken, sessionCsrfToken);
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks by always taking the same amount of time
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a request method requires CSRF validation
 * GET, HEAD, OPTIONS are safe methods
 */
export function requiresCSRFValidation(method: string): boolean {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  return !safeMethods.includes(method.toUpperCase());
}

/**
 * Create a CSRF validation error response
 */
export function createCSRFErrorResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "Invalid or missing CSRF token",
      code: "CSRF_VALIDATION_FAILED",
    }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

// ============================================
// EXPORTS
// ============================================

export { CSRF_HEADER_NAME };
