import { requireAuth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features/flags";
import { listQuizzes, listAvailableQuizzes } from "@/lib/services/quizzes";
import { QuizList } from "@/components/quizzes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@/types";

export default async function QuizzesPage() {
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
              Contact your administrator to enable it.
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

  const isStaff = [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.PROGRAM_MANAGER,
    UserRole.CASE_MANAGER,
  ].includes(user.role);

  // Fetch quizzes based on role
  const [adminQuizzes, availableQuizzes] = await Promise.all([
    isAdmin ? listQuizzes(user.orgId, { isActive: true }) : { quizzes: [], total: 0, hasMore: false },
    listAvailableQuizzes(user.orgId, user.id, isStaff),
  ]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Create and manage training quizzes"
              : "Complete training quizzes to demonstrate your knowledge"}
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/quizzes/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Quiz
            </Link>
          </Button>
        )}
      </div>

      {isAdmin ? (
        <Tabs defaultValue="available">
          <TabsList>
            <TabsTrigger value="available">Available to Me</TabsTrigger>
            <TabsTrigger value="manage">Manage Quizzes</TabsTrigger>
          </TabsList>
          <TabsContent value="available" className="mt-6">
            <QuizList
              quizzes={availableQuizzes.quizzes}
              isAdmin={false}
              emptyMessage="No quizzes are currently available for you"
            />
          </TabsContent>
          <TabsContent value="manage" className="mt-6">
            <QuizList
              quizzes={adminQuizzes.quizzes}
              isAdmin={true}
              emptyMessage="No quizzes created yet"
            />
          </TabsContent>
        </Tabs>
      ) : (
        <QuizList
          quizzes={availableQuizzes.quizzes}
          isAdmin={false}
          emptyMessage="No quizzes are currently available for you"
        />
      )}
    </div>
  );
}
