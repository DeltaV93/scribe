"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { QuizBuilder } from "@/components/quizzes";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface QuizData {
  id: string;
  title: string;
  description: string | null;
  audience: "STAFF" | "CLIENT" | "BOTH";
  passingScore: number;
  maxAttempts: number | null;
  questions: Array<{
    id: string;
    type: string;
    question: string;
    options: Record<string, unknown> | null;
    correctAnswer: unknown;
    points: number;
    order: number;
  }>;
}

export default function EditQuizPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { toast } = useToast();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSave = async (data: {
    title: string;
    description: string | null;
    audience: "STAFF" | "CLIENT" | "BOTH";
    passingScore: number;
    maxAttempts: number | null;
    questions: Array<{
      id?: string;
      type: string;
      question: string;
      options?: Record<string, unknown>;
      correctAnswer: unknown;
      points: number;
      order: number;
    }>;
  }) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update quiz");
      }

      toast({
        title: "Quiz Updated",
        description: "Your quiz has been updated successfully.",
      });
      router.push(`/quizzes/${quizId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update quiz",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/quizzes/${quizId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit Quiz</h1>
        </div>
        <p className="text-muted-foreground ml-10">
          Modify quiz settings and questions
        </p>
      </div>
      <QuizBuilder
        initialData={{
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          audience: quiz.audience,
          passingScore: quiz.passingScore,
          maxAttempts: quiz.maxAttempts,
          questions: quiz.questions.map((q) => ({
            id: q.id,
            type: q.type,
            question: q.question,
            options: q.options ?? undefined,
            correctAnswer: q.correctAnswer,
            points: q.points,
            order: q.order,
          })),
        }}
        onSave={handleSave}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
