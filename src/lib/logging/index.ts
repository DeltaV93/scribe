/**
 * Logging Module Exports
 *
 * Centralized exports for the logging infrastructure.
 */

// Main logger
export { logger, createLogger } from './logger';
export type { Logger, LogContext, LogLevel, SecurityEventType } from './logger';

// Correlation ID management
export {
  generateCorrelationId,
  getCorrelationId,
  setCorrelationContext,
  getCorrelationContext,
  clearCorrelationContext,
  getCurrentCorrelationId,
  withCorrelationContext,
  createCorrelationHeaders,
  getRequestDuration,
  CORRELATION_ID_HEADER,
} from './correlation';

// Masking utilities
export {
  maskString,
  maskObject,
  maskError,
  maskUserContext,
  isSensitiveField,
  createSafeLogPayload,
} from './masking';
