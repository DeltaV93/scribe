"use client";

/**
 * Create Export Template Page
 *
 * Multi-step wizard for creating export templates.
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Form {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface FieldMapping {
  externalField: string;
  scrybeField: string;
  required: boolean;
  transformer?: string;
  defaultValue?: string;
  description?: string;
}

const exportTypes = [
  {
    id: "HUD_HMIS",
    name: "HUD HMIS",
    description: "Homeless Management Information System for HUD reporting",
    format: "CSV",
    icon: <FileSpreadsheet className="h-6 w-6" />,
  },
  {
    id: "DOL_WIPS",
    name: "DOL WIPS",
    description: "Department of Labor Workforce Investment Performance System",
    format: "TXT (Pipe-delimited)",
    icon: <FileText className="h-6 w-6" />,
  },
  {
    id: "CAP60",
    name: "CAP60",
    description: "Community Action Partnership CSBG reporting",
    format: "CSV",
    icon: <FileSpreadsheet className="h-6 w-6" />,
  },
  {
    id: "CALI_GRANTS",
    name: "CalGrants",
    description: "California state grant performance reporting",
    format: "Excel (XLSX)",
    icon: <FileSpreadsheet className="h-6 w-6" />,
  },
  {
    id: "CUSTOM",
    name: "Custom Export",
    description: "Create a custom export format",
    format: "CSV",
    icon: <FileSpreadsheet className="h-6 w-6" />,
  },
];

const steps = [
  { id: 1, name: "Select Type" },
  { id: 2, name: "Source Forms" },
  { id: 3, name: "Field Mapping" },
  { id: 4, name: "Review" },
];

function CreateTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [forms, setForms] = useState<Form[]>([]);
  const [predefinedFields, setPredefinedFields] = useState<FieldMapping[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exportType, setExportType] = useState(initialType || "");
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

  // Load forms on mount
  useEffect(() => {
    async function fetchForms() {
      try {
        const res = await fetch("/api/forms?status=PUBLISHED");
        if (res.ok) {
          const data = await res.json();
          setForms(data.forms || []);
        }
      } catch (error) {
        console.error("Error fetching forms:", error);
      }
    }
    fetchForms();
  }, []);

  // Load predefined fields when type is selected
  useEffect(() => {
    if (exportType && exportType !== "CUSTOM") {
      fetchFieldMappings();
    }
  }, [exportType, selectedFormIds]);

  async function fetchFieldMappings() {
    try {
      const params = new URLSearchParams();
      if (selectedFormIds.length > 0) {
        params.set("formIds", selectedFormIds.join(","));
      }

      const res = await fetch(`/api/exports/field-mappings/${exportType}?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPredefinedFields(data.fields || []);
        if (fieldMappings.length === 0) {
          setFieldMappings(data.fields || []);
        }
      }
    } catch (error) {
      console.error("Error fetching field mappings:", error);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/exports/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          exportType,
          sourceFormIds: selectedFormIds,
          fieldMappings,
          usePredefined: exportType !== "CUSTOM",
        }),
      });

      if (res.ok) {
        const template = await res.json();
        router.push(`/exports/templates/${template.id}`);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create template");
      }
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleForm(formId: string) {
    setSelectedFormIds((prev) =>
      prev.includes(formId)
        ? prev.filter((id) => id !== formId)
        : [...prev, formId]
    );
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 1:
        return !!exportType;
      case 2:
        return selectedFormIds.length > 0;
      case 3:
        return fieldMappings.length > 0 && !!name;
      default:
        return true;
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/exports/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Export Template</h1>
          <p className="text-muted-foreground">
            Configure a new funder export format
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  currentStep > step.id
                    ? "bg-green-500 text-white"
                    : currentStep === step.id
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {currentStep > step.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={`ml-2 text-sm ${
                  currentStep === step.id
                    ? "text-blue-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                {step.name}
              </span>
              {index < steps.length - 1 && (
                <div className="w-24 h-0.5 mx-4 bg-gray-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Select Type */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Select Export Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exportTypes.map((type) => (
                  <div
                    key={type.id}
                    onClick={() => setExportType(type.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      exportType === type.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gray-100 rounded">
                        {type.icon}
                      </div>
                      <div>
                        <p className="font-medium">{type.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {type.description}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {type.format}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Forms */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Select Source Forms</h3>
              <p className="text-sm text-muted-foreground">
                Choose which forms to extract data from
              </p>

              {forms.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No published forms available
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {forms.map((form) => (
                    <div
                      key={form.id}
                      onClick={() => toggleForm(form.id)}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                        selectedFormIds.includes(form.id)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Checkbox
                        checked={selectedFormIds.includes(form.id)}
                        onCheckedChange={() => toggleForm(form.id)}
                      />
                      <div>
                        <p className="font-medium">{form.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {form.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Field Mapping & Name */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Monthly HMIS Export"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Field Mappings</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {predefinedFields.length} fields configured for{" "}
                  {exportTypes.find((t) => t.id === exportType)?.name}
                </p>

                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">External Field</th>
                        <th className="text-left p-2">Scrybe Field</th>
                        <th className="text-left p-2">Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {fieldMappings.slice(0, 20).map((mapping, index) => (
                        <tr key={index}>
                          <td className="p-2 font-mono text-xs">
                            {mapping.externalField}
                          </td>
                          <td className="p-2 font-mono text-xs">
                            {mapping.scrybeField}
                          </td>
                          <td className="p-2">
                            {mapping.required ? (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Optional
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {fieldMappings.length > 20 && (
                    <p className="text-center py-2 text-sm text-muted-foreground">
                      +{fieldMappings.length - 20} more fields
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Review Template</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Template Name</Label>
                  <p className="font-medium">{name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Export Type</Label>
                  <p className="font-medium">
                    {exportTypes.find((t) => t.id === exportType)?.name}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Source Forms</Label>
                  <p className="font-medium">{selectedFormIds.length} forms</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fields</Label>
                  <p className="font-medium">{fieldMappings.length} fields</p>
                </div>
              </div>

              {description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{description}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < 4 ? (
          <Button
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Template
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function NewTemplatePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <CreateTemplateContent />
    </Suspense>
  );
}
