/**
 * Structured Logging with Pino
 *
 * Provides a centralized, structured logging solution for the Scribe application.
 * Features:
 * - JSON format for all logs (production)
 * - Pretty printing for development
 * - Correlation ID support for request tracing
 * - Automatic sensitive data masking
 * - Log levels: ERROR, WARN, INFO, DEBUG
 */

import pino from 'pino';
import type { Logger as PinoLogger, LoggerOptions } from 'pino';
import { maskObject, maskError, createSafeLogPayload } from './masking';
import { getCurrentCorrelationId, getCorrelationContext, getRequestDuration } from './correlation';

// Log levels
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

// Environment-based configuration
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as LogLevel;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

// Log context interface
export interface LogContext {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  organizationId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  [key: string]: unknown;
}

// Security event types
export type SecurityEventType =
  | 'auth_success'
  | 'auth_failure'
  | 'permission_denied'
  | 'suspicious_activity'
  | 'rate_limited'
  | 'mfa_required'
  | 'mfa_success'
  | 'mfa_failure'
  | 'session_expired'
  | 'password_changed'
  | 'data_export'
  | 'admin_action';

// Pino configuration
const pinoOptions: LoggerOptions = {
  level: IS_TEST ? 'silent' : LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'scrybe',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.0.0',
  },
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
    }),
  },
  // Redact sensitive fields at the Pino level as well
  redact: {
    paths: [
      'password',
      'secret',
      'token',
      'authorization',
      '*.password',
      '*.secret',
      '*.token',
      '*.authorization',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true,
  },
};

// Create the base logger
const baseLogger: PinoLogger = IS_PRODUCTION
  ? pino(pinoOptions)
  : pino({
      ...pinoOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
        },
      },
    });

/**
 * Enhanced logger class with context and masking
 */
class Logger {
  private pinoLogger: PinoLogger;

  constructor(logger: PinoLogger) {
    this.pinoLogger = logger;
  }

  /**
   * Add correlation context to log entries
   */
  private enrichContext(context?: LogContext): LogContext {
    const correlationContext = getCorrelationContext();
    return {
      correlationId: getCurrentCorrelationId(),
      ...(correlationContext && {
        userId: correlationContext.userId,
        organizationId: correlationContext.organizationId,
        sessionId: correlationContext.sessionId,
      }),
      ...context,
    };
  }

  /**
   * Safely mask and prepare log data
   */
  private prepareLogData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }
    if (typeof data === 'object') {
      return maskObject(data);
    }
    return data;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const maskedContext = createSafeLogPayload(context);
    return new Logger(this.pinoLogger.child(maskedContext));
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    this.pinoLogger.debug(
      this.prepareLogData(this.enrichContext(context)) as object,
      message
    );
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.pinoLogger.info(
      this.prepareLogData(this.enrichContext(context)) as object,
      message
    );
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.pinoLogger.warn(
      this.prepareLogData(this.enrichContext(context)) as object,
      message
    );
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = error instanceof Error
      ? { error: maskError(error) }
      : error
        ? { error: this.prepareLogData(error) }
        : {};

    this.pinoLogger.error(
      {
        ...this.prepareLogData(this.enrichContext(context)) as object,
        ...errorContext,
      },
      message
    );
  }

  /**
   * Fatal level logging
   */
  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = error instanceof Error
      ? { error: maskError(error) }
      : error
        ? { error: this.prepareLogData(error) }
        : {};

    this.pinoLogger.fatal(
      {
        ...this.prepareLogData(this.enrichContext(context)) as object,
        ...errorContext,
      },
      message
    );
  }

  /**
   * Log security-relevant events
   */
  security(
    eventType: SecurityEventType,
    message: string,
    context?: LogContext
  ): void {
    this.pinoLogger.info(
      {
        ...this.prepareLogData(this.enrichContext(context)) as object,
        securityEvent: eventType,
        severity: this.getSecuritySeverity(eventType),
      },
      `[SECURITY] ${message}`
    );
  }

  /**
   * Log HTTP request
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this.pinoLogger[level](
      {
        ...this.prepareLogData(this.enrichContext(context)) as object,
        http: {
          method,
          path,
          statusCode,
          duration,
        },
      },
      `${method} ${path} ${statusCode} ${duration}ms`
    );
  }

  /**
   * Log API call to external service
   */
  external(
    service: string,
    operation: string,
    duration: number,
    success: boolean,
    context?: LogContext
  ): void {
    const level = success ? 'info' : 'error';

    this.pinoLogger[level](
      {
        ...this.prepareLogData(this.enrichContext(context)) as object,
        external: {
          service,
          operation,
          duration,
          success,
        },
      },
      `External call to ${service}.${operation} ${success ? 'succeeded' : 'failed'} in ${duration}ms`
    );
  }

  /**
   * Log database operation
   */
  database(
    operation: string,
    table: string,
    duration: number,
    context?: LogContext
  ): void {
    this.pinoLogger.debug(
      {
        ...this.prepareLogData(this.enrichContext(context)) as object,
        database: {
          operation,
          table,
          duration,
        },
      },
      `DB ${operation} on ${table} in ${duration}ms`
    );
  }

  /**
   * Log job processing
   */
  job(
    jobType: string,
    jobId: string,
    status: 'started' | 'completed' | 'failed',
    context?: LogContext
  ): void {
    const level = status === 'failed' ? 'error' : 'info';

    this.pinoLogger[level](
      {
        ...this.prepareLogData(this.enrichContext(context)) as object,
        job: {
          type: jobType,
          id: jobId,
          status,
        },
      },
      `Job ${jobType} (${jobId}) ${status}`
    );
  }

  /**
   * Get security severity for event types
   */
  private getSecuritySeverity(
    eventType: SecurityEventType
  ): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<SecurityEventType, 'low' | 'medium' | 'high' | 'critical'> = {
      auth_success: 'low',
      auth_failure: 'medium',
      permission_denied: 'medium',
      suspicious_activity: 'high',
      rate_limited: 'medium',
      mfa_required: 'low',
      mfa_success: 'low',
      mfa_failure: 'medium',
      session_expired: 'low',
      password_changed: 'medium',
      data_export: 'medium',
      admin_action: 'high',
    };
    return severityMap[eventType];
  }
}

// Export the singleton logger instance
export const logger = new Logger(baseLogger);

// Export for creating child loggers with specific contexts
export function createLogger(context: LogContext): Logger {
  return logger.child(context);
}

// Re-export types
export type { Logger };
