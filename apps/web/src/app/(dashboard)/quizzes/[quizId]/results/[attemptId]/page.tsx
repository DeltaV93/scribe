import { requireAuth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features/flags";
import { getAttemptById, getQuizById } from "@/lib/services/quizzes";
import { QuizResults } from "@/components/quizzes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@/types";

interface ResultsPageProps {
  params: Promise<{ quizId: string; attemptId: string }>;
}

export default async function QuizResultsPage({ params }: ResultsPageProps) {
  const { quizId, attemptId } = await params;
  const user = await requireAuth();

  // Check feature flag
  const quizzesEnabled = await isFeatureEnabled(user.orgId, "quizzes");
  if (!quizzesEnabled) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Feature Not Enabled
            </CardTitle>
            <CardDescription>
              The Quizzes feature is not enabled for your organization.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isAdmin = [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.PROGRAM_MANAGER,
  ].includes(user.role);

  const [quiz, attempt] = await Promise.all([
    getQuizById(quizId, user.orgId),
    getAttemptById(attemptId, user.orgId),
  ]);

  if (!quiz || !attempt) {
    notFound();
  }

  // Only allow viewing own attempts unless admin
  if (!isAdmin && attempt.userId !== user.id) {
    notFound();
  }

  // Don't show results for in-progress attempts
  if (attempt.status === "IN_PROGRESS") {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/quizzes/${quizId}/take`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <CardTitle>Quiz In Progress</CardTitle>
            </div>
            <CardDescription>
              This quiz attempt is still in progress. Complete the quiz to see your results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/quizzes/${quizId}/take`}>Continue Quiz</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate whether user can retake
  const canRetake = quiz.maxAttempts === null ||
    (attempt.status !== "PASSED" && quiz.maxAttempts > (attempt.quiz?.questions?.length ?? 1));

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={isAdmin ? `/quizzes/${quizId}` : "/quizzes"}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Quiz Results</h1>
        </div>
      </div>
      <QuizResults
        quizId={quizId}
        quizTitle={quiz.title}
        attemptId={attemptId}
        score={attempt.score}
        totalPoints={attempt.totalPoints}
        maxPoints={attempt.maxPoints}
        status={attempt.status}
        passingScore={quiz.passingScore}
        answers={attempt.answers.map((answer) => {
          const question = quiz.questions?.find((q) => q.id === answer.questionId);
          return {
            id: answer.id,
            questionId: answer.questionId,
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            pointsEarned: answer.pointsEarned,
            question: {
              id: question?.id ?? answer.questionId,
              question: question?.question ?? "",
              type: question?.type ?? "SINGLE_CHOICE",
              points: question?.points ?? 0,
              correctAnswer: question?.correctAnswer,
            },
          };
        })}
        completedAt={attempt.completedAt?.toISOString() ?? null}
        canRetake={canRetake}
      />
    </div>
  );
}
