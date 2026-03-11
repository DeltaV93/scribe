"use client";

/**
 * Integrations Content Component
 *
 * Client component for displaying and managing meeting integrations.
 */

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { useToast } from "@/components/ui/use-toast";

// Platform configuration
const PLATFORMS = [
  {
    id: "TEAMS",
    name: "Microsoft Teams",
    description:
      "Automatically capture recordings from Teams meetings. Requires Microsoft 365 admin consent.",
    icon: TeamsIcon,
    color: "bg-[#6264A7]",
  },
  {
    id: "ZOOM",
    name: "Zoom",
    description:
      "Capture cloud recordings from Zoom meetings. Requires Zoom Pro account or higher.",
    icon: ZoomIcon,
    color: "bg-[#2D8CFF]",
  },
  {
    id: "GOOGLE_MEET",
    name: "Google Meet",
    description:
      "Capture recordings from Google Meet via Google Workspace. Requires admin consent.",
    icon: GoogleMeetIcon,
    color: "bg-[#00897B]",
  },
];

interface Integration {
  id: string;
  platform: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "ERROR" | "DISCONNECTED";
  autoRecordEnabled: boolean;
  syncCalendarEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  connectedAt: string;
}

export function IntegrationsContent() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [platformToDisconnect, setPlatformToDisconnect] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  // Fetch integrations on mount
  useEffect(() => {
    fetchIntegrations();
  }, []);

  // Handle success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const platform = searchParams.get("platform");

    if (success === "true" && platform) {
      toast({
        title: "Connected successfully",
        description: `${getPlatformName(platform)} has been connected.`,
      });
      // Clear query params
      router.replace("/settings/integrations");
      fetchIntegrations();
    } else if (error) {
      toast({
        title: "Connection failed",
        description: error,
        variant: "destructive",
      });
      router.replace("/settings/integrations");
    }
  }, [searchParams, router, toast]);

  async function fetchIntegrations() {
    try {
      const response = await fetch("/api/integrations/meetings");
      const data = await response.json();

      if (data.success) {
        setIntegrations(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(platform: string) {
    setConnecting(platform);

    try {
      const response = await fetch("/api/integrations/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          redirectUrl: "/settings/integrations",
        }),
      });

      const data = await response.json();

      if (data.success && data.data.authUrl) {
        // Redirect to OAuth URL
        window.location.href = data.data.authUrl;
      } else {
        throw new Error(data.error?.message || "Failed to start connection");
      }
    } catch (error) {
      console.error("Failed to initiate OAuth:", error);
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect",
        variant: "destructive",
      });
      setConnecting(null);
    }
  }

  async function handleDisconnect(platform: string) {
    setDisconnecting(platform);

    try {
      const response = await fetch(
        `/api/integrations/meetings/${platform.toLowerCase().replace("_", "-")}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Disconnected",
          description: `${getPlatformName(platform)} has been disconnected.`,
        });
        fetchIntegrations();
      } else {
        throw new Error(data.error?.message || "Failed to disconnect");
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast({
        title: "Error",
        description: "Failed to disconnect integration",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(null);
      setShowDisconnectDialog(false);
      setPlatformToDisconnect(null);
    }
  }

  async function handleSettingChange(
    platform: string,
    setting: string,
    value: boolean
  ) {
    try {
      const response = await fetch(
        `/api/integrations/meetings/${platform.toLowerCase().replace("_", "-")}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [setting]: value }),
        }
      );

      const data = await response.json();

      if (data.success) {
        fetchIntegrations();
      } else {
        throw new Error(data.error?.message || "Failed to update setting");
      }
    } catch (error) {
      console.error("Failed to update setting:", error);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      });
    }
  }

  function getIntegrationForPlatform(platformId: string): Integration | undefined {
    return integrations.find((i) => i.platform === platformId);
  }

  function getPlatformName(platformId: string): string {
    return PLATFORMS.find((p) => p.id === platformId)?.name || platformId;
  }

  function getStatusBadge(status: Integration["status"]) {
    const variants: Record<Integration["status"], "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      PENDING: "secondary",
      EXPIRED: "destructive",
      ERROR: "destructive",
      DISCONNECTED: "outline",
    };

    const labels: Record<Integration["status"], string> = {
      ACTIVE: "Connected",
      PENDING: "Pending",
      EXPIRED: "Expired",
      ERROR: "Error",
      DISCONNECTED: "Disconnected",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  }

  if (loading) {
    return null; // Handled by Suspense
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const integration = getIntegrationForPlatform(platform.id);
          const isConnected = integration?.status === "ACTIVE";
          const isConnecting = connecting === platform.id;
          const Icon = platform.icon;

          return (
            <Card key={platform.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div
                    className={`w-12 h-12 rounded-lg ${platform.color} flex items-center justify-center`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  {integration && getStatusBadge(integration.status)}
                </div>
                <CardTitle className="mt-4">{platform.name}</CardTitle>
                <CardDescription>{platform.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isConnected && integration ? (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${platform.id}-auto-record`} className="text-sm">
                          Auto-capture recordings
                        </Label>
                        <Switch
                          id={`${platform.id}-auto-record`}
                          checked={integration.autoRecordEnabled}
                          onCheckedChange={(value) =>
                            handleSettingChange(platform.id, "autoRecordEnabled", value)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${platform.id}-sync-calendar`} className="text-sm">
                          Sync calendar events
                        </Label>
                        <Switch
                          id={`${platform.id}-sync-calendar`}
                          checked={integration.syncCalendarEnabled}
                          onCheckedChange={(value) =>
                            handleSettingChange(platform.id, "syncCalendarEnabled", value)
                          }
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="text-sm text-muted-foreground">
                      {integration.lastSyncAt ? (
                        <p>
                          Last sync:{" "}
                          {new Date(integration.lastSyncAt).toLocaleDateString()}
                        </p>
                      ) : (
                        <p>No recordings synced yet</p>
                      )}
                      {integration.lastError && (
                        <p className="text-destructive mt-1">
                          Error: {integration.lastError}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setPlatformToDisconnect(platform.id);
                        setShowDisconnectDialog(true);
                      }}
                      disabled={disconnecting === platform.id}
                    >
                      {disconnecting === platform.id ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleConnect(platform.id)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Integration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect{" "}
              {platformToDisconnect ? getPlatformName(platformToDisconnect) : "this integration"}?
              This will stop automatic recording capture from this platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => platformToDisconnect && handleDisconnect(platformToDisconnect)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Platform Icons
function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.7 3.6H16v2.1h1.6v8.7h-2.8v-6c0-.5-.4-.9-.9-.9H9.5c-.5 0-.9.4-.9.9v6H5.8V5.7h1.6V3.6H4.3c-.8 0-1.5.7-1.5 1.5v13.8c0 .8.7 1.5 1.5 1.5h15.4c.8 0 1.5-.7 1.5-1.5V5.1c0-.8-.7-1.5-1.5-1.5zm-8.8 10.8h2.1v-4.2h-2.1v4.2z" />
    </svg>
  );
}

function ZoomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 14H7c-.55 0-1-.45-1-1V9c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1zm6.5-1c0 .55-.45 1-1 1h-.5l-2-1.5V9.5l2-1.5h.5c.55 0 1 .45 1 1v6z" />
    </svg>
  );
}

function GoogleMeetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}
