"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from "lucide-react";

interface QuestionEditorProps {
  type: string;
  question: string;
  options?: Record<string, unknown>;
  correctAnswer: unknown;
  points: number;
  onChange: (updates: Partial<{
    question: string;
    options: Record<string, unknown>;
    correctAnswer: unknown;
    points: number;
  }>) => void;
}

export function QuestionEditor({
  type,
  question,
  options = {},
  correctAnswer,
  points,
  onChange,
}: QuestionEditorProps) {
  return (
    <div className="space-y-4">
      {/* Question Text */}
      <div className="space-y-2">
        <Label htmlFor="question-text">Question Text *</Label>
        <Textarea
          id="question-text"
          value={question}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder="Enter your question"
          rows={2}
        />
      </div>

      {/* Points */}
      <div className="space-y-2">
        <Label htmlFor="points">Points</Label>
        <Input
          id="points"
          type="number"
          min={1}
          max={100}
          value={points}
          onChange={(e) => onChange({ points: parseInt(e.target.value) || 1 })}
          className="w-24"
        />
      </div>

      {/* Type-specific editor */}
      {type === "SINGLE_CHOICE" && (
        <SingleChoiceEditor
          choices={(options.choices as string[]) || []}
          correctAnswer={correctAnswer as string}
          onChange={(choices, correct) =>
            onChange({ options: { ...options, choices }, correctAnswer: correct })
          }
        />
      )}

      {type === "MULTIPLE_CHOICE" && (
        <MultipleChoiceEditor
          choices={(options.choices as string[]) || []}
          correctAnswer={(correctAnswer as string[]) || []}
          onChange={(choices, correct) =>
            onChange({ options: { ...options, choices }, correctAnswer: correct })
          }
        />
      )}

      {type === "FREE_TEXT" && (
        <FreeTextEditor
          keywords={
            (correctAnswer as { keywords?: string[] })?.keywords || []
          }
          onChange={(keywords) =>
            onChange({
              correctAnswer: keywords.length > 0 ? { keywords } : null,
            })
          }
        />
      )}

      {type === "SCALE" && (
        <ScaleEditor
          minValue={(options.minValue as number) || 1}
          maxValue={(options.maxValue as number) || 10}
          minLabel={(options.minLabel as string) || "Low"}
          maxLabel={(options.maxLabel as string) || "High"}
          onChange={(updates) =>
            onChange({ options: { ...options, ...updates } })
          }
        />
      )}

      {type === "MATCHING" && (
        <MatchingEditor
          leftItems={(options.leftItems as string[]) || []}
          rightItems={(options.rightItems as string[]) || []}
          correctAnswer={(correctAnswer as Record<string, string>) || {}}
          onChange={(leftItems, rightItems, correct) =>
            onChange({
              options: { ...options, leftItems, rightItems },
              correctAnswer: correct,
            })
          }
        />
      )}

      {type === "ORDERING" && (
        <OrderingEditor
          items={(options.items as string[]) || []}
          correctOrder={(correctAnswer as string[]) || []}
          onChange={(items, correct) =>
            onChange({
              options: { ...options, items },
              correctAnswer: correct,
            })
          }
        />
      )}

      {type === "FILE_UPLOAD" && (
        <FileUploadEditor
          allowedTypes={(options.allowedTypes as string[]) || []}
          maxSizeBytes={(options.maxSizeBytes as number) || 10 * 1024 * 1024}
          onChange={(updates) =>
            onChange({ options: { ...options, ...updates } })
          }
        />
      )}
    </div>
  );
}

