/**
 * Rate Limit Middleware for Next.js
 *
 * Provides rate limiting integration for Next.js middleware.
 * Includes audit logging for rate limit violations.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, type RateLimitResult } from './limiter'
import {
  getEndpointCategory,
  getRateLimitConfig,
  isExcludedPath,
  type EndpointCategory,
} from './config'

/**
 * Rate limit violation log entry
 */
export interface RateLimitViolation {
  timestamp: Date
  category: EndpointCategory
  path: string
  method: string
  ip: string | null
  userId: string | null
  userAgent: string | null
  limit: number
  retryAfter: number
}

/**
 * In-memory buffer for rate limit violations
 * These should be flushed to the audit log periodically
 */
const violationBuffer: RateLimitViolation[] = []
const MAX_BUFFER_SIZE = 100

/**
 * Add a violation to the buffer
 */
function recordViolation(violation: RateLimitViolation): void {
  violationBuffer.push(violation)

  // Prevent buffer from growing too large
  if (violationBuffer.length > MAX_BUFFER_SIZE) {
    violationBuffer.shift()
  }

  // Log to console for immediate visibility
  console.warn('[RateLimit] Violation:', {
    category: violation.category,
    path: violation.path,
    ip: violation.ip,
    limit: violation.limit,
    retryAfter: violation.retryAfter,
  })
}

/**
 * Get and clear the violation buffer
 * Call this from a scheduled job to persist violations to the audit log
 */
export function getAndClearViolations(): RateLimitViolation[] {
  const violations = [...violationBuffer]
  violationBuffer.length = 0
  return violations
}

/**
 * Extract client IP address from request
 */
export function getClientIp(request: NextRequest): string | null {
  // Check common headers for the real client IP
  // These are set by proxies/load balancers
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp.trim()
  }

  // Vercel
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for')
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0].trim()
  }

  // Fallback - this may be the proxy IP, not the client
  return request.headers.get('x-forwarded-host') || null
}

/**
 * Extract user ID from request (from JWT or session)
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  // Check for user ID in cookie or header
  // This is a simplified check - the actual user ID extraction
  // should be done after full auth validation

  // Check for a session cookie that might contain user info
  const sessionCookie = request.cookies.get('sb-access-token')
  if (sessionCookie) {
    try {
      // Try to extract user ID from JWT payload (base64 encoded)
      const parts = sessionCookie.value.split('.')
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]))
        if (payload.sub) {
          return payload.sub
        }
      }
    } catch {
      // Ignore parsing errors - user ID extraction is best effort
    }
  }

  return null
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.reset.toString())

  if (!result.allowed) {
    response.headers.set('Retry-After', result.retryAfter.toString())
  }

  return response
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message?: string
): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Too Many Requests',
      message: message || 'Rate limit exceeded. Please try again later.',
      retryAfter: result.retryAfter,
    },
    { status: 429 }
  )

  return addRateLimitHeaders(response, result)
}

/**
 * Rate limit middleware function
 *
 * Call this from your Next.js middleware to apply rate limiting.
 * Returns null if the request is allowed, or a 429 response if blocked.
 */
export async function rateLimitMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  const method = request.method

  // Skip excluded paths
  if (isExcludedPath(pathname)) {
    return null
  }

  // Get endpoint category and config
  const category = getEndpointCategory(pathname, method)
  const config = getRateLimitConfig(pathname, method)

  // Extract identifiers
  const ipRaw = getClientIp(request)
  const userIdRaw = getUserIdFromRequest(request)

  // Check rate limit (expects undefined for missing values)
  const result = await checkRateLimit(category, config, {
    userId: userIdRaw ?? undefined,
    ip: ipRaw ?? undefined,
  })

  if (!result.allowed) {
    // Record the violation for audit logging (expects null for missing values)
    recordViolation({
      timestamp: new Date(),
      category,
      path: pathname,
      method,
      ip: ipRaw,
      userId: userIdRaw,
      userAgent: request.headers.get('user-agent'),
      limit: result.limit,
      retryAfter: result.retryAfter,
    })

    return createRateLimitResponse(result, config.message)
  }

  // Request is allowed - return null to continue processing
  // The headers will be added in the response phase
  return null
}

/**
 * Add rate limit headers to an existing response
 *
 * Call this to add rate limit headers to successful responses
 */
export async function addRateLimitHeadersToResponse(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const method = request.method

  // Skip excluded paths
  if (isExcludedPath(pathname)) {
    return response
  }

  // Get endpoint category and config
  const category = getEndpointCategory(pathname, method)
  const config = getRateLimitConfig(pathname, method)

  // Extract identifiers (convert null to undefined for limiter API)
  const ip = getClientIp(request) ?? undefined
  const userId = getUserIdFromRequest(request) ?? undefined

  // Get current rate limit status (without incrementing)
  const { getRateLimitStatus } = await import('./limiter')
  const result = await getRateLimitStatus(category, config, {
    userId,
    ip,
  })

  return addRateLimitHeaders(response, result)
}

/**
 * Options for the rate limit middleware wrapper
 */
export interface RateLimitMiddlewareOptions {
  /** Whether to add rate limit headers to successful responses */
  addHeaders?: boolean
  /** Whether to skip rate limiting entirely (for testing) */
  disabled?: boolean
  /** Custom paths to exclude from rate limiting */
  excludePaths?: string[]
}

/**
 * Create a rate limit middleware wrapper
 *
 * This wraps your existing middleware to add rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse,
  options: RateLimitMiddlewareOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  const { addHeaders = true, disabled = false, excludePaths = [] } = options

  return async (request: NextRequest): Promise<NextResponse> => {
    // Skip if disabled
    if (disabled) {
      return handler(request)
    }

    // Skip custom excluded paths
    const { pathname } = request.nextUrl
    if (excludePaths.some((p) => pathname.startsWith(p))) {
      return handler(request)
    }

    // Check rate limit
    const rateLimitResponse = await rateLimitMiddleware(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Process the request
    const response = await handler(request)

    // Add rate limit headers to the response
    if (addHeaders) {
      return addRateLimitHeadersToResponse(request, response)
    }

    return response
  }
}
