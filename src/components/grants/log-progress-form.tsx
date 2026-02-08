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
} from "@/components/ui/dialog";
import { Loader2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

interface LogProgressFormProps {
  grantId: string;
  deliverableId: string;
  deliverableName: string;
  currentValue: number;
  targetValue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LogProgressForm({
  grantId,
  deliverableId,
  deliverableName,
  currentValue,
  targetValue,
  open,
  onOpenChange,
  onSuccess,
}: LogProgressFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [delta, setDelta] = useState<number>(1);
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (delta === 0) {
      toast.error("Please enter a non-zero value");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/grants/${grantId}/deliverables/${deliverableId}/progress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            delta,
            notes: notes.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to log progress");
      }

      toast.success("Progress logged successfully");
      setDelta(1);
      setNotes("");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error logging progress:", error);
      toast.error(error instanceof Error ? error.message : "Failed to log progress");
    } finally {
      setIsSubmitting(false);
    }
  };

  const newValue = currentValue + delta;
  const newPercentage = targetValue > 0 ? Math.round((newValue / targetValue) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Progress</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">{deliverableName}</p>
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center">
                <p className="text-3xl font-bold">{currentValue}</p>
                <p className="text-xs text-muted-foreground">Current</p>
              </div>
              <div className="text-2xl text-muted-foreground">→</div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{newValue}</p>
                <p className="text-xs text-muted-foreground">New ({newPercentage}%)</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delta">Change Amount</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDelta((d) => d - 1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="delta"
                type="number"
                value={delta}
                onChange={(e) => setDelta(parseInt(e.target.value, 10) || 0)}
                className="text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDelta((d) => d + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use negative numbers to decrease the count
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any context or notes about this progress update..."
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
            <Button type="submit" disabled={isSubmitting || delta === 0}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Progress
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