// Single Choice Editor
function SingleChoiceEditor({
  choices,
  correctAnswer,
  onChange,
}: {
  choices: string[];
  correctAnswer: string;
  onChange: (choices: string[], correct: string) => void;
}) {
  const addChoice = () => {
    onChange([...choices, `Option ${choices.length + 1}`], correctAnswer);
  };

  const removeChoice = (index: number) => {
    const newChoices = choices.filter((_, i) => i !== index);
    const correct = choices[index] === correctAnswer ? "" : correctAnswer;
    onChange(newChoices, correct);
  };

  const updateChoice = (index: number, value: string) => {
    const newChoices = [...choices];
    const wasCorrect = choices[index] === correctAnswer;
    newChoices[index] = value;
    onChange(newChoices, wasCorrect ? value : correctAnswer);
  };

  return (
    <div className="space-y-3">
      <Label>Answer Choices (select correct answer)</Label>
      <RadioGroup
        value={correctAnswer}
        onValueChange={(value) => onChange(choices, value)}
      >
        {choices.map((choice, index) => (
          <div key={index} className="flex items-center gap-2">
            <RadioGroupItem value={choice} id={`choice-${index}`} />
            <Input
              value={choice}
              onChange={(e) => updateChoice(index, e.target.value)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeChoice(index)}
              disabled={choices.length <= 2}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </RadioGroup>
      <Button variant="outline" size="sm" onClick={addChoice}>
        <Plus className="h-4 w-4 mr-2" />
        Add Choice
      </Button>
    </div>
  );
}

// Multiple Choice Editor
function MultipleChoiceEditor({
  choices,
  correctAnswer,
  onChange,
}: {
  choices: string[];
  correctAnswer: string[];
  onChange: (choices: string[], correct: string[]) => void;
}) {
  const addChoice = () => {
    onChange([...choices, `Option ${choices.length + 1}`], correctAnswer);
  };

  const removeChoice = (index: number) => {
    const removedChoice = choices[index];
    const newChoices = choices.filter((_, i) => i !== index);
    const newCorrect = correctAnswer.filter((c) => c !== removedChoice);
    onChange(newChoices, newCorrect);
  };

  const updateChoice = (index: number, value: string) => {
    const oldValue = choices[index];
    const newChoices = [...choices];
    newChoices[index] = value;
    const newCorrect = correctAnswer.map((c) => (c === oldValue ? value : c));
    onChange(newChoices, newCorrect);
  };

  const toggleCorrect = (choice: string) => {
    const newCorrect = correctAnswer.includes(choice)
      ? correctAnswer.filter((c) => c !== choice)
      : [...correctAnswer, choice];
    onChange(choices, newCorrect);
  };

  return (
    <div className="space-y-3">
      <Label>Answer Choices (check all correct answers)</Label>
      {choices.map((choice, index) => (
        <div key={index} className="flex items-center gap-2">
          <Checkbox
            checked={correctAnswer.includes(choice)}
            onCheckedChange={() => toggleCorrect(choice)}
          />
          <Input
            value={choice}
            onChange={(e) => updateChoice(index, e.target.value)}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeChoice(index)}
            disabled={choices.length <= 2}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addChoice}>
        <Plus className="h-4 w-4 mr-2" />
        Add Choice
      </Button>
    </div>
  );
}

// Free Text Editor
function FreeTextEditor({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}) {
  const addKeyword = () => {
    onChange([...keywords, ""]);
  };

  const removeKeyword = (index: number) => {
    onChange(keywords.filter((_, i) => i !== index));
  };

  const updateKeyword = (index: number, value: string) => {
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    onChange(newKeywords);
  };

  return (
    <div className="space-y-3">
      <Label>Keywords for Auto-Grading (optional)</Label>
      <p className="text-sm text-muted-foreground">
        If keywords are provided, answers containing all keywords will be auto-graded as correct.
        Otherwise, manual review is required.
      </p>
      {keywords.map((keyword, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={keyword}
            onChange={(e) => updateKeyword(index, e.target.value)}
            placeholder="Enter keyword"
            className="flex-1"
          />
          <Button variant="ghost" size="icon" onClick={() => removeKeyword(index)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addKeyword}>
        <Plus className="h-4 w-4 mr-2" />
        Add Keyword
      </Button>
    </div>
  );
}

// Scale Editor
function ScaleEditor({
  minValue,
  maxValue,
  minLabel,
  maxLabel,
  onChange,
}: {
  minValue: number;
  maxValue: number;
  minLabel: string;
  maxLabel: string;
  onChange: (updates: Partial<{
    minValue: number;
    maxValue: number;
    minLabel: string;
    maxLabel: string;
  }>) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="min-value">Min Value</Label>
        <Input
          id="min-value"
          type="number"
          value={minValue}
          onChange={(e) => onChange({ minValue: parseInt(e.target.value) || 1 })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="max-value">Max Value</Label>
        <Input
          id="max-value"
          type="number"
          value={maxValue}
          onChange={(e) => onChange({ maxValue: parseInt(e.target.value) || 10 })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="min-label">Min Label</Label>
        <Input
          id="min-label"
          value={minLabel}
          onChange={(e) => onChange({ minLabel: e.target.value })}
          placeholder="Low"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="max-label">Max Label</Label>
        <Input
          id="max-label"
          value={maxLabel}
          onChange={(e) => onChange({ maxLabel: e.target.value })}
          placeholder="High"
        />
      </div>
      <p className="text-sm text-muted-foreground md:col-span-2">
        Scale questions are always marked correct (self-assessment).
      </p>
    </div>
  );
}

// Matching Editor
function MatchingEditor({
  leftItems,
  rightItems,
  correctAnswer,
  onChange,
}: {
  leftItems: string[];
  rightItems: string[];
  correctAnswer: Record<string, string>;
  onChange: (
    leftItems: string[],
    rightItems: string[],
    correct: Record<string, string>
  ) => void;
}) {
  const addPair = () => {
    const newLeft = `Item ${leftItems.length + 1}`;
    const newRight = `Match ${rightItems.length + 1}`;
    onChange(
      [...leftItems, newLeft],
      [...rightItems, newRight],
      { ...correctAnswer, [newLeft]: newRight }
    );
  };

  const removePair = (index: number) => {
    const removedLeft = leftItems[index];
    const newLeft = leftItems.filter((_, i) => i !== index);
    const newRight = rightItems.filter((_, i) => i !== index);
    const newCorrect = { ...correctAnswer };
    delete newCorrect[removedLeft];
    onChange(newLeft, newRight, newCorrect);
  };

  const updateLeft = (index: number, value: string) => {
    const oldValue = leftItems[index];
    const newLeft = [...leftItems];
    newLeft[index] = value;
    const newCorrect = { ...correctAnswer };
    if (newCorrect[oldValue]) {
      newCorrect[value] = newCorrect[oldValue];
      delete newCorrect[oldValue];
    }
    onChange(newLeft, rightItems, newCorrect);
  };

  const updateRight = (index: number, value: string) => {
    const oldValue = rightItems[index];
    const newRight = [...rightItems];
    newRight[index] = value;
    const newCorrect = { ...correctAnswer };
    for (const key of Object.keys(newCorrect)) {
      if (newCorrect[key] === oldValue) {
        newCorrect[key] = value;
      }
    }
    onChange(leftItems, newRight, newCorrect);
  };

  const setMatch = (left: string, right: string) => {
    onChange(leftItems, rightItems, { ...correctAnswer, [left]: right });
  };

  return (
    <div className="space-y-3">
      <Label>Matching Pairs</Label>
      {leftItems.map((left, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={left}
            onChange={(e) => updateLeft(index, e.target.value)}
            placeholder="Left item"
            className="flex-1"
          />
          <span className="text-muted-foreground">matches</span>
          <Input
            value={rightItems[index] || ""}
            onChange={(e) => updateRight(index, e.target.value)}
            placeholder="Right item"
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removePair(index)}
            disabled={leftItems.length <= 2}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addPair}>
        <Plus className="h-4 w-4 mr-2" />
        Add Pair
      </Button>
    </div>
  );
}

// Ordering Editor
function OrderingEditor({
  items,
  correctOrder,
  onChange,
}: {
  items: string[];
  correctOrder: string[];
  onChange: (items: string[], correct: string[]) => void;
}) {
  const addItem = () => {
    const newItem = `Step ${items.length + 1}`;
    onChange([...items, newItem], [...correctOrder, newItem]);
  };

  const removeItem = (index: number) => {
    const removedItem = items[index];
    const newItems = items.filter((_, i) => i !== index);
    const newCorrect = correctOrder.filter((i) => i !== removedItem);
    onChange(newItems, newCorrect);
  };

  const updateItem = (index: number, value: string) => {
    const oldValue = items[index];
    const newItems = [...items];
    newItems[index] = value;
    const newCorrect = correctOrder.map((i) => (i === oldValue ? value : i));
    onChange(newItems, newCorrect);
  };

  return (
    <div className="space-y-3">
      <Label>Items (in correct order)</Label>
      <p className="text-sm text-muted-foreground">
        Enter items in the correct sequence. They will be shuffled when displayed to users.
      </p>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-8 text-center text-sm font-medium text-muted-foreground">
            {index + 1}.
          </span>
          <Input
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder="Enter item"
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeItem(index)}
            disabled={items.length <= 2}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem}>
        <Plus className="h-4 w-4 mr-2" />
        Add Item
      </Button>
    </div>
  );
}

// File Upload Editor
function FileUploadEditor({
  allowedTypes,
  maxSizeBytes,
  onChange,
}: {
  allowedTypes: string[];
  maxSizeBytes: number;
  onChange: (updates: Partial<{
    allowedTypes: string[];
    maxSizeBytes: number;
  }>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="allowed-types">Allowed File Types</Label>
        <Input
          id="allowed-types"
          value={allowedTypes.join(", ")}
          onChange={(e) =>
            onChange({
              allowedTypes: e.target.value.split(",").map((t) => t.trim()),
            })
          }
          placeholder="image/*, application/pdf, .doc, .docx"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated list of MIME types or file extensions
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="max-size">Max File Size (MB)</Label>
        <Input
          id="max-size"
          type="number"
          min={1}
          max={50}
          value={Math.round(maxSizeBytes / 1024 / 1024)}
          onChange={(e) =>
            onChange({
              maxSizeBytes: (parseInt(e.target.value) || 10) * 1024 * 1024,
            })
          }
        />
      </div>
      <p className="text-sm text-muted-foreground">
        File upload questions require manual review.
      </p>
    </div>
  );
}
