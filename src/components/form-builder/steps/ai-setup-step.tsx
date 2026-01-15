"use client";

import { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  formBuilderAtom,
  updateFormAtom,
  wizardStepAtom,
  aiGenerationAtom,
  startGenerationAtom,
  resetGenerationAtom,
} from "@/lib/form-builder/store";
import { FormType, type FormSettings } from "@/types";
import type { GenerateFormRequest } from "@/lib/ai/generation-types";
import { GeneratedFormReview } from "../generated-form-review";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Sparkles, ChevronDown, ArrowRight, Settings } from "lucide-react";

const formTypeOptions = [
  {
    value: FormType.INTAKE,
    label: "Intake Form",
    description: "Initial client registration and assessment",
  },
  {
    value: FormType.FOLLOWUP,
    label: "Follow-up Form",
    description: "Progress tracking and check-ins",
  },
  {
    value: FormType.REFERRAL,
    label: "Referral Form",
    description: "Partner agency referrals",
  },
  {
    value: FormType.ASSESSMENT,
    label: "Assessment Form",
    description: "Detailed evaluations and screenings",
  },
  {
    value: FormType.CUSTOM,
    label: "Custom Form",
    description: "Other form types",
  },
];

export function AISetupStep() {
  const [state] = useAtom(formBuilderAtom);
  const [aiState] = useAtom(aiGenerationAtom);
  const updateForm = useSetAtom(updateFormAtom);
  const setWizardStep = useSetAtom(wizardStepAtom);
  const startGeneration = useSetAtom(startGenerationAtom);
  const resetGeneration = useSetAtom(resetGenerationAtom);

  const form = state.form;
  const settings = form.settings as FormSettings;

  // Local state for AI generation inputs
  const [description, setDescription] = useState("");
  const [dataPoints, setDataPoints] = useState("");
  const [complianceRequirements, setComplianceRequirements] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSettingsChange = (updates: Partial<FormSettings>) => {
    updateForm({
      settings: {
        ...settings,
        ...updates,
      },
    });
  };

  const handleGenerate = async () => {
    if (!form.name?.trim()) {
      setError("Please enter a form name");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the purpose of this form");
      return;
    }
    if (!dataPoints.trim()) {
      setError("Please list the key data points to collect");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const request: GenerateFormRequest = {
        formName: form.name,
        formType: (form.type as GenerateFormRequest["formType"]) || "INTAKE",
        description: description.trim(),
        dataPoints: dataPoints.trim(),
        complianceRequirements: complianceRequirements.trim() || undefined,
      };

      await startGeneration(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate form");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSkipAI = () => {
    // Skip AI and go directly to fields step
    setWizardStep("fields");
  };

  const handleStartOver = () => {
    resetGeneration();
    setDescription("");
    setDataPoints("");
    setComplianceRequirements("");
    setError(null);
  };

  // Show review phase if we have generated fields
  if (aiState.status === "reviewing" && aiState.generatedFields) {
    return <GeneratedFormReview onStartOver={handleStartOver} />;
  }

  // Show generating state
  if (aiState.status === "generating" || isGenerating) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-medium mb-2">Generating Your Form</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Our AI is designing a comprehensive form based on your requirements.
              This usually takes 10-20 seconds.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Form Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create Form with AI
          </CardTitle>
          <CardDescription>
            Tell us about your form and we'll generate the fields for you.
            You can review and edit everything before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="form-name" required>
              Form Name
            </Label>
            <Input
              id="form-name"
              value={form.name || ""}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="e.g., Client Intake Form"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-type">Form Type</Label>
            <Select
              value={form.type || FormType.INTAKE}
              onValueChange={(value: FormType) => updateForm({ type: value })}
            >
              <SelectTrigger id="form-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI Generation Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>What should this form collect?</CardTitle>
          <CardDescription>
            The more detail you provide, the better the generated form will be.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description" required>
              Purpose & Outcome
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this form should accomplish. What information do you need and why? What will you do with the data?"
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Example: "Capture all information needed when a new client enters
              our homeless services program. Need to understand their current
              situation, history, and eligibility for housing programs."
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data-points" required>
              Key Data Points
            </Label>
            <Textarea
              id="data-points"
              value={dataPoints}
              onChange={(e) => setDataPoints(e.target.value)}
              placeholder="List the specific information you need to collect, separated by commas or on new lines."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Example: "Full name, date of birth, SSN (optional), current living
              situation, how long homeless, income sources, health conditions,
              immediate needs, goals"
            </p>
          </div>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="text-sm">
                  Grant/Compliance Requirements (optional)
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Textarea
                value={complianceRequirements}
                onChange={(e) => setComplianceRequirements(e.target.value)}
                placeholder="Any specific compliance requirements (HUD, HIPAA, funders, etc.)"
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: "HUD CoC Program compliance required. Must capture all
                Universal Data Elements."
              </p>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Form Settings (Collapsible) */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Form Settings
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    showSettings ? "rotate-180" : ""
                  }`}
                />
              </CardTitle>
              <CardDescription>
                Optional settings for how the form behaves
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="partial-saves">Allow Partial Saves</Label>
                  <p className="text-xs text-muted-foreground">
                    Users can save progress and return later
                  </p>
                </div>
                <Switch
                  id="partial-saves"
                  checked={settings?.allowPartialSaves ?? true}
                  onCheckedChange={(checked) =>
                    handleSettingsChange({ allowPartialSaves: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="supervisor-review">
                    Require Supervisor Review
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Submissions need supervisor approval
                  </p>
                </div>
                <Switch
                  id="supervisor-review"
                  checked={settings?.requireSupervisorReview ?? false}
                  onCheckedChange={(checked) =>
                    handleSettingsChange({ requireSupervisorReview: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-archive">Auto-Archive After (days)</Label>
                <Select
                  value={settings?.autoArchiveDays?.toString() || "none"}
                  onValueChange={(value) =>
                    handleSettingsChange({
                      autoArchiveDays: value === "none" ? null : parseInt(value),
                    })
                  }
                >
                  <SelectTrigger id="auto-archive">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Never</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Error Message */}
      {(error || aiState.error) && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error || aiState.error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleSkipAI}>
          Skip AI Generation
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button onClick={handleGenerate} disabled={isGenerating}>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Form with AI
        </Button>
      </div>
    </div>
  );
}
