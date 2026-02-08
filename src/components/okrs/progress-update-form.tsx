"use client";

import { useState } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProgressUpdateFormProps {
  keyResult: {
    id: string;
    title: string;
    currentValue: number;
    targetValue: number;
    unit: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ProgressUpdateForm({
  keyResult,
  open,
  onOpenChange,
  onSuccess,
}: ProgressUpdateFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    value: keyResult.currentValue.toString(),
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const newValue = parseFloat(formData.value);
      if (isNaN(newValue) || newValue < 0) {
        toast.error("Please enter a valid positive number");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/key-results/${keyResult.id}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: newValue,
          notes: formData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to update progress");
      }

      toast.success("Progress updated successfully");
      onSuccess();
      onOpenChange(false);
      // Reset form
      setFormData({ value: "", notes: "" });
    } catch (error) {
      console.error("Error updating progress:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update progress"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatUnit = (value: number) => {
    if (keyResult.unit === "%") return `${value}%`;
    if (keyResult.unit === "$") return `$${value.toLocaleString()}`;
    return keyResult.unit ? `${value} ${keyResult.unit}` : value.toString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Update Progress</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {keyResult.title}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Current: {formatUnit(keyResult.currentValue)} / Target:{" "}
            {formatUnit(keyResult.targetValue)}
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">New Value *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="value"
                type="number"
                step="any"
                min="0"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder={keyResult.currentValue.toString()}
                required
              />
              {keyResult.unit && (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {keyResult.unit}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="What contributed to this progress?"
              rows={2}
            />
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
              Update Progress
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
