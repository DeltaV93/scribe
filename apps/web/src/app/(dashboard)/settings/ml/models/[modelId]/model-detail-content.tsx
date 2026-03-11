"use client";

/**
 * Model Detail Content
 *
 * Client component for displaying model details and managing versions.
 * Includes proper loading states, error handling, and confirmation dialogs.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Brain,
  FileText,
  Tags,
  Globe,
  Building2,
  Pencil,
  Plus,
  Calendar,
  Layers,
  Rocket,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  ArrowLeft,
} from "lucide-react";
import {
  VersionTable,
  MLErrorBoundary,
  ConfirmDialog,
  DeployConfirmDialog,
} from "@/components/ml";
import type { Model, ModelVersion, ModelType } from "@/lib/ml-services";

interface ModelDetailContentProps {
  modelId: string;
}

type LoadingState = "idle" | "loading" | "success" | "error";

interface FetchError {
  message: string;
  isNetworkError: boolean;
  status?: number;
}

const MODEL_TYPE_ICONS: Record<ModelType, React.ReactNode> = {
  llm: <Brain className="h-6 w-6" />,
  extraction: <FileText className="h-6 w-6" />,
  classification: <Tags className="h-6 w-6" />,
};

const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  llm: "Large Language Model",
  extraction: "Extraction Model",
  classification: "Classification Model",
};

/**
 * Loading skeleton for model detail page
 */
function ModelDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading model details">
      {/* Model Info Card Skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-32 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3 mb-6" />

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Versions Section Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 flex-1" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <span className="sr-only">Loading model details...</span>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({
  error,
  onRetry,
  onGoBack,
}: {
  error: FetchError;
  onRetry: () => void;
  onGoBack: () => void;
}) {
  const is404 = error.status === 404;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onGoBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Models
      </Button>

      <Alert variant={is404 ? "default" : "destructive"}>
        <div className="flex items-start gap-3">
          {error.isNetworkError ? (
            <WifiOff className="h-5 w-5 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 mt-0.5" />
          )}
          <div className="flex-1">
            <AlertTitle>
              {is404
                ? "Model Not Found"
                : error.isNetworkError
                ? "Connection Error"
                : "Failed to Load Model"}
            </AlertTitle>
            <AlertDescription className="mt-1">
              {is404
                ? "The model you're looking for doesn't exist or has been deleted."
                : error.isNetworkError
                ? "Unable to connect to the server. Please check your internet connection and try again."
                : error.message}
            </AlertDescription>
            <div className="flex gap-2 mt-3">
              {!is404 && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onGoBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Models
              </Button>
            </div>
          </div>
        </div>
      </Alert>
    </div>
  );
}

function ModelDetailContentInner({ modelId }: ModelDetailContentProps) {
  const router = useRouter();
  const [model, setModel] = useState<Model | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  // Deploy confirmation state
  const [deployConfirmState, setDeployConfirmState] = useState<{
    open: boolean;
    versionNumber: number;
    environment: "staging" | "production";
    trafficPercentage: number;
  }>({
    open: false,
    versionNumber: 0,
    environment: "staging",
    trafficPercentage: 100,
  });
  const [isDeploying, setIsDeploying] = useState(false);

  const fetchModel = useCallback(async () => {
    try {
      const response = await fetch(`/api/ml/models/${modelId}`);

      if (!response.ok) {
        if (response.status === 404) {
          const err: FetchError = {
            message: "Model not found",
            isNetworkError: false,
            status: 404,
          };
          setError(err);
          setLoadingState("error");
          return;
        }
        throw new Error("Failed to fetch model");
      }

      const data = await response.json();
      setModel(data.data);
      setEditName(data.data.name);
      setEditDescription(data.data.description || "");
      setLoadingState("success");
    } catch (err) {
      console.error("[ModelDetail] Failed to fetch model:", err);
      const isNetworkError =
        err instanceof TypeError && err.message.includes("fetch");
      setError({
        message: err instanceof Error ? err.message : "An unexpected error occurred",
        isNetworkError,
      });
      setLoadingState("error");
    }
  }, [modelId]);

  const fetchVersions = useCallback(async () => {
    setVersionsLoading(true);
    try {
      const response = await fetch(`/api/ml/models/${modelId}/versions`);
      if (!response.ok) {
        throw new Error("Failed to fetch versions");
      }
      const data = await response.json();
      setVersions(data.data || []);
    } catch (err) {
      console.error("[ModelDetail] Failed to fetch versions:", err);
      // Don't show error toast for versions - they might not exist yet
    } finally {
      setVersionsLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    const loadData = async () => {
      await fetchModel();
      await fetchVersions();
    };
    loadData();
  }, [fetchModel, fetchVersions]);

  const handleRetry = () => {
    setLoadingState("loading");
    setError(null);
    fetchModel();
    fetchVersions();
  };

  const handleGoBack = () => {
    router.push("/settings/ml/models");
  };

  const handleEditModel = async () => {
    if (!editName.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsEditing(true);
    try {
      const response = await fetch(`/api/ml/models/${modelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to update model");
      }

      toast.success("Model updated successfully");
      setIsEditDialogOpen(false);
      fetchModel();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update model");
    } finally {
      setIsEditing(false);
    }
  };

  const handleCreateVersion = async () => {
    setIsCreatingVersion(true);
    try {
      const response = await fetch(`/api/ml/models/${modelId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to create version");
      }

      const result = await response.json();
      toast.success("Version created successfully", {
        description: `Version ${result.data?.version_number || "new"} has been created.`,
      });
      fetchVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create version");
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handleDeployRequest = async (
    versionNumber: number,
    environment: "staging" | "production",
    trafficPercentage: number
  ) => {
    // For production, show confirmation dialog
    if (environment === "production") {
      setDeployConfirmState({
        open: true,
        versionNumber,
        environment,
        trafficPercentage,
      });
      return;
    }

    // For staging, deploy directly
    await executeDeploy(versionNumber, environment, trafficPercentage);
  };

  const executeDeploy = async (
    versionNumber: number,
    environment: "staging" | "production",
    trafficPercentage: number
  ) => {
    setIsDeploying(true);
    try {
      const response = await fetch(
        `/api/ml/models/${modelId}/versions/${versionNumber}/deploy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            environment,
            traffic_percentage: trafficPercentage,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to deploy version");
      }

      toast.success(`Deployed to ${environment}`, {
        description: `Version ${versionNumber} is now serving ${trafficPercentage}% of ${environment} traffic.`,
      });

      setDeployConfirmState((prev) => ({ ...prev, open: false }));
      fetchVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deploy version");
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDeployConfirm = () => {
    const { versionNumber, environment, trafficPercentage } = deployConfirmState;
    executeDeploy(versionNumber, environment, trafficPercentage);
  };

  const handleRollback = async (
    versionNumber: number,
    environment: "staging" | "production"
  ) => {
    try {
      const response = await fetch(
        `/api/ml/models/${modelId}/versions/${versionNumber}/rollback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ environment }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to rollback");
      }

      toast.success(`Rollback complete`, {
        description: `${environment} is now running version ${versionNumber}.`,
      });
      fetchVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rollback");
    }
  };

  // Loading state
  if (loadingState === "loading") {
    return <ModelDetailSkeleton />;
  }

  // Error state
  if (loadingState === "error" && error) {
    return (
      <ErrorState
        error={error}
        onRetry={handleRetry}
        onGoBack={handleGoBack}
      />
    );
  }

  if (!model) {
    return null;
  }

  const deployedVersion = versions.find((v) => v.status === "deployed");
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  return (
    <div className="space-y-6">
      {/* Model Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div
                className="p-3 rounded-lg bg-muted"
                aria-hidden="true"
              >
                {MODEL_TYPE_ICONS[model.model_type]}
              </div>
              <div>
                <CardTitle className="text-2xl">{model.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline">
                    {MODEL_TYPE_LABELS[model.model_type]}
                  </Badge>
                  {model.is_global ? (
                    <Badge variant="secondary" className="gap-1">
                      <Globe className="h-3 w-3" aria-hidden="true" />
                      <span>Global</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Building2 className="h-3 w-3" aria-hidden="true" />
                      <span>Organization</span>
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(true)}
              aria-label="Edit model details"
            >
              <Pencil className="h-4 w-4 mr-2" aria-hidden="true" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            {model.description || "No description provided"}
          </CardDescription>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Created
              </p>
              <p className="font-medium">{formatDate(model.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Layers className="h-4 w-4" aria-hidden="true" />
                Versions
              </p>
              <p className="font-medium">{versions.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Rocket className="h-4 w-4" aria-hidden="true" />
                Deployed
              </p>
              <p className="font-medium">
                {deployedVersion ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                  >
                    v{deployedVersion.version_number}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Versions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-semibold">Versions</h2>
          <Button
            onClick={handleCreateVersion}
            disabled={isCreatingVersion}
            aria-label="Create new version"
          >
            {isCreatingVersion ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            )}
            Create Version
          </Button>
        </div>

        <VersionTable
          modelId={modelId}
          versions={versions}
          isLoading={versionsLoading}
          onDeploy={handleDeployRequest}
          onRollback={handleRollback}
        />
      </div>

      {/* Edit Model Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
            <DialogDescription>
              Update the model name and description.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditModel();
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={200}
                  aria-describedby="edit-name-hint"
                />
                <p id="edit-name-hint" className="text-xs text-muted-foreground">
                  A descriptive name for this model
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  aria-describedby="edit-description-hint"
                />
                <p id="edit-description-hint" className="text-xs text-muted-foreground">
                  Optional description of what this model does
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Production Deploy Confirmation */}
      <DeployConfirmDialog
        open={deployConfirmState.open}
        onOpenChange={(open) =>
          setDeployConfirmState((prev) => ({ ...prev, open }))
        }
        versionNumber={deployConfirmState.versionNumber}
        environment={deployConfirmState.environment}
        onConfirm={handleDeployConfirm}
        isLoading={isDeploying}
      />
    </div>
  );
}

/**
 * Model Detail Content with Error Boundary
 */
export function ModelDetailContent({ modelId }: ModelDetailContentProps) {
  const router = useRouter();

  return (
    <MLErrorBoundary
      title="Model Details Error"
      description="An error occurred while loading the model details. Please try refreshing the page."
      onRetry={() => router.refresh()}
    >
      <ModelDetailContentInner modelId={modelId} />
    </MLErrorBoundary>
  );
}
