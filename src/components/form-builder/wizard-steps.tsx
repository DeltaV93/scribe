"use client";

import { useAtom, useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { wizardStepAtom, canPublishAtom, formBuilderAtom } from "@/lib/form-builder/store";
import type { WizardStep } from "@/types";
import {
  Settings2,
  LayoutGrid,
  Layers,
  GitBranch,
  Eye,
  Sparkles,
  Rocket,
  Check,
} from "lucide-react";

interface StepConfig {
  id: WizardStep;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const steps: StepConfig[] = [
  {
    id: "setup",
    label: "AI Setup",
    icon: Sparkles,
    description: "Generate form fields with AI",
  },
  {
    id: "fields",
    label: "Fields",
    icon: LayoutGrid,
    description: "Add and configure form fields",
  },
  {
    id: "organize",
    label: "Organize",
    icon: Layers,
    description: "Arrange fields into sections",
  },
  {
    id: "logic",
    label: "Logic",
    icon: GitBranch,
    description: "Add conditional visibility",
  },
  {
    id: "preview",
    label: "Preview",
    icon: Eye,
    description: "Preview how the form looks",
  },
  {
    id: "ai-config",
    label: "AI Config",
    icon: Sparkles,
    description: "Configure AI extraction",
  },
  {
    id: "publish",
    label: "Publish",
    icon: Rocket,
    description: "Review and publish",
  },
];

export function WizardSteps() {
  const [currentStep, setCurrentStep] = useAtom(wizardStepAtom);
  const canPublish = useAtomValue(canPublishAtom);
  const formState = useAtomValue(formBuilderAtom);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const getStepStatus = (step: StepConfig, index: number) => {
    if (index < currentStepIndex) return "completed";
    if (index === currentStepIndex) return "current";
    return "upcoming";
  };

  const canNavigateToStep = (step: StepConfig, index: number) => {
    // Can always go back to completed steps
    if (index < currentStepIndex) return true;

    // Can go to current step
    if (index === currentStepIndex) return true;

    // For setup, always accessible
    if (step.id === "setup") return true;

    // For fields, need form name
    if (step.id === "fields") return !!formState.form.name?.trim();

    // For organize and beyond, need at least one field
    if (index >= 2) return formState.fields.length > 0;

    // For publish, need to be able to publish
    if (step.id === "publish") return canPublish;

    return index <= currentStepIndex + 1;
  };

  return (
    <nav aria-label="Form builder progress" className="w-full">
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const status = getStepStatus(step, index);
          const isNavigable = canNavigateToStep(step, index);
          const Icon = step.icon;

          return (
            <li key={step.id} className="flex-1">
              <button
                onClick={() => isNavigable && setCurrentStep(step.id)}
                disabled={!isNavigable}
                className={cn(
                  "group flex w-full flex-col items-center gap-2 rounded-lg p-3 transition-all",
                  isNavigable && "hover:bg-accent cursor-pointer",
                  !isNavigable && "cursor-not-allowed opacity-50"
                )}
                aria-current={status === "current" ? "step" : undefined}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    status === "completed" &&
                      "border-primary bg-primary text-primary-foreground",
                    status === "current" &&
                      "border-primary bg-primary/10 text-primary",
                    status === "upcoming" &&
                      "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {status === "completed" ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="text-center">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      status === "current" && "text-foreground",
                      status !== "current" && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden text-xs text-muted-foreground md:block">
                    {step.description}
                  </span>
                </div>
              </button>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-auto mt-2 hidden h-0.5 w-full md:block",
                    index < currentStepIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function WizardNavigation() {
  const [currentStep, setCurrentStep] = useAtom(wizardStepAtom);
  const canPublish = useAtomValue(canPublishAtom);
  const formState = useAtomValue(formBuilderAtom);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const goToPrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  const goToNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const canGoNext = () => {
    const nextStep = steps[currentStepIndex + 1];
    if (!nextStep) return false;

    // From setup, need form name
    if (currentStep === "setup") return !!formState.form.name?.trim();

    // From fields onwards, need at least one field
    if (currentStepIndex >= 1) return formState.fields.length > 0;

    // For publish step, need everything valid
    if (nextStep.id === "publish") return canPublish;

    return true;
  };

  return {
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    goToPrevious,
    goToNext,
    canGoBack: currentStepIndex > 0,
    canGoNext: canGoNext(),
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === steps.length - 1,
    setStep: setCurrentStep,
  };
}
