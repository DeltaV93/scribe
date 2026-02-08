"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Provider as JotaiProvider } from "jotai";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, createContext, useContext, useCallback } from "react";
import {
  wizardStepAtom,
  formBuilderAtom,
  loadFormAtom,
  markAsSavedAtom,
  creationMethodAtom,
  setCreationMethodAtom,
  featureFlagsAtom,
  triggerGenerationAtom,
  aiGenerationAtom,
  type CreationMethod,
  type FormBuilderFeatureFlags,
} from "@/lib/form-builder/store";
import { saveFormAction, publishFormAction } from "@/lib/form-builder/actions";
import { WizardSteps, WizardNavigation } from "./wizard-steps";
import {
  SetupStep,
  AISetupStep,
  UploadStep,
  FieldsStep,
  OrganizeStep,
  LogicStep,
  PreviewStep,
  AIConfigStep,
  PublishStep,
} from "./steps";
import { CreationMethodModal } from "./creation-method-modal";
import { AutoSaveStatusBar } from "./auto-save-status";
import { useAutoSave } from "@/hooks/use-auto-save";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import type { WizardStep, FormWithFields } from "@/types";
import Link from "next/link";
import { useResourceLock } from "@/hooks/use-resource-lock";
import { LockBanner, ReadOnlyBanner } from "@/components/resource-lock";

// Context for lock state to share across components
interface LockContextValue {
  hasLock: boolean;
  isReadOnly: boolean;
  isLockedByOther: boolean;
  lockedByName?: string;
}

const LockContext = createContext<LockContextValue>({
  hasLock: false,
  isReadOnly: false,
  isLockedByOther: false,
});

export const useLockContext = () => useContext(LockContext);

interface FormBuilderProps {
  initialForm?: FormWithFields;
  featureFlags?: FormBuilderFeatureFlags;
  showMethodModal?: boolean;
}

interface FormBuilderContentProps extends FormBuilderProps {
  lockState: LockContextValue;
  onRetryLock: () => Promise<boolean>;
  onEnterReadOnly: () => void;
  isRetryingLock: boolean;
}

function StepContent() {
  const currentStep = useAtomValue(wizardStepAtom);
  const creationMethod = useAtomValue(creationMethodAtom);

  // For upload method, show UploadStep on the "setup" step
  if (currentStep === "setup" && creationMethod === "upload") {
    return <UploadStep />;
  }

  const stepComponents: Record<WizardStep, React.ReactNode> = {
    setup: <AISetupStep />,
    fields: <FieldsStep />,
    organize: <OrganizeStep />,
    logic: <LogicStep />,
    preview: <PreviewStep />,
    "ai-config": <AIConfigStep />,
    publish: <PublishStep />,
  };

  return stepComponents[currentStep] || <AISetupStep />;
}

function FormBuilderHeader() {
  const [state] = useAtom(formBuilderAtom);
  const { isReadOnly } = useLockContext();

  return (
    <div className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-4">
        <Link
          href="/forms"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">
          {state.form.name || "New Form"}
        </h1>
        <Badge variant="outline">
          {state.form.status === "PUBLISHED" ? "Published" : "Draft"}
        </Badge>
        {isReadOnly && (
          <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-800">
            Read-Only
          </Badge>
        )}
      </div>
    </div>
  );
}

