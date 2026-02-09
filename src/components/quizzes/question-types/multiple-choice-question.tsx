"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MultipleChoiceQuestionProps {
  questionId: string;
  question: string;
  choices: string[];
  value?: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  showCorrect?: boolean;
  correctAnswer?: string[];
}

export function MultipleChoiceQuestion({
  questionId,
  question,
  choices,
  value = [],
  onChange,
  disabled = false,
  showCorrect = false,
  correctAnswer = [],
}: MultipleChoiceQuestionProps) {
  const handleToggle = (choice: string) => {
    if (disabled) return;

    if (value.includes(choice)) {
      onChange(value.filter((v) => v !== choice));
    } else {
      onChange([...value, choice]);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-base font-medium">{question}</p>
      <p className="text-sm text-muted-foreground">Select all that apply</p>
      <div className="space-y-3">
        {choices.map((choice, index) => {
          const isSelected = value.includes(choice);
          const isCorrect = correctAnswer.includes(choice);
          const showAsCorrect = showCorrect && isCorrect;
          const showAsIncorrect = showCorrect && isSelected && !isCorrect;
          const showAsMissed = showCorrect && !isSelected && isCorrect;

          return (
            <div
              key={`${questionId}-${index}`}
              className={cn(
                "flex items-center space-x-3 rounded-lg border p-4 transition-colors cursor-pointer",
                isSelected && !showCorrect && "border-primary bg-primary/5",
                showAsCorrect && isSelected && "border-green-500 bg-green-50",
                showAsIncorrect && "border-red-500 bg-red-50",
                showAsMissed && "border-yellow-500 bg-yellow-50",
                disabled && "cursor-default"
              )}
              onClick={() => handleToggle(choice)}
            >
              <Checkbox
                id={`${questionId}-${index}`}
                checked={isSelected}
                disabled={disabled}
                onCheckedChange={() => handleToggle(choice)}
              />
              <Label
                htmlFor={`${questionId}-${index}`}
                className={cn(
                  "flex-1 cursor-pointer font-normal",
                  disabled && "cursor-default"
                )}
              >
                {choice}
              </Label>
              {showAsCorrect && isSelected && (
                <span className="text-sm font-medium text-green-600">Correct</span>
              )}
              {showAsIncorrect && (
                <span className="text-sm font-medium text-red-600">Should not be selected</span>
              )}
              {showAsMissed && (
                <span className="text-sm font-medium text-yellow-600">Should be selected</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
