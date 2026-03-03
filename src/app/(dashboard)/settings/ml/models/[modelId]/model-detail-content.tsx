"use client";

/**
 * Model Detail Content
 *
 * Client component for displaying model details and managing versions.
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
} from "lucide-react";
import { VersionTable } from "@/components/ml";
import type { Model, ModelVersion, ModelType } from "@/lib/ml-services";

interface ModelDetailContentProps {
  modelId: string;
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

export function ModelDetailContent({ modelId }: ModelDetailContentProps) {
  const router = useRouter();
  const [model, setModel] = useState<Model | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  const fetchModel = useCallback(async () => {
    try {
      const response = await fetch(`/api/ml/models/${modelId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Model not found");
          router.push("/settings/ml/models");
          return;
        }
        throw new Error("Failed to fetch model");
      }
      const data = await response.json();
      setModel(data.data);
      setEditName(data.data.name);
      setEditDescription(data.data.description || "");
    } catch (error) {
      console.error("Failed to fetch model:", error);
      toast.error("Failed to load model");
    }
  }, [modelId, router]);

  const fetchVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/ml/models/${modelId}/versions`);
      if (!response.ok) {
        throw new Error("Failed to fetch versions");
      }
      const data = await response.json();
      setVersions(data.data || []);
    } catch (error) {
      console.error("Failed to fetch versions:", error);
      // Don't show error toast for versions - they might not exist yet
    }
  }, [modelId]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchModel(), fetchVersions()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchModel, fetchVersions]);

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
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to update model");
      }

      toast.success("Model updated successfully");
      setIsEditDialogOpen(false);
      fetchModel();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update model");
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
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to create version");
      }

      toast.success("Version created successfully");
      fetchVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create version");
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handleDeploy = async (
    versionNumber: number,
    environment: "staging" | "production",
    trafficPercentage: number
  ) => {
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
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to deploy version");
      }

      toast.success(`Version ${versionNumber} deployed to ${environment}`);
      fetchVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deploy version");
    }
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
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to rollback");
      }

      toast.success(`Rolled back to version ${versionNumber} on ${environment}`);
      fetchVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rollback");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
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
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                {MODEL_TYPE_ICONS[model.model_type]}
              </div>
              <div>
                <CardTitle className="text-2xl">{model.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {MODEL_TYPE_LABELS[model.model_type]}
                  </Badge>
                  {model.is_global ? (
                    <Badge variant="secondary" className="gap-1">
                      <Globe className="h-3 w-3" />
                      Global
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Building2 className="h-3 w-3" />
                      Organization
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            {model.description || "No description provided"}
          </CardDescription>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Created
              </p>
              <p className="font-medium">{formatDate(model.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Layers className="h-4 w-4" />
                Versions
              </p>
              <p className="font-medium">{versions.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Rocket className="h-4 w-4" />
                Deployed
              </p>
              <p className="font-medium">
                {deployedVersion ? `v${deployedVersion.version_number}` : "None"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Versions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Versions</h2>
          <Button onClick={handleCreateVersion} disabled={isCreatingVersion}>
            {isCreatingVersion ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Version
          </Button>
        </div>

        <VersionTable
          modelId={modelId}
          versions={versions}
          onDeploy={handleDeploy}
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
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isEditing}
            >
              Cancel
            </Button>
            <Button onClick={handleEditModel} disabled={isEditing}>
              {isEditing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
