/**
 * Performance timing utilities for AI operations
 */

type LogMetadata = {
  form_type?: string;
  prompt_length?: number;
  response_length?: number;
  input_tokens?: number;
  output_tokens?: number;
  field_count?: number;
  error?: string;
  model?: string;
  [key: string]: unknown;
};

type LogEntry = {
  event: string;
  step: string;
  duration_ms: number;
  success: boolean;
  metadata: LogMetadata;
};

/**
 * Format a log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const { event, step, duration_ms, success, metadata } = entry;

  let message = `[${event}] ${step}: ${duration_ms}ms`;

  if (!success) {
    message += ` (FAILED)`;
  }

  // Add relevant metadata inline
  const extras: string[] = [];
  if (metadata.input_tokens !== undefined) {
    extras.push(`input: ${metadata.input_tokens} tokens`);
  }
  if (metadata.output_tokens !== undefined) {
    extras.push(`output: ${metadata.output_tokens} tokens`);
  }
  if (metadata.field_count !== undefined) {
    extras.push(`${metadata.field_count} fields`);
  }
  if (metadata.error) {
    extras.push(`error: ${metadata.error}`);
  }

  if (extras.length > 0) {
    message += ` (${extras.join(", ")})`;
  }

  return message;
}

/**
 * Log a performance entry
 */
export function logPerformance(
  event: string,
  step: string,
  duration_ms: number,
  success: boolean,
  metadata: LogMetadata = {}
): void {
  const entry: LogEntry = {
    event,
    step,
    duration_ms: Math.round(duration_ms),
    success,
    metadata,
  };

  // Structured log for production parsing
  console.log(JSON.stringify(entry));

  // Human-readable log for development
  console.log(formatLogEntry(entry));
}

/**
 * Timer class for measuring operation durations
 */
export class Timer {
  private startTime: number;
  private event: string;

  constructor(event: string) {
    this.event = event;
    this.startTime = performance.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Log completion of a step and return elapsed time
   */
  log(step: string, success: boolean, metadata: LogMetadata = {}): number {
    const duration = this.elapsed();
    logPerformance(this.event, step, duration, success, metadata);
    return duration;
  }

  /**
   * Reset the timer for measuring a new step
   */
  reset(): void {
    this.startTime = performance.now();
  }

  /**
   * Create a sub-timer for measuring individual steps
   */
  step(): StepTimer {
    return new StepTimer(this.event);
  }
}

/**
 * Step timer for measuring individual operations within a larger flow
 */
export class StepTimer {
  private startTime: number;
  private event: string;

  constructor(event: string) {
    this.event = event;
    this.startTime = performance.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Complete the step and log it
   */
  complete(step: string, success: boolean, metadata: LogMetadata = {}): number {
    const duration = this.elapsed();
    logPerformance(this.event, step, duration, success, metadata);
    return duration;
  }
}

/**
 * Utility to create a timer for AI form generation
 */
export function createFormGenerationTimer(): Timer {
  return new Timer("ai_form_generation");
}
