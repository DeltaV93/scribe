"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Send, Loader2 } from "lucide-react";
import {
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  FreeTextQuestion,
  ScaleQuestion,
  MatchingQuestion,
  OrderingQuestion,
  FileUploadQuestion,
} from "./question-types";

interface QuizQuestion {
  id: string;
  type: string;
  question: string;
  options?: {
    choices?: string[];
    leftItems?: string[];
    rightItems?: string[];
    items?: string[];
    minValue?: number;
    maxValue?: number;
    minLabel?: string;
    maxLabel?: string;
    allowedTypes?: string[];
    maxSizeBytes?: number;
  };
  points: number;
  order: number;
}

interface QuizTakerProps {
  quizId: string;
  attemptId: string;
  title: string;
  questions: QuizQuestion[];
  onSubmitAnswer: (questionId: string, answer: unknown, fileUrl?: string) => Promise<void>;
  onComplete: () => Promise<void>;
  initialAnswers?: Record<string, unknown>;
}

export function QuizTaker({
  quizId,
  attemptId,
  title,
  questions,
  onSubmitAnswer,
  onComplete,
  initialAnswers = {},
}: QuizTakerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const handleAnswerChange = useCallback(
    async (answer: unknown, fileUrl?: string) => {
      if (!currentQuestion) return;

      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: answer,
      }));

      // Auto-save answer
      setIsSubmitting(true);
      try {
        await onSubmitAnswer(currentQuestion.id, answer, fileUrl);
      } catch (error) {
        console.error("Failed to save answer:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentQuestion, onSubmitAnswer]
  );

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete();
    } catch (error) {
      console.error("Failed to complete quiz:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    const answer = answers[currentQuestion.id];
    const options = currentQuestion.options || {};

    switch (currentQuestion.type) {
      case "SINGLE_CHOICE":
        return (
          <SingleChoiceQuestion
            questionId={currentQuestion.id}
            question={currentQuestion.question}
            choices={options.choices || []}
            value={answer as string | undefined}
            onChange={(value) => handleAnswerChange(value)}
          />
        );

      case "MULTIPLE_CHOICE":
        return (
          <MultipleChoiceQuestion
            questionId={currentQuestion.id}
            question={currentQuestion.question}
            choices={options.choices || []}
            value={answer as string[] | undefined}
            onChange={(value) => handleAnswerChange(value)}
          />
        );

      case "FREE_TEXT":
        return (
          <FreeTextQuestion
            questionId={currentQuestion.id}
            question={currentQuestion.question}
            value={answer as string | undefined}
            onChange={(value) => handleAnswerChange(value)}
          />
        );

      case "SCALE":
        return (
          <ScaleQuestion
            questionId={currentQuestion.id}
            question={currentQuestion.question}
            value={answer as number | undefined}
            onChange={(value) => handleAnswerChange(value)}
            minValue={options.minValue}
            maxValue={options.maxValue}
            minLabel={options.minLabel}
            maxLabel={options.maxLabel}
          />
        );

      case "MATCHING":
        return (
          <MatchingQuestion
            questionId={currentQuestion.id}
            question={currentQuestion.question}
            leftItems={options.leftItems || []}
            rightItems={options.rightItems || []}
            value={answer as Record<string, string> | undefined}
            onChange={(value) => handleAnswerChange(value)}
          />
        );

      case "ORDERING":
        return (
          <OrderingQuestion
            questionId={currentQuestion.id}
            question={currentQuestion.question}
            items={options.items || []}
            value={answer as string[] | undefined}
            onChange={(value) => handleAnswerChange(value)}
          />
        );

      case "FILE_UPLOAD":
        return (
          <FileUploadQuestion
            questionId={currentQuestion.id}
            question={currentQuestion.question}
            value={answer as { fileUrl: string; fileName: string } | undefined}
            onChange={(value) => handleAnswerChange(value, value?.fileUrl)}
            allowedTypes={options.allowedTypes}
            maxSizeBytes={options.maxSizeBytes}
          />
        );

      default:
        return <p>Unknown question type: {currentQuestion.type}</p>;
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-xl">{title}</CardTitle>
          <Badge variant="outline">
            {currentIndex + 1} of {questions.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground mt-2">
          <span>
            {answeredCount} of {questions.length} answered
          </span>
          {currentQuestion && (
            <span>{currentQuestion.points} point{currentQuestion.points !== 1 ? "s" : ""}</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="min-h-[300px]">
        {renderQuestion()}
        {isSubmitting && (
          <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={goToPrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          {currentIndex === questions.length - 1 ? (
            <Button
              onClick={handleComplete}
              disabled={isCompleting || !allAnswered}
            >
              {isCompleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Quiz
            </Button>
          ) : (
            <Button onClick={goToNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
