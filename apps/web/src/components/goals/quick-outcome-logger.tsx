"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Minus, Check } from "lucide-react";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/use-media-query";

interface QuickOutcomeLoggerProps {
  goalId: string;
  kpiId: string;
  kpiName: string;
  currentValue: number;
  targetValue: number;
  unit?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function QuickOutcomeLogger({
  goalId,
  kpiId,
  kpiName,
  currentValue,
  targetValue,
  unit,
  trigger,
  onSuccess,
}: QuickOutcomeLoggerProps) {
  const [open, setOpen] = useState(false);
  const [addValue, setAddValue] = useState(1);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const newValue = currentValue + addValue;
  const progressPercentage = Math.min(100, Math.round((newValue / targetValue) * 100));

  const handleIncrement = () => {
    setAddValue((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setAddValue((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/kpis/${kpiId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newValue,
          notes: notes.trim() || undefined,
          sourceType: "quick_logger",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update progress");
      }

      toast.success("Progress updated successfully");
      setOpen(false);
      setAddValue(1);
      setNotes("");
      onSuccess?.();
    } catch (error) {
      console.error("Error updating progress:", error);
      toast.error("Failed to update progress");
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className="space-y-6 p-1">
      {/* Current Progress Display */}
      <div className="text-center space-y-2">
        <h3 className="font-medium text-lg">{kpiName}</h3>
        <p className="text-sm text-muted-foreground">
          Currently: {currentValue} of {targetValue} {unit}
        </p>
      </div>

      {/* Value Adjuster - Large touch targets for mobile */}
      <div className="space-y-2">
        <Label className="text-center block">Add to current value</Label>
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handleDecrement}
            disabled={addValue <= 1}
            className="h-12 w-12 touch-manipulation"
          >
            <Minus className="h-6 w-6" />
          </Button>
          <Input
            type="number"
            value={addValue}
            onChange={(e) => setAddValue(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-24 h-12 text-center text-xl font-bold"
            min={0}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleIncrement}
            className="h-12 w-12 touch-manipulation"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-muted rounded-lg p-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">New total</p>
        <p className="text-2xl font-bold">
          {newValue} of {targetValue} {unit}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="text-sm font-medium">{progressPercentage}% complete</p>
      </div>

      {/* Optional Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Add any context..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      {/* Submit Button - Large for mobile */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || addValue === 0}
        className="w-full h-12 text-lg touch-manipulation"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Check className="mr-2 h-5 w-5" />
            Save Progress
          </>
        )}
      </Button>
    </div>
  );

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Plus className="h-4 w-4 mr-1" />
      Log Outcome
    </Button>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Outcome</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger || defaultTrigger}</SheetTrigger>
      <SheetContent side="bottom" className="h-auto max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>Log Outcome</SheetTitle>
        </SheetHeader>
        <div className="py-4">{content}</div>
      </SheetContent>
    </Sheet>
  );
}
