"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type LockableResourceType = "form_submission" | "client" | "form" | "call";

export interface LockStatus {
  locked: boolean;
  isOwnLock: boolean;
  lockedBy?: string;
  expiresAt?: string;
}

export interface UseResourceLockOptions {
  resourceType: LockableResourceType;
  resourceId: string | null | undefined;
  /** Whether to automatically acquire lock on mount (default: true) */
  autoAcquire?: boolean;
  /** Lock expiration in ms (default: 300000 = 5 min) */
  expirationMs?: number;
  /** Heartbeat interval in ms to extend lock (default: 60000 = 1 min) */
  heartbeatIntervalMs?: number;
  /** Callback when lock is acquired */
  onLockAcquired?: () => void;
  /** Callback when lock acquisition fails */
  onLockFailed?: (lockedBy: string) => void;
  /** Callback when lock is released */
  onLockReleased?: () => void;
}

export interface UseResourceLockReturn {
  /** Whether we currently hold the lock */
  hasLock: boolean;
  /** Whether the resource is locked by someone else */
  isLockedByOther: boolean;
  /** Name of user who holds the lock (if locked by other) */
  lockedByName?: string;
  /** When the lock expires */
  expiresAt?: Date;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error?: string;
  /** Manually acquire the lock */
  acquireLock: () => Promise<boolean>;
  /** Manually release the lock */
  releaseLock: () => Promise<void>;
  /** Force take over the lock (if expired or own lock) */
  forceTakeover: () => Promise<boolean>;
}

export function useResourceLock({
  resourceType,
  resourceId,
  autoAcquire = true,
  expirationMs = 300000,
  heartbeatIntervalMs = 60000,
  onLockAcquired,
  onLockFailed,
  onLockReleased,
}: UseResourceLockOptions): UseResourceLockReturn {
  const [hasLock, setHasLock] = useState(false);
  const [isLockedByOther, setIsLockedByOther] = useState(false);
  const [lockedByName, setLockedByName] = useState<string | undefined>();
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const hasLockRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    hasLockRef.current = hasLock;
  }, [hasLock]);

  const checkLockStatus = useCallback(async (): Promise<LockStatus | null> => {
    if (!resourceId) return null;

    try {
      const params = new URLSearchParams({
        resourceType,
        resourceId,
      });

      const response = await fetch(`/api/locks?${params}`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      }
      return null;
    } catch {
      return null;
    }
  }, [resourceType, resourceId]);

  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (!resourceId) return false;

    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetch("/api/locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType,
          resourceId,
          expirationMs,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setHasLock(true);
        setIsLockedByOther(false);
        setLockedByName(undefined);
        setExpiresAt(data.data.expiresAt ? new Date(data.data.expiresAt) : undefined);
        onLockAcquired?.();
        return true;
      } else {
        setHasLock(false);
        setIsLockedByOther(true);
        setLockedByName(data.data?.existingLock?.userName || "Another user");
        setExpiresAt(
          data.data?.existingLock?.expiresAt
            ? new Date(data.data.existingLock.expiresAt)
            : undefined
        );
        setError(data.error?.message || "Failed to acquire lock");
        onLockFailed?.(data.data?.existingLock?.userName || "Another user");
        return false;
      }
    } catch (err) {
      setError("Failed to acquire lock");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [resourceType, resourceId, expirationMs, onLockAcquired, onLockFailed]);

  const releaseLock = useCallback(async (): Promise<void> => {
    if (!resourceId || !hasLockRef.current) return;

    try {
      await fetch("/api/locks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType,
          resourceId,
        }),
      });

      setHasLock(false);
      setIsLockedByOther(false);
      setLockedByName(undefined);
      setExpiresAt(undefined);
      onLockReleased?.();
    } catch {
      // Ignore errors on release
    }
  }, [resourceType, resourceId, onLockReleased]);

  const forceTakeover = useCallback(async (): Promise<boolean> => {
    // First release any existing lock (server will handle if we don't own it)
    // Then acquire a new lock
    return acquireLock();
  }, [acquireLock]);

  // Heartbeat to extend lock
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(async () => {
      if (!hasLockRef.current || !resourceId) return;

      try {
        // Re-acquire extends the lock if we own it
        await fetch("/api/locks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceType,
            resourceId,
            expirationMs,
          }),
        });
      } catch {
        // Ignore heartbeat failures
      }
    }, heartbeatIntervalMs);
  }, [resourceType, resourceId, expirationMs, heartbeatIntervalMs]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Auto-acquire lock on mount
  useEffect(() => {
    if (autoAcquire && resourceId) {
      acquireLock();
    }

    // Cleanup on unmount
    return () => {
      stopHeartbeat();
      if (hasLockRef.current && resourceId) {
        // Fire and forget release on unmount
        fetch("/api/locks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceType,
            resourceId,
          }),
        }).catch(() => {
          // Ignore errors on cleanup
        });
      }
    };
  }, [resourceId]); // Only re-run if resourceId changes

  // Start/stop heartbeat based on lock status
  useEffect(() => {
    if (hasLock) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }

    return () => stopHeartbeat();
  }, [hasLock, startHeartbeat, stopHeartbeat]);

  // Handle page visibility change - release lock when hidden for too long
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && hasLockRef.current) {
        // Page is hidden, could release lock or let it expire
        // For now, we'll let the heartbeat handle it
      } else if (!document.hidden && hasLockRef.current) {
        // Page is visible again, refresh the lock
        acquireLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [acquireLock]);

  // Handle beforeunload to release lock
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasLockRef.current && resourceId) {
        // Use sendBeacon for reliable cleanup on page unload
        const data = JSON.stringify({
          resourceType,
          resourceId,
        });
        navigator.sendBeacon?.(
          "/api/locks/release-beacon",
          new Blob([data], { type: "application/json" })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [resourceType, resourceId]);

  return {
    hasLock,
    isLockedByOther,
    lockedByName,
    expiresAt,
    isLoading,
    error,
    acquireLock,
    releaseLock,
    forceTakeover,
  };
}
