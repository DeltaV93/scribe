/**
 * Sentry Client-Side Configuration
 *
 * This file configures the Sentry SDK for the browser environment.
 * It runs when the application loads in the user's browser.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.npm_package_version,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay for debugging user issues
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Integration configuration
    integrations: [
      Sentry.replayIntegration({
        // Mask all text content for privacy (PHI protection)
        maskAllText: true,
        // Block all media for privacy
        blockAllMedia: true,
      }),
    ],

    // Filter events before sending
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
        return null;
      }

      // Scrub sensitive data from error messages
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

      // Remove sensitive breadcrumb data
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
          ...breadcrumb,
          message: breadcrumb.message ? scrubSensitiveData(breadcrumb.message) : breadcrumb.message,
          data: breadcrumb.data ? scrubObject(breadcrumb.data) : breadcrumb.data,
        }));
      }

      return event;
    },

    // Filter breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Don't record XHR/fetch breadcrumbs with sensitive data
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
        const url = breadcrumb.data?.url as string;
        if (url) {
          // Mask sensitive URL parameters
          const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth'];
          let maskedUrl = url;
          sensitiveParams.forEach((param) => {
            const regex = new RegExp(`(${param}=)[^&]*`, 'gi');
            maskedUrl = maskedUrl.replace(regex, `$1[REDACTED]`);
          });
          breadcrumb.data = { ...breadcrumb.data, url: maskedUrl };
        }
      }

      // Scrub console breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.message) {
        breadcrumb.message = scrubSensitiveData(breadcrumb.message);
      }

      return breadcrumb;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network errors that are expected
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // User-triggered navigation
      'AbortError',
      // Third-party scripts
      /^Script error\.?$/,
    ],

    // URLs to ignore
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      // Firefox extensions
      /^resource:\/\//i,
      // Safari extensions
      /safari-extension:/i,
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

/**
 * Scrub sensitive data from objects
 */
function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'ssn',
    'creditCard',
    'credit_card',
  ];

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = scrubSensitiveData(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = scrubObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}
