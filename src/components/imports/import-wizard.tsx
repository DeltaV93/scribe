"use client";

/**
 * Import Wizard Component
 *
 * Multi-step wizard for importing client data from CSV/Excel files.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  Users,
  Loader2,
  FileSpreadsheet,
  Wand2,
  Eye,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { ImportFileUploader, UploadResult } from "./file-uploader";
import { FieldMapper, FieldMapping, TargetField } from "./field-mapper";
import { ImportPreview } from "./import-preview";

// Default target fields for client import
const CLIENT_TARGET_FIELDS: TargetField[] = [
  { value: "client.firstName", label: "First Name", required: true },
  { value: "client.lastName", label: "Last Name", required: true },
  { value: "client.phone", label: "Phone Number", required: true },
  { value: "client.email", label: "Email Address" },
  { value: "client.address.street", label: "Street Address" },
  { value: "client.address.city", label: "City" },
  { value: "client.address.state", label: "State" },
  { value: "client.address.zip", label: "ZIP Code" },
  { value: "client.internalId", label: "External/Internal ID" },
];

type WizardStep = "upload" | "mapping" | "preview" | "execute";

const steps: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: "upload", label: "Upload File", icon: <Upload className="h-4 w-4" /> },
  { id: "mapping", label: "Map Fields", icon: <Wand2 className="h-4 w-4" /> },
  { id: "preview", label: "Preview", icon: <Eye className="h-4 w-4" /> },
  { id: "execute", label: "Import", icon: <Users className="h-4 w-4" /> },
];

interface ImportWizardProps {
  entityType?: "CLIENT" | "FORM_SUBMISSION";
  formId?: string;
  targetFields?: TargetField[];
  onComplete?: (result: ImportResult) => void;
  className?: string;
}

interface ImportResult {
  batchId: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export function ImportWizard({
  entityType = "CLIENT",
  targetFields = CLIENT_TARGET_FIELDS,
  onComplete,
  className,
}: ImportWizardProps) {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Data state
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [duplicateEnabled, setDuplicateEnabled] = useState(true);

  // Step index for progress
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/imports/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to upload file");
        return;
      }

      const result: UploadResult = await res.json();
      setUploadResult(result);

      // Set initial mappings from AI suggestions
      setMappings(
        result.suggestedMappings.map((m) => ({
          sourceColumn: m.sourceColumn,
          targetField: m.targetField,
          confidence: m.confidence,
          aiSuggested: m.aiSuggested !== false,
        }))
      );

      // Move to mapping step
      setCurrentStep("mapping");
      toast.success(`File uploaded: ${result.totalRows} rows detected`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const validateMappings = (): boolean => {
    const mappedTargets = new Set(mappings.map((m) => m.targetField));
    const requiredFields = targetFields.filter((f) => f.required);
    const missingRequired = requiredFields.filter((f) => !mappedTargets.has(f.value));

    if (missingRequired.length > 0) {
      toast.error(
        `Please map required fields: ${missingRequired.map((f) => f.label).join(", ")}`
      );
      return false;
    }

    return true;
  };

  const handleNext = () => {
    switch (currentStep) {
      case "upload":
        // Upload handles its own progression
        break;
      case "mapping":
        if (validateMappings()) {
          setCurrentStep("preview");
        }
        break;
      case "preview":
        setCurrentStep("execute");
        break;
      case "execute":
        executeImport();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "mapping":
        setCurrentStep("upload");
        break;
      case "preview":
        setCurrentStep("mapping");
        break;
      case "execute":
        setCurrentStep("preview");
        break;
    }
  };

  const executeImport = async () => {
    if (!uploadResult) return;

    setIsExecuting(true);

    try {
      const res = await fetch("/api/imports/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: uploadResult.batchId,
          fieldMappings: mappings,
          duplicateSettings: {
            enabled: duplicateEnabled,
            matchFields: [
              { field: "client.firstName", weight: 0.3, matchType: "fuzzy" },
              { field: "client.lastName", weight: 0.3, matchType: "fuzzy" },
              { field: "client.phone", weight: 0.25, matchType: "normalized" },
              { field: "client.email", weight: 0.15, matchType: "exact" },
            ],
            threshold: 0.8,
            defaultAction: "SKIP",
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to execute import");
        return;
      }

      const result = await res.json();
      toast.success("Import started successfully!");

      if (onComplete) {
        onComplete({
          batchId: result.batchId,
          created: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
        });
      }

      // Navigate to import detail page
      router.push(`/imports/${result.batchId}`);
    } catch (error) {
      console.error("Import execution error:", error);
      toast.error("Failed to execute import. Please try again.");
    } finally {
      setIsExecuting(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case "upload":
        return false; // Upload handles progression
      case "mapping":
        return mappings.length > 0;
      case "preview":
        return true;
      case "execute":
        return !isExecuting;
      default:
        return false;
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Progress Indicator */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-2",
                index <= currentStepIndex ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2",
                  index < currentStepIndex
                    ? "bg-primary border-primary text-primary-foreground"
                    : index === currentStepIndex
                    ? "border-primary text-primary"
                    : "border-muted-foreground"
                )}
              >
                {index < currentStepIndex ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.icon
                )}
              </div>
              <span className="hidden sm:inline text-sm font-medium">{step.label}</span>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "hidden sm:block w-12 h-0.5 mx-2",
                    index < currentStepIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <Progress value={((currentStepIndex + 1) / steps.length) * 100} />
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === "upload" && "Upload Your Data File"}
            {currentStep === "mapping" && "Map Columns to Fields"}
            {currentStep === "preview" && "Review Import Preview"}
            {currentStep === "execute" && "Confirm & Execute Import"}
          </CardTitle>
          <CardDescription>
            {currentStep === "upload" &&
              "Upload a CSV, Excel, or JSON file containing your client data."}
            {currentStep === "mapping" &&
              "Match columns from your file to Scrybe fields. AI has suggested some mappings."}
            {currentStep === "preview" &&
              "Review how your data will be imported before proceeding."}
            {currentStep === "execute" &&
              "Configure final settings and start the import process."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Upload Step */}
          {currentStep === "upload" && (
            <ImportFileUploader
              onFileSelected={handleFileSelected}
              isUploading={isUploading}
            />
          )}

          {/* Mapping Step */}
          {currentStep === "mapping" && uploadResult && (
            <FieldMapper
              columns={uploadResult.columns}
              sampleData={uploadResult.preview}
              mappings={mappings}
              targetFields={targetFields}
              onMappingsChange={setMappings}
            />
          )}

          {/* Preview Step */}
          {currentStep === "preview" && uploadResult && (
            <ImportPreview
              totalRows={uploadResult.totalRows}
              mappings={mappings}
              targetFields={targetFields}
              previewData={uploadResult.preview}
            />
          )}

          {/* Execute Step */}
          {currentStep === "execute" && uploadResult && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="text-2xl font-bold">{uploadResult.totalRows}</p>
                        <p className="text-xs text-muted-foreground">Total Records</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Wand2 className="h-8 w-8 text-purple-600" />
                      <div>
                        <p className="text-2xl font-bold">{mappings.length}</p>
                        <p className="text-xs text-muted-foreground">Mapped Fields</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Settings */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <CardTitle className="text-lg">Import Settings</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="duplicate-detection">Duplicate Detection</Label>
                      <p className="text-sm text-muted-foreground">
                        Check for existing clients with similar names, phone, or email
                      </p>
                    </div>
                    <Switch
                      id="duplicate-detection"
                      checked={duplicateEnabled}
                      onCheckedChange={setDuplicateEnabled}
                    />
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> After the import completes, you will have 24 hours
                      to rollback if needed. All created records can be undone.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === "upload" || isExecuting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep !== "upload" && (
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isExecuting}
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : currentStep === "execute" ? (
              <>
                <Users className="h-4 w-4 mr-2" />
                Import {uploadResult?.totalRows || 0} Records
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
