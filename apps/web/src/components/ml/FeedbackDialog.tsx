"use client";

/**
 * Feedback Dialog
 *
 * Detailed feedback form with correction support.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { MessageSquarePlus, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackType = "thumbs_up" | "thumbs_down" | "correction" | "comment";

interface FeedbackDialogProps {
  modelId: string;
  versionId?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  onFeedbackSubmitted?: () => void;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
}

export function FeedbackDialog({
  modelId,
  versionId,
  inputData,
  outputData,
  onFeedbackSubmitted,
  trigger,
  defaultOpen = false,
}: FeedbackDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("comment");
  const [rating, setRating] = useState<number>(3);
  const [comment, setComment] = useState("");
  const [correctedOutput, setCorrectedOutput] = useState("");

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        model_id: modelId,
        version_id: versionId,
        feedback_type: feedbackType,
        input_data: inputData,
        output_data: outputData,
      };

      // Add rating if provided
      if (rating > 0) {
        payload.rating = rating;
      }

      // Add comment if provided
      if (comment.trim()) {
        payload.comment = comment.trim();
      }

      // Add corrected output for correction type
      if (feedbackType === "correction" && correctedOutput.trim()) {
        try {
          payload.corrected_output = JSON.parse(correctedOutput);
        } catch {
          // If not valid JSON, store as text
          payload.corrected_output = { text: correctedOutput.trim() };
        }
      }

      const response = await fetch("/api/ml/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to submit feedback");
      }

      setOpen(false);
      onFeedbackSubmitted?.();

      // Reset form
      setFeedbackType("comment");
      setRating(3);
      setComment("");
      setCorrectedOutput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            Provide Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Provide Feedback</DialogTitle>
          <DialogDescription>
            Help us improve the model by sharing your feedback on this output.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Feedback Type */}
          <div className="space-y-3">
            <Label>Feedback Type</Label>
            <RadioGroup
              value={feedbackType}
              onValueChange={(v) => setFeedbackType(v as FeedbackType)}
              className="grid grid-cols-2 gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="thumbs_up" id="thumbs_up" />
                <Label htmlFor="thumbs_up" className="font-normal cursor-pointer">
                  Helpful
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="thumbs_down" id="thumbs_down" />
                <Label htmlFor="thumbs_down" className="font-normal cursor-pointer">
                  Not Helpful
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="correction" id="correction" />
                <Label htmlFor="correction" className="font-normal cursor-pointer">
                  Needs Correction
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="comment" id="comment_type" />
                <Label htmlFor="comment_type" className="font-normal cursor-pointer">
                  General Comment
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Rating (Optional)</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5 transition-colors",
                        star <= rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <Slider
              value={[rating]}
              onValueChange={([v]) => setRating(v)}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">
              {feedbackType === "correction" ? "Explain the Issue" : "Comments (Optional)"}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                feedbackType === "correction"
                  ? "Describe what was wrong with the output..."
                  : "Share any additional thoughts..."
              }
              rows={3}
            />
          </div>

          {/* Corrected Output (for corrections) */}
          {feedbackType === "correction" && (
            <div className="space-y-2">
              <Label htmlFor="corrected_output">Correct Output</Label>
              <Textarea
                id="corrected_output"
                value={correctedOutput}
                onChange={(e) => setCorrectedOutput(e.target.value)}
                placeholder="Provide the correct output (JSON or text)..."
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Provide what the output should have been. This helps train better models.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
