/**
 * Rate Limiter Implementation
 *
 * Uses the sliding window algorithm for accurate rate limiting.
 * Supports Redis for distributed rate limiting with in-memory fallback.
 */

import { getRateLimitRedis, safeRedisCommand } from './redis'
import {
  type RateLimitConfig,
  type EndpointCategory,
  generateRateLimitKey,
} from './config'

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Maximum requests allowed in the window */
  limit: number
  /** Remaining requests in the current window */
  remaining: number
  /** Unix timestamp (seconds) when the rate limit resets */
  reset: number
  /** Time in seconds until the rate limit resets */
  retryAfter: number
}

/**
 * In-memory rate limit store for fallback
 * Uses a simple object for storage with periodic cleanup
 */
interface InMemoryEntry {
  count: number
  windowStart: number
}

const inMemoryStore: Map<string, InMemoryEntry> = new Map()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

/**
 * Clean up expired entries from in-memory store
 */
function cleanupInMemoryStore(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return
  }

  lastCleanup = now
  const nowSeconds = Math.floor(now / 1000)

  Array.from(inMemoryStore.entries()).forEach(([key, entry]) => {
    // Remove entries older than 1 hour
    if (nowSeconds - entry.windowStart > 3600) {
      inMemoryStore.delete(key)
    }
  })
}

/**
 * Check rate limit using in-memory store (fallback)
 */
function checkInMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupInMemoryStore()

  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % config.windowSeconds)
  const windowEnd = windowStart + config.windowSeconds

  const entry = inMemoryStore.get(key)

  if (!entry || entry.windowStart !== windowStart) {
    // New window
    inMemoryStore.set(key, { count: 1, windowStart })
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: windowEnd,
      retryAfter: 0,
    }
  }

  // Same window
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      reset: windowEnd,
      retryAfter: windowEnd - now,
    }
  }

  entry.count++
  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    reset: windowEnd,
    retryAfter: 0,
  }
}

/**
 * Sliding window rate limit check using Redis
 *
 * Uses a sorted set to track requests with their timestamps.
 * This provides accurate rate limiting across distributed instances.
 */
async function checkRedisRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRateLimitRedis()

  if (!redis || redis.status !== 'ready') {
    // Fallback to in-memory
    return checkInMemoryRateLimit(key, config)
  }

  const now = Date.now()
  const nowSeconds = Math.floor(now / 1000)
  const windowStart = (now - config.windowSeconds * 1000).toString()
  const windowEnd = nowSeconds + config.windowSeconds

  try {
    // Atomic sliding window operation using Redis pipeline
    const pipeline = redis.pipeline()

    // Remove expired entries
    pipeline.zremrangebyscore(key, '-inf', windowStart)

    // Count current entries
    pipeline.zcard(key)

    // Add current request with timestamp as score
    pipeline.zadd(key, now.toString(), `${now}:${Math.random().toString(36).slice(2)}`)

    // Set TTL to clean up the key eventually
    pipeline.expire(key, config.windowSeconds * 2)

    const results = await pipeline.exec()

    if (!results) {
      return checkInMemoryRateLimit(key, config)
    }

    // Get the count before adding this request
    const countResult = results[1]
    const currentCount = typeof countResult?.[1] === 'number' ? countResult[1] : 0

    if (currentCount >= config.limit) {
      // Over limit - remove the request we just added
      await redis.zremrangebyscore(key, now.toString(), now.toString())

      // Get oldest entry to calculate retry-after
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES')
      let retryAfter = config.windowSeconds

      if (oldest && oldest.length >= 2) {
        const oldestTime = parseInt(oldest[1], 10)
        retryAfter = Math.ceil((oldestTime + config.windowSeconds * 1000 - now) / 1000)
        retryAfter = Math.max(1, retryAfter)
      }

      return {
        allowed: false,
        limit: config.limit,
        remaining: 0,
        reset: windowEnd,
        retryAfter,
      }
    }

    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - currentCount - 1,
      reset: windowEnd,
      retryAfter: 0,
    }
  } catch (error) {
    console.error('[RateLimit] Redis operation failed:', error)
    return checkInMemoryRateLimit(key, config)
  }
}

