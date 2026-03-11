"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderingQuestionProps {
  questionId: string;
  question: string;
  items: string[];
  value?: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  showCorrect?: boolean;
  correctAnswer?: string[];
}

export function OrderingQuestion({
  questionId,
  question,
  items,
  value,
  onChange,
  disabled = false,
  showCorrect = false,
  correctAnswer = [],
}: OrderingQuestionProps) {
  // Initialize with shuffled items if no value provided
  const [orderedItems, setOrderedItems] = useState<string[]>(() => {
    if (value && value.length > 0) return value;
    // Shuffle items for initial order
    return [...items].sort(() => Math.random() - 0.5);
  });

  useEffect(() => {
    if (value && value.length > 0) {
      setOrderedItems(value);
    }
  }, [value]);

  const moveItem = (index: number, direction: "up" | "down") => {
    if (disabled) return;

    const newItems = [...orderedItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setOrderedItems(newItems);
    onChange(newItems);
  };

  return (
    <div className="space-y-4">
      <p className="text-base font-medium">{question}</p>
      <p className="text-sm text-muted-foreground">
        Arrange the items in the correct order (first to last)
      </p>
      <div className="space-y-2">
        {orderedItems.map((item, index) => {
          const isCorrectPosition = showCorrect && correctAnswer[index] === item;
          const isIncorrectPosition = showCorrect && correctAnswer[index] !== item;

          return (
            <div
              key={`${questionId}-${item}`}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-4",
                isCorrectPosition && "border-green-500 bg-green-50",
                isIncorrectPosition && "border-red-500 bg-red-50"
              )}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1">{item}</span>
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={disabled || index === 0}
                  onClick={() => moveItem(index, "up")}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={disabled || index === orderedItems.length - 1}
                  onClick={() => moveItem(index, "down")}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              <span className="w-8 text-center text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              {showCorrect && isIncorrectPosition && (
                <span className="text-xs text-red-600">
                  Should be: {correctAnswer.indexOf(item) + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
