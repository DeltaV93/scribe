import { requireAuth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features/flags";
import { getQuizById, getQuizStats, getAllAttempts } from "@/lib/services/quizzes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, ArrowLeft, Edit, Users, User, Play, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UserRole } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface QuizDetailPageProps {
  params: Promise<{ quizId: string }>;
}

export default async function QuizDetailPage({ params }: QuizDetailPageProps) {
  const { quizId } = await params;
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

  const quiz = await getQuizById(quizId, user.orgId);
  if (!quiz) {
    notFound();
  }

  // Non-admins should go to take the quiz
  if (!isAdmin) {
    redirect(`/quizzes/${quizId}/take`);
  }

  const [stats, attemptsResult] = await Promise.all([
    getQuizStats(quizId),
    getAllAttempts(quizId, { limit: 50 }),
  ]);

  const audienceIcon =
    quiz.audience === "STAFF" ? (
      <User className="h-4 w-4" />
    ) : (
      <Users className="h-4 w-4" />
    );

  const audienceLabel =
    quiz.audience === "STAFF"
      ? "Staff Only"
      : quiz.audience === "CLIENT"
      ? "Clients Only"
      : "Everyone";

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/quizzes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{quiz.title}</h1>
          </div>
          {quiz.description && (
            <p className="text-muted-foreground ml-10">{quiz.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/quizzes/${quizId}/take`}>
              <Play className="h-4 w-4 mr-2" />
              Preview
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/quizzes/${quizId}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Quiz
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Questions</CardDescription>
            <CardTitle className="text-2xl">{quiz._count?.questions ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Attempts</CardDescription>
            <CardTitle className="text-2xl">{stats?.totalAttempts ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pass Rate</CardDescription>
            <CardTitle className="text-2xl">
              {stats?.passRate !== undefined ? `${Math.round(stats.passRate)}%` : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Score</CardDescription>
            <CardTitle className="text-2xl">
              {stats?.averageScore !== undefined ? `${Math.round(stats.averageScore)}%` : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quiz Details & Attempts */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="attempts">Attempts ({attemptsResult.attempts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  {audienceIcon}
                  {audienceLabel}
                </Badge>
                <Badge variant="outline">Passing Score: {quiz.passingScore}%</Badge>
                <Badge variant="outline">
                  Max Attempts: {quiz.maxAttempts ?? "Unlimited"}
                </Badge>
                {quiz.isActive ? (
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>

              <div className="pt-4">
                <h4 className="font-medium mb-2">Questions</h4>
                <div className="space-y-2">
                  {quiz.questions?.map((question, index) => (
                    <div
                      key={question.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          Q{index + 1}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {question.type.replace("_", " ")}
                        </Badge>
                        <span className="text-sm">{question.question}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {question.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attempts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Attempts</CardTitle>
              <CardDescription>
                View all quiz attempts and results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attemptsResult.attempts.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No attempts yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attemptsResult.attempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{attempt.user?.name ?? "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">
                              {attempt.user?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {attempt.status === "PASSED" ? (
                            <Badge className="bg-green-100 text-green-800 gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Passed
                            </Badge>
                          ) : attempt.status === "FAILED" ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Failed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" />
                              In Progress
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {attempt.score !== null ? `${attempt.score}%` : "-"}
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(attempt.startedAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          {attempt.status !== "IN_PROGRESS" && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/quizzes/${quizId}/results/${attempt.id}`}>
                                View
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
