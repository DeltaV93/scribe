"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  Loader2,
  MessageSquareQuote,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FieldOption {
  value: string;
  label: string;
}

interface ExtractedField {
  fieldId: string;
  slug: string;
  name: string;
  type: string;
  value: string | number | boolean | string[] | null;
  confidence: number;
  reasoning?: string;
  sourceSnippet?: string;
  needsReview: boolean;
  options?: FieldOption[];
  isRequired: boolean;
}

interface ExtractionReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: string;
  clientName: string;
  formId: string;
  formName: string;
  extractedFields: ExtractedField[];
  overallConfidence: number;
  onConfirm: (fields: ExtractedField[]) => Promise<void>;
  onReExtract?: () => Promise<void>;
}

export function ExtractionReviewModal({
  open,
  onOpenChange,
  callId,
  clientName,
  formId,
  formName,
  extractedFields: initialFields,
  overallConfidence,
  onConfirm,
  onReExtract,
}: ExtractionReviewModalProps) {
  const [fields, setFields] = useState<ExtractedField[]>(initialFields);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const updateFieldValue = useCallback(
    (fieldId: string, value: ExtractedField["value"]) => {
      setFields((prev) =>
        prev.map((f) =>
          f.fieldId === fieldId
            ? { ...f, value, needsReview: false, confidence: 100 }
            : f
        )
      );
    },
    []
  );

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(fields);
      toast.success("Form data saved successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error confirming extraction:", error);
      toast.error("Failed to save form data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReExtract = async () => {
    if (!onReExtract) return;
    setIsReExtracting(true);
    try {
      await onReExtract();
      toast.success("Re-extraction complete");
    } catch (error) {
      console.error("Error re-extracting:", error);
      toast.error("Failed to re-extract data");
    } finally {
      setIsReExtracting(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600";
    if (confidence >= 70) return "text-amber-600";
    return "text-red-600";
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90)
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">High</Badge>;
    if (confidence >= 70)
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Medium</Badge>;
    return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Low</Badge>;
  };

  const fieldsNeedingReview = fields.filter((f) => f.needsReview);
  const requiredFieldsMissing = fields.filter(
    (f) => f.isRequired && (f.value === null || f.value === "")
  );

  const renderFieldInput = (field: ExtractedField) => {
    const isEditing = editingFieldId === field.fieldId;

    // Display mode
    if (!isEditing) {
      let displayValue: string;
      if (field.value === null || field.value === "") {
        displayValue = "(not extracted)";
      } else if (typeof field.value === "boolean") {
        displayValue = field.value ? "Yes" : "No";
      } else if (Array.isArray(field.value)) {
        displayValue = field.value.join(", ");
      } else {
        displayValue = String(field.value);
      }

      return (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex-1",
              (field.value === null || field.value === "") && "text-muted-foreground italic"
            )}
          >
            {displayValue}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingFieldId(field.fieldId)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    // Edit mode based on field type
    switch (field.type) {
      case "DROPDOWN":
        return (
          <Select
            value={String(field.value || "")}
            onValueChange={(value) => {
              updateFieldValue(field.fieldId, value);
              setEditingFieldId(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "YES_NO":
        return (
          <div className="flex items-center gap-4">
            <Button
              variant={field.value === true ? "default" : "outline"}
              size="sm"
              onClick={() => {
                updateFieldValue(field.fieldId, true);
                setEditingFieldId(null);
              }}
            >
              Yes
            </Button>
            <Button
              variant={field.value === false ? "default" : "outline"}
              size="sm"
              onClick={() => {
                updateFieldValue(field.fieldId, false);
                setEditingFieldId(null);
              }}
            >
              No
            </Button>
          </div>
        );

      case "CHECKBOX":
        return (
          <div className="space-y-2">
            {field.options?.map((option) => {
              const values = Array.isArray(field.value) ? field.value : [];
              const isChecked = values.includes(option.value);
              return (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`${field.fieldId}-${option.value}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const newValues = checked
                        ? [...values, option.value]
                        : values.filter((v) => v !== option.value);
                      updateFieldValue(field.fieldId, newValues);
                    }}
                  />
                  <Label htmlFor={`${field.fieldId}-${option.value}`}>
                    {option.label}
                  </Label>
                </div>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingFieldId(null)}
            >
              Done
            </Button>
          </div>
        );

      case "LONG_TEXT":
        return (
          <div className="space-y-2">
            <Textarea
              value={String(field.value || "")}
              onChange={(e) => updateFieldValue(field.fieldId, e.target.value)}
              rows={3}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingFieldId(null)}
            >
              Done
            </Button>
          </div>
        );

      case "NUMBER":
        return (
          <Input
            type="number"
            value={field.value !== null ? String(field.value) : ""}
            onChange={(e) =>
              updateFieldValue(
                field.fieldId,
                e.target.value ? Number(e.target.value) : null
              )
            }
            onBlur={() => setEditingFieldId(null)}
            onKeyDown={(e) => e.key === "Enter" && setEditingFieldId(null)}
            autoFocus
          />
        );

      case "DATE":
        return (
          <Input
            type="date"
            value={String(field.value || "")}
            onChange={(e) => updateFieldValue(field.fieldId, e.target.value)}
            onBlur={() => setEditingFieldId(null)}
            autoFocus
          />
        );

      default:
        return (
          <Input
            value={String(field.value || "")}
            onChange={(e) => updateFieldValue(field.fieldId, e.target.value)}
            onBlur={() => setEditingFieldId(null)}
            onKeyDown={(e) => e.key === "Enter" && setEditingFieldId(null)}
            autoFocus
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review Extracted Data
          </DialogTitle>
          <DialogDescription>
            AI extracted the following data from your call with {clientName}.
            Review and correct any fields before saving to the form.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Bar */}
        <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Form: </span>
              <span className="font-medium">{formName}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Confidence: </span>
              <span className={cn("font-medium", getConfidenceColor(overallConfidence))}>
                {overallConfidence}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fieldsNeedingReview.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700">
                {fieldsNeedingReview.length} needs review
              </Badge>
            )}
            {requiredFieldsMissing.length > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700">
                {requiredFieldsMissing.length} required missing
              </Badge>
            )}
          </div>
        </div>

        {/* Fields List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {fields.map((field) => (
              <div
                key={field.fieldId}
                className={cn(
                  "border rounded-lg p-3",
                  field.needsReview && "border-amber-300 bg-amber-50/50",
                  field.isRequired &&
                    (field.value === null || field.value === "") &&
                    "border-red-300 bg-red-50/50"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Label className="font-medium">
                      {field.name}
                      {field.isRequired && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    {field.needsReview ? (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {getConfidenceBadge(field.confidence)}
                </div>

                {renderFieldInput(field)}

                {/* Reasoning and source snippet */}
                {(field.reasoning || field.sourceSnippet) && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    {field.reasoning && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Reasoning:</span>{" "}
                        {field.reasoning}
                      </p>
                    )}
                    {field.sourceSnippet && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-start gap-1 text-xs text-muted-foreground cursor-help">
                              <MessageSquareQuote className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-1">
                                "{field.sourceSnippet}"
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm">
                            <p>"{field.sourceSnippet}"</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          {onReExtract && (
            <Button
              variant="outline"
              onClick={handleReExtract}
              disabled={isReExtracting || isSubmitting}
            >
              {isReExtracting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Re-extract
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
