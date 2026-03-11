"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, FileQuestion, Users, User, Play } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  audience: "STAFF" | "CLIENT" | "BOTH";
  passingScore: number;
  maxAttempts: number | null;
  _count?: {
    questions: number;
    attempts: number;
  };
  userAttemptCount?: number;
  canAttempt?: boolean;
}

interface QuizListProps {
  quizzes: Quiz[];
  isAdmin?: boolean;
  emptyMessage?: string;
}

export function QuizList({
  quizzes,
  isAdmin = false,
  emptyMessage = "No quizzes available",
}: QuizListProps) {
  if (quizzes.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{emptyMessage}</p>
        {isAdmin && (
          <Button className="mt-4" asChild>
            <Link href="/quizzes/new">Create Quiz</Link>
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {quizzes.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

function QuizCard({ quiz, isAdmin }: { quiz: Quiz; isAdmin: boolean }) {
  const audienceIcon =
    quiz.audience === "STAFF" ? (
      <User className="h-4 w-4" />
    ) : quiz.audience === "CLIENT" ? (
      <Users className="h-4 w-4" />
    ) : (
      <Users className="h-4 w-4" />
    );

  const audienceLabel =
    quiz.audience === "STAFF"
      ? "Staff Only"
      : quiz.audience === "CLIENT"
      ? "Clients Only"
      : "Everyone";

  const hasPassed = quiz.userAttemptCount !== undefined && !quiz.canAttempt;
  const attemptsUsed = quiz.userAttemptCount ?? 0;
  const attemptsRemaining = quiz.maxAttempts
    ? quiz.maxAttempts - attemptsUsed
    : null;

  return (
    <Card className={cn(hasPassed && "border-green-200 bg-green-50/50")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{quiz.title}</CardTitle>
          {hasPassed && (
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
          )}
        </div>
        <CardDescription className="line-clamp-2">
          {quiz.description || "No description provided"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            {audienceIcon}
            {audienceLabel}
          </Badge>
          <Badge variant="outline">
            {quiz._count?.questions ?? 0} questions
          </Badge>
          <Badge variant="outline">Pass: {quiz.passingScore}%</Badge>
        </div>

        {!isAdmin && quiz.userAttemptCount !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your attempts</span>
              <span>
                {attemptsUsed}
                {quiz.maxAttempts && ` / ${quiz.maxAttempts}`}
              </span>
            </div>
            {quiz.maxAttempts && (
              <Progress
                value={(attemptsUsed / quiz.maxAttempts) * 100}
                className="h-2"
              />
            )}
          </div>
        )}

        {isAdmin && quiz._count && (
          <div className="text-sm text-muted-foreground">
            {quiz._count.attempts} total attempts
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        {isAdmin ? (
          <>
            <Button variant="outline" className="flex-1" asChild>
              <Link href={`/quizzes/${quiz.id}`}>View Details</Link>
            </Button>
            <Button variant="secondary" className="flex-1" asChild>
              <Link href={`/quizzes/${quiz.id}/edit`}>Edit</Link>
            </Button>
          </>
        ) : hasPassed ? (
          <Button variant="outline" className="w-full" disabled>
            <CheckCircle className="h-4 w-4 mr-2" />
            Completed
          </Button>
        ) : quiz.canAttempt ? (
          <Button className="w-full" asChild>
            <Link href={`/quizzes/${quiz.id}/take`}>
              <Play className="h-4 w-4 mr-2" />
              {attemptsUsed > 0 ? "Retake Quiz" : "Start Quiz"}
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            <Clock className="h-4 w-4 mr-2" />
            No attempts remaining
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
