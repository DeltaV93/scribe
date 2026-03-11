"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MatchingQuestionProps {
  questionId: string;
  question: string;
  leftItems: string[];
  rightItems: string[];
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
  showCorrect?: boolean;
  correctAnswer?: Record<string, string>;
}

export function MatchingQuestion({
  questionId,
  question,
  leftItems,
  rightItems,
  value = {},
  onChange,
  disabled = false,
  showCorrect = false,
  correctAnswer = {},
}: MatchingQuestionProps) {
  const handleMatch = (leftItem: string, rightItem: string) => {
    onChange({
      ...value,
      [leftItem]: rightItem,
    });
  };

  // Get used right items to prevent duplicate selections
  const usedRightItems = Object.values(value);

  return (
    <div className="space-y-4">
      <p className="text-base font-medium">{question}</p>
      <p className="text-sm text-muted-foreground">
        Match each item on the left with the correct item on the right
      </p>
      <div className="space-y-3">
        {leftItems.map((leftItem, index) => {
          const selectedValue = value[leftItem];
          const isCorrect = correctAnswer[leftItem] === selectedValue;
          const showAsCorrect = showCorrect && isCorrect;
          const showAsIncorrect = showCorrect && selectedValue && !isCorrect;

          return (
            <div
              key={`${questionId}-${index}`}
              className={cn(
                "flex items-center gap-4 rounded-lg border p-4",
                showAsCorrect && "border-green-500 bg-green-50",
                showAsIncorrect && "border-red-500 bg-red-50"
              )}
            >
              <Label className="flex-1 font-normal">{leftItem}</Label>
              <Select
                value={selectedValue}
                onValueChange={(val) => handleMatch(leftItem, val)}
                disabled={disabled}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select match..." />
                </SelectTrigger>
                <SelectContent>
                  {rightItems.map((rightItem) => {
                    const isUsed = usedRightItems.includes(rightItem) && value[leftItem] !== rightItem;
                    return (
                      <SelectItem
                        key={rightItem}
                        value={rightItem}
                        disabled={isUsed}
                      >
                        {rightItem}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {showAsCorrect && (
                <span className="text-sm font-medium text-green-600">Correct</span>
              )}
              {showAsIncorrect && (
                <span className="text-sm font-medium text-red-600">
                  Correct: {correctAnswer[leftItem]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
