/**
 * Sentry Edge Runtime Configuration
 *
 * This file configures the Sentry SDK for Next.js Edge Runtime.
 * It runs in middleware and edge API routes.
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
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

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
        // Remove cookies
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        // Remove body
        delete event.request.data;
      }

      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Expected middleware redirects
      'NEXT_REDIRECT',
      'NEXT_NOT_FOUND',
      // Rate limiting
      'Too Many Requests',
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

  return result;
}
