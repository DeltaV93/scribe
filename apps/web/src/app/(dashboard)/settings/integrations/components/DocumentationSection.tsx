"use client";

/**
 * Documentation Integrations Section (PX-1003)
 *
 * Displays documentation platform integrations: Google Docs, Confluence.
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

type DocumentationPlatform = "GOOGLE_DOCS" | "CONFLUENCE";

interface PlatformStatus {
  platform: DocumentationPlatform;
  enabled: boolean;
  configured: boolean;
  connectedUsers: number;
}

interface PlatformConfig {
  id: DocumentationPlatform;
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

const DOCUMENTATION_PLATFORMS: PlatformConfig[] = [
  {
    id: "GOOGLE_DOCS",
    name: "Google Docs",
    description:
      "Export meeting notes and summaries to Google Docs.",
    icon: GoogleDocsIcon,
    color: "bg-[#4285F4]",
    setupGuideUrl: "https://console.cloud.google.com/apis/credentials",
    implemented: false, // Wave 1 - to be implemented
  },
  {
    id: "CONFLUENCE",
    name: "Confluence",
    description:
      "Push documentation and meeting notes to Confluence spaces.",
    icon: ConfluenceIcon,
    color: "bg-[#0052CC]",
    setupGuideUrl: "https://developer.atlassian.com/console/myapps/",
    implemented: false, // Wave 1 - to be implemented
  },
];

// ============================================
// Main Component
// ============================================

export function DocumentationSection() {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<DocumentationPlatform | null>(null);

  const { toast } = useToast();

  const fetchPlatforms = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/integration-platforms?category=DOCUMENTATION");
      if (response.ok) {
        const data = await response.json();
        setPlatforms(data.platforms || []);
      }
    } catch (error) {
      console.error("Failed to fetch documentation platforms:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  async function handleToggle(platform: DocumentationPlatform, enabled: boolean) {
    setUpdating(platform);

    try {
      const response = await fetch("/api/admin/integration-platforms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, enabled, category: "DOCUMENTATION" }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const platformName = DOCUMENTATION_PLATFORMS.find((p) => p.id === platform)?.name || platform;
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
          <h3 className="text-lg font-medium">Documentation</h3>
          <p className="text-sm text-muted-foreground">
            Export meeting notes and documentation to external tools
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
        <h3 className="text-lg font-medium">Documentation</h3>
        <p className="text-sm text-muted-foreground">
          Export meeting notes and documentation to external tools
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {DOCUMENTATION_PLATFORMS.map((config) => {
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

function GoogleDocsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.727 6.727H14V0H4.91c-.906 0-1.637.732-1.637 1.636v20.728c0 .904.731 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zm-.545 10.455H7.09v-1.364h7.09v1.364zm2.727-2.727H7.091v-1.364h9.818v1.364zm0-2.728H7.091V10.364h9.818v1.363zM14.727 6h6l-6-6v6z" />
    </svg>
  );
}

function ConfluenceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M.87 18.257c-.248.382-.53.875-.763 1.245a.764.764 0 0 0 .255 1.04l4.965 3.054a.764.764 0 0 0 1.058-.26c.199-.332.454-.763.733-1.221 1.967-3.247 3.945-2.853 7.508-1.146l4.957 2.381a.764.764 0 0 0 1.028-.382l2.02-4.665a.764.764 0 0 0-.382-1.012l-4.845-2.328c-5.033-2.416-10.666-2.617-16.534 3.294zm22.26-12.514c.248-.382.53-.875.763-1.245a.764.764 0 0 0-.255-1.04L18.673.404a.764.764 0 0 0-1.058.26c-.199.332-.454.763-.733 1.221-1.967 3.247-3.945 2.853-7.508 1.146L4.417.65a.764.764 0 0 0-1.028.382L1.37 5.697a.764.764 0 0 0 .382 1.012l4.845 2.328c5.033 2.416 10.666 2.617 16.534-3.294z" />
    </svg>
  );
}
