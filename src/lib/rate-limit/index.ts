/**
 * Rate Limiting Module
 *
 * Provides distributed rate limiting using Redis with sliding window algorithm.
 * Includes graceful degradation to in-memory fallback when Redis is unavailable.
 *
 * Usage in middleware:
 * ```typescript
 * import { rateLimitMiddleware } from '@/lib/rate-limit'
 *
 * export async function middleware(request: NextRequest) {
 *   const rateLimitResponse = await rateLimitMiddleware(request)
 *   if (rateLimitResponse) {
 *     return rateLimitResponse
 *   }
 *   // Continue with normal middleware logic
 * }
 * ```
 *
 * Rate Limits:
 * - Authentication: 10 requests / 15 minutes
 * - API (authenticated): 1000 requests / 1 minute
 * - File uploads: 10 uploads / 1 hour
 * - Webhooks: 100 requests / 1 minute
 * - Public endpoints: 100 requests / 1 minute
 */

// Redis connection
export {
  getRateLimitRedis,
  isRateLimitRedisAvailable,
  isRateLimitRedisHealthy,
  closeRateLimitRedis,
  safeRedisCommand,
} from './redis'

// Configuration
export {
  RATE_LIMIT_CONFIGS,
  ROUTE_PATTERNS,
  EXCLUDED_PATHS,
  getEndpointCategory,
  getRateLimitConfig,
  generateRateLimitKey,
  isExcludedPath,
  type RateLimitConfig,
  type EndpointCategory,
} from './config'

// Rate limiter
export {
  checkRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  clearAllRateLimits,
  type RateLimitResult,
} from './limiter'

// Middleware
export {
  rateLimitMiddleware,
  addRateLimitHeaders,
  addRateLimitHeadersToResponse,
  createRateLimitResponse,
  getClientIp,
  getUserIdFromRequest,
  getAndClearViolations,
  withRateLimit,
  type RateLimitViolation,
  type RateLimitMiddlewareOptions,
} from './middleware'

// Audit integration
export {
  flushViolationsToAudit,
  getViolationSummary,
  getViolationSeverity,
  formatViolationForAudit,
  type ViolationSeverity,
} from './audit'
