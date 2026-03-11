"use client";

import { GoalWizard } from "@/components/goals/wizard/goal-wizard";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewGoalPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/goals"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Goals
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Goal</h1>
        <p className="text-muted-foreground">
          Set up a new goal to track progress across grants, KPIs, and initiatives.
        </p>
      </div>

      {/* Wizard */}
      <GoalWizard />
    </div>
  );
}
