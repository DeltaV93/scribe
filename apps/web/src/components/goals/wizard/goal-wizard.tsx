"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoalBasicsStep } from "./goal-basics-step";
import { GoalMetricsStep } from "./goal-metrics-step";
import { GoalTeamStep } from "./goal-team-step";
import { GoalType, GoalStatus } from "@prisma/client";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const steps = [
  { id: "basics", label: "Basics", description: "Name and type" },
  { id: "metrics", label: "Metrics", description: "Link items" },
  { id: "team", label: "Team", description: "Owner and programs" },
];

export interface GoalFormData {
  name: string;
  description: string;
  type: GoalType;
  startDate: Date | null;
  endDate: Date | null;
  ownerId: string | null;
  teamId: string | null;
  programIds: string[];
  grantIds: string[];
  kpiIds: string[];
  objectiveIds: string[];
}

const initialFormData: GoalFormData = {
  name: "",
  description: "",
  type: GoalType.GRANT,
  startDate: null,
  endDate: null,
  ownerId: null,
  teamId: null,
  programIds: [],
  grantIds: [],
  kpiIds: [],
  objectiveIds: [],
};

export function GoalWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<GoalFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateFormData = (updates: Partial<GoalFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.name.trim().length > 0;
      case 1:
        return true; // Metrics step is optional
      case 2:
        return true; // Team step is optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Create the goal
      const goalResponse = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          type: formData.type,
          startDate: formData.startDate?.toISOString(),
          endDate: formData.endDate?.toISOString(),
          ownerId: formData.ownerId,
          teamId: formData.teamId,
        }),
      });

      if (!goalResponse.ok) {
        throw new Error("Failed to create goal");
      }

      const { data: goal } = await goalResponse.json();

      // Link grants
      for (const grantId of formData.grantIds) {
        await fetch(`/api/goals/${goal.id}/grants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantId }),
        });
      }

      // Link KPIs
      for (const kpiId of formData.kpiIds) {
        await fetch(`/api/goals/${goal.id}/kpis`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kpiId }),
        });
      }

      // Link objectives
      for (const objectiveId of formData.objectiveIds) {
        await fetch(`/api/goals/${goal.id}/objectives`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectiveId }),
        });
      }

      // Link programs
      for (const programId of formData.programIds) {
        await fetch(`/api/goals/${goal.id}/programs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programId, backfillHistorical: true }),
        });
      }

      toast.success("Goal created successfully");
      router.push(`/goals/${goal.id}`);
    } catch (error) {
      console.error("Error creating goal:", error);
      toast.error("Failed to create goal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center",
                index < steps.length - 1 && "flex-1"
              )}
            >
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
                    index < currentStep
                      ? "bg-primary text-primary-foreground"
                      : index === currentStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4",
                    index < currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].label}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[400px]">
          {currentStep === 0 && (
            <GoalBasicsStep formData={formData} onChange={updateFormData} />
          )}
          {currentStep === 1 && (
            <GoalMetricsStep formData={formData} onChange={updateFormData} />
          )}
          {currentStep === 2 && (
            <GoalTeamStep formData={formData} onChange={updateFormData} />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.push("/goals")}>
            Cancel
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Goal
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
