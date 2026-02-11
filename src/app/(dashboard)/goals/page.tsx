"use client";

import { Suspense } from "react";
import { GoalList } from "@/components/goals/goal-list";
import { Loader2 } from "lucide-react";

export default function GoalsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Goals</h1>
        <p className="text-muted-foreground">
          Track all your goals, grants, KPIs, and initiatives in one place.
        </p>
      </div>

      {/* Goals List */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <GoalList />
      </Suspense>
    </div>
  );
}
