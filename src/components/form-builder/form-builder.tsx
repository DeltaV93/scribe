"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Provider as JotaiProvider } from "jotai";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import {
  wizardStepAtom,
  formBuilderAtom,
  loadFormAtom,
  markAsSavedAtom,
} from "@/lib/form-builder/store";
import { saveFormAction, publishFormAction } from "@/lib/form-builder/actions";
import { WizardSteps, WizardNavigation } from "./wizard-steps";
import {
  SetupStep,
  AISetupStep,
  FieldsStep,
  OrganizeStep,
  LogicStep,
  PreviewStep,
  AIConfigStep,
  PublishStep,
} from "./steps";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Clock,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import type { WizardStep, FormWithFields } from "@/types";
import Link from "next/link";

interface FormBuilderProps {
  initialForm?: FormWithFields;
}

function StepContent() {
  const currentStep = useAtomValue(wizardStepAtom);

  const stepComponents: Record<WizardStep, React.ReactNode> = {
    setup: <AISetupStep />,  // Use AI-powered setup step
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
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveFormAction(state.form.id || null, {
        name: state.form.name || "Untitled Form",
        description: state.form.description,
        type: state.form.type!,
        settings: state.form.settings,
        fields: state.fields,
      });

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        markAsSaved();
        toast({
          title: "Saved",
          description: "Form saved successfully",
        });

        // If this was a new form, redirect to the edit page
        if (!state.form.id && result.formId) {
          router.replace(`/forms/${result.formId}/edit`);
        }
      }
    });
  };

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
        {state.isDirty && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Unsaved changes
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={!state.isDirty || isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Draft
        </Button>
      </div>
    </div>
  );
}

function FormBuilderNavigation() {
  const nav = WizardNavigation();
  const [state] = useAtom(formBuilderAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handlePublish = () => {
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

  return (
    <div className="flex items-center justify-between border-t px-6 py-4">
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
        <Button onClick={handlePublish} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Publish Form
        </Button>
      ) : (
        <Button onClick={nav.goToNext} disabled={!nav.canGoNext}>
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );
}

function FormBuilderContent({ initialForm }: FormBuilderProps) {
  const loadForm = useSetAtom(loadFormAtom);
  const [isLoaded, setIsLoaded] = useState(!initialForm);

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

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <FormBuilderHeader />

      {/* Wizard Steps Navigation */}
      <div className="border-b px-6 py-4 bg-muted/30">
        <WizardSteps />
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <StepContent />
      </div>

      {/* Footer Navigation */}
      <FormBuilderNavigation />
    </div>
  );
}

export function FormBuilder({ initialForm }: FormBuilderProps = {}) {
  return (
    <JotaiProvider>
      <FormBuilderContent initialForm={initialForm} />
    </JotaiProvider>
  );
}
