"use client";

/**
 * Communication Integrations Section (PX-1003)
 *
 * Displays communication platform integrations: Slack, Gmail, Outlook Mail, Teams.
 * Allows admins to enable/disable platforms for their organization.
 */

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { IntegrationCard } from "./IntegrationCard";

// ============================================
// Types
// ============================================

type CommunicationPlatform = "SLACK" | "GMAIL" | "OUTLOOK" | "TEAMS";

interface PlatformStatus {
  platform: CommunicationPlatform;
  enabled: boolean;
  configured: boolean;
  connectedUsers: number;
}

interface PlatformConfig {
  id: CommunicationPlatform;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  setupGuideUrl: string;
  // Whether this integration is fully implemented
  implemented: boolean;
}

// ============================================
// Platform Configuration
// ============================================

const COMMUNICATION_PLATFORMS: PlatformConfig[] = [
  {
    id: "SLACK",
    name: "Slack",
    description:
      "Post session summaries and action items to Slack channels.",
    icon: SlackIcon,
    color: "bg-[#4A154B]",
    setupGuideUrl: "https://api.slack.com/apps",
    implemented: true,
  },
  {
    id: "GMAIL",
    name: "Gmail",
    description:
      "Send follow-up emails and meeting summaries via Gmail.",
    icon: GmailIcon,
    color: "bg-[#EA4335]",
    setupGuideUrl: "https://console.cloud.google.com/apis/credentials",
    implemented: false, // Wave 1 but not first priority
  },
  {
    id: "OUTLOOK",
    name: "Outlook Mail",
    description:
      "Send follow-up emails and summaries via Outlook.",
    icon: OutlookIcon,
    color: "bg-[#0078D4]",
    setupGuideUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
    implemented: false, // Wave 1 but not first priority
  },
  {
    id: "TEAMS",
    name: "Microsoft Teams",
    description:
      "Post summaries and updates to Teams channels.",
    icon: TeamsIcon,
    color: "bg-[#6264A7]",
    setupGuideUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
    implemented: false, // Wave 1 but not first priority
  },
];

// ============================================
// Main Component
// ============================================

export function CommunicationSection() {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<CommunicationPlatform | null>(null);

  const { toast } = useToast();

  const fetchPlatforms = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/integration-platforms?category=COMMUNICATION");
      if (response.ok) {
        const data = await response.json();
        setPlatforms(data.platforms || []);
      }
    } catch (error) {
      console.error("Failed to fetch communication platforms:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  async function handleToggle(platform: CommunicationPlatform, enabled: boolean) {
    setUpdating(platform);

    try {
      const response = await fetch("/api/admin/integration-platforms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, enabled, category: "COMMUNICATION" }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const platformName = COMMUNICATION_PLATFORMS.find((p) => p.id === platform)?.name || platform;
        toast({
          title: enabled ? "Platform enabled" : "Platform disabled",
          description: enabled
            ? `${platformName} is now available for users to connect.`
            : `${platformName} has been disabled.`,
        });
        fetchPlatforms();
      } else {
        throw new Error(data.error?.message || "Failed to update platform");
      }
    } catch (error) {
      console.error("Failed to toggle platform:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update platform",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Communication</h3>
          <p className="text-sm text-muted-foreground">
            Post summaries and updates to messaging platforms
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Communication</h3>
        <p className="text-sm text-muted-foreground">
          Post summaries and updates to messaging platforms
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {COMMUNICATION_PLATFORMS.map((config) => {
          const status = platforms.find((p) => p.platform === config.id);
          const isEnabled = status?.enabled ?? false;
          const isConfigured = status?.configured ?? false;
          const connectedUsers = status?.connectedUsers ?? 0;
          const isUpdating = updating === config.id;

          // If not implemented, show as coming soon
          if (!config.implemented) {
            return (
              <IntegrationCard
                key={config.id}
                id={config.id}
                name={config.name}
                description={config.description}
                icon={config.icon}
                color={config.color}
                status="coming_soon"
              />
            );
          }

          return (
            <IntegrationCard
              key={config.id}
              id={config.id}
              name={config.name}
              description={config.description}
              icon={config.icon}
              color={config.color}
              status={isConfigured ? "available" : "not_configured"}
              enabled={isEnabled}
              connectedUsers={connectedUsers}
              onToggleEnabled={(enabled) => handleToggle(config.id, enabled)}
              isToggling={isUpdating}
              setupGuideUrl={config.setupGuideUrl}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Platform Icons
// ============================================

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function GmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.154-.352.23-.58.23h-8.547v-6.959l1.6 1.18c.08.06.166.09.26.09.096 0 .18-.03.254-.09l6.87-5.14c.104-.074.196-.112.28-.112.104 0 .19.04.254.114.063.074.092.166.092.275l-.002.003-.043.055v-.7zm-.238-1.544c.158.152.238.346.238.576v.166l-7.31 5.476-1.97-1.453V5.843h8.461c.229 0 .423.076.581.23v-.23zM14.182 5.843v6.959l-1.971 1.453L5.4 8.13a.508.508 0 0 1-.238-.41V5.843h9.02zM0 7.752A2.75 2.75 0 0 1 2.75 5h11.432v16H2.75A2.75 2.75 0 0 1 0 18.25V7.752zM2.4 12a3.6 3.6 0 1 0 7.2 0 3.6 3.6 0 0 0-7.2 0zm1.2 0a2.4 2.4 0 1 1 4.8 0 2.4 2.4 0 0 1-4.8 0z" />
    </svg>
  );
}

function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.625 8.25h-6c-.621 0-1.125.504-1.125 1.125v6c0 .621.504 1.125 1.125 1.125h6c.621 0 1.125-.504 1.125-1.125v-6c0-.621-.504-1.125-1.125-1.125zm-3 1.875a1.125 1.125 0 1 1 0 2.25 1.125 1.125 0 0 1 0-2.25zm2.25 4.125h-4.5v-.375c0-.828 1.007-1.5 2.25-1.5s2.25.672 2.25 1.5v.375zM16.5 6.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5zM9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5.25 10.5A2.25 2.25 0 0 0 3 12.75v6c0 1.243 1.007 2.25 2.25 2.25h7.5A2.25 2.25 0 0 0 15 18.75v-6a2.25 2.25 0 0 0-2.25-2.25h-7.5z" />
    </svg>
  );
}
