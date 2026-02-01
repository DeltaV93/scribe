"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, FileText, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  description?: string;
  type: string;
}

interface Program {
  id: string;
  name: string;
}

type WizardStep = "template" | "period" | "programs" | "review";

function GenerateReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTemplateId = searchParams.get("templateId");

  const [step, setStep] = useState<WizardStep>(
    preselectedTemplateId ? "period" : "template"
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    preselectedTemplateId || ""
  );
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    date.setDate(1);
    return date.toISOString().split("T")[0];
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    const date = new Date();
    date.setDate(0); // Last day of previous month
    return date.toISOString().split("T")[0];
  });
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [includeAllPrograms, setIncludeAllPrograms] = useState(true);

  // Load templates
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [templatesRes, programsRes] = await Promise.all([
          fetch("/api/reports/templates?status=PUBLISHED"),
          fetch("/api/programs"),
        ]);

        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data.data || []);
        }

        if (programsRes.ok) {
          const data = await programsRes.json();
          setPrograms(data.data || []);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const canProceed = () => {
    switch (step) {
      case "template":
        return !!selectedTemplateId;
      case "period":
        return !!periodStart && !!periodEnd && new Date(periodStart) < new Date(periodEnd);
      case "programs":
        return includeAllPrograms || selectedProgramIds.length > 0;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const steps: WizardStep[] = ["template", "period", "programs", "review"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: WizardStep[] = ["template", "period", "programs", "review"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          reportingPeriod: {
            start: new Date(periodStart).toISOString(),
            end: new Date(periodEnd).toISOString(),
          },
          programIds: includeAllPrograms ? undefined : selectedProgramIds,
          async: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/reports/${data.data.reportId}`);
      } else {
        const error = await response.json();
        toast.error(error.error?.message || "Failed to generate report");
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProgram = (programId: string) => {
    setSelectedProgramIds((prev) =>
      prev.includes(programId)
        ? prev.filter((id) => id !== programId)
        : [...prev, programId]
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generate Report</h1>
          <p className="text-muted-foreground">
            Create a new report from a template
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {(["template", "period", "programs", "review"] as WizardStep[]).map(
          (s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : (["template", "period", "programs", "review"].indexOf(step) >
                        i)
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {(["template", "period", "programs", "review"].indexOf(step) > i) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div
                  className={`h-0.5 w-8 ${
                    (["template", "period", "programs", "review"].indexOf(step) > i)
                      ? "bg-green-300"
                      : "bg-muted"
                  }`}
                />
              )}
            </div>
          )
        )}
      </div>

      {/* Step Content */}
      <Card>
        {step === "template" && (
          <>
            <CardHeader>
              <CardTitle>Select Template</CardTitle>
              <CardDescription>
                Choose a report template to generate from
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No published templates available.
                  </p>
                  <Link href="/reports/templates/new">
                    <Button variant="outline">Create a Template</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTemplateId === template.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description || "No description"}
                          </p>
                        </div>
                        <Badge variant="outline">{template.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </>
        )}

        {step === "period" && (
          <>
            <CardHeader>
              <CardTitle>Reporting Period</CardTitle>
              <CardDescription>
                Select the date range for this report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="periodStart">Start Date</Label>
                  <Input
                    id="periodStart"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodEnd">End Date</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick Period Selectors */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const end = new Date(now.getFullYear(), now.getMonth(), 0);
                    setPeriodStart(start.toISOString().split("T")[0]);
                    setPeriodEnd(end.toISOString().split("T")[0]);
                  }}
                >
                  Last Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const quarter = Math.floor(now.getMonth() / 3);
                    const start = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
                    const end = new Date(now.getFullYear(), quarter * 3, 0);
                    setPeriodStart(start.toISOString().split("T")[0]);
                    setPeriodEnd(end.toISOString().split("T")[0]);
                  }}
                >
                  Last Quarter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const start = new Date(now.getFullYear() - 1, 0, 1);
                    const end = new Date(now.getFullYear() - 1, 11, 31);
                    setPeriodStart(start.toISOString().split("T")[0]);
                    setPeriodEnd(end.toISOString().split("T")[0]);
                  }}
                >
                  Last Year
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    // Fiscal year: July 1 - June 30
                    const year = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
                    const start = new Date(year - 1, 6, 1);
                    const end = new Date(year, 5, 30);
                    setPeriodStart(start.toISOString().split("T")[0]);
                    setPeriodEnd(end.toISOString().split("T")[0]);
                  }}
                >
                  Last Fiscal Year
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === "programs" && (
          <>
            <CardHeader>
              <CardTitle>Programs</CardTitle>
              <CardDescription>
                Select which programs to include in this report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allPrograms"
                  checked={includeAllPrograms}
                  onCheckedChange={(checked) =>
                    setIncludeAllPrograms(checked as boolean)
                  }
                />
                <Label htmlFor="allPrograms">Include all programs</Label>
              </div>

              {!includeAllPrograms && (
                <div className="space-y-2 mt-4">
                  {programs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No programs available.
                    </p>
                  ) : (
                    programs.map((program) => (
                      <div
                        key={program.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={program.id}
                          checked={selectedProgramIds.includes(program.id)}
                          onCheckedChange={() => toggleProgram(program.id)}
                        />
                        <Label htmlFor={program.id}>{program.name}</Label>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </>
        )}

        {step === "review" && (
          <>
            <CardHeader>
              <CardTitle>Review & Generate</CardTitle>
              <CardDescription>
                Confirm your settings before generating the report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Template</span>
                  <span className="font-medium">
                    {selectedTemplate?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Report Type</span>
                  <Badge variant="outline">
                    {selectedTemplate?.type || "-"}
                  </Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Reporting Period</span>
                  <span className="font-medium">
                    {new Date(periodStart).toLocaleDateString()} -{" "}
                    {new Date(periodEnd).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Programs</span>
                  <span className="font-medium">
                    {includeAllPrograms
                      ? "All Programs"
                      : `${selectedProgramIds.length} selected`}
                  </span>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="text-muted-foreground">
                  The report will be generated in the background. You will be
                  notified when it is ready for download.
                </p>
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === "template" && !preselectedTemplateId}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {step === "review" ? (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function GenerateReportPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <GenerateReportContent />
    </Suspense>
  );
}
