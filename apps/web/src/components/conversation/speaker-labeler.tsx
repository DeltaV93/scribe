"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  Briefcase,
  Users,
  HelpCircle,
  Check,
  Loader2,
  Clock,
  MessageSquare,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export type SpeakerRole = "staff" | "client" | "other";

export interface SpeakerLabel {
  speakerId: string;
  role: SpeakerRole;
  name?: string;
  userId?: string;
  clientId?: string;
}

export interface SpeakerStats {
  speakerId: string;
  segmentCount: number;
  totalDuration: number;
  wordCount: number;
}

interface SpeakerLabelerProps {
  conversationId: string;
  onLabelsChange?: (labels: SpeakerLabel[]) => void;
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const ROLE_CONFIG: Record<
  SpeakerRole,
  { label: string; icon: React.ReactNode; color: string }
> = {
  staff: {
    label: "Staff",
    icon: <Briefcase className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  client: {
    label: "Client",
    icon: <User className="h-4 w-4" />,
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  other: {
    label: "Other",
    icon: <Users className="h-4 w-4" />,
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SpeakerLabeler({
  conversationId,
  onLabelsChange,
  className,
}: SpeakerLabelerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedSpeakers, setDetectedSpeakers] = useState<string[]>([]);
  const [stats, setStats] = useState<SpeakerStats[]>([]);
  const [labels, setLabels] = useState<Map<string, SpeakerLabel>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch speaker data
  const fetchSpeakers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/speakers`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch speakers");
      }

      setDetectedSpeakers(data.detectedSpeakers || []);
      setStats(data.stats || []);

      // Convert labels array to map
      const labelsMap = new Map<string, SpeakerLabel>();
      for (const label of data.labels || []) {
        labelsMap.set(label.speakerId, label);
      }
      setLabels(labelsMap);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchSpeakers();
  }, [fetchSpeakers]);

  // Update a speaker's role
  const updateRole = (speakerId: string, role: SpeakerRole) => {
    setLabels((prev) => {
      const next = new Map(prev);
      const existing = next.get(speakerId);
      next.set(speakerId, {
        ...existing,
        speakerId,
        role,
        name: existing?.name,
      });
      return next;
    });
    setHasChanges(true);
  };

  // Update a speaker's name
  const updateName = (speakerId: string, name: string) => {
    setLabels((prev) => {
      const next = new Map(prev);
      const existing = next.get(speakerId);
      next.set(speakerId, {
        ...existing,
        speakerId,
        role: existing?.role || "other",
        name: name || undefined,
      });
      return next;
    });
    setHasChanges(true);
  };

  // Save labels
  const saveLabels = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const labelsArray = Array.from(labels.values());

      const response = await fetch(`/api/conversations/${conversationId}/speakers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labels: labelsArray }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to save labels");
      }

      setHasChanges(false);
      onLabelsChange?.(labelsArray);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // Get stats for a speaker
  const getSpeakerStats = (speakerId: string): SpeakerStats | undefined => {
    return stats.find((s) => s.speakerId === speakerId);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (detectedSpeakers.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <HelpCircle className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No speakers detected in the transcript.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Speaker Labeling
          </CardTitle>
          {hasChanges && (
            <Button
              size="sm"
              onClick={saveLabels}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Label each speaker to improve transcript readability and extraction accuracy.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {error}
          </div>
        )}

        {detectedSpeakers.map((speakerId) => {
          const label = labels.get(speakerId);
          const speakerStats = getSpeakerStats(speakerId);
          const role = label?.role || "other";
          const roleConfig = ROLE_CONFIG[role];

          return (
            <div
              key={speakerId}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              {/* Speaker badge */}
              <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                <Badge variant="outline" className={cn("gap-1", roleConfig.color)}>
                  {roleConfig.icon}
                  {speakerId}
                </Badge>
              </div>

              {/* Stats */}
              {speakerStats && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {speakerStats.segmentCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(speakerStats.totalDuration)}
                  </span>
                </div>
              )}

              {/* Role selector */}
              <div className="flex-shrink-0 w-32">
                <Select
                  value={role}
                  onValueChange={(value) => updateRole(speakerId, value as SpeakerRole)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3 w-3" />
                        Staff
                      </div>
                    </SelectItem>
                    <SelectItem value="client">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        Client
                      </div>
                    </SelectItem>
                    <SelectItem value="other">
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        Other
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name input */}
              <div className="flex-1 min-w-0">
                <Input
                  placeholder="Name (optional)"
                  value={label?.name || ""}
                  onChange={(e) => updateName(speakerId, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Speaker roles:</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(ROLE_CONFIG) as [SpeakerRole, typeof ROLE_CONFIG.staff][]).map(
              ([role, config]) => (
                <Badge key={role} variant="outline" className={cn("gap-1", config.color)}>
                  {config.icon}
                  {config.label}
                </Badge>
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// HOOK FOR SPEAKER LABELS
// ============================================

export function useSpeakerLabels(conversationId: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<SpeakerLabel[]>([]);
  const [detectedSpeakers, setDetectedSpeakers] = useState<string[]>([]);
  const [stats, setStats] = useState<SpeakerStats[]>([]);

  const fetchLabels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/speakers`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch speakers");
      }

      setLabels(data.labels || []);
      setDetectedSpeakers(data.detectedSpeakers || []);
      setStats(data.stats || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  return {
    isLoading,
    error,
    labels,
    detectedSpeakers,
    stats,
    refetch: fetchLabels,
  };
}
