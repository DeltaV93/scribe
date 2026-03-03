"use client";

/**
 * Model Registry Content
 *
 * Client component for displaying and managing the model registry.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { ModelTable, CreateModelDialog } from "@/components/ml";
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

export function ModelRegistryContent() {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [filters, setFilters] = useState<{
    modelType?: ModelType;
    search?: string;
  }>({});

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.modelType) {
        params.set("model_type", filters.modelType);
      }
      params.set("include_global", "true");

      const response = await fetch(`/api/ml/models?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch models");
      }

      const data: ModelsResponse = await response.json();
      setModels(data.data);
    } catch (error) {
      console.error("Failed to fetch models:", error);
      toast.error("Failed to load models");
    } finally {
      setIsLoading(false);
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
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to create model");
      }

      toast.success("Model created successfully");
      setIsCreateDialogOpen(false);
      fetchModels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create model");
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const handleFilterChange = (newFilters: { modelType?: ModelType; search?: string }) => {
    setFilters(newFilters);
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Model
        </Button>
      </div>

      {/* Models Table */}
      <ModelTable
        models={models}
        isLoading={isLoading}
        onFilterChange={handleFilterChange}
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
