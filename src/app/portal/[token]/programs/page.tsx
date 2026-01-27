"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePortalSession } from "@/components/portal/portal-session-provider";
import { EnrollmentCard } from "@/components/portal/enrollment-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, GraduationCap } from "lucide-react";
import { toast } from "sonner";

interface ProgramEnrollment {
  id: string;
  programId: string;
  programName: string;
  status: string;
  enrolledDate: string;
  completionDate: string | null;
  hoursCompleted: number;
  hoursRequired: number | null;
  progressPercentage: number;
  sessionsAttended: number;
  totalSessions: number;
}

export default function ProgramsPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { session, isLoading, pinVerified } = usePortalSession();

  const [enrollments, setEnrollments] = useState<ProgramEnrollment[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);

  // Redirect if PIN verification is required
  useEffect(() => {
    if (!isLoading && session?.requiresPIN && !pinVerified) {
      router.replace(`/portal/${token}/pin`);
    }
  }, [isLoading, session, pinVerified, token, router]);

  // Fetch programs
  useEffect(() => {
    if (!isLoading && session && pinVerified) {
      fetchPrograms();
    }
  }, [isLoading, session, pinVerified]);

  const fetchPrograms = async () => {
    try {
      const response = await fetch("/api/portal/programs", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setEnrollments(data.data.enrollments);
      } else {
        toast.error("Failed to load programs");
      }
    } catch (error) {
      console.error("Error fetching programs:", error);
      toast.error("Failed to load programs");
    } finally {
      setIsLoadingPrograms(false);
    }
  };

  if (isLoading || isLoadingPrograms) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground text-sm">Loading programs...</p>
        </CardContent>
      </Card>
    );
  }

  if (!session) return null;

  // Separate active and completed enrollments
  const activeEnrollments = enrollments.filter(
    (e) => !["COMPLETED", "WITHDRAWN", "FAILED"].includes(e.status)
  );
  const completedEnrollments = enrollments.filter(
    (e) => ["COMPLETED", "WITHDRAWN", "FAILED"].includes(e.status)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">My Programs</h1>
          <p className="text-xs text-muted-foreground">
            Track your progress and attendance
          </p>
        </div>
      </div>

      {/* No Programs State */}
      {enrollments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              You are not currently enrolled in any programs.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Contact your case manager for more information.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Active Programs */}
      {activeEnrollments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Active Programs ({activeEnrollments.length})
          </h2>
          {activeEnrollments.map((enrollment) => (
            <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
          ))}
        </div>
      )}

      {/* Completed Programs */}
      {completedEnrollments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Completed ({completedEnrollments.length})
          </h2>
          {completedEnrollments.map((enrollment) => (
            <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
          ))}
        </div>
      )}
    </div>
  );
}
