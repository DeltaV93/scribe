/**
 * Rate-Limited External API Client
 *
 * Provides a wrapper for external API calls with:
 * - Proactive rate limiting using existing rate limiter
 * - Exponential backoff with jitter on 429 responses
 * - Request queuing to prevent bursts
 *
 * Usage:
 * ```typescript
 * const client = new RateLimitedClient('calendar', userId);
 * const response = await client.fetch('https://api.google.com/calendar/v3/events', {
 *   method: 'POST',
 *   body: JSON.stringify(event),
 * });
 * ```
 */

import { checkRateLimit, type RateLimitResult } from './limiter'
import { RATE_LIMIT_CONFIGS } from './config'

export interface RateLimitedClientOptions {
  /** Maximum number of retries on 429 responses */
  maxRetries?: number
  /** Base delay in ms for exponential backoff */
  baseDelayMs?: number
  /** Maximum delay in ms for backoff */
  maxDelayMs?: number
  /** Custom headers to include in all requests */
  defaultHeaders?: Record<string, string>
}

export interface RateLimitedResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  status?: number
  rateLimitInfo?: RateLimitResult
  retryCount?: number
}

const DEFAULT_OPTIONS: Required<Omit<RateLimitedClientOptions, 'defaultHeaders'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs)

  // Add jitter (±25% randomization)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1)

  return Math.floor(cappedDelay + jitter)
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Rate-limited client for external API calls
 */
export class RateLimitedClient {
  private service: string
  private userId: string
  private options: Required<Omit<RateLimitedClientOptions, 'defaultHeaders'>> & {
    defaultHeaders?: Record<string, string>
  }

  constructor(
    service: string,
    userId: string,
    options: RateLimitedClientOptions = {}
  ) {
    this.service = service
    this.userId = userId
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    }
  }

  /**
   * Make a rate-limited fetch request with automatic retries
   */
  async fetch<T = unknown>(
    url: string,
    init?: RequestInit
  ): Promise<RateLimitedResponse<T>> {
    // Check our internal rate limit first
    const rateLimitResult = await checkRateLimit(
      'external_api',
      RATE_LIMIT_CONFIGS.external_api,
      { userId: this.userId }
    )

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds.`,
        status: 429,
        rateLimitInfo: rateLimitResult,
      }
    }

    // Merge default headers with request headers
    const headers = {
      ...this.options.defaultHeaders,
      ...init?.headers,
    }

    let lastError: string | undefined
    let lastStatus: number | undefined

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...init,
          headers,
        })

        // Success - parse and return
        if (response.ok) {
          let data: T | undefined

          const contentType = response.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            data = await response.json()
          }

          return {
            success: true,
            data,
            status: response.status,
            rateLimitInfo: rateLimitResult,
            retryCount: attempt,
          }
        }

        // Rate limited by external API - retry with backoff
        if (response.status === 429) {
          lastStatus = 429
          lastError = 'External API rate limit exceeded'

          // Check if this is the last attempt
          if (attempt >= this.options.maxRetries) {
            break
          }

          // Get retry-after header if available
          const retryAfter = response.headers.get('retry-after')
          let delayMs: number

          if (retryAfter) {
            // Retry-After can be seconds or HTTP date
            const retrySeconds = parseInt(retryAfter, 10)
            if (!isNaN(retrySeconds)) {
              delayMs = retrySeconds * 1000
            } else {
              // Parse as HTTP date
              const retryDate = new Date(retryAfter)
              delayMs = Math.max(0, retryDate.getTime() - Date.now())
            }
          } else {
            // Use exponential backoff
            delayMs = calculateBackoff(
              attempt,
              this.options.baseDelayMs,
              this.options.maxDelayMs
            )
          }

          console.warn(
            `[RateLimitedClient] ${this.service} 429 response, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.options.maxRetries + 1})`
          )

          await sleep(delayMs)
          continue
        }

        // Other error - don't retry
        lastStatus = response.status
        try {
          const errorBody = await response.json()
          lastError = errorBody.error?.message || errorBody.message || response.statusText
        } catch {
          lastError = response.statusText
        }

        return {
          success: false,
          error: lastError,
          status: lastStatus,
          rateLimitInfo: rateLimitResult,
          retryCount: attempt,
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
        lastStatus = 0

        // Network errors - retry with backoff
        if (attempt < this.options.maxRetries) {
          const delayMs = calculateBackoff(
            attempt,
            this.options.baseDelayMs,
            this.options.maxDelayMs
          )

          console.warn(
            `[RateLimitedClient] ${this.service} network error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.options.maxRetries + 1}): ${lastError}`
          )

          await sleep(delayMs)
          continue
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: lastError || 'Request failed after retries',
      status: lastStatus,
      rateLimitInfo: rateLimitResult,
      retryCount: this.options.maxRetries,
    }
  }

  /**
   * Convenience method for JSON POST requests
   */
  async post<T = unknown, B = unknown>(
    url: string,
    body: B,
    headers?: Record<string, string>
  ): Promise<RateLimitedResponse<T>> {
    return this.fetch<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  /**
   * Convenience method for JSON PATCH requests
   */
  async patch<T = unknown, B = unknown>(
    url: string,
    body: B,
    headers?: Record<string, string>
  ): Promise<RateLimitedResponse<T>> {
    return this.fetch<T>(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete<T = unknown>(
    url: string,
    headers?: Record<string, string>
  ): Promise<RateLimitedResponse<T>> {
    return this.fetch<T>(url, {
      method: 'DELETE',
      headers,
    })
  }

  /**
   * Convenience method for GET requests
   */
  async get<T = unknown>(
    url: string,
    headers?: Record<string, string>
  ): Promise<RateLimitedResponse<T>> {
    return this.fetch<T>(url, {
      method: 'GET',
      headers,
    })
  }
}

/**
 * Create a rate-limited client for a specific service
 */
export function createRateLimitedClient(
  service: string,
  userId: string,
  options?: RateLimitedClientOptions
): RateLimitedClient {
  return new RateLimitedClient(service, userId, options)
}
