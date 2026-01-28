"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EnrollmentCardProps {
  enrollment: {
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
  };
}

const statusColors: Record<string, string> = {
  ENROLLED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  WITHDRAWN: "bg-gray-100 text-gray-800",
  ON_HOLD: "bg-orange-100 text-orange-800",
  FAILED: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  ENROLLED: "Enrolled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  WITHDRAWN: "Withdrawn",
  ON_HOLD: "On Hold",
  FAILED: "Failed",
};

export function EnrollmentCard({ enrollment }: EnrollmentCardProps) {
  const isCompleted = enrollment.status === "COMPLETED";
  const hasHoursRequirement = enrollment.hoursRequired && enrollment.hoursRequired > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {enrollment.programName}
          </CardTitle>
          <Badge
            variant="secondary"
            className={cn("shrink-0", statusColors[enrollment.status] || "")}
          >
            {statusLabels[enrollment.status] || enrollment.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {hasHoursRequirement && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {enrollment.hoursCompleted} / {enrollment.hoursRequired} hours
              </span>
            </div>
            <Progress
              value={enrollment.progressPercentage}
              className={cn(
                "h-2",
                isCompleted && "[&>div]:bg-green-500"
              )}
            />
            <p className="text-xs text-muted-foreground text-right">
              {Math.round(enrollment.progressPercentage)}% complete
            </p>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{enrollment.sessionsAttended}</span>
              {enrollment.totalSessions > 0 && (
                <span className="text-muted-foreground">
                  {" "}/ {enrollment.totalSessions}
                </span>
              )}
              <span className="text-muted-foreground"> sessions</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Enrolled {format(new Date(enrollment.enrolledDate), "MMM d, yyyy")}
            </span>
          </div>
        </div>

        {/* Completion Date */}
        {enrollment.completionDate && (
          <div className="flex items-center gap-2 text-sm text-green-600 pt-1">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Completed {format(new Date(enrollment.completionDate), "MMM d, yyyy")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