function FormBuilderNavigation({
  onAIGenerate,
  isGenerating,
}: {
  onAIGenerate?: () => void;
  isGenerating?: boolean;
}) {
  const nav = WizardNavigation();
  const [state] = useAtom(formBuilderAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { isReadOnly } = useLockContext();

  const handlePublish = () => {
    if (isReadOnly) {
      toast({
        title: "Read-Only Mode",
        description: "Cannot publish in read-only mode",
        variant: "destructive",
      });
      return;
    }

    if (!state.form.id) {
      toast({
        title: "Error",
        description: "Please save the form first before publishing",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      // First save any pending changes
      if (state.isDirty) {
        const saveResult = await saveFormAction(state.form.id!, {
          name: state.form.name || "Untitled Form",
          description: state.form.description,
          type: state.form.type!,
          settings: state.form.settings,
          fields: state.fields,
        });

        if (saveResult.error) {
          toast({
            title: "Error",
            description: saveResult.error,
            variant: "destructive",
          });
          return;
        }
        markAsSaved();
      }

      // Then publish
      const result = await publishFormAction(state.form.id!);

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Published",
          description: `Form published as version ${result.version}`,
        });
        router.push("/forms");
      }
    });
  };

  // Handle next button click - for AI setup step, trigger generation
  const handleNext = () => {
    if (nav.isAISetupStep && onAIGenerate) {
      onAIGenerate();
    } else {
      nav.goToNext();
    }
  };

  return (
    <div className="flex items-center justify-between border-t px-6 py-4 bg-background">
      <Button
        variant="outline"
        onClick={nav.goToPrevious}
        disabled={!nav.canGoBack}
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>

      <span className="text-sm text-muted-foreground">
        Step {nav.currentStepIndex + 1} of {nav.totalSteps}
      </span>

      {nav.isLastStep ? (
        <Button onClick={handlePublish} disabled={isPending || isReadOnly}>
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          {isReadOnly ? "View Only" : "Publish Form"}
        </Button>
      ) : (
        <Button
          onClick={handleNext}
          disabled={!nav.canGoNext || isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : nav.isAISetupStep ? (
            <Sparkles className="h-4 w-4 mr-2" />
          ) : null}
          {nav.nextButtonLabel}
          {!nav.isAISetupStep && <ChevronRight className="h-4 w-4 ml-2" />}
        </Button>
      )}
    </div>
  );
}

