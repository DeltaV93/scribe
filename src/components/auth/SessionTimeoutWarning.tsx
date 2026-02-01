"use client";

/**
 * Session Timeout Warning Modal
 *
 * Displays a warning modal when the session is about to expire.
 * Shows countdown timer and allows user to extend their session.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, LogOut, RefreshCw } from "lucide-react";
import { formatRemainingTime } from "@/lib/auth/session/activity-tracker";
import { DEFAULT_SESSION_CONFIG } from "@/lib/auth/session/types";

interface SessionTimeoutWarningProps {
  /** Whether the warning should be shown */
  isOpen: boolean;
  /** Remaining seconds until session expires */
  remainingSeconds: number;
  /** Callback to extend the session */
  onExtendSession: () => Promise<void>;
  /** Callback when user chooses to log out */
  onLogout: () => void;
  /** Callback when session expires */
  onExpired: () => void;
}

export function SessionTimeoutWarning({
  isOpen,
  remainingSeconds,
  onExtendSession,
  onLogout,
  onExpired,
}: SessionTimeoutWarningProps) {
  const [isExtending, setIsExtending] = useState(false);
  const [countdown, setCountdown] = useState(remainingSeconds);

  // Update countdown
  useEffect(() => {
    setCountdown(remainingSeconds);
  }, [remainingSeconds]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, countdown, onExpired]);

  const handleExtendSession = useCallback(async () => {
    setIsExtending(true);
    try {
      await onExtendSession();
    } finally {
      setIsExtending(false);
    }
  }, [onExtendSession]);

  // Calculate progress (warning shows for last 5 minutes = 300 seconds)
  const warningDuration = DEFAULT_SESSION_CONFIG.warningMinutes * 60;
  const progressPercent = Math.max(0, (countdown / warningDuration) * 100);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl">Session Expiring Soon</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-base">
            Your session will expire due to inactivity. Click &ldquo;Stay Signed In&rdquo; to continue
            working, or you will be automatically logged out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Countdown Display */}
          <div className="flex items-center justify-center gap-3 rounded-lg bg-muted p-4">
            <Clock className="h-6 w-6 text-muted-foreground" />
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums">
                {formatRemainingTime(countdown)}
              </div>
              <div className="text-sm text-muted-foreground">until logout</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div
              className={`h-2 w-full overflow-hidden rounded-full bg-secondary`}
            >
              <div
                className={`h-full transition-all ${
                  countdown <= 60
                    ? "bg-red-500"
                    : countdown <= 120
                    ? "bg-amber-500"
                    : "bg-amber-400"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {countdown <= 60
                ? "Session expiring very soon!"
                : countdown <= 120
                ? "Less than 2 minutes remaining"
                : "Session will expire soon"}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onLogout}
            disabled={isExtending}
            className="w-full sm:w-auto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out Now
          </Button>
          <Button
            onClick={handleExtendSession}
            disabled={isExtending}
            className="w-full sm:w-auto"
          >
            {isExtending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Extending...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Stay Signed In
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// SESSION EXPIRED MODAL
// ============================================

interface SessionExpiredModalProps {
  isOpen: boolean;
  onLogin: () => void;
}

export function SessionExpiredModal({ isOpen, onLogin }: SessionExpiredModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-xl">Session Expired</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-base">
            Your session has expired due to inactivity. Please log in again to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg bg-muted p-4 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              For your security, we automatically log you out after a period of inactivity.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onLogin} className="w-full">
            Log In Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// SESSION TIMEOUT PROVIDER
// ============================================

import { createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useActivityTracker } from "@/lib/auth/session/activity-tracker";

interface SessionTimeoutContextValue {
  remainingSeconds: number;
  isExpiringSoon: boolean;
  extendSession: () => Promise<void>;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextValue | null>(null);

interface SessionTimeoutProviderProps {
  children: ReactNode;
  sessionId?: string;
}

export function SessionTimeoutProvider({
  children,
  sessionId,
}: SessionTimeoutProviderProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [showExpired, setShowExpired] = useState(false);

  const handleSessionExpiring = useCallback((remaining: number) => {
    if (remaining <= DEFAULT_SESSION_CONFIG.warningMinutes * 60) {
      setShowWarning(true);
    }
  }, []);

  const handleSessionExpired = useCallback(() => {
    setShowWarning(false);
    setShowExpired(true);
  }, []);

  const {
    timeoutStatus,
    refreshSession,
    isSessionValid,
  } = useActivityTracker({
    enabled: !!sessionId,
    sessionId,
    onSessionExpiring: handleSessionExpiring,
    onSessionExpired: handleSessionExpired,
  });

  const handleExtendSession = useCallback(async () => {
    await refreshSession();
    setShowWarning(false);
  }, [refreshSession]);

  const handleLogout = useCallback(() => {
    setShowWarning(false);
    router.push("/login");
  }, [router]);

  const handleLogin = useCallback(() => {
    setShowExpired(false);
    router.push("/login");
  }, [router]);

  // Close warning if session becomes valid again
  useEffect(() => {
    if (isSessionValid && !timeoutStatus.shouldShowWarning) {
      setShowWarning(false);
    }
  }, [isSessionValid, timeoutStatus.shouldShowWarning]);

  return (
    <SessionTimeoutContext.Provider
      value={{
        remainingSeconds: timeoutStatus.remainingSeconds,
        isExpiringSoon: timeoutStatus.isExpiringSoon,
        extendSession: handleExtendSession,
      }}
    >
      {children}

      <SessionTimeoutWarning
        isOpen={showWarning}
        remainingSeconds={timeoutStatus.remainingSeconds}
        onExtendSession={handleExtendSession}
        onLogout={handleLogout}
        onExpired={handleSessionExpired}
      />

      <SessionExpiredModal isOpen={showExpired} onLogin={handleLogin} />
    </SessionTimeoutContext.Provider>
  );
}

export function useSessionTimeout(): SessionTimeoutContextValue {
  const context = useContext(SessionTimeoutContext);

  if (!context) {
    throw new Error(
      "useSessionTimeout must be used within a SessionTimeoutProvider"
    );
  }

  return context;
}
