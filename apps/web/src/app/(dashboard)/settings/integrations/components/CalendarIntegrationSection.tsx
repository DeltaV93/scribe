"use client";

/**
 * Calendar Integration Section Component
 *
 * Main component for managing calendar integrations in the settings page.
 * Handles:
 * - Displaying connection status (connected/disconnected)
 * - Provider selection buttons for Google, Outlook, Apple
 * - Connected account details and settings
 * - OAuth callback handling via URL params
 * - Error states with reconnect prompts
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, AlertCircle, RefreshCw } from "lucide-react";
import {
  CalendarProviderButton,
  CalendarProvider,
} from "./CalendarProviderButton";
import { ConnectedCalendarCard } from "./ConnectedCalendarCard";

interface CalendarIntegrationResponse {
  connected: boolean;
  provider?: CalendarProvider;
  email?: string;
  status: "ACTIVE" | "ERROR" | "DISCONNECTED";
  clientAutoInvite: boolean;
  connectedAt?: string;
  lastSyncAt?: string;
  error?: string;
  availableProviders: Array<{
    provider: CalendarProvider;
    configured: boolean;
  }>;
}

export function CalendarIntegrationSection() {
  const [integration, setIntegration] =
    useState<CalendarIntegrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<CalendarProvider | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [updatingSetting, setUpdatingSetting] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  // Fetch integration status
  const fetchIntegration = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/calendar");
      const data = await response.json();

      if (response.ok) {
        setIntegration(data);
      } else {
        throw new Error(data.error || "Failed to fetch calendar integration");
      }
    } catch (error) {
      console.error("Failed to fetch calendar integration:", error);
      toast({
        title: "Error",
        description: "Failed to load calendar integration status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch on mount
  useEffect(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  // Handle OAuth callback params
  useEffect(() => {
    const connected = searchParams.get("calendar_connected");
    const provider = searchParams.get("calendar_provider");
    const email = searchParams.get("calendar_email");
    const error = searchParams.get("calendar_error");

    if (connected === "true" && provider) {
      toast({
        title: "Calendar connected",
        description: `${getProviderName(provider as CalendarProvider)}${
          email ? ` (${email})` : ""
        } has been connected successfully.`,
      });
      // Clear query params and refresh data
      router.replace("/settings/integrations");
      fetchIntegration();
    } else if (error) {
      toast({
        title: "Connection failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      router.replace("/settings/integrations");
    }
  }, [searchParams, router, toast, fetchIntegration]);

  function getProviderName(provider: CalendarProvider): string {
    const names: Record<CalendarProvider, string> = {
      GOOGLE: "Google Calendar",
      OUTLOOK: "Outlook Calendar",
      APPLE: "Apple Calendar",
    };
    return names[provider] || provider;
  }

  async function handleConnect(provider: CalendarProvider) {
    setConnecting(provider);

    try {
      const response = await fetch(
        `/api/integrations/calendar/authorize?provider=${provider.toLowerCase()}`
      );
      const data = await response.json();

      if (response.ok && data.authorizationUrl) {
        // Redirect to OAuth URL in same window
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error(data.error || "Failed to start authorization");
      }
    } catch (error) {
      console.error("Failed to initiate OAuth:", error);
      toast({
        title: "Connection failed",
        description:
          error instanceof Error ? error.message : "Failed to connect",
        variant: "destructive",
      });
      setConnecting(null);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);

    try {
      const response = await fetch("/api/integrations/calendar", {
        method: "DELETE",
      });
      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Calendar disconnected",
          description: "Your calendar has been disconnected successfully.",
        });
        fetchIntegration();
      } else {
        throw new Error(data.error || "Failed to disconnect");
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast({
        title: "Error",
        description: "Failed to disconnect calendar",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSettingChange(setting: string, value: boolean) {
    setUpdatingSetting(true);

    try {
      const response = await fetch("/api/integrations/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [setting]: value }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        fetchIntegration();
      } else {
        throw new Error(data.error || "Failed to update setting");
      }
    } catch (error) {
      console.error("Failed to update setting:", error);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      });
    } finally {
      setUpdatingSetting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Connected state
  if (integration?.connected && integration.provider && integration.email) {
    return (
      <ConnectedCalendarCard
        provider={integration.provider}
        email={integration.email}
        status={integration.status}
        connectedAt={integration.connectedAt}
        lastSyncAt={integration.lastSyncAt}
        error={integration.error}
        clientAutoInvite={integration.clientAutoInvite}
        onDisconnect={handleDisconnect}
        onSettingChange={handleSettingChange}
        isDisconnecting={disconnecting}
        isUpdatingSetting={updatingSetting}
      />
    );
  }

  // Disconnected state - show provider selection
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Calendar Integration</CardTitle>
            <CardDescription>
              Connect your calendar to schedule appointments and automatically
              invite clients to events.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Error state with reconnect prompt */}
        {integration?.status === "ERROR" && integration.error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm mb-4">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Previous connection failed</p>
              <p className="mt-1">{integration.error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => fetchIntegration()}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Provider buttons */}
        {integration?.availableProviders.map(({ provider, configured }) => (
          <CalendarProviderButton
            key={provider}
            provider={provider}
            configured={configured}
            loading={connecting === provider}
            onClick={() => handleConnect(provider)}
          />
        ))}

        {/* No providers configured message */}
        {integration?.availableProviders.every((p) => !p.configured) && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No calendar providers are configured. Contact your administrator to
            enable calendar integrations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
