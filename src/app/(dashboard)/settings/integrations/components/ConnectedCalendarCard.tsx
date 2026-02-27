"use client";

/**
 * Connected Calendar Card Component
 *
 * Displays information about a connected calendar account including:
 * - Provider logo and name
 * - Connected email address
 * - Connection timestamp and status
 * - Settings form with auto-invite toggle
 * - Disconnect button with confirmation
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { Calendar, Mail, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { CalendarProvider, PROVIDER_CONFIG } from "./CalendarProviderButton";

interface ConnectedCalendarCardProps {
  provider: CalendarProvider;
  email: string;
  status: "ACTIVE" | "ERROR" | "DISCONNECTED";
  connectedAt?: string;
  lastSyncAt?: string;
  error?: string;
  clientAutoInvite: boolean;
  onDisconnect: () => Promise<void>;
  onSettingChange: (setting: string, value: boolean) => Promise<void>;
  isDisconnecting: boolean;
  isUpdatingSetting: boolean;
}

export function ConnectedCalendarCard({
  provider,
  email,
  status,
  connectedAt,
  lastSyncAt,
  error,
  clientAutoInvite,
  onDisconnect,
  onSettingChange,
  isDisconnecting,
  isUpdatingSetting,
}: ConnectedCalendarCardProps) {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const config = PROVIDER_CONFIG[provider];
  const Icon = config.icon;

  function getStatusBadge(status: "ACTIVE" | "ERROR" | "DISCONNECTED") {
    const variants: Record<typeof status, "default" | "destructive" | "outline"> = {
      ACTIVE: "default",
      ERROR: "destructive",
      DISCONNECTED: "outline",
    };

    const labels: Record<typeof status, string> = {
      ACTIVE: "Connected",
      ERROR: "Error",
      DISCONNECTED: "Disconnected",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  }

  function formatDate(dateString?: string) {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleDisconnect() {
    await onDisconnect();
    setShowDisconnectDialog(false);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg">{config.name}</CardTitle>
                <CardDescription className="flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  {email}
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error State */}
          {status === "ERROR" && error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Connection Error</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor="client-auto-invite"
                  className="text-sm font-medium"
                >
                  Auto-invite clients to events
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically add clients as attendees when creating calendar events
                </p>
              </div>
              <Switch
                id="client-auto-invite"
                checked={clientAutoInvite}
                onCheckedChange={(value) =>
                  onSettingChange("clientAutoInvite", value)
                }
                disabled={isUpdatingSetting || status !== "ACTIVE"}
              />
            </div>
          </div>

          <Separator />

          {/* Connection Info */}
          <div className="text-sm text-muted-foreground space-y-1.5">
            {connectedAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Connected: {formatDate(connectedAt)}</span>
              </div>
            )}
            {lastSyncAt && (
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Last sync: {formatDate(lastSyncAt)}</span>
              </div>
            )}
          </div>

          {/* Disconnect Button */}
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setShowDisconnectDialog(true)}
            disabled={isDisconnecting}
            loading={isDisconnecting}
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect Calendar"}
          </Button>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Calendar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect {config.name} ({email})? This
              will remove access to your calendar and disable auto-invite
              functionality.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
