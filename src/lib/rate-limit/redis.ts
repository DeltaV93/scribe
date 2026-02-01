/**
 * Redis Client Singleton for Rate Limiting
 *
 * Provides a dedicated Redis connection for rate limiting operations.
 * Separate from the BullMQ connection to avoid conflicts.
 */

import Redis from 'ioredis'

let rateLimitRedis: Redis | null = null

/**
 * Configuration for rate limit Redis connection
 */
const REDIS_CONFIG = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 5) {
      console.error('[RateLimit] Redis connection failed after 5 retries')
      return null
    }
    return Math.min(times * 200, 2000)
  },
  enableOfflineQueue: true,
  lazyConnect: true,
  connectTimeout: 5000,
  commandTimeout: 2000,
}

/**
 * Get or create the Redis connection for rate limiting
 * Returns null if REDIS_URL is not set
 */
export function getRateLimitRedis(): Redis | null {
  if (rateLimitRedis) {
    return rateLimitRedis
  }

  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    console.warn('[RateLimit] REDIS_URL not set. Rate limiting will use in-memory fallback.')
    return null
  }

  try {
    rateLimitRedis = new Redis(redisUrl, REDIS_CONFIG)

    rateLimitRedis.on('error', (error) => {
      console.error('[RateLimit] Redis error:', error.message)
    })

    rateLimitRedis.on('connect', () => {
      console.log('[RateLimit] Redis connected')
    })

    rateLimitRedis.on('close', () => {
      console.log('[RateLimit] Redis connection closed')
    })

    return rateLimitRedis
  } catch (error) {
    console.error('[RateLimit] Failed to create Redis connection:', error)
    return null
  }
}

/**
 * Check if rate limit Redis is available
 */
export function isRateLimitRedisAvailable(): boolean {
  const redis = getRateLimitRedis()
  if (!redis) return false
  return redis.status === 'ready' || redis.status === 'connecting'
}

/**
 * Check Redis health for rate limiting
 */
export async function isRateLimitRedisHealthy(): Promise<boolean> {
  try {
    const redis = getRateLimitRedis()
    if (!redis) return false

    // Connect if not already connected
    if (redis.status === 'wait') {
      await redis.connect()
    }

    const result = await redis.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}

/**
 * Close the rate limit Redis connection
 */
export async function closeRateLimitRedis(): Promise<void> {
  if (rateLimitRedis) {
    await rateLimitRedis.quit()
    rateLimitRedis = null
  }
}

/**
 * Execute a Redis command with fallback on failure
 * Returns the default value if the command fails (for graceful degradation)
 */
export async function safeRedisCommand<T>(
  command: (redis: Redis) => Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    const redis = getRateLimitRedis()
    if (!redis) return defaultValue

    // Ensure connection is ready
    if (redis.status === 'wait') {
      await redis.connect()
    }

    if (redis.status !== 'ready') {
      return defaultValue
    }

    return await command(redis)
  } catch (error) {
    console.error('[RateLimit] Redis command failed:', error)
    return defaultValue
  }
}
