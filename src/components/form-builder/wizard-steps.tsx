"use client";

import { useAtom, useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import {
  wizardStepAtom,
  canPublishAtom,
  formBuilderAtom,
  visibleStepsAtom,
  creationMethodAtom,
} from "@/lib/form-builder/store";
import type { WizardStep } from "@/types";
import {
  Upload,
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

// All possible steps with their configuration
const allSteps: StepConfig[] = [
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

// Create a map for quick lookup
const stepConfigMap = new Map(allSteps.map((step) => [step.id, step]));

// Special step config for upload (replaces setup for upload method)
const uploadStepConfig: StepConfig = {
  id: "setup", // Uses same slot as setup
  label: "Upload",
  icon: Upload,
  description: "Upload an existing form",
};

export function WizardSteps() {
  const [currentStep, setCurrentStep] = useAtom(wizardStepAtom);
  const canPublish = useAtomValue(canPublishAtom);
  const formState = useAtomValue(formBuilderAtom);
  const visibleStepIds = useAtomValue(visibleStepsAtom);
  const creationMethod = useAtomValue(creationMethodAtom);

  // Get visible steps with their configs
  const visibleSteps = visibleStepIds.map((id) => {
    // For upload method, replace setup config with upload config
    if (id === "setup" && creationMethod === "upload") {
      return uploadStepConfig;
    }
    return stepConfigMap.get(id)!;
  });

  // Find current step index in visible steps
  const currentStepIndex = visibleSteps.findIndex((s) => s.id === currentStep);

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

    // For first step (setup or upload), always accessible
    if (index === 0) return true;

    // For fields, need form name
    if (step.id === "fields") return !!formState.form.name?.trim();

    // For organize and beyond, need at least one field
    const fieldsStepIndex = visibleSteps.findIndex((s) => s.id === "fields");
    if (index > fieldsStepIndex) return formState.fields.length > 0;

    // For publish, need to be able to publish
    if (step.id === "publish") return canPublish;

    return index <= currentStepIndex + 1;
  };

  return (
    <nav aria-label="Form builder progress" className="w-full">
      <ol className="flex items-center gap-2">
        {visibleSteps.map((step, index) => {
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
              {index < visibleSteps.length - 1 && (
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
  const visibleStepIds = useAtomValue(visibleStepsAtom);
  const creationMethod = useAtomValue(creationMethodAtom);

  // Find current step index in visible steps
  const currentStepIndex = visibleStepIds.findIndex((id) => id === currentStep);

  const goToPrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(visibleStepIds[currentStepIndex - 1]);
    }
  };

  const goToNext = () => {
    if (currentStepIndex < visibleStepIds.length - 1) {
      setCurrentStep(visibleStepIds[currentStepIndex + 1]);
    }
  };

  const canGoNext = () => {
    const nextStepId = visibleStepIds[currentStepIndex + 1];
    if (!nextStepId) return false;

    // From first step (setup/upload), need form name
    if (currentStepIndex === 0) return !!formState.form.name?.trim();

    // From fields onwards, need at least one field
    const fieldsStepIndex = visibleStepIds.findIndex((id) => id === "fields");
    if (currentStepIndex >= fieldsStepIndex) return formState.fields.length > 0;

    // For publish step, need everything valid
    if (nextStepId === "publish") return canPublish;

    return true;
  };

  // Determine button label based on current step and method
  const getNextButtonLabel = () => {
    if (currentStepIndex === visibleStepIds.length - 1) {
      return "Publish Form";
    }
    if (currentStepIndex === 0 && creationMethod === "ai") {
      return "Generate Form";
    }
    return "Next";
  };

  return {
    currentStep,
    currentStepIndex,
    totalSteps: visibleStepIds.length,
    goToPrevious,
    goToNext,
    canGoBack: currentStepIndex > 0,
    canGoNext: canGoNext(),
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === visibleStepIds.length - 1,
    setStep: setCurrentStep,
    nextButtonLabel: getNextButtonLabel(),
    isAISetupStep: currentStepIndex === 0 && creationMethod === "ai",
  };
}
