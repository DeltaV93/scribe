/**
 * Redis Connection Singleton
 *
 * Provides a shared Redis connection for BullMQ queues and workers.
 * Uses IORedis with connection pooling for optimal performance.
 */

import { Redis } from 'ioredis'

let connection: Redis | null = null

/**
 * Get or create the Redis connection singleton
 * Returns null if REDIS_URL is not set (for build-time checks)
 */
export function getRedisConnection(): Redis {
  if (connection) {
    return connection
  }

  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    // During build time or when Redis is not configured, throw a descriptive error
    // This will be caught by callers who should handle the case gracefully
    throw new Error('REDIS_URL environment variable is not set. Job queue features are disabled.')
  }

  connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > 10) {
        console.error('Redis connection failed after 10 retries')
        return null
      }
      return Math.min(times * 100, 3000)
    },
  })

  connection.on('error', (error) => {
    console.error('Redis connection error:', error)
  })

  connection.on('connect', () => {
    console.log('Redis connected')
  })

  return connection
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_URL
}

/**
 * Close the Redis connection (for graceful shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit()
    connection = null
  }
}

/**
 * Check if Redis is connected and healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const redis = getRedisConnection()
    const result = await redis.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}
