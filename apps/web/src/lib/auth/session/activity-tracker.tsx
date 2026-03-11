"use client";

/**
 * Client-side Activity Tracker
 *
 * Tracks user activity to determine if the session should be extended.
 * Sends heartbeat requests to refresh the session when user is active.
 */

import { useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";
import {
  type ActivityEventType,
  type ActivityState,
  type SessionTimeoutStatus,
  DEFAULT_ACTIVITY_TRACKER_CONFIG,
  DEFAULT_SESSION_CONFIG,
  getRemainingSeconds,
} from "./types";

// ============================================
// ACTIVITY TRACKER HOOK
// ============================================

interface UseActivityTrackerOptions {
  /** Whether to enable the tracker */
  enabled?: boolean;
  /** Session ID to track */
  sessionId?: string;
  /** Callback when session is about to expire */
  onSessionExpiring?: (remainingSeconds: number) => void;
  /** Callback when session has expired */
  onSessionExpired?: () => void;
  /** Callback when heartbeat succeeds */
  onHeartbeatSuccess?: (expiresAt: Date) => void;
  /** Callback when heartbeat fails */
  onHeartbeatError?: (error: Error) => void;
}

interface UseActivityTrackerReturn {
  /** Current activity state */
  activityState: ActivityState;
  /** Session timeout status */
  timeoutStatus: SessionTimeoutStatus;
  /** Manually refresh the session */
  refreshSession: () => Promise<void>;
  /** Reset activity timer */
  resetActivity: () => void;
  /** Check if session is valid */
  isSessionValid: boolean;
}

export function useActivityTracker(
  options: UseActivityTrackerOptions = {}
): UseActivityTrackerReturn {
  const {
    enabled = true,
    sessionId,
    onSessionExpiring,
    onSessionExpired,
    onHeartbeatSuccess,
    onHeartbeatError,
  } = options;

  // State
  const [activityState, setActivityState] = useState<ActivityState>({
    lastActivityAt: new Date(),
    isActive: true,
    idleTimeSeconds: 0,
  });

  const [timeoutStatus, setTimeoutStatus] = useState<SessionTimeoutStatus>({
    isExpiringSoon: false,
    expiresAt: null,
    remainingSeconds: DEFAULT_SESSION_CONFIG.timeoutMinutes * 60,
    shouldShowWarning: false,
  });

  // Refs
  const lastActivityRef = useRef<Date>(new Date());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const expiresAtRef = useRef<Date | null>(null);

  // ============================================
  // ACTIVITY DETECTION
  // ============================================

  const handleActivity = useCallback(() => {
    // Debounce activity events
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const now = new Date();
      lastActivityRef.current = now;

      setActivityState({
        lastActivityAt: now,
        isActive: true,
        idleTimeSeconds: 0,
      });
    }, DEFAULT_ACTIVITY_TRACKER_CONFIG.debounceMs);
  }, []);

  // Reset activity (called externally to force reset)
  const resetActivity = useCallback(() => {
    const now = new Date();
    lastActivityRef.current = now;
    setActivityState({
      lastActivityAt: now,
      isActive: true,
      idleTimeSeconds: 0,
    });
  }, []);

  // ============================================
  // HEARTBEAT
  // ============================================

  const sendHeartbeat = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch("/api/auth/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error("Heartbeat failed");
      }

      const data = await response.json();

      if (data.success) {
        const expiresAt = new Date(data.data.expiresAt);
        expiresAtRef.current = expiresAt;

        setTimeoutStatus({
          isExpiringSoon: false,
          expiresAt,
          remainingSeconds: data.data.remainingSeconds,
          shouldShowWarning: false,
        });

        onHeartbeatSuccess?.(expiresAt);
      } else {
        throw new Error(data.error?.message || "Heartbeat failed");
      }
    } catch (error) {
      onHeartbeatError?.(error as Error);
    }
  }, [sessionId, onHeartbeatSuccess, onHeartbeatError]);

  const refreshSession = useCallback(async () => {
    await sendHeartbeat();
  }, [sendHeartbeat]);

  // ============================================
  // COUNTDOWN TIMER
  // ============================================

  useEffect(() => {
    if (!enabled || !expiresAtRef.current) return;

    const updateCountdown = () => {
      const expiresAt = expiresAtRef.current;
      if (!expiresAt) return;

      const remaining = getRemainingSeconds(expiresAt);
      const warningThreshold = DEFAULT_SESSION_CONFIG.warningMinutes * 60;
      const isExpiringSoon = remaining > 0 && remaining <= warningThreshold;

      if (remaining <= 0) {
        onSessionExpired?.();
        setTimeoutStatus({
          isExpiringSoon: false,
          expiresAt,
          remainingSeconds: 0,
          shouldShowWarning: false,
        });
        return;
      }

      if (isExpiringSoon) {
        onSessionExpiring?.(remaining);
      }

      setTimeoutStatus({
        isExpiringSoon,
        expiresAt,
        remainingSeconds: remaining,
        shouldShowWarning: isExpiringSoon,
      });

      // Update idle time
      const idleSeconds = Math.floor(
        (Date.now() - lastActivityRef.current.getTime()) / 1000
      );
      setActivityState((prev) => ({
        ...prev,
        idleTimeSeconds: idleSeconds,
        isActive: idleSeconds < 60, // Consider active if less than 60 seconds idle
      }));
    };

    countdownTimerRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [enabled, onSessionExpiring, onSessionExpired]);

  // ============================================
  // EVENT LISTENERS
  // ============================================

  useEffect(() => {
    if (!enabled) return;

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "focus",
    ];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Also track visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleActivity();
        // Send heartbeat when tab becomes visible
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, handleActivity, sendHeartbeat]);

  // ============================================
  // HEARTBEAT INTERVAL
  // ============================================

  useEffect(() => {
    if (!enabled || !sessionId) return;

    // Send initial heartbeat
    sendHeartbeat();

    // Set up heartbeat interval (every 5 minutes)
    heartbeatTimerRef.current = setInterval(
      sendHeartbeat,
      DEFAULT_SESSION_CONFIG.heartbeatIntervalMs
    );

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [enabled, sessionId, sendHeartbeat]);

  return {
    activityState,
    timeoutStatus,
    refreshSession,
    resetActivity,
    isSessionValid: timeoutStatus.remainingSeconds > 0,
  };
}