/**
 * Check rate limit for a request
 *
 * @param category - The endpoint category
 * @param config - Rate limit configuration
 * @param identifiers - Object containing user ID and/or IP address
 * @returns Rate limit result
 */
export async function checkRateLimit(
  category: EndpointCategory,
  config: RateLimitConfig,
  identifiers: { userId?: string; ip?: string }
): Promise<RateLimitResult> {
  const results: RateLimitResult[] = []

  // Check by user ID if configured and available
  if (config.trackByUser && identifiers.userId) {
    const key = generateRateLimitKey(category, `user:${identifiers.userId}`)
    const result = await checkRedisRateLimit(key, config)
    results.push(result)
  }

  // Check by IP if configured and available
  if (config.trackByIp && identifiers.ip) {
    const key = generateRateLimitKey(category, `ip:${identifiers.ip}`)
    const result = await checkRedisRateLimit(key, config)
    results.push(result)
  }

  // If no identifiers available, allow the request (edge case)
  if (results.length === 0) {
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit,
      reset: Math.floor(Date.now() / 1000) + config.windowSeconds,
      retryAfter: 0,
    }
  }

  // Return the most restrictive result
  // If any check fails, the request should be blocked
  const blocked = results.find((r) => !r.allowed)
  if (blocked) {
    return blocked
  }

  // Return the result with the lowest remaining count
  return results.reduce((min, r) => (r.remaining < min.remaining ? r : min))
}

/**
 * Get current rate limit status without incrementing counter
 *
 * Useful for displaying rate limit info without consuming quota
 */
export async function getRateLimitStatus(
  category: EndpointCategory,
  config: RateLimitConfig,
  identifiers: { userId?: string; ip?: string }
): Promise<RateLimitResult> {
  const redis = getRateLimitRedis()
  const now = Date.now()
  const nowSeconds = Math.floor(now / 1000)
  const windowStart = (now - config.windowSeconds * 1000).toString()
  const windowEnd = nowSeconds + config.windowSeconds

  // Try to get count from Redis
  if (redis && redis.status === 'ready') {
    try {
      let count = 0

      if (config.trackByUser && identifiers.userId) {
        const key = generateRateLimitKey(category, `user:${identifiers.userId}`)
        await redis.zremrangebyscore(key, '-inf', windowStart)
        count = Math.max(count, await redis.zcard(key))
      }

      if (config.trackByIp && identifiers.ip) {
        const key = generateRateLimitKey(category, `ip:${identifiers.ip}`)
        await redis.zremrangebyscore(key, '-inf', windowStart)
        count = Math.max(count, await redis.zcard(key))
      }

      return {
        allowed: count < config.limit,
        limit: config.limit,
        remaining: Math.max(0, config.limit - count),
        reset: windowEnd,
        retryAfter: count >= config.limit ? config.windowSeconds : 0,
      }
    } catch (error) {
      console.error('[RateLimit] Failed to get status:', error)
    }
  }

  // Return default (assume allowed) if we can't check
  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit,
    reset: windowEnd,
    retryAfter: 0,
  }
}

/**
 * Reset rate limit for a specific identifier
 *
 * Useful for administrative purposes (e.g., unblocking a user)
 */
export async function resetRateLimit(
  category: EndpointCategory,
  identifierType: 'user' | 'ip',
  identifier: string
): Promise<boolean> {
  return safeRedisCommand(async (redis) => {
    const key = generateRateLimitKey(category, `${identifierType}:${identifier}`)
    await redis.del(key)
    return true
  }, false)
}

/**
 * Clear all rate limits (for testing/admin purposes)
 */
export async function clearAllRateLimits(): Promise<boolean> {
  return safeRedisCommand(async (redis) => {
    const keys = await redis.keys('rate_limit:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return true
  }, false)
}
