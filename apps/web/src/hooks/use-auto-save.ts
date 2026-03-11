"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface AutoSaveOptions {
  /**
   * Called when auto-save triggers. Should return a promise that resolves on success.
   */
  onSave: () => Promise<void>;

  /**
   * Idle timeout in milliseconds before triggering save.
   * Default: 10000 (10 seconds)
   */
  idleTimeout?: number;

  /**
   * Maximum interval in milliseconds between saves regardless of activity.
   * Default: 60000 (60 seconds)
   */
  maxInterval?: number;

  /**
   * Maximum number of retry attempts on failure.
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Whether the form has unsaved changes.
   */
  isDirty: boolean;

  /**
   * Whether saving is disabled (e.g., read-only mode).
   */
  disabled?: boolean;
}

interface AutoSaveResult {
  /**
   * Current status of auto-save.
   */
  status: AutoSaveStatus;

  /**
   * Timestamp of last successful save.
   */
  lastSavedAt: Date | null;

  /**
   * Error message if save failed.
   */
  error: string | null;

  /**
   * Number of retry attempts remaining.
   */
  retriesRemaining: number;

  /**
   * Manually trigger a save.
   */
  saveNow: () => Promise<void>;

  /**
   * Retry a failed save.
   */
  retry: () => Promise<void>;

  /**
   * Reset error state.
   */
  clearError: () => void;
}

const EXPONENTIAL_BACKOFF_BASE = 2000; // 2 seconds

/**
 * Hook for auto-saving form data with dual timer strategy.
 *
 * Implements a combined approach:
 * - Saves after idle timeout (no changes for X seconds)
 * - Saves after max interval regardless of activity
 * - Whichever comes first triggers the save
 *
 * Includes exponential backoff retry on failure.
 */
export function useAutoSave({
  onSave,
  idleTimeout = 10000,
  maxInterval = 60000,
  maxRetries = 3,
  isDirty,
  disabled = false,
}: AutoSaveOptions): AutoSaveResult {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retriesRemaining, setRetriesRemaining] = useState(maxRetries);

  // Refs to track timers and state
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxIntervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastChangeRef = useRef<number>(Date.now());
  const isSavingRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (maxIntervalTimerRef.current) {
      clearTimeout(maxIntervalTimerRef.current);
      maxIntervalTimerRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Perform the save
  const performSave = useCallback(async () => {
    if (isSavingRef.current || disabled) return;

    isSavingRef.current = true;
    setStatus("saving");
    setError(null);

    try {
      await onSave();
      setStatus("saved");
      setLastSavedAt(new Date());
      setRetriesRemaining(maxRetries); // Reset retries on success
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save";
      setError(errorMessage);

      if (retriesRemaining > 0) {
        // Calculate exponential backoff delay
        const retryCount = maxRetries - retriesRemaining;
        const delay = EXPONENTIAL_BACKOFF_BASE * Math.pow(2, retryCount);

        setRetriesRemaining((prev) => prev - 1);

        // Schedule retry
        retryTimeoutRef.current = setTimeout(() => {
          isSavingRef.current = false;
          performSave();
        }, delay);

        setStatus("saving"); // Keep showing saving during retry
      } else {
        setStatus("error");
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave, disabled, retriesRemaining, maxRetries]);

  // Reset idle timer when dirty state changes
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    if (isDirty && !disabled) {
      idleTimerRef.current = setTimeout(() => {
        performSave();
      }, idleTimeout);
    }
  }, [isDirty, disabled, idleTimeout, performSave]);

  // Set up timers when dirty state changes
  useEffect(() => {
    if (!isDirty || disabled) {
      clearTimers();
      return;
    }

    // Record when changes started
    lastChangeRef.current = Date.now();

    // Set idle timer
    resetIdleTimer();

    // Set max interval timer (only if not already set)
    if (!maxIntervalTimerRef.current) {
      maxIntervalTimerRef.current = setTimeout(() => {
        performSave();
        maxIntervalTimerRef.current = null;
      }, maxInterval);
    }

    return () => {
      // Only clear idle timer on cleanup, not max interval
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [isDirty, disabled, resetIdleTimer, maxInterval, performSave, clearTimers]);

  // Reset max interval timer after successful save
  useEffect(() => {
    if (status === "saved" && maxIntervalTimerRef.current) {
      clearTimeout(maxIntervalTimerRef.current);
      maxIntervalTimerRef.current = null;
    }
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // Manual save function
  const saveNow = useCallback(async () => {
    clearTimers();
    await performSave();
  }, [clearTimers, performSave]);

  // Retry function
  const retry = useCallback(async () => {
    setRetriesRemaining(maxRetries);
    setError(null);
    await performSave();
  }, [maxRetries, performSave]);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
    setStatus("idle");
    setRetriesRemaining(maxRetries);
  }, [maxRetries]);

  return {
    status,
    lastSavedAt,
    error,
    retriesRemaining,
    saveNow,
    retry,
    clearError,
  };
}
