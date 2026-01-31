"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  text: string;
  type: "text" | "textarea" | "select" | "multiselect" | "boolean" | "date" | "number";
  required: boolean;
  helpText?: string;
  options?: QuestionOption[];
  placeholder?: string;
  dependsOn?: {
    questionId: string;
    value: string | string[] | boolean;
  };
}

export interface QuestionSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

interface QuestionnaireStepProps {
  sections: QuestionSection[];
  answers: Record<string, unknown>;
  onAnswerChange: (questionId: string, value: unknown) => void;
  errors?: Array<{ questionId: string; message: string }>;
}

export function QuestionnaireStep({
  sections,
  answers,
  onAnswerChange,
  errors = [],
}: QuestionnaireStepProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map((s) => s.id))
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const getError = (questionId: string) => {
    return errors.find((e) => e.questionId === questionId);
  };

  const shouldShowQuestion = (question: Question): boolean => {
    if (!question.dependsOn) return true;

    const dependsOnValue = answers[question.dependsOn.questionId];
    const expectedValue = question.dependsOn.value;

    if (Array.isArray(expectedValue)) {
      return expectedValue.includes(dependsOnValue as string);
    }

    return dependsOnValue === expectedValue;
  };

  const renderQuestion = (question: Question) => {
    if (!shouldShowQuestion(question)) return null;

    const error = getError(question.id);
    const value = answers[question.id];

    return (
      <div key={question.id} className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={question.id} className="text-sm font-medium">
            {question.text}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.helpText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{question.helpText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {question.type === "text" && (
          <Input
            id={question.id}
            value={(value as string) || ""}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder}
            className={error ? "border-destructive" : ""}
          />
        )}

        {question.type === "textarea" && (
          <Textarea
            id={question.id}
            value={(value as string) || ""}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder}
            rows={3}
            className={error ? "border-destructive" : ""}
          />
        )}

        {question.type === "number" && (
          <Input
            id={question.id}
            type="number"
            value={(value as number) || ""}
            onChange={(e) => onAnswerChange(question.id, e.target.value ? Number(e.target.value) : null)}
            placeholder={question.placeholder}
            className={error ? "border-destructive" : ""}
          />
        )}

        {question.type === "date" && (
          <Input
            id={question.id}
            type="date"
            value={(value as string) || ""}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            className={error ? "border-destructive" : ""}
          />
        )}

        {question.type === "select" && question.options && (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => onAnswerChange(question.id, v)}
          >
            <SelectTrigger className={error ? "border-destructive" : ""}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {question.type === "multiselect" && question.options && (
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => {
              const selected = Array.isArray(value) && value.includes(option.value);
              return (
                <Badge
                  key={option.value}
                  variant={selected ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    const current = (value as string[]) || [];
                    if (selected) {
                      onAnswerChange(
                        question.id,
                        current.filter((v) => v !== option.value)
                      );
                    } else {
                      onAnswerChange(question.id, [...current, option.value]);
                    }
                  }}
                >
                  {option.label}
                </Badge>
              );
            })}
          </div>
        )}

        {question.type === "boolean" && (
          <div className="flex items-center gap-3">
            <Switch
              id={question.id}
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => onAnswerChange(question.id, checked)}
            />
            <Label htmlFor={question.id} className="text-sm text-muted-foreground">
              {value ? "Yes" : "No"}
            </Label>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error.message}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader
            className="cursor-pointer"
            onClick={() => toggleSection(section.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                {section.description && (
                  <CardDescription className="mt-1">
                    {section.description}
                  </CardDescription>
                )}
              </div>
              <Button variant="ghost" size="icon">
                {expandedSections.has(section.id) ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </Button>
            </div>
          </CardHeader>
          {expandedSections.has(section.id) && (
            <CardContent className="space-y-6">
              {section.questions.map(renderQuestion)}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
