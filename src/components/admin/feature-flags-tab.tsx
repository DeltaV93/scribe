"use client";

/**
 * Feature Flags Admin Tab
 * Allows admins to enable/disable features for their organization
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FeatureFlagConfig {
  enabled: boolean;
  enabledAt?: string;
  enabledBy?: string;
}

type FeatureFlags = Record<string, FeatureFlagConfig>;

// Feature flag metadata for display
const FEATURE_INFO: Record<string, { name: string; description: string; category: string }> = {
  "conversation-capture": {
    name: "Conversation Capture",
    description: "Record in-person meetings and conversations using device microphone",
    category: "Recording",
  },
  "video-meeting-bot": {
    name: "Video Meeting Bot",
    description: "Send a bot to capture Zoom, Google Meet, and Microsoft Teams meetings (coming soon)",
    category: "Recording",
  },
  "mass-notes": {
    name: "Mass Notes",
    description: "Create notes for multiple clients at once from a single session",
    category: "Notes",
  },
  "photo-to-form": {
    name: "Photo to Form",
    description: "Convert photos of paper forms into digital form submissions",
    category: "Forms",
  },
  "automated-reporting": {
    name: "Automated Reporting",
    description: "Schedule and automate report generation",
    category: "Reports",
  },
  "sms-messaging": {
    name: "SMS Messaging",
    description: "Send SMS messages to clients",
    category: "Communication",
  },
  "client-portal": {
    name: "Client Portal",
    description: "Allow clients to access their information through a portal",
    category: "Communication",
  },
  "form-logic": {
    name: "Form Logic",
    description: "Add conditional logic to forms",
    category: "Forms",
  },
  "performance-metrics": {
    name: "Performance Metrics",
    description: "Track team performance metrics and KPIs",
    category: "Analytics",
  },
  "quizzes": {
    name: "Quizzes",
    description: "Create and assign quizzes for training",
    category: "Training",
  },
};

export function FeatureFlagsTab() {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      const response = await fetch("/api/admin/feature-flags");
      if (!response.ok) {
        throw new Error("Failed to fetch feature flags");
      }
      const data = await response.json();
      setFlags(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feature flags");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFlag = async (flagName: string, enabled: boolean) => {
    setUpdating(flagName);
    setError(null);

    try {
      const response = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: { [flagName]: enabled },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update feature flag");
      }

      const data = await response.json();
      setFlags(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update feature flag");
    } finally {
      setUpdating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group flags by category
  const groupedFlags: Record<string, string[]> = {};
  Object.keys(FEATURE_INFO).forEach((flag) => {
    const category = FEATURE_INFO[flag].category;
    if (!groupedFlags[category]) {
      groupedFlags[category] = [];
    }
    groupedFlags[category].push(flag);
  });

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {Object.entries(groupedFlags).map(([category, categoryFlags]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
            <CardDescription>
              Manage {category.toLowerCase()} features for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryFlags.map((flagName) => {
              const info = FEATURE_INFO[flagName];
              const flagConfig = flags?.[flagName];
              const isEnabled = flagConfig?.enabled ?? false;
              const isUpdating = updating === flagName;

              return (
                <div
                  key={flagName}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={flagName} className="font-medium">
                        {info.name}
                      </Label>
                      {flagName === "video-meeting-bot" && (
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                    {isEnabled && flagConfig?.enabledAt && (
                      <p className="text-xs text-muted-foreground">
                        Enabled {new Date(flagConfig.enabledAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Switch
                      id={flagName}
                      checked={isEnabled}
                      onCheckedChange={(checked) => toggleFlag(flagName, checked)}
                      disabled={isUpdating}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
