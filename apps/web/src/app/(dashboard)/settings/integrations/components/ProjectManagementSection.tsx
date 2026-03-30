"use client";

/**
 * Project Management Integrations Section (PX-1003)
 *
 * Displays project management platform integrations: Asana, Monday.com.
 * Allows admins to enable/disable platforms for their organization.
 *
 * Note: Linear, Notion, and Jira are in the AdminWorkflowPlatformsSection.
 */

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { IntegrationCard } from "./IntegrationCard";

// ============================================
// Types
// ============================================

type ProjectManagementPlatform = "ASANA" | "MONDAY";

interface PlatformStatus {
  platform: ProjectManagementPlatform;
  enabled: boolean;
  configured: boolean;
  connectedUsers: number;
}

interface PlatformConfig {
  id: ProjectManagementPlatform;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  setupGuideUrl: string;
  implemented: boolean;
}

// ============================================
// Platform Configuration
// ============================================

const PROJECT_MANAGEMENT_PLATFORMS: PlatformConfig[] = [
  {
    id: "ASANA",
    name: "Asana",
    description:
      "Push action items and tasks to Asana projects.",
    icon: AsanaIcon,
    color: "bg-[#F06A6A]",
    setupGuideUrl: "https://developers.asana.com/docs/getting-started",
    implemented: false, // Wave 1 - to be implemented
  },
  {
    id: "MONDAY",
    name: "Monday.com",
    description:
      "Create tasks and update project boards in Monday.com.",
    icon: MondayIcon,
    color: "bg-[#0055CC]",
    setupGuideUrl: "https://developer.monday.com/apps/",
    implemented: false, // Wave 1 - to be implemented
  },
];

// ============================================
// Main Component
// ============================================

export function ProjectManagementSection() {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<ProjectManagementPlatform | null>(null);

  const { toast } = useToast();

  const fetchPlatforms = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/integration-platforms?category=PROJECT_MGMT");
      if (response.ok) {
        const data = await response.json();
        setPlatforms(data.platforms || []);
      }
    } catch (error) {
      console.error("Failed to fetch project management platforms:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  async function handleToggle(platform: ProjectManagementPlatform, enabled: boolean) {
    setUpdating(platform);

    try {
      const response = await fetch("/api/admin/integration-platforms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, enabled, category: "PROJECT_MGMT" }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const platformName = PROJECT_MANAGEMENT_PLATFORMS.find((p) => p.id === platform)?.name || platform;
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
          <h3 className="text-lg font-medium">Additional Project Management</h3>
          <p className="text-sm text-muted-foreground">
            Push action items to additional project management tools
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2].map((i) => (
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
        <h3 className="text-lg font-medium">Additional Project Management</h3>
        <p className="text-sm text-muted-foreground">
          Push action items to additional project management tools
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {PROJECT_MANAGEMENT_PLATFORMS.map((config) => {
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

function AsanaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.79 12.69c-2.88 0-5.21 2.33-5.21 5.21S15.91 23.1 18.79 23.1 24 20.78 24 17.9s-2.33-5.21-5.21-5.21zm-13.57 0c-2.88 0-5.21 2.33-5.21 5.21S2.34 23.1 5.22 23.1s5.21-2.33 5.21-5.21-2.34-5.2-5.21-5.2zm6.78-7.48c2.88 0 5.21-2.33 5.21-5.21S14.88 0 12 0 6.79 2.33 6.79 5.21s2.33 5.21 5.21 5.21v-.01z" />
    </svg>
  );
}

function MondayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.04 12.02c0-1.18.52-2.24 1.34-2.96.18-.68.66-1.28 1.36-1.6.28-1.12 1.06-2.02 2.1-2.42C7.7 3.8 9.02 3.02 10.5 3.02c.94 0 1.82.3 2.54.82.72-.52 1.6-.82 2.54-.82 1.48 0 2.8.78 3.66 2.02 1.04.4 1.82 1.3 2.1 2.42.7.32 1.18.92 1.36 1.6.82.72 1.34 1.78 1.34 2.96 0 1.18-.52 2.24-1.34 2.96-.18.68-.66 1.28-1.36 1.6-.28 1.12-1.06 2.02-2.1 2.42-.86 1.24-2.18 2.02-3.66 2.02-.94 0-1.82-.3-2.54-.82-.72.52-1.6.82-2.54.82-1.48 0-2.8-.78-3.66-2.02-1.04-.4-1.82-1.3-2.1-2.42-.7-.32-1.18-.92-1.36-1.6-.82-.72-1.34-1.78-1.34-2.96zm4.06 0c0 .94.76 1.7 1.7 1.7s1.7-.76 1.7-1.7-.76-1.7-1.7-1.7-1.7.76-1.7 1.7zm6.2 0c0 .94.76 1.7 1.7 1.7s1.7-.76 1.7-1.7-.76-1.7-1.7-1.7-1.7.76-1.7 1.7z" />
    </svg>
  );
}
