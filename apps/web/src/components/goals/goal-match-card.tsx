"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  Target,
  Sparkles,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalType } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface MatchCandidate {
  goalId: string;
  goalName: string;
  similarity: number;
}

export interface SuggestedGoal {
  name: string;
  description: string;
  type: GoalType;
  ownerId?: string;
  teamId?: string;
  startDate?: string;
  endDate?: string;
}

export type ResolveAction = "link_existing" | "create_new" | "dismiss";

export interface ResolveData {
  action: ResolveAction;
  goalId?: string; // For link_existing
  newGoal?: {
    name: string;
    description: string;
    type: GoalType;
  };
}

export interface GoalMatchCardProps {
  draftId: string;
  detectedText: string;
  matchCandidates: MatchCandidate[];
  suggestedGoal: SuggestedGoal | null;
  onResolve: (draftId: string, action: ResolveAction, data: ResolveData) => Promise<void>;
  isProcessing?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "GRANT", label: "Grant" },
  { value: "KPI", label: "KPI" },
  { value: "OKR", label: "OKR" },
  { value: "PROGRAM_INITIATIVE", label: "Program Initiative" },
  { value: "TEAM_INITIATIVE", label: "Team Initiative" },
  { value: "INDIVIDUAL", label: "Individual" },
];

// ============================================
// COMPONENT
// ============================================

export function GoalMatchCard({
  draftId,
  detectedText,
  matchCandidates,
  suggestedGoal,
  onResolve,
  isProcessing = false,
}: GoalMatchCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string>(
    matchCandidates.length > 0 ? matchCandidates[0].goalId : "create_new"
  );
  const [showNewGoalForm, setShowNewGoalForm] = useState(matchCandidates.length === 0);

  // New goal form state
  const [newGoalName, setNewGoalName] = useState(suggestedGoal?.name || "");
  const [newGoalDescription, setNewGoalDescription] = useState(
    suggestedGoal?.description || ""
  );
  const [newGoalType, setNewGoalType] = useState<GoalType>(
    suggestedGoal?.type || "PROGRAM_INITIATIVE"
  );

  const handleOptionChange = (value: string) => {
    setSelectedOption(value);
    setShowNewGoalForm(value === "create_new");
  };

  const handleResolve = async () => {
    if (selectedOption === "create_new") {
      if (!newGoalName.trim()) return;

      await onResolve(draftId, "create_new", {
        action: "create_new",
        newGoal: {
          name: newGoalName.trim(),
          description: newGoalDescription.trim(),
          type: newGoalType,
        },
      });
    } else {
      await onResolve(draftId, "link_existing", {
        action: "link_existing",
        goalId: selectedOption,
      });
    }
  };

  const handleDismiss = async () => {
    await onResolve(draftId, "dismiss", { action: "dismiss" });
  };

  const getSimilarityBadgeVariant = (similarity: number) => {
    if (similarity >= 0.8) return "success";
    if (similarity >= 0.6) return "warning";
    return "secondary";
  };

  const isResolveDisabled =
    isProcessing || (selectedOption === "create_new" && !newGoalName.trim());

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-base">Goal Match Required</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Needs Review
          </Badge>
        </div>
        <CardDescription>
          AI detected a goal reference that needs to be linked or created
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Detected Text Highlight */}
        <div className="p-3 rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
            Detected Goal Reference
          </p>
          <p className="text-sm text-purple-700 dark:text-purple-300 italic">
            &ldquo;{detectedText}&rdquo;
          </p>
        </div>

        {/* Collapsible Match Options */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
            >
              <span className="text-sm font-medium">
                {matchCandidates.length > 0
                  ? `${matchCandidates.length} potential match${matchCandidates.length > 1 ? "es" : ""} found`
                  : "No existing matches - create new goal"}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-3 space-y-4">
            <RadioGroup
              value={selectedOption}
              onValueChange={handleOptionChange}
              className="space-y-2"
            >
              {/* Existing goal matches */}
              {matchCandidates.map((candidate) => (
                <div
                  key={candidate.goalId}
                  className={cn(
                    "flex items-center space-x-3 p-3 rounded-md border transition-colors",
                    selectedOption === candidate.goalId
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem
                    value={candidate.goalId}
                    id={`match-${candidate.goalId}`}
                    disabled={isProcessing}
                  />
                  <Label
                    htmlFor={`match-${candidate.goalId}`}
                    className="flex-1 flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-sm font-medium">
                      {candidate.goalName}
                    </span>
                    <Badge
                      variant={getSimilarityBadgeVariant(candidate.similarity)}
                      className="text-xs"
                    >
                      {Math.round(candidate.similarity * 100)}% match
                    </Badge>
                  </Label>
                </div>
              ))}

              {/* Create new goal option */}
              <div
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-md border transition-colors",
                  selectedOption === "create_new"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                    : "border-muted hover:border-muted-foreground/30"
                )}
              >
                <RadioGroupItem
                  value="create_new"
                  id="create-new-goal"
                  className="mt-0.5"
                  disabled={isProcessing}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="create-new-goal"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Create new goal</span>
                    {suggestedGoal && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI suggested
                      </Badge>
                    )}
                  </Label>
                </div>
              </div>
            </RadioGroup>

            {/* New Goal Form (inline, expandable) */}
            {showNewGoalForm && (
              <div className="ml-7 space-y-4 pt-2 border-t border-dashed">
                <div className="space-y-2">
                  <Label htmlFor="new-goal-name" className="text-sm">
                    Goal Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-goal-name"
                    value={newGoalName}
                    onChange={(e) => setNewGoalName(e.target.value)}
                    placeholder="Enter goal name..."
                    disabled={isProcessing}
                    className={cn(
                      suggestedGoal?.name && newGoalName === suggestedGoal.name
                        ? "border-purple-300 bg-purple-50/50 dark:bg-purple-900/10"
                        : ""
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-goal-description" className="text-sm">
                    Description
                  </Label>
                  <Textarea
                    id="new-goal-description"
                    value={newGoalDescription}
                    onChange={(e) => setNewGoalDescription(e.target.value)}
                    placeholder="Describe the goal..."
                    rows={3}
                    disabled={isProcessing}
                    className={cn(
                      "resize-none",
                      suggestedGoal?.description &&
                        newGoalDescription === suggestedGoal.description
                        ? "border-purple-300 bg-purple-50/50 dark:bg-purple-900/10"
                        : ""
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-goal-type" className="text-sm">
                    Goal Type
                  </Label>
                  <Select
                    value={newGoalType}
                    onValueChange={(value) => setNewGoalType(value as GoalType)}
                    disabled={isProcessing}
                  >
                    <SelectTrigger id="new-goal-type">
                      <SelectValue placeholder="Select goal type" />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={isProcessing}
            className="text-muted-foreground hover:text-destructive"
          >
            Dismiss
          </Button>
          <Button
            size="sm"
            onClick={handleResolve}
            disabled={isResolveDisabled}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Processing...
              </>
            ) : selectedOption === "create_new" ? (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Goal
              </>
            ) : (
              <>
                <Target className="h-4 w-4 mr-1.5" />
                Link to Goal
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default GoalMatchCard;
