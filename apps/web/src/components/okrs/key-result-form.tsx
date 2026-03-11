"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface KeyResultFormProps {
  objectiveId: string;
  keyResult?: {
    id: string;
    title: string;
    description: string | null;
    targetValue: number;
    startValue: number;
    unit: string | null;
    weight: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function KeyResultForm({
  objectiveId,
  keyResult,
  open,
  onOpenChange,
  onSuccess,
}: KeyResultFormProps) {
  const mode = keyResult ? "edit" : "create";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: keyResult?.title || "",
    description: keyResult?.description || "",
    targetValue: keyResult?.targetValue?.toString() || "",
    startValue: keyResult?.startValue?.toString() || "0",
    unit: keyResult?.unit || "",
    weight: keyResult?.weight?.toString() || "1.0",
  });

  // Reset form when keyResult changes
  useEffect(() => {
    if (keyResult) {
      setFormData({
        title: keyResult.title,
        description: keyResult.description || "",
        targetValue: keyResult.targetValue.toString(),
        startValue: keyResult.startValue.toString(),
        unit: keyResult.unit || "",
        weight: keyResult.weight.toString(),
      });
    } else {
      setFormData({
        title: "",
        description: "",
        targetValue: "",
        startValue: "0",
        unit: "",
        weight: "1.0",
      });
    }
  }, [keyResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        targetValue: parseFloat(formData.targetValue),
        startValue: parseFloat(formData.startValue),
        unit: formData.unit || null,
        weight: parseFloat(formData.weight),
      };

      // Validate start value is less than target
      if (payload.startValue >= payload.targetValue) {
        toast.error("Start value must be less than target value");
        setIsSubmitting(false);
        return;
      }

      const url =
        mode === "create"
          ? `/api/objectives/${objectiveId}/key-results`
          : `/api/objectives/${objectiveId}/key-results/${keyResult?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save key result");
      }

      toast.success(
        mode === "create"
          ? "Key result created successfully"
          : "Key result updated successfully"
      );
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving key result:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save key result"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Key Result" : "Edit Key Result"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Key Result *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Achieve 90% customer satisfaction score"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="How will this key result be measured?"
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startValue">Start Value</Label>
              <Input
                id="startValue"
                type="number"
                step="any"
                value={formData.startValue}
                onChange={(e) =>
                  setFormData({ ...formData, startValue: e.target.value })
                }
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetValue">Target Value *</Label>
              <Input
                id="targetValue"
                type="number"
                step="any"
                min="0.01"
                value={formData.targetValue}
                onChange={(e) =>
                  setFormData({ ...formData, targetValue: e.target.value })
                }
                placeholder="100"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="%, $, users"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">
              Weight <span className="text-muted-foreground">(for progress calculation)</span>
            </Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              placeholder="1.0"
            />
            <p className="text-xs text-muted-foreground">
              Higher weight means this key result contributes more to the objective&apos;s overall progress.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add Key Result" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
