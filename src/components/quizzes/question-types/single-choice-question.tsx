"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SingleChoiceQuestionProps {
  questionId: string;
  question: string;
  choices: string[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showCorrect?: boolean;
  correctAnswer?: string;
}

export function SingleChoiceQuestion({
  questionId,
  question,
  choices,
  value,
  onChange,
  disabled = false,
  showCorrect = false,
  correctAnswer,
}: SingleChoiceQuestionProps) {
  return (
    <div className="space-y-4">
      <p className="text-base font-medium">{question}</p>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className="space-y-3"
      >
        {choices.map((choice, index) => {
          const isSelected = value === choice;
          const isCorrect = correctAnswer === choice;
          const showAsCorrect = showCorrect && isCorrect;
          const showAsIncorrect = showCorrect && isSelected && !isCorrect;

          return (
            <div
              key={`${questionId}-${index}`}
              className={cn(
                "flex items-center space-x-3 rounded-lg border p-4 transition-colors",
                isSelected && !showCorrect && "border-primary bg-primary/5",
                showAsCorrect && "border-green-500 bg-green-50",
                showAsIncorrect && "border-red-500 bg-red-50"
              )}
            >
              <RadioGroupItem
                value={choice}
                id={`${questionId}-${index}`}
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
              {showAsCorrect && (
                <span className="text-sm font-medium text-green-600">Correct</span>
              )}
              {showAsIncorrect && (
                <span className="text-sm font-medium text-red-600">Incorrect</span>
              )}
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
