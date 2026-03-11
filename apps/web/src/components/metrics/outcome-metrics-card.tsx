"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, CheckCircle2, Target, Users2 } from "lucide-react";

interface OutcomeMetrics {
  caseClosureRate: number;
  programCompletionRate: number;
  goalAchievement: number;
  totalCasesHandled: number;
  totalCasesClosed: number;
  totalEnrollments: number;
  totalCompletions: number;
}

interface OutcomeMetricsCardProps {
  outcomes: OutcomeMetrics;
  className?: string;
  showTitle?: boolean;
}

interface OutcomeItemProps {
  label: string;
  value: number;
  total?: number;
  icon: React.ReactNode;
  color: string;
  isPercentage?: boolean;
}

function getProgressColor(value: number): string {
  if (value >= 80) return "text-green-500";
  if (value >= 60) return "text-blue-500";
  if (value >= 40) return "text-yellow-500";
  return "text-red-500";
}

function OutcomeItem({
  label,
  value,
  total,
  icon,
  color,
  isPercentage = true,
}: OutcomeItemProps) {
  const displayValue = isPercentage ? Math.round(value) : value;

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
      <div className={cn("p-2 rounded-md", color)}>{icon}</div>
      <div className="flex-1">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-2xl font-bold", isPercentage && getProgressColor(value))}>
            {displayValue.toLocaleString()}
            {isPercentage && "%"}
          </span>
          {total !== undefined && !isPercentage && (
            <span className="text-sm text-muted-foreground">/ {total.toLocaleString()}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function OutcomeMetricsCard({
  outcomes,
  className,
  showTitle = true,
}: OutcomeMetricsCardProps) {
  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle>Outcomes</CardTitle>
          <CardDescription>Key performance indicators</CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn(!showTitle && "pt-6")}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <OutcomeItem
            label="Case Closure Rate"
            value={outcomes.caseClosureRate}
            icon={<CheckCircle2 className="h-4 w-4 text-white" />}
            color="bg-green-500"
          />
          <OutcomeItem
            label="Program Completion"
            value={outcomes.programCompletionRate}
            icon={<TrendingUp className="h-4 w-4 text-white" />}
            color="bg-blue-500"
          />
          <OutcomeItem
            label="Goal Achievement"
            value={outcomes.goalAchievement}
            icon={<Target className="h-4 w-4 text-white" />}
            color="bg-purple-500"
          />
          <OutcomeItem
            label="Active Cases"
            value={outcomes.totalCasesHandled - outcomes.totalCasesClosed}
            total={outcomes.totalCasesHandled}
            icon={<Users2 className="h-4 w-4 text-white" />}
            color="bg-orange-500"
            isPercentage={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}
