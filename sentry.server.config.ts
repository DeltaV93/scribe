/**
 * Sentry Server-Side Configuration
 *
 * This file configures the Sentry SDK for the Node.js server environment.
 * It runs on the server when processing requests.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

// Only initialize if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version,

    // Performance monitoring - lower sample rate in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Profile sample rate for performance insights
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Integrations
    integrations: [
      // Prisma integration for database query tracing
      Sentry.prismaIntegration(),
    ],

    // Filter events before sending
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
        return null;
      }

      // Scrub sensitive data
      if (event.message) {
        event.message = scrubSensitiveData(event.message);
      }

      // Scrub exception messages
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((exception) => ({
          ...exception,
          value: exception.value ? scrubSensitiveData(exception.value) : exception.value,
        }));
      }

      // Remove sensitive request data
      if (event.request) {
        event.request = scrubRequestData(event.request);
      }

      // Remove sensitive breadcrumb data
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
          ...breadcrumb,
          message: breadcrumb.message ? scrubSensitiveData(breadcrumb.message) : breadcrumb.message,
          data: breadcrumb.data ? scrubObject(breadcrumb.data) : breadcrumb.data,
        }));
      }

      // Remove sensitive extra data
      if (event.extra) {
        event.extra = scrubObject(event.extra as Record<string, unknown>);
      }

      return event;
    },

    // Filter breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Scrub HTTP breadcrumbs
      if (breadcrumb.category === 'http' && breadcrumb.data) {
        const data = breadcrumb.data as Record<string, unknown>;

        // Mask sensitive URL parameters
        if (typeof data.url === 'string') {
          data.url = scrubUrl(data.url);
        }

        // Remove request body
        delete data.body;
        delete data.request_body;

        // Remove response body
        delete data.response_body;

        breadcrumb.data = data;
      }

      // Scrub query breadcrumbs (database)
      if (breadcrumb.category === 'query' && breadcrumb.message) {
        // Don't send actual query data, just the operation type
        breadcrumb.message = scrubQuery(breadcrumb.message);
      }

      return breadcrumb;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Expected authentication errors
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
      // Rate limiting
      'Too Many Requests',
      // Client disconnects
      'ECONNRESET',
      'EPIPE',
    ],
  });
}

/**
 * Scrub sensitive data from strings
 */
function scrubSensitiveData(str: string): string {
  let result = str;

  // Email addresses
  result = result.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[EMAIL]'
  );

  // Phone numbers
  result = result.replace(
    /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    '[PHONE]'
  );

  // SSN
  result = result.replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '[SSN]');

  // JWT tokens
  result = result.replace(
    /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g,
    '[TOKEN]'
  );

  // API keys
  result = result.replace(
    /\b(?:sk|pk|api|key|token|secret)[-_]?[A-Za-z0-9]{20,}\b/gi,
    '[API_KEY]'
  );

  // AWS keys
  result = result.replace(/\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g, '[AWS_KEY]');

  // Stripe keys
  result = result.replace(/\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{24,}\b/g, '[STRIPE_KEY]');

  return result;
}

/**
 * Scrub sensitive data from objects
 */
function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'passwd',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'ssn',
    'social_security',
    'creditCard',
    'credit_card',
    'cardNumber',
    'card_number',
    'cvv',
    'cvc',
    'dob',
    'date_of_birth',
    'refresh_token',
    'access_token',
  ];

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = scrubSensitiveData(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = scrubObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? scrubObject(item as Record<string, unknown>)
          : typeof item === 'string'
            ? scrubSensitiveData(item)
            : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Scrub request data
 */
function scrubRequestData(request: Sentry.Event['request']): Sentry.Event['request'] {
  if (!request) return request;

  const scrubbed = { ...request };

  // Scrub URL
  if (scrubbed.url) {
    scrubbed.url = scrubUrl(scrubbed.url);
  }

  // Remove sensitive headers
  if (scrubbed.headers) {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    scrubbed.headers = Object.fromEntries(
      Object.entries(scrubbed.headers).map(([key, value]) => [
        key,
        sensitiveHeaders.includes(key.toLowerCase()) ? '[REDACTED]' : value,
      ])
    );
  }

  // Remove request body (may contain sensitive data)
  delete scrubbed.data;

  // Scrub query string
  if (scrubbed.query_string) {
    // query_string can be string or array of tuples
    if (typeof scrubbed.query_string === 'string') {
      scrubbed.query_string = scrubQueryString(scrubbed.query_string);
    }
    // If it's an array of tuples, leave it as is (already processed)
  }

  return scrubbed;
}

/**
 * Scrub URL parameters
 */
function scrubUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth', 'code', 'state'];

    sensitiveParams.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });

    return urlObj.toString();
  } catch {
    // If URL parsing fails, do basic regex replacement
    const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth'];
    let result = url;
    sensitiveParams.forEach((param) => {
      const regex = new RegExp(`(${param}=)[^&]*`, 'gi');
      result = result.replace(regex, `$1[REDACTED]`);
    });
    return result;
  }
}

/**
 * Scrub query string
 */
function scrubQueryString(queryString: string): string {
  const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth', 'code'];
  let result = queryString;

  sensitiveParams.forEach((param) => {
    const regex = new RegExp(`(${param}=)[^&]*`, 'gi');
    result = result.replace(regex, `$1[REDACTED]`);
  });

  return result;
}

/**
 * Scrub SQL query (remove values, keep structure)
 */
function scrubQuery(query: string): string {
  // Replace string values
  let result = query.replace(/'[^']*'/g, "'[VALUE]'");

  // Replace numeric values in common patterns
  result = result.replace(/= \d+/g, '= [VALUE]');
  result = result.replace(/IN \([^)]+\)/gi, 'IN ([VALUES])');

  return result;
}
