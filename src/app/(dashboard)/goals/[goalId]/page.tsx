"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoalDetailHeader } from "@/components/goals/goal-detail-header";
import { LinkedItemCard } from "@/components/goals/linked-item-card";
import { GoalStatus, GoalType } from "@prisma/client";
import { Loader2, Plus, Target, TrendingUp, FileText, Link2, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
import { toast } from "sonner";

interface Goal {
  id: string;
  name: string;
  description: string | null;
  type: GoalType;
  status: GoalStatus;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  ownerName: string | null;
  teamName: string | null;
  grants: Array<{
    id: string;
    grantId: string;
    name: string;
    status: string;
    progress: number;
    weight: number;
  }>;
  objectives: Array<{
    id: string;
    objectiveId: string;
    title: string;
    status: string;
    progress: number;
    weight: number;
  }>;
  kpis: Array<{
    id: string;
    kpiId: string;
    name: string;
    progress: number;
    weight: number;
  }>;
  programs: Array<{
    id: string;
    programId: string;
    name: string;
    status: string;
  }>;
  updates?: Array<{
    id: string;
    content: string;
    progressSnapshot: number | null;
    createdBy: { name: string | null };
    createdAt: string;
  }>;
}

export default function GoalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.goalId as string;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchGoal = async () => {
    try {
      const response = await fetch(`/api/goals/${goalId}`);
      if (response.ok) {
        const data = await response.json();
        setGoal(data.data);
      } else if (response.status === 404) {
        router.push("/goals");
      }
    } catch (error) {
      console.error("Error fetching goal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoal();
  }, [goalId]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Goal deleted successfully");
        router.push("/goals");
      } else {
        toast.error("Failed to delete goal");
      }
    } catch (error) {
      toast.error("Failed to delete goal");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleUnlinkGrant = async (grantId: string) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/grants/${grantId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Grant unlinked");
        fetchGoal();
      }
    } catch (error) {
      toast.error("Failed to unlink grant");
    }
  };

  const handleUnlinkKpi = async (kpiId: string) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/kpis/${kpiId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("KPI unlinked");
        fetchGoal();
      }
    } catch (error) {
      toast.error("Failed to unlink KPI");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!goal) {
    return null;
  }

  const totalLinkedItems =
    goal.grants.length + goal.objectives.length + goal.kpis.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <GoalDetailHeader
        goal={goal}
        onEdit={() => router.push(`/goals/${goalId}/edit`)}
        onDelete={() => setShowDeleteDialog(true)}
        onDuplicate={() => router.push(`/goals/${goalId}/duplicate`)}
      />

      {/* Tabs */}
      <Tabs defaultValue="linked" className="space-y-4">
        <TabsList>
          <TabsTrigger value="linked" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Linked Items ({totalLinkedItems})
          </TabsTrigger>
          <TabsTrigger value="programs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Programs ({goal.programs.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="linked" className="space-y-6">
          {/* Grants */}
          {goal.grants.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Grants ({goal.grants.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {goal.grants.map((grant) => (
                  <LinkedItemCard
                    key={grant.id}
                    type="grant"
                    item={{
                      id: grant.grantId,
                      name: grant.name,
                      status: grant.status,
                      progress: grant.progress,
                      weight: grant.weight,
                    }}
                    onView={() => router.push(`/grants/${grant.grantId}`)}
                    onUnlink={() => handleUnlinkGrant(grant.grantId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* OKRs/Objectives */}
          {goal.objectives.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  OKRs ({goal.objectives.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {goal.objectives.map((obj) => (
                  <LinkedItemCard
                    key={obj.id}
                    type="objective"
                    item={{
                      id: obj.objectiveId,
                      name: obj.title,
                      status: obj.status,
                      progress: obj.progress,
                      weight: obj.weight,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* KPIs */}
          {goal.kpis.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  KPIs ({goal.kpis.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {goal.kpis.map((kpi) => (
                  <LinkedItemCard
                    key={kpi.id}
                    type="kpi"
                    item={{
                      id: kpi.kpiId,
                      name: kpi.name,
                      status: "ACTIVE",
                      progress: kpi.progress,
                      weight: kpi.weight,
                    }}
                    onUnlink={() => handleUnlinkKpi(kpi.kpiId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {totalLinkedItems === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No linked items yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Link grants, OKRs, or KPIs to track progress toward this goal.
                </p>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Link Item
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="programs">
          {goal.programs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goal.programs.map((program) => (
                <Card key={program.id}>
                  <CardContent className="p-4">
                    <h4 className="font-medium">{program.name}</h4>
                    <p className="text-sm text-muted-foreground capitalize">
                      {program.status.toLowerCase().replace("_", " ")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No programs linked</h3>
                <p className="text-sm text-muted-foreground">
                  Programs linked to this goal will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          {goal.updates && goal.updates.length > 0 ? (
            <div className="space-y-4">
              {goal.updates.map((update) => (
                <Card key={update.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm">{update.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {update.createdBy.name || "Unknown"} -{" "}
                          {formatDistanceToNow(new Date(update.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {update.progressSnapshot !== null && (
                        <span className="text-sm font-medium">
                          {update.progressSnapshot}%
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No updates yet</h3>
                <p className="text-sm text-muted-foreground">
                  Progress updates and check-ins will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{goal.name}&quot;? This action
              cannot be undone. Linked items will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
