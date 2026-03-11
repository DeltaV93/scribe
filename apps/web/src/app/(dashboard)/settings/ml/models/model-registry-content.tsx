"use client";

/**
 * Model Registry Content
 *
 * Client component for displaying and managing the model registry.
 * Includes error handling, retry functionality, and loading states.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Plus, RefreshCw, AlertTriangle, WifiOff } from "lucide-react";
import {
  ModelTable,
  CreateModelDialog,
  MLErrorBoundary,
} from "@/components/ml";
import type { Model, ModelType } from "@/lib/ml-services";

interface ModelsResponse {
  success: boolean;
  data: Model[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type LoadingState = "idle" | "loading" | "success" | "error";

interface FetchError {
  message: string;
  isNetworkError: boolean;
}

function ModelRegistryContentInner() {
  const [models, setModels] = useState<Model[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [error, setError] = useState<FetchError | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [filters, setFilters] = useState<{
    modelType?: ModelType;
    search?: string;
  }>({});

  const fetchModels = useCallback(async () => {
    setLoadingState("loading");
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.modelType) {
        params.set("model_type", filters.modelType);
      }
      params.set("include_global", "true");

      const response = await fetch(`/api/ml/models?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to fetch models (${response.status})`
        );
      }

      const data: ModelsResponse = await response.json();
      setModels(data.data);
      setLoadingState("success");
    } catch (err) {
      console.error("[ModelRegistry] Failed to fetch models:", err);

      const isNetworkError =
        err instanceof TypeError && err.message.includes("fetch");

      setError({
        message: err instanceof Error ? err.message : "An unexpected error occurred",
        isNetworkError,
      });
      setLoadingState("error");

      // Show toast for non-network errors (network errors are shown inline)
      if (!isNetworkError) {
        toast.error("Failed to load models", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }
  }, [filters.modelType]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleCreateModel = async (data: {
    name: string;
    model_type: ModelType;
    description?: string;
  }) => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/ml/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to create model");
      }

      const result = await response.json();

      toast.success("Model created successfully", {
        description: `"${data.name}" has been added to the registry.`,
      });

      setIsCreateDialogOpen(false);
      fetchModels();

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create model";
      toast.error("Failed to create model", {
        description: message,
      });
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const handleFilterChange = (newFilters: { modelType?: ModelType; search?: string }) => {
    setFilters(newFilters);
  };

  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  // Error state with retry
  if (loadingState === "error" && error) {
    return (
      <div className="space-y-4">
        {/* Actions - disabled when error */}
        <div className="flex justify-end">
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Create Model
          </Button>
        </div>

        {/* Error Alert */}
        <Alert variant="destructive">
          <div className="flex items-start gap-3">
            {error.isNetworkError ? (
              <WifiOff className="h-5 w-5 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 mt-0.5" />
            )}
            <div className="flex-1">
              <AlertTitle>
                {error.isNetworkError ? "Connection Error" : "Failed to Load Models"}
              </AlertTitle>
              <AlertDescription className="mt-1">
                {error.isNetworkError
                  ? "Unable to connect to the server. Please check your internet connection and try again."
                  : error.message}
              </AlertDescription>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchModels}
                className="mt-3"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Model
        </Button>
      </div>

      {/* Models Table */}
      <ModelTable
        models={models}
        isLoading={loadingState === "loading"}
        onFilterChange={handleFilterChange}
        onCreateClick={handleOpenCreateDialog}
      />

      {/* Create Dialog */}
      <CreateModelDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateModel}
        isLoading={isCreating}
      />
    </div>
  );
}

/**
 * Model Registry Content with Error Boundary
 */
export function ModelRegistryContent() {
  return (
    <MLErrorBoundary
      title="Model Registry Error"
      description="An error occurred while loading the model registry. Please try refreshing the page."
    >
      <ModelRegistryContentInner />
    </MLErrorBoundary>
  );
}
