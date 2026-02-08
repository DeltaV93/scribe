"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  ObjectiveStatusBadge,
  KeyResultRow,
  ObjectiveForm,
  KeyResultForm,
  ProgressUpdateForm,
  OKRProgress,
} from "@/components/okrs";
import { ObjectiveStatus, KeyResultStatus } from "@prisma/client";
import {
  ArrowLeft,
  Calendar,
  MoreVertical,
  Pencil,
  Archive,
  Plus,
  Loader2,
  Target,
  User,
  MessageSquare,
  Send,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  startValue: number;
  unit: string | null;
  weight: number;
  status: KeyResultStatus;
  progressPercentage: number;
}

interface Objective {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  parentId: string | null;
  status: ObjectiveStatus;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  keyResults: KeyResult[];
  childCount: number;
}

interface ObjectiveUpdate {
  id: string;
  content: string;
  progressSnapshot: number | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function ObjectiveDetailPage({
  params,
}: {
  params: Promise<{ objectiveId: string }>;
}) {
  const { objectiveId } = use(params);
  const router = useRouter();
  const [objective, setObjective] = useState<Objective | null>(null);
  const [updates, setUpdates] = useState<ObjectiveUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  const [showKeyResultForm, setShowKeyResultForm] = useState(false);
  const [editingKeyResult, setEditingKeyResult] = useState<KeyResult | null>(null);
  const [progressKeyResult, setProgressKeyResult] = useState<KeyResult | null>(null);
  const [newUpdateContent, setNewUpdateContent] = useState("");
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);

  const fetchObjective = useCallback(async () => {
    try {
      const response = await fetch(`/api/objectives/${objectiveId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/okrs");
          return;
        }
        throw new Error("Failed to fetch objective");
      }
      const data = await response.json();
      setObjective(data.data);
    } catch (error) {
      console.error("Error fetching objective:", error);
      toast.error("Failed to load objective");
    }
  }, [objectiveId, router]);

  const fetchUpdates = useCallback(async () => {
    try {
      const response = await fetch(`/api/objectives/${objectiveId}/updates?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setUpdates(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching updates:", error);
    }
  }, [objectiveId]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchObjective(), fetchUpdates()]);
      setIsLoading(false);
    };
    loadData();
  }, [objectiveId, fetchObjective, fetchUpdates]);

  const handleArchive = async () => {
    try {
      const response = await fetch(`/api/objectives/${objectiveId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to archive objective");
      }

      toast.success("Objective archived successfully");
      router.push("/okrs");
    } catch (error) {
      console.error("Error archiving objective:", error);
      toast.error("Failed to archive objective");
    }
    setShowArchiveDialog(false);
  };

  const handleSubmitUpdate = async () => {
    if (!newUpdateContent.trim()) return;

    setIsSubmittingUpdate(true);
    try {
      const response = await fetch(`/api/objectives/${objectiveId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newUpdateContent }),
      });

      if (!response.ok) {
        throw new Error("Failed to post update");
      }

      toast.success("Check-in posted");
      setNewUpdateContent("");
      fetchUpdates();
    } catch (error) {
      console.error("Error posting update:", error);
      toast.error("Failed to post update");
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const handleObjectiveSuccess = () => {
    fetchObjective();
    setShowObjectiveForm(false);
  };

  const handleKeyResultSuccess = () => {
    fetchObjective();
    setShowKeyResultForm(false);
    setEditingKeyResult(null);
  };

  const handleProgressSuccess = () => {
    fetchObjective();
    setProgressKeyResult(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!objective) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/okrs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {objective.title}
              </h1>
              <ObjectiveStatusBadge status={objective.status} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{objective.ownerName || objective.ownerEmail}</span>
              </div>
              {(objective.startDate || objective.endDate) && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {objective.startDate &&
                      format(new Date(objective.startDate), "MMM d")}
                    {objective.startDate && objective.endDate && " - "}
                    {objective.endDate &&
                      format(new Date(objective.endDate), "MMM d, yyyy")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowObjectiveForm(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Objective
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowArchiveDialog(true)}
              className="text-destructive"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive Objective
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="pt-6">
          <OKRProgress value={objective.progress} size="lg" />
          {objective.description && (
            <p className="text-muted-foreground mt-4">{objective.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="key-results" className="space-y-4">
        <TabsList>
          <TabsTrigger value="key-results">Key Results</TabsTrigger>
          <TabsTrigger value="updates">Check-ins</TabsTrigger>
        </TabsList>

        <TabsContent value="key-results" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Key Results</h2>
            <Button onClick={() => setShowKeyResultForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Key Result
            </Button>
          </div>

          {objective.keyResults.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No key results yet</h3>
                <p className="text-muted-foreground text-center max-w-sm mt-1">
                  Add measurable key results to track progress toward this objective.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setShowKeyResultForm(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Key Result
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {objective.keyResults.map((kr) => (
                <KeyResultRow
                  key={kr.id}
                  keyResult={kr}
                  onUpdateProgress={() => setProgressKeyResult(kr)}
                  onEdit={() => {
                    setEditingKeyResult(kr);
                    setShowKeyResultForm(true);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="updates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post a Check-in</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Share progress, blockers, or updates..."
                value={newUpdateContent}
                onChange={(e) => setNewUpdateContent(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitUpdate}
                  disabled={!newUpdateContent.trim() || isSubmittingUpdate}
                >
                  {isSubmittingUpdate && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Send className="mr-2 h-4 w-4" />
                  Post Check-in
                </Button>
              </div>
            </CardContent>
          </Card>

          {updates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No check-ins yet</h3>
                <p className="text-muted-foreground text-center max-w-sm mt-1">
                  Post regular check-ins to track progress and share updates.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {updates.map((update) => (
                <Card key={update.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {update.createdBy.name || update.createdBy.email}
                        </span>
                        {update.progressSnapshot !== null && (
                          <span className="text-xs text-muted-foreground">
                            ({update.progressSnapshot}% progress)
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(update.createdAt), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {update.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this objective?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the objective and all its key results. You can
              restore it later from the archives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ObjectiveForm
        objective={
          showObjectiveForm
            ? {
                id: objective.id,
                title: objective.title,
                description: objective.description,
                ownerId: objective.ownerId,
                parentId: objective.parentId,
                status: objective.status,
                startDate: objective.startDate,
                endDate: objective.endDate,
              }
            : undefined
        }
        open={showObjectiveForm}
        onOpenChange={(open) => {
          setShowObjectiveForm(open);
        }}
        onSuccess={handleObjectiveSuccess}
      />

      <KeyResultForm
        objectiveId={objectiveId}
        keyResult={editingKeyResult || undefined}
        open={showKeyResultForm}
        onOpenChange={(open) => {
          setShowKeyResultForm(open);
          if (!open) setEditingKeyResult(null);
        }}
        onSuccess={handleKeyResultSuccess}
      />

      {progressKeyResult && (
        <ProgressUpdateForm
          keyResult={progressKeyResult}
          open={!!progressKeyResult}
          onOpenChange={(open) => {
            if (!open) setProgressKeyResult(null);
          }}
          onSuccess={handleProgressSuccess}
        />
      )}
    </div>
  );
}
