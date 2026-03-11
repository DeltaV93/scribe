"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuizBuilder } from "@/components/quizzes";
import { useToast } from "@/components/ui/use-toast";

export default function NewQuizPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (data: {
    title: string;
    description: string | null;
    audience: "STAFF" | "CLIENT" | "BOTH";
    passingScore: number;
    maxAttempts: number | null;
    questions: Array<{
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
      const response = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create quiz");
      }

      const quiz = await response.json();
      toast({
        title: "Quiz Created",
        description: "Your quiz has been created successfully.",
      });
      router.push(`/quizzes/${quiz.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create quiz",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create New Quiz</h1>
        <p className="text-muted-foreground">
          Build a quiz with questions to assess knowledge and skills
        </p>
      </div>
      <QuizBuilder onSave={handleSave} isSubmitting={isSubmitting} />
    </div>
  );
}