function FormBuilderContent({
  initialForm,
  featureFlags,
  showMethodModal = false,
  lockState,
  onRetryLock,
  onEnterReadOnly,
  isRetryingLock,
}: FormBuilderContentProps) {
  const loadForm = useSetAtom(loadFormAtom);
  const [state] = useAtom(formBuilderAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const setFeatureFlags = useSetAtom(featureFlagsAtom);
  const creationMethod = useAtomValue(creationMethodAtom);
  const setCreationMethod = useSetAtom(setCreationMethodAtom);
  const setWizardStep = useSetAtom(wizardStepAtom);
  const setTriggerGeneration = useSetAtom(triggerGenerationAtom);
  const aiState = useAtomValue(aiGenerationAtom);

  const [isLoaded, setIsLoaded] = useState(!initialForm);
  const [isModalOpen, setIsModalOpen] = useState(showMethodModal && !initialForm);
  const router = useRouter();
  const { toast } = useToast();

  // Set feature flags
  useEffect(() => {
    if (featureFlags) {
      setFeatureFlags(featureFlags);
    }
  }, [featureFlags, setFeatureFlags]);

  // Load initial form data if editing
  useEffect(() => {
    if (initialForm && !isLoaded) {
      loadForm(
        {
          id: initialForm.id,
          orgId: initialForm.orgId,
          name: initialForm.name,
          description: initialForm.description,
          type: initialForm.type,
          status: initialForm.status,
          version: initialForm.version,
          settings: initialForm.settings,
          createdById: initialForm.createdById,
          createdAt: initialForm.createdAt,
          updatedAt: initialForm.updatedAt,
          archivedAt: initialForm.archivedAt,
          publishedAt: initialForm.publishedAt,
        },
        initialForm.fields
      );
      setIsLoaded(true);
    }
  }, [initialForm, isLoaded, loadForm]);

  // Handle method selection
  const handleMethodSelect = (method: CreationMethod) => {
    setCreationMethod(method);
    setIsModalOpen(false);

    // For manual method, skip to fields step
    if (method === "manual") {
      setWizardStep("fields");
    }
  };

  // Auto-save handler
  const handleAutoSave = useCallback(async () => {
    if (lockState.isReadOnly) return;

    const result = await saveFormAction(state.form.id || null, {
      name: state.form.name || "Untitled Form",
      description: state.form.description,
      type: state.form.type!,
      settings: state.form.settings,
      fields: state.fields,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    markAsSaved();

    // If this was a new form, update URL
    if (!state.form.id && result.formId) {
      router.replace(`/forms/${result.formId}/edit`);
    }
  }, [state, markAsSaved, router, lockState.isReadOnly]);

  // Auto-save hook
  const autoSave = useAutoSave({
    onSave: handleAutoSave,
    isDirty: state.isDirty,
    disabled: lockState.isReadOnly || isModalOpen,
    idleTimeout: 10000, // 10 seconds
    maxInterval: 60000, // 60 seconds
  });

  // Handle AI generation trigger from footer button
  const handleAIGenerate = useCallback(() => {
    // Increment the trigger atom to signal AISetupStep to start generation
    setTriggerGeneration((prev) => prev + 1);
  }, [setTriggerGeneration]);

  // Track generating state from the AI generation atom
  const isGenerating = aiState.status === "generating";

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <LockContext.Provider value={lockState}>
      {/* Creation Method Modal */}
      <CreationMethodModal
        open={isModalOpen}
        onSelect={handleMethodSelect}
        showUploadOption={featureFlags?.photoToForm ?? false}
      />

      <div className="flex flex-col h-full">
        <FormBuilderHeader />

        {/* Lock status banner */}
        {lockState.isLockedByOther && !lockState.isReadOnly && (
          <div className="px-6 pt-4">
            <LockBanner
              lockedByName={lockState.lockedByName || "Another user"}
              onRetry={onRetryLock}
              onDismiss={onEnterReadOnly}
              isRetrying={isRetryingLock}
              resourceType="form"
            />
          </div>
        )}

        {lockState.isReadOnly && (
          <div className="px-6 pt-4">
            <ReadOnlyBanner
              onTryEdit={onRetryLock}
              isTrying={isRetryingLock}
              resourceType="form"
            />
          </div>
        )}

        {/* Wizard Steps Navigation */}
        <div className="border-b px-6 py-4 bg-muted/30">
          <WizardSteps />
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <StepContent />
        </div>

        {/* Auto-Save Status Bar */}
        {!lockState.isReadOnly && (
          <AutoSaveStatusBar
            status={autoSave.status}
            lastSavedAt={autoSave.lastSavedAt}
            error={autoSave.error}
            retriesRemaining={autoSave.retriesRemaining}
            onRetry={autoSave.retry}
          />
        )}

        {/* Footer Navigation */}
        <FormBuilderNavigation
          onAIGenerate={handleAIGenerate}
          isGenerating={isGenerating}
        />
      </div>
    </LockContext.Provider>
  );
}

function FormBuilderWithLock({
  initialForm,
  featureFlags,
  showMethodModal,
}: FormBuilderProps) {
  const [isReadOnly, setIsReadOnly] = useState(false);
  const { toast } = useToast();

  // Only use resource locking for existing forms (not new forms)
  const {
    hasLock,
    isLockedByOther,
    lockedByName,
    expiresAt,
    isLoading,
    acquireLock,
  } = useResourceLock({
    resourceType: "form",
    resourceId: initialForm?.id,
    autoAcquire: !!initialForm?.id,
    onLockAcquired: () => {
      setIsReadOnly(false);
    },
    onLockFailed: (lockedBy) => {
      toast({
        title: "Form is locked",
        description: `${lockedBy} is currently editing this form`,
        variant: "destructive",
      });
    },
  });

  const handleRetryLock = async () => {
    const success = await acquireLock();
    if (success) {
      setIsReadOnly(false);
      toast({
        title: "Lock acquired",
        description: "You can now edit this form",
      });
    }
    return success;
  };

  const handleEnterReadOnly = () => {
    setIsReadOnly(true);
    toast({
      title: "Read-only mode",
      description: "You are viewing the form in read-only mode",
    });
  };

  // For new forms, no locking needed
  const lockState: LockContextValue = initialForm?.id
    ? {
        hasLock,
        isReadOnly,
        isLockedByOther,
        lockedByName,
      }
    : {
        hasLock: true, // New forms always have implicit lock
        isReadOnly: false,
        isLockedByOther: false,
      };

  // Show loading while checking lock status for existing forms
  if (initialForm?.id && isLoading && !hasLock && !isLockedByOther) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Checking edit access...</p>
        </div>
      </div>
    );
  }

  return (
    <FormBuilderContent
      initialForm={initialForm}
      featureFlags={featureFlags}
      showMethodModal={showMethodModal}
      lockState={lockState}
      onRetryLock={handleRetryLock}
      onEnterReadOnly={handleEnterReadOnly}
      isRetryingLock={isLoading}
    />
  );
}

export function FormBuilder({
  initialForm,
  featureFlags,
  showMethodModal = true,
}: FormBuilderProps = {}) {
  return (
    <JotaiProvider>
      <FormBuilderWithLock
        initialForm={initialForm}
        featureFlags={featureFlags}
        showMethodModal={showMethodModal}
      />
    </JotaiProvider>
  );
}
