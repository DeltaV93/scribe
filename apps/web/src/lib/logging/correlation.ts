/**
 * Request Correlation ID Management
 *
 * Provides correlation IDs for request tracing across services.
 * Essential for debugging and audit trails in distributed systems.
 */

import { nanoid } from 'nanoid';

// Header name for correlation ID (standard across many systems)
export const CORRELATION_ID_HEADER = 'x-correlation-id';

// Alternative header names that some systems use
export const ALT_CORRELATION_HEADERS = [
  'x-request-id',
  'x-trace-id',
  'trace-id',
  'request-id',
];

/**
 * Generate a new correlation ID
 * Uses nanoid for URL-safe, unique identifiers
 */
export function generateCorrelationId(): string {
  return nanoid(21);
}

/**
 * Extract correlation ID from request headers
 * Checks standard header and alternatives, or generates a new one
 */
export function getCorrelationId(headers: Headers | Record<string, string | undefined>): string {
  // Handle both Headers object and plain object
  const getHeader = (name: string): string | null | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    return headers[name] || headers[name.toLowerCase()];
  };

  // Check primary header first
  const primaryId = getHeader(CORRELATION_ID_HEADER);
  if (primaryId) {
    return primaryId;
  }

  // Check alternative headers
  for (const header of ALT_CORRELATION_HEADERS) {
    const altId = getHeader(header);
    if (altId) {
      return altId;
    }
  }

  // Generate new if none found
  return generateCorrelationId();
}

/**
 * Correlation context for async local storage
 * Allows accessing correlation ID anywhere in the request lifecycle
 */
interface CorrelationContext {
  correlationId: string;
  requestId?: string;
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  startTime: number;
}

// AsyncLocalStorage for request context
// Using a simple map for environments where AsyncLocalStorage isn't available
let currentContext: CorrelationContext | null = null;

/**
 * Set the current correlation context
 */
export function setCorrelationContext(context: Partial<CorrelationContext>): void {
  currentContext = {
    correlationId: context.correlationId || generateCorrelationId(),
    requestId: context.requestId,
    userId: context.userId,
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    startTime: context.startTime || Date.now(),
  };
}

/**
 * Get the current correlation context
 */
export function getCorrelationContext(): CorrelationContext | null {
  return currentContext;
}

/**
 * Clear the current correlation context
 */
export function clearCorrelationContext(): void {
  currentContext = null;
}

/**
 * Get the current correlation ID (shortcut)
 */
export function getCurrentCorrelationId(): string | undefined {
  return currentContext?.correlationId;
}

/**
 * Run a function with a specific correlation context
 */
export async function withCorrelationContext<T>(
  context: Partial<CorrelationContext>,
  fn: () => Promise<T>
): Promise<T> {
  const previousContext = currentContext;
  setCorrelationContext(context);
  try {
    return await fn();
  } finally {
    currentContext = previousContext;
  }
}

/**
 * Create correlation headers for outgoing requests
 */
export function createCorrelationHeaders(): Record<string, string> {
  const context = getCorrelationContext();
  if (!context) {
    return {
      [CORRELATION_ID_HEADER]: generateCorrelationId(),
    };
  }

  return {
    [CORRELATION_ID_HEADER]: context.correlationId,
    ...(context.requestId && { 'x-request-id': context.requestId }),
  };
}

/**
 * Calculate request duration from context
 */
export function getRequestDuration(): number | undefined {
  const context = getCorrelationContext();
  if (!context) {
    return undefined;
  }
  return Date.now() - context.startTime;
}
