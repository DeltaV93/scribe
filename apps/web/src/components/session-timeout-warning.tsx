"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, AlertTriangle, LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// ============================================
// CONFIGURATION
// ============================================

/** How often to check session status (in milliseconds) */
const CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

/** How often to update countdown display (in milliseconds) */
const COUNTDOWN_INTERVAL_MS = 1000; // 1 second

/** Warning threshold in seconds (show warning when this much time remains) */
const WARNING_THRESHOLD_SECONDS = 5 * 60; // 5 minutes

// ============================================
// TYPES
// ============================================

interface SessionStatusResponse {
  success: boolean;
  data?: {
    sessionId: string;
    valid: boolean;
    expiresIn: number;
    absoluteExpiresIn: number;
    warningActive: boolean;
    config: {
      slidingTimeoutMinutes: number;
      absoluteTimeoutHours: number;
      warningBeforeMinutes: number;
    };
  };
  error?: {
    code: string;
    message: string;
    reason?: string;
  };
}

interface ExtendSessionResponse {
  success: boolean;
  data?: {
    sessionId: string;
    expiresIn: number;
    absoluteExpiresIn: number;
    warningActive: boolean;
    extended: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface SessionTimeoutWarningProps {
  /** Callback when user is logged out (optional) */
  onLogout?: () => void;
  /** Custom check interval in milliseconds */
  checkIntervalMs?: number;
  /** Whether to show the component (useful for conditional rendering) */
  enabled?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format seconds into human-readable time string
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format seconds into descriptive text
 */
function formatTimeDescription(seconds: number): string {
  if (seconds <= 0) return "now";

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (minutes === 0) {
    return `${secs} second${secs !== 1 ? "s" : ""}`;
  }

  if (secs === 0) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  return `${minutes} minute${minutes !== 1 ? "s" : ""} and ${secs} second${secs !== 1 ? "s" : ""}`;
}

// ============================================
// COMPONENT
// ============================================

export function SessionTimeoutWarning({
  onLogout,
  checkIntervalMs = CHECK_INTERVAL_MS,
  enabled = true,
}: SessionTimeoutWarningProps) {
  const router = useRouter();

  // State
  const [showWarning, setShowWarning] = React.useState(false);
  const [expiresIn, setExpiresIn] = React.useState(0);
  const [absoluteExpiresIn, setAbsoluteExpiresIn] = React.useState(0);
  const [isExtending, setIsExtending] = React.useState(false);
  const [extendError, setExtendError] = React.useState<string | null>(null);
  const [isExpired, setIsExpired] = React.useState(false);
  const [expiryReason, setExpiryReason] = React.useState<"sliding" | "absolute" | null>(null);

  // Refs for intervals
  const checkIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch current session status from API
   */
  const checkSessionStatus = React.useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session-status", {
        method: "GET",
        credentials: "include",
      });

      const data: SessionStatusResponse = await response.json();

      if (!response.ok) {
        // Session expired or invalid
        if (data.error?.code === "SESSION_EXPIRED" || data.error?.code === "UNAUTHORIZED") {
          setIsExpired(true);
          setShowWarning(true);
          setExpiryReason(
            data.error?.reason === "absolute"
              ? "absolute"
              : data.error?.reason === "sliding"
                ? "sliding"
                : null
          );
          return;
        }

        // No session found - user might not be logged in
        if (data.error?.code === "NO_SESSION" || data.error?.code === "NOT_FOUND") {
          // Don't show warning, just stop checking
          return;
        }

        console.error("[SessionTimeout] Status check failed:", data.error?.message);
        return;
      }

      if (data.success && data.data) {
        const { expiresIn: newExpiresIn, absoluteExpiresIn: newAbsoluteExpiresIn, warningActive } =
          data.data;

        setExpiresIn(newExpiresIn);
        setAbsoluteExpiresIn(newAbsoluteExpiresIn);

        // Show warning if within threshold
        if (warningActive || newExpiresIn <= WARNING_THRESHOLD_SECONDS) {
          setShowWarning(true);
          setIsExpired(false);
          setExpiryReason(null);
        } else {
          setShowWarning(false);
          setExtendError(null);
        }
      }
    } catch (error) {
      console.error("[SessionTimeout] Failed to check session status:", error);
    }
  }, []);

  /**
   * Extend session by calling API
   */
  const handleExtendSession = React.useCallback(async () => {
    setIsExtending(true);
    setExtendError(null);

    try {
      const response = await fetch("/api/auth/extend-session", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data: ExtendSessionResponse = await response.json();

      if (!response.ok) {
        if (data.error?.code === "ABSOLUTE_LIMIT") {
          setExtendError(
            "Your session has reached its maximum duration. Please log in again to continue."
          );
          setIsExpired(true);
          setExpiryReason("absolute");
        } else {
          setExtendError(data.error?.message || "Failed to extend session");
        }
        return;
      }

      if (data.success && data.data) {
        setExpiresIn(data.data.expiresIn);
        setAbsoluteExpiresIn(data.data.absoluteExpiresIn);

        // Hide warning if session was successfully extended and no longer in warning period
        if (!data.data.warningActive && data.data.expiresIn > WARNING_THRESHOLD_SECONDS) {
          setShowWarning(false);
          setExtendError(null);
        }
      }
    } catch (error) {
      console.error("[SessionTimeout] Failed to extend session:", error);
      setExtendError("Network error. Please check your connection and try again.");
    } finally {
      setIsExtending(false);
    }
  }, []);

  /**
   * Handle logout - redirect to login page
   */
  const handleLogout = React.useCallback(() => {
    // Clear any intervals
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Call optional callback
    onLogout?.();

    // Redirect to login
    router.push("/login?reason=session_expired");
  }, [onLogout, router]);

  /**
   * Countdown timer effect
   */
  React.useEffect(() => {
    if (showWarning && !isExpired && expiresIn > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setExpiresIn((prev) => {
          const newValue = Math.max(0, prev - 1);
          if (newValue === 0) {
            setIsExpired(true);
            setExpiryReason("sliding");
          }
          return newValue;
        });

        setAbsoluteExpiresIn((prev) => {
          const newValue = Math.max(0, prev - 1);
          if (newValue === 0 && !isExpired) {
            setIsExpired(true);
            setExpiryReason("absolute");
          }
          return newValue;
        });
      }, COUNTDOWN_INTERVAL_MS);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      };
    }
  }, [showWarning, isExpired, expiresIn]);

  /**
   * Session status check interval effect
   */
  React.useEffect(() => {
    if (!enabled) return;

    // Initial check
    checkSessionStatus();

    // Set up interval for regular checks
    checkIntervalRef.current = setInterval(checkSessionStatus, checkIntervalMs);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enabled, checkIntervalMs, checkSessionStatus]);

  /**
   * Auto-redirect when session expires
   */
  React.useEffect(() => {
    if (isExpired) {
      // Give user a moment to see the expired state before redirecting
      const timeout = setTimeout(handleLogout, 5000);
      return () => clearTimeout(timeout);
    }
  }, [isExpired, handleLogout]);

  // Don't render if disabled
  if (!enabled) {
    return null;
  }

  // Calculate progress for visual indicator
  const progressValue = isExpired
    ? 0
    : Math.min(100, (expiresIn / WARNING_THRESHOLD_SECONDS) * 100);

  // Determine which timeout is the limiting factor
  const isAbsoluteLimiting = absoluteExpiresIn < expiresIn;
  const effectiveExpiresIn = Math.min(expiresIn, absoluteExpiresIn);

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isExpired ? (
              <>
                <LogOut className="h-5 w-5 text-destructive" />
                Session Expired
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-warning" />
                Session Expiring Soon
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {isExpired ? (
                <p>
                  {expiryReason === "absolute"
                    ? "Your session has reached its maximum duration of 12 hours. For security, you will need to log in again."
                    : "Your session has expired due to inactivity. You will be redirected to the login page."}
                </p>
              ) : (
                <>
                  <p>
                    Your session will expire in{" "}
                    <strong className="text-foreground">
                      {formatTimeDescription(effectiveExpiresIn)}
                    </strong>
                    .
                    {isAbsoluteLimiting &&
                      " This is the maximum session duration and cannot be extended further."}
                  </p>

                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Time remaining</span>
                        <span className="font-mono font-medium">
                          {formatTimeRemaining(effectiveExpiresIn)}
                        </span>
                      </div>
                      <Progress value={progressValue} className="h-2" />
                    </div>
                  </div>

                  {!isAbsoluteLimiting && (
                    <p className="text-sm text-muted-foreground">
                      Click &quot;Stay Logged In&quot; to extend your session for another{" "}
                      {Math.floor(expiresIn / 60)} minutes.
                    </p>
                  )}
                </>
              )}

              {extendError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {extendError}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isExpired ? (
            <Button onClick={handleLogout} className="w-full sm:w-auto">
              Go to Login
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleLogout} disabled={isExtending}>
                Log Out
              </Button>
              {!isAbsoluteLimiting && (
                <Button onClick={handleExtendSession} loading={isExtending} disabled={isExtending}>
                  {isExtending ? "Extending..." : "Stay Logged In"}
                </Button>
              )}
              {isAbsoluteLimiting && (
                <Button onClick={handleLogout}>Acknowledge</Button>
              )}
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================
// HOOK FOR PROGRAMMATIC ACCESS
// ============================================

/**
 * Hook to access session timeout state and actions
 * Useful for integrating with other components
 */
export function useSessionTimeout(options: { checkIntervalMs?: number } = {}) {
  const { checkIntervalMs = CHECK_INTERVAL_MS } = options;

  const [status, setStatus] = React.useState<{
    isValid: boolean;
    expiresIn: number;
    absoluteExpiresIn: number;
    warningActive: boolean;
    isLoading: boolean;
    error: string | null;
  }>({
    isValid: true,
    expiresIn: 0,
    absoluteExpiresIn: 0,
    warningActive: false,
    isLoading: true,
    error: null,
  });

  const checkStatus = React.useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session-status", {
        method: "GET",
        credentials: "include",
      });

      const data: SessionStatusResponse = await response.json();

      if (!response.ok) {
        setStatus((prev) => ({
          ...prev,
          isValid: false,
          isLoading: false,
          error: data.error?.message || "Session check failed",
        }));
        return;
      }

      if (data.success && data.data) {
        setStatus({
          isValid: data.data.valid,
          expiresIn: data.data.expiresIn,
          absoluteExpiresIn: data.data.absoluteExpiresIn,
          warningActive: data.data.warningActive,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to check session status",
      }));
    }
  }, []);

  const extendSession = React.useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/extend-session", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data: ExtendSessionResponse = await response.json();

      if (!response.ok) {
        setStatus((prev) => ({
          ...prev,
          error: data.error?.message || "Failed to extend session",
        }));
        return false;
      }

      if (data.success && data.data) {
        setStatus((prev) => ({
          ...prev,
          expiresIn: data.data!.expiresIn,
          absoluteExpiresIn: data.data!.absoluteExpiresIn,
          warningActive: data.data!.warningActive,
          error: null,
        }));
        return true;
      }

      return false;
    } catch {
      setStatus((prev) => ({
        ...prev,
        error: "Network error while extending session",
      }));
      return false;
    }
  }, []);

  React.useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, checkIntervalMs);
    return () => clearInterval(interval);
  }, [checkStatus, checkIntervalMs]);

  return {
    ...status,
    checkStatus,
    extendSession,
  };
}

export default SessionTimeoutWarning;
