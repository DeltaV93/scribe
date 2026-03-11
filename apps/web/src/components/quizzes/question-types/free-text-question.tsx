"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface FreeTextQuestionProps {
  questionId: string;
  question: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showCorrect?: boolean;
  isCorrect?: boolean | null;
}

export function FreeTextQuestion({
  questionId,
  question,
  value = "",
  onChange,
  disabled = false,
  placeholder = "Enter your answer...",
  showCorrect = false,
  isCorrect,
}: FreeTextQuestionProps) {
  return (
    <div className="space-y-4">
      <Label htmlFor={questionId} className="text-base font-medium">
        {question}
      </Label>
      <Textarea
        id={questionId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={4}
        className="resize-none"
      />
      {showCorrect && isCorrect !== null && (
        <div
          className={`text-sm font-medium ${
            isCorrect ? "text-green-600" : "text-yellow-600"
          }`}
        >
          {isCorrect ? "Answer accepted" : "Pending review"}
        </div>
      )}
      {showCorrect && isCorrect === null && (
        <div className="text-sm text-muted-foreground">
          This answer requires manual review
        </div>
      )}
    </div>
  );
}
