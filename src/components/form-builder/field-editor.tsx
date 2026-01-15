"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { cn } from "@/lib/utils";
import {
  selectedFieldAtom,
  updateFieldAtom,
  removeFieldAtom,
  selectFieldAtom,
} from "@/lib/form-builder/store";
import {
  FieldType,
  FieldPurpose,
  FIELD_TYPE_CONFIG,
  PURPOSE_CONFIG,
  type FormFieldData,
  type FieldOption,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";

interface FieldEditorProps {
  className?: string;
}

export function FieldEditor({ className }: FieldEditorProps) {
  const field = useAtomValue(selectedFieldAtom);
  const updateField = useSetAtom(updateFieldAtom);
  const removeField = useSetAtom(removeFieldAtom);
  const selectField = useSetAtom(selectFieldAtom);

  if (!field) {
    return (
      <Card className={cn("h-full", className)}>
        <CardContent className="flex h-full items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Select a field to edit</p>
            <p className="text-xs mt-1">
              Click on a field in the canvas or add a new one
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = FIELD_TYPE_CONFIG[field.type];

  const handleUpdate = (updates: Partial<FormFieldData>) => {
    updateField(field.id, updates);
  };

  const handleClose = () => {
    selectField(null);
  };

  const handleDelete = () => {
    removeField(field.id);
  };

  return (
    <Card className={cn("h-full overflow-hidden flex flex-col", className)}>
      <CardHeader className="border-b py-4 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Edit Field</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{config.label}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-name" required>
              Field Name
            </Label>
            <Input
              id="field-name"
              value={field.name}
              onChange={(e) => handleUpdate({ name: e.target.value })}
              placeholder="Enter field name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-help">Help Text</Label>
            <Textarea
              id="field-help"
              value={field.helpText || ""}
              onChange={(e) => handleUpdate({ helpText: e.target.value || null })}
              placeholder="Instructions shown to users"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-slug">Field Slug</Label>
            <Input
              id="field-slug"
              value={field.slug}
              onChange={(e) => handleUpdate({ slug: e.target.value })}
              placeholder="field_slug"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Used for API and AI extraction
            </p>
          </div>
        </div>

        <Separator />

        {/* Purpose */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-purpose">Purpose</Label>
            <Select
              value={field.purpose}
              onValueChange={(value: FieldPurpose) =>
                handleUpdate({ purpose: value })
              }
            >
              <SelectTrigger id="field-purpose">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PURPOSE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {PURPOSE_CONFIG[field.purpose].description}
            </p>
          </div>

          {field.purpose === FieldPurpose.OTHER && (
            <div className="space-y-2">
              <Label htmlFor="purpose-note">Purpose Note</Label>
              <Input
                id="purpose-note"
                value={field.purposeNote || ""}
                onChange={(e) =>
                  handleUpdate({ purposeNote: e.target.value || null })
                }
                placeholder="Describe the purpose"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Options for dropdown/checkbox */}
        {(field.type === FieldType.DROPDOWN ||
          field.type === FieldType.CHECKBOX) && (
          <>
            <OptionsEditor
              options={field.options || []}
              onChange={(options) => handleUpdate({ options })}
            />
            <Separator />
          </>
        )}

        {/* Validation & Behavior */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Validation & Behavior</h4>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="required">Required</Label>
              <p className="text-xs text-muted-foreground">
                Users must fill this field
              </p>
            </div>
            <Switch
              id="required"
              checked={field.isRequired}
              onCheckedChange={(checked) => handleUpdate({ isRequired: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sensitive">Sensitive Data</Label>
              <p className="text-xs text-muted-foreground">
                Encrypt and audit access
              </p>
            </div>
            <Switch
              id="sensitive"
              checked={field.isSensitive}
              onCheckedChange={(checked) => handleUpdate({ isSensitive: checked })}
            />
          </div>
        </div>

        <Separator />

        {/* AI Configuration */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AI Extraction
          </h4>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-extractable">Enable AI Extraction</Label>
              <p className="text-xs text-muted-foreground">
                Extract from call transcripts
              </p>
            </div>
            <Switch
              id="ai-extractable"
              checked={field.isAiExtractable}
              onCheckedChange={(checked) =>
                handleUpdate({ isAiExtractable: checked })
              }
              disabled={!config.aiExtractable}
            />
          </div>

          {field.isAiExtractable && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expected Confidence</span>
                <Badge variant="outline">{config.aiConfidence}%</Badge>
              </div>
              {config.aiWarning && (
                <div className="flex items-start gap-2 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{config.aiWarning}</span>
                </div>
              )}
            </div>
          )}

          {!config.aiExtractable && (
            <p className="text-xs text-muted-foreground">
              This field type cannot be extracted from audio
            </p>
          )}
        </div>

        <Separator />

        {/* Danger Zone */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Field
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Options editor for dropdown/checkbox fields
function OptionsEditor({
  options,
  onChange,
}: {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
}) {
  const [newOption, setNewOption] = useState("");

  const addOption = () => {
    if (!newOption.trim()) return;
    const value = newOption
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    onChange([...options, { value, label: newOption.trim() }]);
    setNewOption("");
  };

  const removeOption = (index: number) => {
    const updated = options.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateOption = (index: number, label: string) => {
    const updated = options.map((opt, i) =>
      i === index
        ? {
            ...opt,
            label,
            value: label
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_|_$/g, ""),
          }
        : opt
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Options</h4>

      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            <Input
              value={option.label}
              onChange={(e) => updateOption(index, e.target.value)}
              placeholder="Option label"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeOption(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          placeholder="Add new option"
          onKeyDown={(e) => e.key === "Enter" && addOption()}
        />
        <Button variant="outline" size="icon" onClick={addOption}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add at least one option for users to choose from
        </p>
      )}
    </div>
  );
}
