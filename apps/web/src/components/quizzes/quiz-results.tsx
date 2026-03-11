"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Clock, ArrowLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface QuizAnswer {
  id: string;
  questionId: string;
  answer: unknown;
  isCorrect: boolean | null;
  pointsEarned: number | null;
  question: {
    id: string;
    question: string;
    type: string;
    points: number;
    correctAnswer?: unknown;
  };
}

interface QuizResultsProps {
  quizId: string;
  quizTitle: string;
  attemptId: string;
  score: number | null;
  totalPoints: number | null;
  maxPoints: number | null;
  status: "IN_PROGRESS" | "PASSED" | "FAILED";
  passingScore: number;
  answers: QuizAnswer[];
  completedAt: string | null;
  canRetake: boolean;
  onRetake?: () => void;
}

export function QuizResults({
  quizId,
  quizTitle,
  attemptId,
  score,
  totalPoints,
  maxPoints,
  status,
  passingScore,
  answers,
  completedAt,
  canRetake,
  onRetake,
}: QuizResultsProps) {
  const passed = status === "PASSED";
  const inProgress = status === "IN_PROGRESS";
  const pendingReview = answers.some((a) => a.isCorrect === null);

  const correctCount = answers.filter((a) => a.isCorrect === true).length;
  const incorrectCount = answers.filter((a) => a.isCorrect === false).length;
  const pendingCount = answers.filter((a) => a.isCorrect === null).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Results Summary Card */}
      <Card className={cn(
        "border-2",
        passed && "border-green-500",
        status === "FAILED" && "border-red-500",
        inProgress && "border-yellow-500"
      )}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {passed ? (
              <CheckCircle className="h-16 w-16 text-green-500" />
            ) : inProgress ? (
              <Clock className="h-16 w-16 text-yellow-500" />
            ) : (
              <XCircle className="h-16 w-16 text-red-500" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {passed ? "Congratulations!" : inProgress ? "Quiz Submitted" : "Quiz Not Passed"}
          </CardTitle>
          <CardDescription>
            {quizTitle}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Score Display */}
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">
              {score !== null ? `${score}%` : "--"}
            </div>
            <p className="text-muted-foreground">
              {totalPoints ?? 0} of {maxPoints ?? 0} points
            </p>
            <Progress
              value={score ?? 0}
              className={cn(
                "h-3 mt-4",
                passed && "[&>div]:bg-green-500",
                status === "FAILED" && "[&>div]:bg-red-500"
              )}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Passing score: {passingScore}%
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">{correctCount}</div>
              <p className="text-sm text-green-600">Correct</p>
            </div>
            <div className="p-4 rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-600">{incorrectCount}</div>
              <p className="text-sm text-red-600">Incorrect</p>
            </div>
            <div className="p-4 rounded-lg bg-yellow-50">
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <p className="text-sm text-yellow-600">Pending</p>
            </div>
          </div>

          {pendingReview && (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-sm text-yellow-800">
                Some answers require manual review. Your final score may change after review.
              </p>
            </div>
          )}

          {completedAt && (
            <p className="text-sm text-muted-foreground text-center">
              Completed on {new Date(completedAt).toLocaleString()}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Button variant="outline" asChild>
              <Link href="/quizzes">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Quizzes
              </Link>
            </Button>
            {canRetake && !passed && onRetake && (
              <Button onClick={onRetake}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retake Quiz
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Answer Review */}
      <Card>
        <CardHeader>
          <CardTitle>Answer Review</CardTitle>
          <CardDescription>
            Review your answers below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {answers.map((answer, index) => (
            <div
              key={answer.id}
              className={cn(
                "p-4 rounded-lg border",
                answer.isCorrect === true && "bg-green-50 border-green-200",
                answer.isCorrect === false && "bg-red-50 border-red-200",
                answer.isCorrect === null && "bg-yellow-50 border-yellow-200"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {answer.isCorrect === true ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : answer.isCorrect === false ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      Q{index + 1}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {answer.question.type.replace("_", " ")}
                    </Badge>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {answer.pointsEarned ?? 0} / {answer.question.points} pts
                    </span>
                  </div>
                  <p className="font-medium mb-2">{answer.question.question}</p>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Your answer: </span>
                    <span className="font-medium">
                      {formatAnswer(answer.answer, answer.question.type)}
                    </span>
                  </div>
                  {answer.isCorrect === false && answer.question.correctAnswer !== undefined && (
                    <div className="text-sm mt-1">
                      <span className="text-muted-foreground">Correct answer: </span>
                      <span className="font-medium text-green-600">
                        {String(formatAnswer(answer.question.correctAnswer, answer.question.type))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function formatAnswer(answer: unknown, type: string): string {
  if (answer === null || answer === undefined) {
    return "(not answered)";
  }

  switch (type) {
    case "SINGLE_CHOICE":
    case "FREE_TEXT":
      return String(answer);

    case "MULTIPLE_CHOICE":
    case "ORDERING":
      return Array.isArray(answer) ? answer.join(", ") : String(answer);

    case "SCALE":
      return String(answer);

    case "MATCHING":
      if (typeof answer === "object" && answer !== null) {
        return Object.entries(answer as Record<string, string>)
          .map(([left, right]) => `${left} -> ${right}`)
          .join("; ");
      }
      return String(answer);

    case "FILE_UPLOAD":
      if (typeof answer === "object" && answer !== null && "fileName" in answer) {
        return (answer as { fileName: string }).fileName;
      }
      return "(file uploaded)";

    default:
      return JSON.stringify(answer);
  }
}
