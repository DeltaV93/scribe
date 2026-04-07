"use client";

import { useAtom, useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import {
  wizardStepAtom,
  canPublishAtom,
  formBuilderAtom,
  visibleStepsAtom,
  creationMethodAtom,
  aiGenerationAtom,
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
    label: "AI Settings",
    icon: Sparkles,
    description: "Set up automatic data extraction",
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
  const aiState = useAtomValue(aiGenerationAtom);

  // Use AI as default method (matches visibleStepsAtom behavior)
  const effectiveMethod = creationMethod || "ai";
  const isOnAISetupStep = currentStep === "setup" && effectiveMethod === "ai";

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

    // SAFEGUARD: When on AI setup step, cannot skip ahead to fields
    // User must go through AI generation and review process first
    if (isOnAISetupStep && step.id === "fields") {
      // Only allow if AI generation was accepted (fields were added via acceptGeneratedFieldsAtom)
      // or if user has manually added fields (edge case)
      if (aiState.status !== "accepted" && formState.fields.length === 0) {
        return false;
      }
    }

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

  // Use AI as default method (matches visibleStepsAtom behavior)
  const effectiveMethod = creationMethod || "ai";
  const isAISetupStep = currentStep === "setup" && effectiveMethod === "ai";

  const goToPrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(visibleStepIds[currentStepIndex - 1]);
    }
  };

  const goToNext = () => {
    // SAFEGUARD: Never auto-navigate from AI setup step
    // Navigation from AI setup only happens via acceptGeneratedFieldsAtom
    if (isAISetupStep) {
      console.warn("goToNext called on AI setup step - this should not happen. Navigation blocked.");
      return;
    }
    if (currentStepIndex < visibleStepIds.length - 1) {
      setCurrentStep(visibleStepIds[currentStepIndex + 1]);
    }
  };

  const canGoNext = () => {
    const nextStepId = visibleStepIds[currentStepIndex + 1];
    if (!nextStepId) return false;

    // For AI setup step, button enablement is based on form name
    // (actual navigation is blocked in goToNext and handleNext)
    if (isAISetupStep) {
      return !!formState.form.name?.trim();
    }

    // From first step (upload method), need form name
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
    if (isAISetupStep) {
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
    isAISetupStep,
  };
}
