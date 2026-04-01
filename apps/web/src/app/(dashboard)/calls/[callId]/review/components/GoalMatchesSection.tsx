"use client";

import { useState, useEffect } from "react";
import { Target, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  GoalMatchCard,
  type MatchCandidate,
  type SuggestedGoal,
  type ResolveAction,
  type ResolveData,
} from "@/components/goals/goal-match-card";
import type { GoalType } from "@prisma/client";

// ============================================
// TYPES
// ============================================

interface GoalDraftNeedsResolution {
  id: string;
  detectedGoalText: string | null;
  matchCandidates: MatchCandidate[] | null;
  suggestedGoal: {
    name: string | null;
    description: string | null;
    type: GoalType | null;
    ownerId: string | null;
    teamId: string | null;
    startDate: string | null;
    endDate: string | null;
  } | null;
  narrative: string;
  createdAt: string;
  clientName: string;
}

interface GoalDraftsResponse {
  needsGoalResolution: GoalDraftNeedsResolution[];
  needsApproval: unknown[];
  totalPending: number;
}

interface GoalMatchesSectionProps {
  callId: string;
}

// ============================================
// COMPONENT
// ============================================

/**
 * GoalMatchesSection - Container for goal drafts needing resolution
 *
 * Displays GoalMatchCard components for drafts that have detected goal text
 * but need to be linked to an existing goal or used to create a new goal.
 */
export function GoalMatchesSection({ callId }: GoalMatchesSectionProps) {
  const [drafts, setDrafts] = useState<GoalDraftNeedsResolution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingDraftId, setProcessingDraftId] = useState<string | null>(null);

  // Fetch goal drafts on mount
  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/calls/${callId}/goal-drafts`);

        if (!response.ok) {
          if (response.status === 404) {
            // No drafts for this call - not an error
            setDrafts([]);
            return;
          }
          throw new Error("Failed to fetch goal drafts");
        }

        const data: { success: boolean; data: GoalDraftsResponse } = await response.json();
        setDrafts(data.data.needsGoalResolution || []);
      } catch (err) {
        console.error("Error fetching goal drafts:", err);
        setError("Failed to load goal matches");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrafts();
  }, [callId]);

  const handleResolve = async (
    draftId: string,
    action: ResolveAction,
    data: ResolveData
  ) => {
    try {
      setProcessingDraftId(draftId);

      // Build request body based on action type
      let requestBody: Record<string, unknown>;

      if (action === "dismiss") {
        requestBody = { action: "dismiss" };
      } else if (action === "link_existing") {
        requestBody = {
          action: "link_existing",
          existingGoalId: data.goalId,
        };
      } else {
        // create_new
        requestBody = {
          action: "create_new",
          newGoalData: data.newGoal
            ? {
                name: data.newGoal.name,
                description: data.newGoal.description,
                type: data.newGoal.type,
              }
            : undefined,
        };
      }

      const response = await fetch(
        `/api/calls/${callId}/goal-drafts/${draftId}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to resolve goal match");
      }

      const result = await response.json();

      // Show success message
      if (action === "dismiss") {
        toast.success("Goal match dismissed");
      } else if (action === "link_existing") {
        toast.success("Goal linked successfully", {
          description: `Linked to "${result.data.goalName}"`,
        });
      } else {
        toast.success("New goal created", {
          description: `Created draft goal "${result.data.goalName}"`,
        });
      }

      // Remove resolved draft from list
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch (err) {
      console.error("Error resolving goal match:", err);
      toast.error("Failed to resolve goal match", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
      throw err;
    } finally {
      setProcessingDraftId(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            Goal Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            Goal Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state - don't show section
  if (drafts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-500" />
          Goal Matches
        </CardTitle>
        <CardDescription>
          AI detected goal references that need to be linked or created
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {drafts.map((draft) => {
          // Transform suggestedGoal to match expected interface
          const suggestedGoal: SuggestedGoal | null = draft.suggestedGoal?.name
            ? {
                name: draft.suggestedGoal.name,
                description: draft.suggestedGoal.description || "",
                type: draft.suggestedGoal.type || "PROGRAM_INITIATIVE",
                ownerId: draft.suggestedGoal.ownerId || undefined,
                teamId: draft.suggestedGoal.teamId || undefined,
                startDate: draft.suggestedGoal.startDate || undefined,
                endDate: draft.suggestedGoal.endDate || undefined,
              }
            : null;

          return (
            <GoalMatchCard
              key={draft.id}
              draftId={draft.id}
              detectedText={draft.detectedGoalText || draft.narrative}
              matchCandidates={draft.matchCandidates || []}
              suggestedGoal={suggestedGoal}
              onResolve={handleResolve}
              isProcessing={processingDraftId === draft.id}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

export default GoalMatchesSection;
