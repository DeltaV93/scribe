"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Check,
  AlertTriangle,
  Edit3,
  Save,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Quote,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface ExtractedFieldData {
  fieldId: string;
  value: unknown;
  confidence: number;
  reasoning?: string;
  sourceSnippet?: string;
  needsReview: boolean;
}

export interface FormExtractionData {
  formName: string;
  fields: Record<string, ExtractedFieldData>;
}

export interface ExtractionData {
  forms: Record<string, FormExtractionData>;
  extractedAt: string;
  tokensUsed?: { input: number; output: number };
}

export interface FormFieldInfo {
  id: string;
  slug: string;
  name: string;
  type: string;
  isRequired: boolean;
}

export interface FormInfo {
  formId: string;
  formName: string;
  formType: string;
  fields: FormFieldInfo[];
}

interface UnifiedReviewViewProps {
  conversationId: string;
  extractionData?: ExtractionData | null;
  forms?: FormInfo[];
  isLoading?: boolean;
  onExtract?: () => Promise<void>;
  onFinalize?: (edits: Record<string, Record<string, unknown>>) => Promise<void>;
  onFieldEdit?: (formId: string, fieldSlug: string, value: unknown) => void;
  className?: string;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const colorClass =
    confidence >= 90
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : confidence >= 70
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  return (
    <Badge variant="outline" className={cn("text-xs font-mono", colorClass)}>
      {confidence}%
    </Badge>
  );
}

function FieldValueDisplay({
  value,
  type,
}: {
  value: unknown;
  type: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">Not found</span>;
  }

  if (Array.isArray(value)) {
    return <span>{value.join(", ")}</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Yes" : "No"}</span>;
  }

  return <span>{String(value)}</span>;
}

interface EditableFieldProps {
  fieldSlug: string;
  fieldName: string;
  fieldType: string;
  value: unknown;
  confidence: number;
  sourceSnippet?: string;
  needsReview: boolean;
  isEditing: boolean;
  editValue: string;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: (value: string) => void;
  onEditChange: (value: string) => void;
}