// ============================================
// ACTIVITY TRACKER CONTEXT
// ============================================

interface ActivityTrackerContextValue extends UseActivityTrackerReturn {
  sessionId: string | null;
}

const ActivityTrackerContext = createContext<ActivityTrackerContextValue | null>(null);

interface ActivityTrackerProviderProps {
  children: ReactNode;
  sessionId?: string;
  onSessionExpired?: () => void;
}

export function ActivityTrackerProvider({
  children,
  sessionId,
  onSessionExpired,
}: ActivityTrackerProviderProps) {
  const tracker = useActivityTracker({
    enabled: !!sessionId,
    sessionId,
    onSessionExpired,
  });

  return (
    <ActivityTrackerContext.Provider value={{ ...tracker, sessionId: sessionId ?? null }}>
      {children}
    </ActivityTrackerContext.Provider>
  );
}

export function useActivityTrackerContext(): ActivityTrackerContextValue {
  const context = useContext(ActivityTrackerContext);

  if (!context) {
    throw new Error(
      "useActivityTrackerContext must be used within an ActivityTrackerProvider"
    );
  }

  return context;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format remaining time for display
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return "Expired";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

/**
 * Get event type from DOM event
 */
export function getActivityEventType(event: Event): ActivityEventType {
  const typeMap: Record<string, ActivityEventType> = {
    mousemove: "mouse_move",
    mousedown: "mouse_click",
    click: "mouse_click",
    keydown: "key_press",
    keypress: "key_press",
    scroll: "scroll",
    focus: "focus",
    touchstart: "touch",
    touchmove: "touch",
  };

  return typeMap[event.type] || "mouse_move";
}
