"use client";

/**
 * Privacy Budget Card
 *
 * Displays the differential privacy epsilon budget status
 * with a visual progress bar and reset date.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle } from "lucide-react";

interface PrivacyBudgetCardProps {
  budget: {
    epsilon_budget: number;
    epsilon_consumed: number;
    epsilon_remaining: number;
    budget_reset_at: string | null;
    is_exhausted: boolean;
  };
  isLoading?: boolean;
}

export function PrivacyBudgetCard({ budget, isLoading }: PrivacyBudgetCardProps) {
  const percentUsed = Math.min(
    100,
    (budget.epsilon_consumed / budget.epsilon_budget) * 100
  );

  const getStatusColor = () => {
    if (budget.is_exhausted) return "destructive";
    if (percentUsed > 80) return "warning";
    return "default";
  };

  const getProgressColor = () => {
    if (budget.is_exhausted) return "bg-destructive";
    if (percentUsed > 80) return "bg-yellow-500";
    return "bg-primary";
  };

  const formatResetDate = (dateStr: string | null) => {
    if (!dateStr) return "No reset scheduled";
    const date = new Date(dateStr);
    return `Resets ${date.toLocaleDateString()}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy Budget
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-2 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Privacy Budget
        </CardTitle>
        <CardDescription>
          Differential privacy epsilon budget for model training
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">
              {budget.epsilon_remaining.toFixed(2)}
            </span>
            <span className="text-muted-foreground ml-1">
              / {budget.epsilon_budget.toFixed(2)} remaining
            </span>
          </div>
          {budget.is_exhausted ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Exhausted
            </Badge>
          ) : percentUsed > 80 ? (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              Low
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Healthy
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Consumed: {budget.epsilon_consumed.toFixed(3)}</span>
            <span>{percentUsed.toFixed(1)}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all ${getProgressColor()}`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {formatResetDate(budget.budget_reset_at)}
        </p>
      </CardContent>
    </Card>
  );
}
