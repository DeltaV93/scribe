"use client";

import { useState, useCallback } from "react";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import {
  formBuilderAtom,
  updateFormAtom,
  wizardStepAtom,
  setFieldSourcesAtom,
} from "@/lib/form-builder/store";
import { FormType, FieldType, FieldPurpose, type FormSettings, type FormFieldData } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload,
  FileImage,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

interface UploadState {
  status: "idle" | "uploading" | "processing" | "success" | "error";
  file: File | null;
  progress: number;
  error: string | null;
  detectedFields: FormFieldData[];
  suggestedName: string | null;
  suggestedDescription: string | null;
}

export function UploadStep() {
  const [state] = useAtom(formBuilderAtom);
  const updateForm = useSetAtom(updateFormAtom);
  const setWizardStep = useSetAtom(wizardStepAtom);
  const setFieldSources = useSetAtom(setFieldSourcesAtom);
  const { toast } = useToast();

  const form = state.form;

  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    file: null,
    progress: 0,
    error: null,
    detectedFields: [],
    suggestedName: null,
    suggestedDescription: null,
  });

  const [isDragging, setIsDragging] = useState(false);

  // Handle file validation
  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return "Please upload a PDF, JPEG, PNG, or WebP file";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be less than 25MB";
    }
    return null;
  };

  // Process the uploaded file
  const processFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState((prev) => ({
        ...prev,
        status: "error",
        error: validationError,
      }));
      return;
    }

    setUploadState((prev) => ({
      ...prev,
      status: "uploading",
      file,
      progress: 0,
      error: null,
    }));

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append("file", file);

      // Upload and start conversion
      const startResponse = await fetch("/api/form-conversion/start", {
        method: "POST",
        body: formData,
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.error?.message || "Failed to upload file");
      }

      const { conversionId } = await startResponse.json();

      setUploadState((prev) => ({
        ...prev,
        status: "processing",
        progress: 50,
      }));

      // Process the conversion
      const processResponse = await fetch(
        `/api/form-conversion/${conversionId}/process`,
        {
          method: "POST",
        }
      );

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error?.message || "Failed to process file");
      }

      const result = await processResponse.json();

      // Update state with detected fields
      setUploadState((prev) => ({
        ...prev,
        status: "success",
        progress: 100,
        detectedFields: result.detectedFields || [],
        suggestedName: result.suggestedName || null,
        suggestedDescription: result.suggestedDescription || null,
      }));

      // Auto-fill form name if not already set
      if (!form.name && result.suggestedName) {
        updateForm({ name: result.suggestedName });
      }

      // Auto-fill description if not already set
      if (!form.description && result.suggestedDescription) {
        updateForm({ description: result.suggestedDescription });
      }

      toast({
        title: "File processed successfully",
        description: `Detected ${result.detectedFields?.length || 0} fields`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to process file";
      setUploadState((prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
      toast({
        title: "Processing failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Proceed to fields step with detected fields
  const handleProceed = () => {
    if (uploadState.detectedFields.length > 0) {
      // Add detected fields to form builder
      const current = state;
      const newFields = uploadState.detectedFields.map((field, index) => ({
        ...field,
        id: field.id || crypto.randomUUID(),
        formId: current.form.id || "",
        order: current.fields.length + index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Update form builder state
      const formBuilderState = {
        ...current,
        fields: [...current.fields, ...newFields],
        isDirty: true,
      };

      // Track field sources as "upload"
      const sources = newFields.reduce(
        (acc, field) => ({ ...acc, [field.id]: "upload" as const }),
        {}
      );
      setFieldSources(sources);
    }

    setWizardStep("fields");
  };

  // Skip upload and go to fields
  const handleSkip = () => {
    setWizardStep("fields");
  };

  const isProcessing =
    uploadState.status === "uploading" || uploadState.status === "processing";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Form Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Existing Form
          </CardTitle>
          <CardDescription>
            Upload a PDF or image of an existing form. We'll detect the fields
            and create a digital version for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="form-name">Form Name</Label>
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

      {/* File Upload Area */}
      <Card>
        <CardContent className="pt-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 transition-colors",
              isDragging && "border-primary bg-primary/5",
              uploadState.status === "error" &&
                "border-destructive bg-destructive/5",
              uploadState.status === "success" &&
                "border-green-500 bg-green-500/5",
              !isDragging &&
                uploadState.status === "idle" &&
                "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
          >
            {/* Idle State */}
            {uploadState.status === "idle" && (
              <>
                <div className="flex gap-2">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <FileImage className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium">
                    Drag and drop your form here, or{" "}
                    <label className="text-primary cursor-pointer hover:underline">
                      browse
                      <input
                        type="file"
                        accept={ACCEPTED_FILE_TYPES.join(",")}
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    PDF, JPEG, PNG, or WebP up to 25MB
                  </p>
                </div>
              </>
            )}

            {/* Uploading/Processing State */}
            {isProcessing && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">
                    {uploadState.status === "uploading"
                      ? "Uploading file..."
                      : "Analyzing form and detecting fields..."}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This usually takes 10-30 seconds
                  </p>
                </div>
              </>
            )}

            {/* Success State */}
            {uploadState.status === "success" && (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <div className="text-center">
                  <p className="font-medium text-green-700">
                    Successfully detected {uploadState.detectedFields.length}{" "}
                    fields
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {uploadState.file?.name}
                  </p>
                </div>
              </>
            )}

            {/* Error State */}
            {uploadState.status === "error" && (
              <>
                <AlertCircle className="h-12 w-12 text-destructive" />
                <div className="text-center">
                  <p className="font-medium text-destructive">
                    {uploadState.error}
                  </p>
                  <label className="mt-2 inline-block text-sm text-primary cursor-pointer hover:underline">
                    Try another file
                    <input
                      type="file"
                      accept={ACCEPTED_FILE_TYPES.join(",")}
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detected Fields Preview */}
      {uploadState.status === "success" &&
        uploadState.detectedFields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detected Fields</CardTitle>
              <CardDescription>
                These fields were detected from your document. You can review
                and edit them in the next step.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {uploadState.detectedFields.slice(0, 5).map((field, index) => (
                  <li
                    key={field.id || index}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="font-medium">{field.name}</span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {field.type.toLowerCase().replace("_", " ")}
                    </span>
                  </li>
                ))}
                {uploadState.detectedFields.length > 5 && (
                  <li className="text-sm text-muted-foreground py-2">
                    + {uploadState.detectedFields.length - 5} more fields
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleSkip}>
          Skip upload, build manually
        </Button>
        {uploadState.status === "success" && (
          <Button onClick={handleProceed}>
            Continue with {uploadState.detectedFields.length} fields
          </Button>
        )}
      </div>
    </div>
  );
}
