"use client";

/**
 * Active Sessions Management UI
 *
 * Displays and manages user's active sessions across devices.
 * Allows terminating individual sessions or all other sessions.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  MapPin,
  LogOut,
  ShieldAlert,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { type SessionSummary, type DeviceInfo } from "@/lib/auth/session/types";
import { formatDistanceToNow } from "date-fns";

interface ActiveSessionsProps {
  /** Current user's session ID */
  currentSessionId?: string;
}

export function ActiveSessions({ currentSessionId }: ActiveSessionsProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTerminating, setIsTerminating] = useState<string | null>(null);
  const [sessionToTerminate, setSessionToTerminate] = useState<SessionSummary | null>(null);
  const [showTerminateAllDialog, setShowTerminateAllDialog] = useState(false);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/auth/sessions");
      const data = await response.json();

      if (data.success) {
        setSessions(data.data.sessions);
      } else {
        toast.error("Failed to load sessions");
      }
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Terminate a single session
  const handleTerminateSession = async (sessionId: string) => {
    setIsTerminating(sessionId);
    try {
      const response = await fetch(`/api/auth/sessions?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        toast.success("Session terminated successfully");
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        toast.error(data.error?.message || "Failed to terminate session");
      }
    } catch {
      toast.error("Failed to terminate session");
    } finally {
      setIsTerminating(null);
      setSessionToTerminate(null);
    }
  };

  // Terminate all other sessions
  const handleTerminateAll = async () => {
    setIsTerminating("all");
    try {
      const response = await fetch("/api/auth/sessions?all=true", {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        toast.success(`Terminated ${data.data.terminatedCount} other sessions`);
        setSessions((prev) => prev.filter((s) => s.isCurrent));
      } else {
        toast.error(data.error?.message || "Failed to terminate sessions");
      }
    } catch {
      toast.error("Failed to terminate sessions");
    } finally {
      setIsTerminating(null);
      setShowTerminateAllDialog(false);
    }
  };

  const getDeviceIcon = (deviceInfo: DeviceInfo) => {
    switch (deviceInfo.device) {
      case "Mobile":
        return <Smartphone className="h-5 w-5" />;
      case "Tablet":
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage your active sessions across devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              {sessions.length} active session{sessions.length !== 1 ? "s" : ""} across your
              devices
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {otherSessionsCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowTerminateAllDialog(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out All Others
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No active sessions found
            </p>
          ) : (
            sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isCurrentSession={session.isCurrent}
                isTerminating={isTerminating === session.id}
                onTerminate={() => setSessionToTerminate(session)}
                deviceIcon={getDeviceIcon(session.deviceInfo)}
              />
            ))
          )}
        </div>
      </CardContent>

      {/* Terminate Single Session Dialog */}
      <AlertDialog
        open={!!sessionToTerminate}
        onOpenChange={() => setSessionToTerminate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately sign out the session on{" "}
              <strong>
                {sessionToTerminate?.deviceInfo.device} ({sessionToTerminate?.deviceInfo.browser})
              </strong>
              . Any unsaved work on that device will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToTerminate && handleTerminateSession(sessionToTerminate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Terminate Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate All Sessions Dialog */}
      <AlertDialog open={showTerminateAllDialog} onOpenChange={setShowTerminateAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out All Other Sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately sign out {otherSessionsCount} other session
              {otherSessionsCount !== 1 ? "s" : ""} on your other devices. Any unsaved work on
              those devices will be lost. Your current session will remain active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTerminateAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isTerminating === "all" ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Signing Out...
                </>
              ) : (
                "Sign Out All Others"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ============================================
// SESSION CARD COMPONENT
// ============================================

interface SessionCardProps {
  session: SessionSummary;
  isCurrentSession: boolean;
  isTerminating: boolean;
  onTerminate: () => void;
  deviceIcon: React.ReactNode;
}

function SessionCard({
  session,
  isCurrentSession,
  isTerminating,
  onTerminate,
  deviceIcon,
}: SessionCardProps) {
  const { deviceInfo, ipAddress, lastActivity, createdAt } = session;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isCurrentSession ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isCurrentSession
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {deviceIcon}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {deviceInfo.browser} on {deviceInfo.os}
              </span>
              {isCurrentSession && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Current
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                {ipAddress}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {deviceInfo.device}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last active {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
              </span>
              <span>Started {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>

        {!isCurrentSession && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onTerminate}
            disabled={isTerminating}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {isTerminating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPACT SESSION INDICATOR
// ============================================

interface SessionIndicatorProps {
  sessionCount: number;
  onClick?: () => void;
}

export function SessionIndicator({ sessionCount, onClick }: SessionIndicatorProps) {
  if (sessionCount <= 1) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
    >
      <Monitor className="h-3.5 w-3.5" />
      {sessionCount} active sessions
    </button>
  );
}
