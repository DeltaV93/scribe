"use client";

/**
 * Create Model Dialog
 *
 * Dialog for creating a new ML model in the registry.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Brain, FileText, Tags } from "lucide-react";
import type { ModelType } from "@/lib/ml-services";

interface CreateModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    model_type: ModelType;
    description?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

const MODEL_TYPE_OPTIONS: Array<{
  value: ModelType;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: "llm",
    label: "LLM",
    description: "Large language model for text generation",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    value: "extraction",
    label: "Extraction",
    description: "Extract structured data from text",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    value: "classification",
    label: "Classification",
    description: "Classify text into categories",
    icon: <Tags className="h-4 w-4" />,
  },
];

export function CreateModelDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateModelDialogProps) {
  const [name, setName] = useState("");
  const [modelType, setModelType] = useState<ModelType | "">("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!modelType) {
      newErrors.modelType = "Model type is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        model_type: modelType as ModelType,
        description: description.trim() || undefined,
      });

      // Reset form on success
      setName("");
      setModelType("");
      setDescription("");
      setErrors({});
    } catch (error) {
      // Error handling is done in parent
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      setName("");
      setModelType("");
      setDescription("");
      setErrors({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Model</DialogTitle>
            <DialogDescription>
              Register a new ML model in the registry. You can add versions after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Model Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: "" });
                }}
                placeholder="e.g., extraction-v2, client-classifier"
                maxLength={200}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Model Type */}
            <div className="space-y-2">
              <Label htmlFor="modelType">Model Type</Label>
              <Select
                value={modelType}
                onValueChange={(value) => {
                  setModelType(value as ModelType);
                  if (errors.modelType) setErrors({ ...errors, modelType: "" });
                }}
              >
                <SelectTrigger id="modelType">
                  <SelectValue placeholder="Select model type" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        <div>
                          <span className="font-medium">{option.label}</span>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.modelType && (
                <p className="text-sm text-destructive">{errors.modelType}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this model does..."
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Model"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
