/**
 * Sentry Error Tracking Utilities
 *
 * Provides helper functions for Sentry integration including:
 * - Error capture with context
 * - User context management (sanitized)
 * - Release tracking
 * - Performance monitoring
 */

import * as Sentry from '@sentry/nextjs';
import { maskUserContext, maskObject, maskString } from '../logging/masking';
import { getCurrentCorrelationId, getCorrelationContext } from '../logging/correlation';

// Re-export Sentry for convenience
export { Sentry };

// Error severity levels
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

// Custom context interface
export interface ErrorContext {
  action?: string;
  resource?: string;
  resourceId?: string;
  organizationId?: string;
  formId?: string;
  clientId?: string;
  callId?: string;
  [key: string]: unknown;
}

/**
 * Set sanitized user context in Sentry
 * Only includes non-PHI identifiers
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
  organizationId?: string;
  role?: string;
}): void {
  const sanitizedUser = maskUserContext(user);
  const userContext: { id: string; organization_id?: string; role?: string } = {
    id: sanitizedUser.id as string,
  };
  // Don't include email or other PII
  if (sanitizedUser.organizationId) {
    userContext.organization_id = sanitizedUser.organizationId as string;
  }
  if (sanitizedUser.role) {
    userContext.role = sanitizedUser.role as string;
  }
  Sentry.setUser(userContext);
}

/**
 * Clear user context from Sentry
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture an error with context
 */
export function captureError(
  error: Error | unknown,
  context?: ErrorContext,
  severity?: ErrorSeverity
): string {
  const correlationId = getCurrentCorrelationId();
  const correlationContext = getCorrelationContext();

  // Set tags for filtering
  Sentry.setTag('correlation_id', correlationId || 'unknown');
  if (context?.organizationId) {
    Sentry.setTag('organization_id', context.organizationId);
  }
  if (context?.action) {
    Sentry.setTag('action', context.action);
  }
  if (context?.resource) {
    Sentry.setTag('resource', context.resource);
  }

  // Add extra context (masked)
  const maskedContext = context ? maskObject(context) : {};
  Sentry.setContext('request', {
    correlationId,
    ...(correlationContext && {
      userId: correlationContext.userId,
      organizationId: correlationContext.organizationId,
    }),
    ...maskedContext,
  });

  // Capture the error
  if (error instanceof Error) {
    return Sentry.captureException(error, {
      level: severity || 'error',
    });
  }

  // Handle non-Error objects
  const errorMessage = typeof error === 'string'
    ? maskString(error)
    : JSON.stringify(maskObject(error));

  return Sentry.captureMessage(errorMessage, {
    level: severity || 'error',
  });
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  severity: ErrorSeverity = 'info',
  context?: ErrorContext
): string {
  const correlationId = getCurrentCorrelationId();

  if (context) {
    Sentry.setContext('custom', maskObject(context) as Record<string, unknown>);
  }

  return Sentry.captureMessage(maskString(message), {
    level: severity,
    tags: {
      correlation_id: correlationId || 'unknown',
    },
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    message: maskString(message),
    category,
    data: data ? (maskObject(data) as Record<string, unknown>) : undefined,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, unknown>
): Sentry.Span | undefined {
  // Convert data to SpanAttributes (string values only for Sentry)
  const attributes = data
    ? Object.fromEntries(
        Object.entries(maskObject(data) as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
          .map(([k, v]) => [k, String(v)])
      )
    : undefined;

  return Sentry.startInactiveSpan({
    name,
    op,
    attributes,
  });
}

/**
 * Wrap an async function with Sentry error handling
 */
export async function withSentryErrorHandling<T>(
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    captureError(error, context);
    throw error;
  }
}

/**
 * Wrap a function with Sentry performance monitoring
 */
export async function withSentrySpan<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
  data?: Record<string, unknown>
): Promise<T> {
  // Convert data to SpanAttributes (string values only for Sentry)
  const attributes = data
    ? Object.fromEntries(
        Object.entries(maskObject(data) as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
          .map(([k, v]) => [k, String(v)])
      )
    : undefined;

  return Sentry.startSpan(
    {
      name,
      op,
      attributes,
    },
    async () => fn()
  );
}

/**
 * Set custom context for the current scope
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, maskObject(context) as Record<string, unknown>);
}

/**
 * Set a custom tag
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, maskString(value));
}

/**
 * Flush pending events (useful before serverless function ends)
 */
export async function flush(timeout = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Check if Sentry is initialized
 */
export function isInitialized(): boolean {
  return !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN;
}