function EditableField({
  fieldSlug,
  fieldName,
  fieldType,
  value,
  confidence,
  sourceSnippet,
  needsReview,
  isEditing,
  editValue,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditChange,
}: EditableFieldProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border",
        needsReview
          ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
          : "border-transparent bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{fieldName}</span>
            {needsReview && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Low confidence - please review</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <ConfidenceBadge confidence={confidence} />
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2">
              {fieldType === "TEXTAREA" ? (
                <Textarea
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  className="text-sm"
                  rows={3}
                />
              ) : (
                <Input
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  className="text-sm h-8"
                />
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => onEditSave(editValue)}
              >
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onEditCancel}
              >
                <X className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="text-sm">
                <FieldValueDisplay value={value} type={fieldType} />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-50 hover:opacity-100"
                onClick={onEditStart}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            </div>
          )}

          {sourceSnippet && !isEditing && (
            <div className="mt-2 text-xs text-muted-foreground flex items-start gap-1">
              <Quote className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="italic line-clamp-2">{sourceSnippet}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function UnifiedReviewView({
  conversationId,
  extractionData,
  forms = [],
  isLoading = false,
  onExtract,
  onFinalize,
  onFieldEdit,
  className,
}: UnifiedReviewViewProps) {
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<{
    formId: string;
    fieldSlug: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localEdits, setLocalEdits] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [isExtracting, setIsExtracting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Expand all forms by default when extraction data loads
  useEffect(() => {
    if (extractionData?.forms) {
      setExpandedForms(new Set(Object.keys(extractionData.forms)));
    }
  }, [extractionData]);

  const toggleFormExpanded = (formId: string) => {
    setExpandedForms((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) {
        next.delete(formId);
      } else {
        next.add(formId);
      }
      return next;
    });
  };

  const handleEditStart = (
    formId: string,
    fieldSlug: string,
    currentValue: unknown
  ) => {
    setEditingField({ formId, fieldSlug });
    setEditValue(currentValue !== null ? String(currentValue) : "");
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleEditSave = (formId: string, fieldSlug: string, value: string) => {
    // Store in local edits
    setLocalEdits((prev) => ({
      ...prev,
      [formId]: {
        ...(prev[formId] || {}),
        [fieldSlug]: value,
      },
    }));

    // Notify parent
    onFieldEdit?.(formId, fieldSlug, value);

    // Clear editing state
    setEditingField(null);
    setEditValue("");
  };

  const handleExtract = async () => {
    if (!onExtract) return;
    setIsExtracting(true);
    try {
      await onExtract();
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFinalize = async () => {
    if (!onFinalize) return;
    setIsFinalizing(true);
    try {
      await onFinalize(localEdits);
    } finally {
      setIsFinalizing(false);
    }
  };

  // Get current value (with local edits applied)
  const getFieldValue = (formId: string, fieldSlug: string): unknown => {
    // Check local edits first
    if (localEdits[formId]?.[fieldSlug] !== undefined) {
      return localEdits[formId][fieldSlug];
    }

    // Fall back to extracted data
    return extractionData?.forms?.[formId]?.fields?.[fieldSlug]?.value;
  };

  // Check if there are any edits
  const hasEdits = Object.keys(localEdits).length > 0;

  // Count fields needing review
  const reviewCount = extractionData
    ? Object.values(extractionData.forms).reduce((count, form) => {
        return (
          count +
          Object.values(form.fields).filter((f) => f.needsReview).length
        );
      }, 0)
    : 0;

  // No extraction data yet
  if (!extractionData && !isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-2">No Extraction Data</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            Extract data from the transcript to populate form fields automatically.
          </p>
          {onExtract && (
            <Button onClick={handleExtract} disabled={isExtracting} className="gap-2">
              {isExtracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Extract Data
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Extracted Data Review
            {reviewCount > 0 && (
              <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700">
                {reviewCount} need review
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {onExtract && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExtract}
                disabled={isExtracting}
                className="gap-2"
              >
                {isExtracting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Re-extract
              </Button>
            )}
          </div>
        </div>
        {extractionData?.extractedAt && (
          <p className="text-xs text-muted-foreground">
            Extracted {new Date(extractionData.extractedAt).toLocaleString()}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Form sections */}
        {forms.map((form) => {
          const formData = extractionData?.forms?.[form.formId];
          const isExpanded = expandedForms.has(form.formId);
          const extractedCount = formData
            ? Object.values(formData.fields).filter((f) => f.value !== null).length
            : 0;

          return (
            <Collapsible
              key={form.formId}
              open={isExpanded}
              onOpenChange={() => toggleFormExpanded(form.formId)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{form.formName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {form.formType}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {extractedCount}/{form.fields.length} fields
                  </span>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="pt-2">
                <div className="space-y-2 pl-6">
                  {form.fields.map((field) => {
                    const fieldData = formData?.fields?.[field.slug];
                    const currentValue = getFieldValue(form.formId, field.slug);
                    const isEditing =
                      editingField?.formId === form.formId &&
                      editingField?.fieldSlug === field.slug;

                    return (
                      <EditableField
                        key={field.id}
                        fieldSlug={field.slug}
                        fieldName={field.name}
                        fieldType={field.type}
                        value={currentValue}
                        confidence={fieldData?.confidence ?? 0}
                        sourceSnippet={fieldData?.sourceSnippet}
                        needsReview={fieldData?.needsReview ?? false}
                        isEditing={isEditing}
                        editValue={editValue}
                        onEditStart={() =>
                          handleEditStart(form.formId, field.slug, currentValue)
                        }
                        onEditCancel={handleEditCancel}
                        onEditSave={(value) =>
                          handleEditSave(form.formId, field.slug, value)
                        }
                        onEditChange={setEditValue}
                      />
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Finalize button */}
        {onFinalize && extractionData && (
          <div className="pt-4 border-t flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {hasEdits
                ? "You have unsaved edits. Finalize to create form submissions."
                : "Review complete? Create form submissions."}
            </p>
            <Button
              onClick={handleFinalize}
              disabled={isFinalizing}
              className="gap-2"
            >
              {isFinalizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Finalize & Create Submissions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// HOOK FOR DATA FETCHING
// ============================================

export function useExtractionData(conversationId: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractionData, setExtractionData] = useState<ExtractionData | null>(
    null
  );
  const [forms, setForms] = useState<FormInfo[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/extract`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch extraction data");
      }

      setExtractionData(data.extractedFields || null);
      setForms(
        data.forms?.map((f: { formId: string; formName: string; formType: string; fieldCount: number }) => ({
          formId: f.formId,
          formName: f.formName,
          formType: f.formType,
          fields: [], // Fields will be populated from guide endpoint
        })) || []
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const runExtraction = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/extract`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Extraction failed");
      }

      // Refetch to get updated data
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
      setIsLoading(false);
    }
  }, [conversationId, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    isLoading,
    error,
    extractionData,
    forms,
    refetch: fetchData,
    runExtraction,
  };
}
