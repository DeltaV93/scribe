"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ActivityMetrics {
  callsCompleted: number;
  messagesSent: number;
  formsCompleted: number;
  sessionsDelivered: number;
  clientsContacted: number;
}

interface OutcomeMetrics {
  caseClosureRate: number;
  programCompletionRate: number;
  goalAchievement: number;
  totalCasesHandled: number;
  totalCasesClosed: number;
  totalEnrollments: number;
  totalCompletions: number;
}

interface TeamMemberMetrics {
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  activity: ActivityMetrics;
  outcomes: OutcomeMetrics;
}

interface TeamMetricsTableProps {
  members: TeamMemberMetrics[];
  className?: string;
  showTitle?: boolean;
}

function getTotalActivities(activity: ActivityMetrics): number {
  return (
    activity.callsCompleted +
    activity.messagesSent +
    activity.formsCompleted +
    activity.sessionsDelivered
  );
}

function getPerformanceLevel(
  goalAchievement: number
): "high" | "medium" | "low" {
  if (goalAchievement >= 75) return "high";
  if (goalAchievement >= 50) return "medium";
  return "low";
}

function PerformanceIndicator({ level }: { level: "high" | "medium" | "low" }) {
  const config = {
    high: {
      icon: TrendingUp,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      label: "On Track",
    },
    medium: {
      icon: Minus,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      label: "Needs Attention",
    },
    low: {
      icon: TrendingDown,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      label: "At Risk",
    },
  };

  const Icon = config[level].icon;

  return (
    <Badge variant="outline" className={cn("gap-1", config[level].bgColor)}>
      <Icon className={cn("h-3 w-3", config[level].color)} />
      <span className={config[level].color}>{config[level].label}</span>
    </Badge>
  );
}

export function TeamMetricsTable({
  members,
  className,
  showTitle = true,
}: TeamMetricsTableProps) {
  // Sort members by total activities descending
  const sortedMembers = [...members].sort(
    (a, b) => getTotalActivities(b.activity) - getTotalActivities(a.activity)
  );

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle>Team Performance</CardTitle>
          <CardDescription>
            Individual metrics for {members.length} team member
            {members.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn(!showTitle && "pt-6")}>
        {members.length === 0 ? (
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-muted-foreground">No team members found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead className="text-center">Calls</TableHead>
                  <TableHead className="text-center">Messages</TableHead>
                  <TableHead className="text-center">Forms</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead className="text-center">Clients</TableHead>
                  <TableHead className="text-center">Goal Progress</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {member.userName || member.userEmail}
                        </p>
                        {member.userName && (
                          <p className="text-sm text-muted-foreground">
                            {member.userEmail}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {member.activity.callsCompleted}
                    </TableCell>
                    <TableCell className="text-center">
                      {member.activity.messagesSent}
                    </TableCell>
                    <TableCell className="text-center">
                      {member.activity.formsCompleted}
                    </TableCell>
                    <TableCell className="text-center">
                      {member.activity.sessionsDelivered}
                    </TableCell>
                    <TableCell className="text-center">
                      {member.activity.clientsContacted}
                    </TableCell>
                    <TableCell>
                      <div className="w-full max-w-[120px] mx-auto">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={member.outcomes.goalAchievement}
                            className="h-2"
                          />
                          <span className="text-sm text-muted-foreground w-10">
                            {Math.round(member.outcomes.goalAchievement)}%
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <PerformanceIndicator
                        level={getPerformanceLevel(member.outcomes.goalAchievement)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
