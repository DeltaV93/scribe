"use client";

import { cn } from "@/lib/utils";

interface ScaleQuestionProps {
  questionId: string;
  question: string;
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
}

export function ScaleQuestion({
  questionId,
  question,
  value,
  onChange,
  disabled = false,
  minValue = 1,
  maxValue = 10,
  minLabel = "Low",
  maxLabel = "High",
}: ScaleQuestionProps) {
  const range = Array.from(
    { length: maxValue - minValue + 1 },
    (_, i) => minValue + i
  );

  return (
    <div className="space-y-4">
      <p className="text-base font-medium">{question}</p>
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <div className="flex justify-between gap-2">
          {range.map((num) => (
            <button
              key={`${questionId}-${num}`}
              type="button"
              disabled={disabled}
              onClick={() => onChange(num)}
              className={cn(
                "flex-1 py-3 px-2 text-sm font-medium rounded-lg border transition-colors",
                "hover:border-primary hover:bg-primary/5",
                value === num && "border-primary bg-primary text-primary-foreground",
                disabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent"
              )}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
