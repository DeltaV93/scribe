"use client";

/**
 * Feedback Button
 *
 * Inline thumbs up/down feedback for model outputs.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackButtonProps {
  modelId: string;
  versionId?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  onFeedbackSubmitted?: (type: "thumbs_up" | "thumbs_down") => void;
  className?: string;
  size?: "sm" | "default" | "lg";
  disabled?: boolean;
}

export function FeedbackButton({
  modelId,
  versionId,
  inputData,
  outputData,
  onFeedbackSubmitted,
  className,
  size = "sm",
  disabled = false,
}: FeedbackButtonProps) {
  const [submitted, setSubmitted] = useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFeedback = async (type: "thumbs_up" | "thumbs_down") => {
    if (submitted || isSubmitting || disabled) return;

    setIsSubmitting(type);
    setError(null);

    try {
      const response = await fetch("/api/ml/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: modelId,
          version_id: versionId,
          feedback_type: type,
          input_data: inputData,
          output_data: outputData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to submit feedback");
      }

      setSubmitted(type);
      onFeedbackSubmitted?.(type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(null);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant={submitted === "thumbs_up" ? "default" : "ghost"}
        size={size === "sm" ? "sm" : size === "lg" ? "lg" : "default"}
        className={cn(
          "px-2",
          submitted === "thumbs_up" && "bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800"
        )}
        onClick={() => handleFeedback("thumbs_up")}
        disabled={submitted !== null || isSubmitting !== null || disabled}
        title="This output was helpful"
      >
        {isSubmitting === "thumbs_up" ? (
          <Loader2 className={cn(iconSize, "animate-spin")} />
        ) : (
          <ThumbsUp className={iconSize} />
        )}
      </Button>

      <Button
        variant={submitted === "thumbs_down" ? "default" : "ghost"}
        size={size === "sm" ? "sm" : size === "lg" ? "lg" : "default"}
        className={cn(
          "px-2",
          submitted === "thumbs_down" && "bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800"
        )}
        onClick={() => handleFeedback("thumbs_down")}
        disabled={submitted !== null || isSubmitting !== null || disabled}
        title="This output was not helpful"
      >
        {isSubmitting === "thumbs_down" ? (
          <Loader2 className={cn(iconSize, "animate-spin")} />
        ) : (
          <ThumbsDown className={iconSize} />
        )}
      </Button>

      {error && (
        <span className="text-xs text-destructive ml-2">{error}</span>
      )}

      {submitted && (
        <span className="text-xs text-muted-foreground ml-2">
          Thanks for your feedback!
        </span>
      )}
    </div>
  );
}
