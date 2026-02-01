/**
 * Rate Limit Configuration
 *
 * Defines rate limits for different endpoint categories.
 * These limits are designed for SOC 2 compliance and security.
 */

/**
 * Rate limit configuration for an endpoint category
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
  /** Human-readable name for logging */
  name: string
  /** Whether to track by user ID in addition to IP */
  trackByUser: boolean
  /** Whether to track by IP address */
  trackByIp: boolean
  /** Optional message override for rate limit exceeded */
  message?: string
}

/**
 * Endpoint category type
 */
export type EndpointCategory =
  | 'authentication'
  | 'api'
  | 'file_upload'
  | 'webhook'
  | 'public'
  | 'health'

/**
 * Rate limit configurations by endpoint category
 *
 * These limits follow security best practices and SOC 2 requirements:
 * - Authentication: Strict limits to prevent brute force attacks
 * - API: Reasonable limits for normal authenticated usage
 * - File uploads: Strict limits to prevent abuse
 * - Webhooks: Allow external services reasonable throughput
 * - Public: Moderate limits for unauthenticated access
 */
export const RATE_LIMIT_CONFIGS: Record<EndpointCategory, RateLimitConfig> = {
  authentication: {
    limit: 10,
    windowSeconds: 15 * 60, // 15 minutes
    name: 'Authentication',
    trackByUser: false, // User not known yet during auth
    trackByIp: true,
    message: 'Too many authentication attempts. Please try again later.',
  },
  api: {
    limit: 1000,
    windowSeconds: 60, // 1 minute
    name: 'API',
    trackByUser: true,
    trackByIp: true,
  },
  file_upload: {
    limit: 10,
    windowSeconds: 60 * 60, // 1 hour
    name: 'File Upload',
    trackByUser: true,
    trackByIp: true,
    message: 'Upload limit exceeded. Please wait before uploading more files.',
  },
  webhook: {
    limit: 100,
    windowSeconds: 60, // 1 minute
    name: 'Webhook',
    trackByUser: false,
    trackByIp: true,
  },
  public: {
    limit: 100,
    windowSeconds: 60, // 1 minute
    name: 'Public',
    trackByUser: false,
    trackByIp: true,
  },
  health: {
    limit: 1000,
    windowSeconds: 60, // 1 minute - high limit for monitoring
    name: 'Health Check',
    trackByUser: false,
    trackByIp: true,
  },
}

/**
 * Route pattern matching for endpoint categorization
 */
interface RoutePattern {
  /** Pattern to match (supports wildcards with *) */
  pattern: string
  /** HTTP methods this pattern applies to (empty = all methods) */
  methods?: string[]
  /** The category for this pattern */
  category: EndpointCategory
}

/**
 * Route patterns for categorizing endpoints
 * Order matters - first match wins
 */
export const ROUTE_PATTERNS: RoutePattern[] = [
  // Health check endpoints - high limit
  { pattern: '/api/health*', category: 'health' },
  { pattern: '/api/healthz*', category: 'health' },

  // Authentication endpoints - strict limits
  { pattern: '/api/auth/*', category: 'authentication' },
  { pattern: '/login', category: 'authentication' },
  { pattern: '/signup', category: 'authentication' },
  { pattern: '/forgot-password', category: 'authentication' },
  { pattern: '/reset-password', category: 'authentication' },

  // File upload endpoints - strict limits
  { pattern: '/api/files/upload*', methods: ['POST'], category: 'file_upload' },
  { pattern: '/api/*/upload*', methods: ['POST'], category: 'file_upload' },

  // Webhook endpoints - external service limits
  { pattern: '/api/webhooks/*', category: 'webhook' },
  { pattern: '/api/billing/webhook*', category: 'webhook' },

  // Public endpoints (unauthenticated) - moderate limits
  { pattern: '/api/portal/*', category: 'public' },
  { pattern: '/api/attendance/codes*', category: 'public' },

  // All other API endpoints - standard authenticated limits
  { pattern: '/api/*', category: 'api' },
]

/**
 * Determine the endpoint category for a given path and method
 */
export function getEndpointCategory(
  pathname: string,
  method: string = 'GET'
): EndpointCategory {
  for (const route of ROUTE_PATTERNS) {
    if (matchPattern(pathname, route.pattern)) {
      // Check if method restriction applies
      if (route.methods && route.methods.length > 0) {
        if (!route.methods.includes(method.toUpperCase())) {
          continue
        }
      }
      return route.category
    }
  }

  // Default to public for non-API routes
  return 'public'
}

/**
 * Get the rate limit config for a given path and method
 */
export function getRateLimitConfig(
  pathname: string,
  method: string = 'GET'
): RateLimitConfig {
  const category = getEndpointCategory(pathname, method)
  return RATE_LIMIT_CONFIGS[category]
}

/**
 * Simple wildcard pattern matching
 * Supports * at the end of patterns
 */
function matchPattern(pathname: string, pattern: string): boolean {
  // Exact match
  if (pattern === pathname) {
    return true
  }

  // Wildcard at end
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return pathname.startsWith(prefix)
  }

  return false
}

/**
 * Generate a Redis key for rate limiting
 */
export function generateRateLimitKey(
  category: EndpointCategory,
  identifier: string
): string {
  return `rate_limit:${category}:${identifier}`
}

/**
 * Paths that should be excluded from rate limiting
 */
export const EXCLUDED_PATHS = [
  '/_next',
  '/static',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]

/**
 * Check if a path should be excluded from rate limiting
 */
export function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATHS.some(
    (excluded) =>
      pathname === excluded || pathname.startsWith(`${excluded}/`)
  )
}
