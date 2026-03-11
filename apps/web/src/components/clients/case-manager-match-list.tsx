"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Users,
  Languages,
  Award,
  Briefcase,
  RefreshCw,
  UserPlus,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface CaseManagerProfile {
  maxCaseload: number;
  currentCaseload: number;
  availabilityStatus: string;
  languages: string[];
  skills: string[];
  specializations: string[];
}

interface CaseManager {
  id: string;
  name: string | null;
  email: string;
  role: string;
  profile: CaseManagerProfile | null;
}

interface ScoreBreakdown {
  caseloadScore: number;
  skillScore: number;
  languageScore: number;
  specializationScore: number;
  availabilityScore: number;
}

interface Recommendation {
  caseManager: CaseManager;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
}

interface CaseManagerMatchListProps {
  clientId: string;
  clientName: string;
  onAssign?: (caseManagerId: string, caseManagerName: string) => void;
  currentAssigneeId?: string;
}

export function CaseManagerMatchList({
  clientId,
  clientName,
  onAssign,
  currentAssigneeId,
}: CaseManagerMatchListProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/match-recommendations?limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.data.recommendations);
      } else {
        const error = await response.json();
        toast.error(error.error?.message || "Failed to load recommendations");
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      toast.error("Failed to load recommendations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [clientId]);

  const handleAssign = async (caseManagerId: string, caseManagerName: string) => {
    if (isAssigning) return;

    setIsAssigning(caseManagerId);
    try {
      const response = await fetch(`/api/clients/${clientId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseManagerId }),
      });

      if (response.ok) {
        toast.success(`${clientName} assigned to ${caseManagerName || "case manager"}`);
        onAssign?.(caseManagerId, caseManagerName);
        // Refresh recommendations to update caseload counts
        fetchRecommendations();
      } else {
        const error = await response.json();
        toast.error(error.error?.message || "Failed to assign client");
      }
    } catch (error) {
      console.error("Error assigning client:", error);
      toast.error("Failed to assign client");
    } finally {
      setIsAssigning(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "outline";
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-100 text-green-800";
      case "LIMITED":
        return "bg-yellow-100 text-yellow-800";
      case "UNAVAILABLE":
        return "bg-red-100 text-red-800";
      case "ON_LEAVE":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatAvailabilityStatus = (status: string) => {
    return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recommended Case Managers
          </CardTitle>
          <CardDescription>Loading recommendations...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recommended Case Managers
            </CardTitle>
            <CardDescription>
              Best matches for {clientName} based on availability, skills, and languages
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRecommendations} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No available case managers found</p>
            <p className="text-sm">All case managers may be at capacity or unavailable</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, index) => {
              const isCurrentAssignee = rec.caseManager.id === currentAssigneeId;
              const isExpanded = expandedId === rec.caseManager.id;
              const profile = rec.caseManager.profile;
              const spotsAvailable = profile
                ? profile.maxCaseload - profile.currentCaseload
                : 30;
              const utilizationPercent = profile
                ? Math.round((profile.currentCaseload / profile.maxCaseload) * 100)
                : 0;

              return (
                <div
                  key={rec.caseManager.id}
                  className={`border rounded-lg transition-all ${
                    index === 0 ? "border-primary/50 bg-primary/5" : ""
                  } ${isCurrentAssignee ? "border-green-500 bg-green-50" : ""}`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Rank indicator */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                          index === 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">
                            {rec.caseManager.name || rec.caseManager.email}
                          </h4>
                          {isCurrentAssignee && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Current
                            </Badge>
                          )}
                          {index === 0 && !isCurrentAssignee && (
                            <Badge variant="default">Best Match</Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {spotsAvailable} spots available
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${getAvailabilityColor(
                              profile?.availabilityStatus || "AVAILABLE"
                            )}`}
                          >
                            {formatAvailabilityStatus(profile?.availabilityStatus || "AVAILABLE")}
                          </span>
                        </div>

                        {/* Score and quick stats */}
                        <div className="flex items-center gap-4">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${getScoreColor(rec.score)}`}>
                                    {rec.score}
                                  </span>
                                  <span className="text-sm text-muted-foreground">/100</span>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <div className="space-y-2 text-xs">
                                  <p className="font-medium">Score Breakdown:</p>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span>Caseload (30%)</span>
                                      <span>{rec.scoreBreakdown.caseloadScore}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Skills (25%)</span>
                                      <span>{rec.scoreBreakdown.skillScore}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Languages (25%)</span>
                                      <span>{rec.scoreBreakdown.languageScore}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Specialization (10%)</span>
                                      <span>{rec.scoreBreakdown.specializationScore}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Availability (10%)</span>
                                      <span>{rec.scoreBreakdown.availabilityScore}</span>
                                    </div>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Caseload progress */}
                          <div className="flex-1 max-w-32">
                            <Progress value={utilizationPercent} className="h-2" />
                            <span className="text-xs text-muted-foreground">
                              {profile?.currentCaseload || 0}/{profile?.maxCaseload || 30} clients
                            </span>
                          </div>
                        </div>

                        {/* Expand/collapse for details */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 p-0 h-auto text-muted-foreground"
                          onClick={() => setExpandedId(isExpanded ? null : rec.caseManager.id)}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" /> Hide details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" /> Show details
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Action button */}
                      <div className="flex-shrink-0">
                        <Button
                          size="sm"
                          variant={isCurrentAssignee ? "outline" : "default"}
                          disabled={isAssigning !== null || isCurrentAssignee}
                          onClick={() =>
                            handleAssign(
                              rec.caseManager.id,
                              rec.caseManager.name || rec.caseManager.email
                            )
                          }
                        >
                          {isAssigning === rec.caseManager.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isCurrentAssignee ? (
                            "Assigned"
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" /> Assign
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        {/* Languages */}
                        {profile?.languages && profile.languages.length > 0 && (
                          <div className="flex items-start gap-2">
                            <Languages className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <span className="text-sm font-medium">Languages: </span>
                              <span className="text-sm text-muted-foreground">
                                {profile.languages.join(", ")}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Skills */}
                        {profile?.skills && profile.skills.length > 0 && (
                          <div className="flex items-start gap-2">
                            <Award className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <span className="text-sm font-medium">Skills: </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {profile.skills.map((skill) => (
                                  <Badge key={skill} variant="outline" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Specializations */}
                        {profile?.specializations && profile.specializations.length > 0 && (
                          <div className="flex items-start gap-2">
                            <Briefcase className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <span className="text-sm font-medium">Specializations: </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {profile.specializations.map((spec) => (
                                  <Badge key={spec} variant="secondary" className="text-xs">
                                    {spec}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Match reasons */}
                        {rec.reasons.length > 0 && (
                          <div className="bg-muted/50 rounded p-3">
                            <span className="text-sm font-medium">Match reasons:</span>
                            <ul className="mt-1 text-sm text-muted-foreground list-disc list-inside">
                              {rec.reasons.map((reason, i) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
