"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldEditor, type DetectedFieldData } from "./field-editor";
import { ConfidenceBadge, ConfidenceBar } from "./confidence-badge";
import {
  ArrowLeft,
  Loader2,
  Save,
  FileText,
  AlertTriangle,
  Plus,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ReviewPageProps {
  conversionId: string;
}

interface ConversionData {
  id: string;
  status: string;
  sourceType: string;
  confidence: number | null;
  warnings: string[];
  detectedFields: DetectedFieldData[];
  requiresOriginalExport: boolean;
  createdAt: string;
}

const FORM_TYPES = [
  { value: "INTAKE", label: "Intake" },
  { value: "FOLLOWUP", label: "Follow-up" },
  { value: "REFERRAL", label: "Referral" },
  { value: "ASSESSMENT", label: "Assessment" },
  { value: "CUSTOM", label: "Custom" },
];

export function ReviewPage({ conversionId }: ReviewPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [conversion, setConversion] = useState<ConversionData | null>(null);
  const [fields, setFields] = useState<DetectedFieldData[]>([]);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState("CUSTOM");
  const [newSection, setNewSection] = useState("");

  // Get unique sections
  const sections = [...new Set(fields.map((f) => f.section).filter(Boolean))] as string[];

  useEffect(() => {
    loadConversion();
  }, [conversionId]);

  const loadConversion = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/form-conversion/${conversionId}`);
      if (!response.ok) throw new Error("Failed to load conversion");

      const data = await response.json();
      setConversion(data.data);
      setFields(data.data.detectedFields || []);
      setFormName(data.data.suggestedFormName || "Converted Form");
    } catch (error) {
      console.error("Error loading conversion:", error);
      toast.error("Failed to load conversion");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateField = (index: number, updates: Partial<DetectedFieldData>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const handleRemoveField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddField = () => {
    const slug = `field_${Date.now()}`;
    setFields((prev) => [
      ...prev,
      {
        slug,
        name: "New Field",
        type: "TEXT_SHORT",
        purpose: "OTHER",
        isRequired: false,
        isSensitive: false,
        confidence: 1.0,
        sourceLabel: "Manually added",
      },
    ]);
  };

  const handleAddSection = () => {
    if (newSection.trim() && !sections.includes(newSection.trim())) {
      // Just add section name - fields can be assigned to it
      setNewSection("");
      toast.success(`Section "${newSection.trim()}" added`);
    }
  };

  const handleSaveReview = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/form-conversion/${conversionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: fields.map((f) => ({
            slug: f.slug,
            name: f.name,
            type: f.type,
            purpose: f.purpose,
            isRequired: f.isRequired,
            isSensitive: f.isSensitive,
            section: f.section,
            helpText: f.helpText,
            options: f.options,
          })),
          suggestedFormName: formName,
          suggestedFormType: formType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to save review");
      }

      toast.success("Review saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateForm = async () => {
    if (!formName.trim()) {
      toast.error("Please enter a form name");
      return;
    }

    if (fields.length === 0) {
      toast.error("At least one field is required");
      return;
    }

    setIsCreating(true);
    try {
      // Save review first
      await handleSaveReview();

      // Create form
      const response = await fetch(`/api/form-conversion/${conversionId}/create-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          type: formType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to create form");
      }

      const data = await response.json();
      toast.success("Form created successfully");
      router.push(`/forms/${data.data.formId}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create form");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!conversion) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Conversion not found
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Review Detected Fields</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{conversion.sourceType}</Badge>
              {conversion.confidence !== null && (
                <ConfidenceBadge confidence={conversion.confidence} showLabel />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSaveReview} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Review
          </Button>
          <Button onClick={handleCreateForm} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Create Form
          </Button>
        </div>
      </div>

      {/* Warnings */}
      {conversion.warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {conversion.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Details */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Details</CardTitle>
              <CardDescription>
                Configure the new form settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="formName">Form Name *</Label>
                <Input
                  id="formName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter form name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="formType">Form Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="formDescription">Description</Label>
                <Textarea
                  id="formDescription"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional form description"
                  rows={3}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Sections</Label>
                <div className="flex gap-2">
                  <Input
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    placeholder="New section name"
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), handleAddSection())
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddSection}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {sections.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {sections.map((section) => (
                      <Badge key={section} variant="secondary">
                        {section}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Detection Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Fields Detected</span>
                <span className="font-medium">{fields.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Required Fields</span>
                <span className="font-medium">
                  {fields.filter((f) => f.isRequired).length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Sensitive Fields</span>
                <span className="font-medium">
                  {fields.filter((f) => f.isSensitive).length}
                </span>
              </div>
              {conversion.confidence !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Overall Confidence</span>
                    <span className="font-medium">
                      {Math.round(conversion.confidence * 100)}%
                    </span>
                  </div>
                  <ConfidenceBar confidence={conversion.confidence} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fields List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Detected Fields</CardTitle>
                <CardDescription>
                  Review and edit the detected form fields
                </CardDescription>
              </div>
              <Button variant="outline" onClick={handleAddField}>
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {fields.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No fields detected</p>
                      <p className="text-sm">Click "Add Field" to add fields manually</p>
                    </div>
                  ) : (
                    fields.map((field, index) => (
                      <FieldEditor
                        key={field.slug}
                        field={field}
                        index={index}
                        onUpdate={handleUpdateField}
                        onRemove={handleRemoveField}
                        sections={sections}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
