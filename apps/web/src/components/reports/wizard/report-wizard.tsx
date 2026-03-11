"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, ArrowRight, Check, FileText, Sparkles, Settings } from "lucide-react";
import { toast } from "sonner";
import { ReportTypeSelector, ReportTypeOption } from "./report-type-selector";
import { QuestionnaireStep, QuestionSection } from "./questionnaire-step";
import { MetricSelector, MetricSuggestion, PreBuiltMetric } from "./metric-selector";

type WizardStep = "type" | "questions" | "metrics" | "review";

const STEPS: WizardStep[] = ["type", "questions", "metrics", "review"];

interface Category {
  id: string;
  label: string;
  description: string;
}

export function ReportWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>("type");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [reportTypes, setReportTypes] = useState<ReportTypeOption[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [questionnaire, setQuestionnaire] = useState<{
    title: string;
    description: string;
    sections: QuestionSection[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<
    Array<{ questionId: string; message: string }>
  >([]);

  // Metrics state
  const [availableMetrics, setAvailableMetrics] = useState<PreBuiltMetric[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<MetricSuggestion[]>([]);

  // Load report types on mount
  useEffect(() => {
    loadReportTypes();
  }, []);

  // Load questionnaire when type is selected
  useEffect(() => {
    if (selectedType) {
      loadQuestionnaire(selectedType);
      loadMetrics(selectedType);
    }
  }, [selectedType]);

  const loadReportTypes = async () => {
    try {
      const response = await fetch("/api/reports/questionnaire");
      if (!response.ok) throw new Error("Failed to load report types");
      const data = await response.json();
      setReportTypes(data.data);
    } catch (error) {
      toast.error("Failed to load report types");
    }
  };

  const loadQuestionnaire = async (type: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/questionnaire/${type}`);
      if (!response.ok) throw new Error("Failed to load questionnaire");
      const data = await response.json();
      setQuestionnaire(data.data);
      setAnswers({});
      setValidationErrors([]);
    } catch (error) {
      toast.error("Failed to load questionnaire");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMetrics = async (type: string) => {
    try {
      const response = await fetch(`/api/reports/metrics/pre-built?type=${type}`);
      if (!response.ok) throw new Error("Failed to load metrics");
      const data = await response.json();
      setAvailableMetrics(data.data.metrics);
      setCategories(data.data.categories);
      setSelectedMetricIds([]);
      setSuggestions([]);
    } catch (error) {
      toast.error("Failed to load metrics");
    }
  };

  const getSuggestions = async () => {
    if (!selectedType) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/reports/suggest-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: selectedType,
          questionnaireAnswers: answers,
        }),
      });

      if (!response.ok) throw new Error("Failed to get suggestions");
      const data = await response.json();
      setSuggestions(data.data.suggestions || []);

      // Auto-select required metrics
      const requiredIds = (data.data.suggestions || [])
        .filter((s: MetricSuggestion) => s.priority === "required")
        .map((s: MetricSuggestion) => s.metricId);
      setSelectedMetricIds(requiredIds);
    } catch (error) {
      toast.error("Failed to get metric suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  const validateQuestionnaire = async (): Promise<boolean> => {
    if (!selectedType) return false;

    try {
      const response = await fetch("/api/reports/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: selectedType,
          answers,
          getSuggestions: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setValidationErrors(data.error?.details || []);
        return false;
      }

      setValidationErrors([]);
      return true;
    } catch (error) {
      toast.error("Validation failed");
      return false;
    }
  };

  const handleNext = async () => {
    const currentIndex = STEPS.indexOf(currentStep);

    if (currentStep === "type" && !selectedType) {
      toast.error("Please select a report type");
      return;
    }

    if (currentStep === "questions") {
      const isValid = await validateQuestionnaire();
      if (!isValid) {
        toast.error("Please fix the validation errors");
        return;
      }
      // Get AI suggestions when moving to metrics step
      await getSuggestions();
    }

    if (currentStep === "metrics" && selectedMetricIds.length === 0) {
      toast.error("Please select at least one metric");
      return;
    }

    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const handleSave = async () => {
    if (!selectedType || selectedMetricIds.length === 0) return;

    setIsSaving(true);
    try {
      const reportName = (answers.report_name as string) || "Untitled Report";
      const reportDescription = answers.report_description as string | undefined;

      const response = await fetch("/api/reports/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reportName,
          description: reportDescription,
          type: selectedType,
          questionnaireAnswers: answers,
          selectedMetricIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to create template");
      }

      const data = await response.json();
      toast.success("Report template created");
      router.push(`/reports/templates/${data.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Clear error for this question
    setValidationErrors((prev) => prev.filter((e) => e.questionId !== questionId));
  };

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Create Report Template</h1>
        <p className="text-muted-foreground">
          Follow the steps to configure your report template
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground">
          {STEPS.map((step, index) => (
            <div
              key={step}
              className={`flex items-center gap-1 ${
                index <= currentStepIndex ? "text-primary" : ""
              }`}
            >
              {index < currentStepIndex ? (
                <Check className="h-4 w-4" />
              ) : index === currentStepIndex ? (
                <span className="font-medium">{index + 1}</span>
              ) : (
                <span>{index + 1}</span>
              )}
              <span className="hidden sm:inline capitalize">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              {currentStep === "type" && (
                <ReportTypeSelector
                  reportTypes={reportTypes}
                  selectedType={selectedType}
                  onSelect={setSelectedType}
                />
              )}

              {currentStep === "questions" && questionnaire && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">{questionnaire.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {questionnaire.description}
                    </p>
                  </div>
                  <QuestionnaireStep
                    sections={questionnaire.sections}
                    answers={answers}
                    onAnswerChange={handleAnswerChange}
                    errors={validationErrors}
                  />
                </div>
              )}

              {currentStep === "metrics" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Select Metrics</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose the metrics to include in your report
                    </p>
                  </div>
                  <MetricSelector
                    availableMetrics={availableMetrics}
                    selectedMetricIds={selectedMetricIds}
                    onSelectionChange={setSelectedMetricIds}
                    suggestions={suggestions}
                    categories={categories}
                  />
                </div>
              )}

              {currentStep === "review" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Review & Create</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Review your settings and create the template
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          <CardTitle className="text-lg">Report Details</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium">{selectedType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium">
                            {(answers.report_name as string) || "Untitled"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5" />
                          <CardTitle className="text-lg">Selected Metrics</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {selectedMetricIds.map((id) => {
                            const metric = availableMetrics.find((m) => m.id === id);
                            return metric ? (
                              <span
                                key={id}
                                className="px-2 py-1 bg-secondary rounded text-sm"
                              >
                                {metric.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {selectedMetricIds.length} metrics selected
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStepIndex === 0 || isLoading}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep === "review" ? (
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Create Template
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={isLoading}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
