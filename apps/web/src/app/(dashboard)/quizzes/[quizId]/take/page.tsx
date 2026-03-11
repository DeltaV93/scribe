"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { QuizTaker } from "@/components/quizzes";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Play, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

interface QuizData {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  maxAttempts: number | null;
  questions: Array<{
    id: string;
    type: string;
    question: string;
    options: Record<string, unknown> | null;
    points: number;
    order: number;
  }>;
  userAttemptCount?: number;
  canAttempt?: boolean;
}

interface AttemptData {
  id: string;
  quizId: string;
  status: "IN_PROGRESS" | "PASSED" | "FAILED";
  answers: Array<{
    id: string;
    questionId: string;
    answer: unknown;
  }>;
}

export default function TakeQuizPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { toast } = useToast();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuiz() {
      try {
        const response = await fetch(`/api/quizzes/${quizId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Quiz not found");
          } else {
            throw new Error("Failed to fetch quiz");
          }
          return;
        }
        const data = await response.json();
        setQuiz(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quiz");
      } finally {
        setIsLoading(false);
      }
    }
    fetchQuiz();
  }, [quizId]);

  const startQuiz = async () => {
    setIsStarting(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start quiz");
      }

      const data = await response.json();
      setAttempt(data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to start quiz",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleAnswerSubmit = async (questionId: string, answer: unknown) => {
    if (!attempt) return;

    try {
      const response = await fetch(`/api/quiz-attempts/${attempt.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save answer");
      }
    } catch (err) {
      toast({
        title: "Error saving answer",
        description: err instanceof Error ? err.message : "Failed to save answer",
        variant: "destructive",
      });
    }
  };

  const handleSubmitQuiz = async () => {
    if (!attempt) return;

    try {
      const response = await fetch(`/api/quiz-attempts/${attempt.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit quiz");
      }

      const result = await response.json();
      toast({
        title: result.status === "PASSED" ? "Congratulations!" : "Quiz Completed",
        description:
          result.status === "PASSED"
            ? `You passed with a score of ${result.score}%!`
            : `You scored ${result.score}%. ${quiz?.passingScore}% required to pass.`,
        variant: result.status === "PASSED" ? "default" : "destructive",
      });
      router.push(`/quizzes/${quizId}/results/${attempt.id}`);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit quiz",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">{error || "Quiz not found"}</p>
            <Button asChild>
              <Link href="/quizzes">Back to Quizzes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If quiz has already been passed and can't attempt again
  if (quiz.canAttempt === false && quiz.userAttemptCount !== undefined) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/quizzes">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <CardTitle>{quiz.title}</CardTitle>
            </div>
            <CardDescription>{quiz.description}</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Quiz Completed</h3>
            <p className="text-muted-foreground mb-4">
              You have already completed this quiz successfully.
            </p>
            <Button asChild>
              <Link href="/quizzes">Back to Quizzes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show start screen if no attempt yet
  if (!attempt) {
    const attemptsUsed = quiz.userAttemptCount ?? 0;
    const attemptsRemaining = quiz.maxAttempts
      ? quiz.maxAttempts - attemptsUsed
      : null;

    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/quizzes">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <CardTitle>{quiz.title}</CardTitle>
            </div>
            {quiz.description && (
              <CardDescription>{quiz.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{quiz.questions.length} questions</Badge>
              <Badge variant="outline">Pass: {quiz.passingScore}%</Badge>
              {attemptsRemaining !== null && (
                <Badge variant={attemptsRemaining > 0 ? "outline" : "destructive"}>
                  {attemptsRemaining} attempts remaining
                </Badge>
              )}
            </div>

            {attemptsRemaining === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Attempts Remaining</h3>
                <p className="text-muted-foreground">
                  You have used all available attempts for this quiz.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <Button size="lg" onClick={startQuiz} disabled={isStarting}>
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {attemptsUsed > 0 ? "Retake Quiz" : "Start Quiz"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show quiz taker
  return (
    <div className="container mx-auto py-8">
      <QuizTaker
        quizId={quiz.id}
        attemptId={attempt.id}
        title={quiz.title}
        questions={quiz.questions.map((q) => ({
          id: q.id,
          type: q.type,
          question: q.question,
          options: (q.options ?? {}) as {
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
          },
          points: q.points,
          order: q.order,
        }))}
        initialAnswers={attempt.answers.reduce(
          (acc, a) => ({ ...acc, [a.questionId]: a.answer }),
          {}
        )}
        onSubmitAnswer={handleAnswerSubmit}
        onComplete={handleSubmitQuiz}
      />
    </div>
  );
}
