"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ConfidenceBadge } from "./confidence-badge";
import { Trash2, GripVertical, Plus, AlertTriangle } from "lucide-react";

export interface DetectedFieldData {
  slug: string;
  name: string;
  type: string;
  purpose: string;
  isRequired: boolean;
  isSensitive: boolean;
  section?: string;
  helpText?: string;
  options?: string[];
  confidence: number;
  sourceLabel: string;
}

interface FieldEditorProps {
  field: DetectedFieldData;
  index: number;
  onUpdate: (index: number, updates: Partial<DetectedFieldData>) => void;
  onRemove: (index: number) => void;
  sections: string[];
}

const FIELD_TYPES = [
  { value: "TEXT_SHORT", label: "Short Text" },
  { value: "TEXT_LONG", label: "Long Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "ADDRESS", label: "Address" },
  { value: "DROPDOWN", label: "Dropdown" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "YES_NO", label: "Yes/No" },
  { value: "SIGNATURE", label: "Signature" },
  { value: "FILE", label: "File Upload" },
];

const FIELD_PURPOSES = [
  { value: "GRANT_REQUIREMENT", label: "Grant Requirement" },
  { value: "INTERNAL_OPS", label: "Internal Operations" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "OUTCOME_MEASUREMENT", label: "Outcome Measurement" },
  { value: "RISK_ASSESSMENT", label: "Risk Assessment" },
  { value: "OTHER", label: "Other" },
];

export function FieldEditor({
  field,
  index,
  onUpdate,
  onRemove,
  sections,
}: FieldEditorProps) {
  const [optionInput, setOptionInput] = useState("");

  const handleAddOption = () => {
    if (optionInput.trim() && field.options) {
      onUpdate(index, { options: [...field.options, optionInput.trim()] });
      setOptionInput("");
    } else if (optionInput.trim()) {
      onUpdate(index, { options: [optionInput.trim()] });
      setOptionInput("");
    }
  };

  const handleRemoveOption = (optionIndex: number) => {
    if (field.options) {
      onUpdate(index, {
        options: field.options.filter((_, i) => i !== optionIndex),
      });
    }
  };

  const needsOptions = field.type === "DROPDOWN" || field.type === "CHECKBOX";

  return (
    <Accordion type="single" collapsible className="border rounded-lg">
      <AccordionItem value={field.slug} className="border-0">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-3 flex-1">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium">{field.name}</span>
                {field.isRequired && (
                  <Badge variant="outline" className="text-xs">Required</Badge>
                )}
                {field.isSensitive && (
                  <Badge variant="destructive" className="text-xs">Sensitive</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {FIELD_TYPES.find((t) => t.value === field.type)?.label || field.type}
                {field.section && ` • ${field.section}`}
              </div>
            </div>
            <ConfidenceBadge confidence={field.confidence} size="sm" />
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="grid gap-4">
            {field.confidence < 0.7 && (
              <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                <AlertTriangle className="h-4 w-4" />
                Low confidence detection. Please verify this field.
              </div>
            )}

            {/* Field Name */}
            <div className="space-y-2">
              <Label htmlFor={`name-${index}`}>Field Name</Label>
              <Input
                id={`name-${index}`}
                value={field.name}
                onChange={(e) => onUpdate(index, { name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Original: {field.sourceLabel}
              </p>
            </div>

            {/* Type and Purpose */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field Type</Label>
                <Select
                  value={field.type}
                  onValueChange={(value) => onUpdate(index, { type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Purpose</Label>
                <Select
                  value={field.purpose}
                  onValueChange={(value) => onUpdate(index, { purpose: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_PURPOSES.map((purpose) => (
                      <SelectItem key={purpose.value} value={purpose.value}>
                        {purpose.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Section */}
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={field.section || ""}
                onValueChange={(value) => onUpdate(index, { section: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No section</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Help Text */}
            <div className="space-y-2">
              <Label htmlFor={`helpText-${index}`}>Help Text</Label>
              <Textarea
                id={`helpText-${index}`}
                value={field.helpText || ""}
                onChange={(e) => onUpdate(index, { helpText: e.target.value || undefined })}
                placeholder="Optional instructions for this field"
                rows={2}
              />
            </div>

            {/* Options (for dropdown/checkbox) */}
            {needsOptions && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex gap-2">
                  <Input
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                    placeholder="Add an option"
                  />
                  <Button type="button" size="sm" onClick={handleAddOption}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {field.options && field.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.options.map((option, optIdx) => (
                      <Badge
                        key={optIdx}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleRemoveOption(optIdx)}
                      >
                        {option} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Checkboxes */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`required-${index}`}
                  checked={field.isRequired}
                  onCheckedChange={(checked) =>
                    onUpdate(index, { isRequired: checked as boolean })
                  }
                />
                <Label htmlFor={`required-${index}`} className="text-sm">
                  Required
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`sensitive-${index}`}
                  checked={field.isSensitive}
                  onCheckedChange={(checked) =>
                    onUpdate(index, { isSensitive: checked as boolean })
                  }
                />
                <Label htmlFor={`sensitive-${index}`} className="text-sm">
                  Sensitive (PII)
                </Label>
              </div>
            </div>

            {/* Remove Button */}
            <div className="flex justify-end pt-2 border-t">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onRemove(index)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Field
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
