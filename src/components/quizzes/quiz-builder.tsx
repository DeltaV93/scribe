"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { QuestionEditor } from "./question-editor";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  id?: string;
  type: string;
  question: string;
  options?: Record<string, unknown>;
  correctAnswer: unknown;
  points: number;
  order: number;
}

interface QuizBuilderProps {
  initialData?: {
    id?: string;
    title: string;
    description: string | null;
    audience: "STAFF" | "CLIENT" | "BOTH";
    passingScore: number;
    maxAttempts: number | null;
    questions: QuizQuestion[];
  };
  onSave: (data: {
    title: string;
    description: string | null;
    audience: "STAFF" | "CLIENT" | "BOTH";
    passingScore: number;
    maxAttempts: number | null;
    questions: QuizQuestion[];
  }) => Promise<void>;
  isSubmitting?: boolean;
}

const QUESTION_TYPES = [
  { value: "SINGLE_CHOICE", label: "Single Choice" },
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
  { value: "FREE_TEXT", label: "Free Text" },
  { value: "SCALE", label: "Scale Rating" },
  { value: "MATCHING", label: "Matching" },
  { value: "ORDERING", label: "Ordering" },
  { value: "FILE_UPLOAD", label: "File Upload" },
];

export function QuizBuilder({
  initialData,
  onSave,
  isSubmitting = false,
}: QuizBuilderProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [audience, setAudience] = useState<"STAFF" | "CLIENT" | "BOTH">(
    initialData?.audience || "BOTH"
  );
  const [passingScore, setPassingScore] = useState(initialData?.passingScore || 80);
  const [maxAttempts, setMaxAttempts] = useState<number | null>(
    initialData?.maxAttempts ?? null
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initialData?.questions || []
  );
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const addQuestion = (type: string) => {
    const newQuestion: QuizQuestion = {
      type,
      question: "",
      options: getDefaultOptions(type),
      correctAnswer: getDefaultCorrectAnswer(type),
      points: 1,
      order: questions.length,
    };
    setQuestions([...questions, newQuestion]);
    setExpandedQuestion(questions.length);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestions(newQuestions);
  };

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    // Update order for remaining questions
    newQuestions.forEach((q, i) => {
      q.order = i;
    });
    setQuestions(newQuestions);
    setExpandedQuestion(null);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[targetIndex]] = [
      newQuestions[targetIndex],
      newQuestions[index],
    ];
    // Update order
    newQuestions.forEach((q, i) => {
      q.order = i;
    });
    setQuestions(newQuestions);
    setExpandedQuestion(targetIndex);
  };

  const handleSave = async () => {
    await onSave({
      title,
      description: description || null,
      audience,
      passingScore,
      maxAttempts,
      questions,
    });
  };

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const isValid = title.trim() && questions.length > 0 && questions.every((q) => q.question.trim());

  return (
    <div className="space-y-6">
      {/* Quiz Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter quiz title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                <SelectTrigger id="audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff Only</SelectItem>
                  <SelectItem value="CLIENT">Clients Only</SelectItem>
                  <SelectItem value="BOTH">Everyone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="passingScore">Passing Score (%)</Label>
              <Input
                id="passingScore"
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxAttempts">Max Attempts</Label>
              <Input
                id="maxAttempts"
                type="number"
                min={1}
                value={maxAttempts ?? ""}
                onChange={(e) =>
                  setMaxAttempts(e.target.value ? parseInt(e.target.value) : null)
                }
                placeholder="Unlimited"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Questions</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {questions.length} question{questions.length !== 1 ? "s" : ""} | {totalPoints} total points
            </p>
          </div>
          <Select onValueChange={addQuestion}>
            <SelectTrigger className="w-[180px]">
              <Plus className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Add Question" />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No questions yet. Add your first question above.
            </div>
          ) : (
            questions.map((question, index) => (
              <div
                key={index}
                className={cn(
                  "border rounded-lg transition-colors",
                  expandedQuestion === index && "border-primary"
                )}
              >
                <div
                  className="flex items-center gap-2 p-4 cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    setExpandedQuestion(expandedQuestion === index ? null : index)
                  }
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs">
                    Q{index + 1}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {QUESTION_TYPES.find((t) => t.value === question.type)?.label}
                  </Badge>
                  <span className="flex-1 truncate text-sm">
                    {question.question || "(no question text)"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {question.points} pt{question.points !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(index, "up");
                      }}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(index, "down");
                      }}
                      disabled={index === questions.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeQuestion(index);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {expandedQuestion === index && (
                  <div className="border-t p-4">
                    <QuestionEditor
                      type={question.type}
                      question={question.question}
                      options={question.options as Record<string, unknown>}
                      correctAnswer={question.correctAnswer}
                      points={question.points}
                      onChange={(updates) => updateQuestion(index, updates)}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSave}
          disabled={isSubmitting || !isValid}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {initialData?.id ? "Update Quiz" : "Create Quiz"}
        </Button>
      </div>
    </div>
  );
}

function getDefaultOptions(type: string): Record<string, unknown> {
  switch (type) {
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
      return { choices: ["Option 1", "Option 2", "Option 3"] };
    case "MATCHING":
      return { leftItems: ["Item A", "Item B"], rightItems: ["Match 1", "Match 2"] };
    case "ORDERING":
      return { items: ["First", "Second", "Third"] };
    case "SCALE":
      return { minValue: 1, maxValue: 10, minLabel: "Low", maxLabel: "High" };
    case "FILE_UPLOAD":
      return { allowedTypes: ["image/*", "application/pdf"], maxSizeBytes: 10 * 1024 * 1024 };
    default:
      return {};
  }
}

function getDefaultCorrectAnswer(type: string): unknown {
  switch (type) {
    case "SINGLE_CHOICE":
      return "";
    case "MULTIPLE_CHOICE":
      return [];
    case "ORDERING":
      return [];
    case "MATCHING":
      return {};
    case "SCALE":
      return 5;
    case "FREE_TEXT":
    case "FILE_UPLOAD":
      return null;
    default:
      return null;
  }
}
