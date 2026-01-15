"use client";

import { useAtomValue } from "jotai";
import { formBuilderAtom, fieldsBySectionAtom } from "@/lib/form-builder/store";
import { FieldType, FIELD_TYPE_CONFIG, type FormFieldData } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Monitor, Tablet, Smartphone, Lock } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ViewMode = "desktop" | "tablet" | "mobile";

function FieldPreview({ field }: { field: FormFieldData }) {
  const config = FIELD_TYPE_CONFIG[field.type];

  const renderField = () => {
    switch (field.type) {
      case FieldType.TEXT_SHORT:
        return (
          <Input
            placeholder={`Enter ${field.name.toLowerCase()}`}
            disabled
            className="bg-background"
          />
        );

      case FieldType.TEXT_LONG:
        return (
          <Textarea
            placeholder={`Enter ${field.name.toLowerCase()}`}
            disabled
            rows={3}
            className="bg-background"
          />
        );

      case FieldType.NUMBER:
        return (
          <Input
            type="number"
            placeholder="0"
            disabled
            className="bg-background"
          />
        );

      case FieldType.DATE:
        return (
          <Input
            type="date"
            disabled
            className="bg-background"
          />
        );

      case FieldType.PHONE:
        return (
          <Input
            type="tel"
            placeholder="(555) 555-5555"
            disabled
            className="bg-background"
          />
        );

      case FieldType.EMAIL:
        return (
          <Input
            type="email"
            placeholder="email@example.com"
            disabled
            className="bg-background"
          />
        );

      case FieldType.ADDRESS:
        return (
          <div className="space-y-2">
            <Input placeholder="Street address" disabled className="bg-background" />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="City" disabled className="bg-background" />
              <Input placeholder="State" disabled className="bg-background" />
              <Input placeholder="ZIP" disabled className="bg-background" />
            </div>
          </div>
        );

      case FieldType.DROPDOWN:
        return (
          <Select disabled>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
              {(!field.options || field.options.length === 0) && (
                <SelectItem value="none" disabled>
                  No options defined
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        );

      case FieldType.CHECKBOX:
        return (
          <div className="space-y-2">
            {(field.options || []).map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox id={opt.value} disabled />
                <label htmlFor={opt.value} className="text-sm">
                  {opt.label}
                </label>
              </div>
            ))}
            {(!field.options || field.options.length === 0) && (
              <p className="text-xs text-muted-foreground">
                No options defined
              </p>
            )}
          </div>
        );

      case FieldType.YES_NO:
        return (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name={field.id}
                disabled
                className="h-4 w-4"
              />
              <span className="text-sm">Yes</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name={field.id}
                disabled
                className="h-4 w-4"
              />
              <span className="text-sm">No</span>
            </div>
          </div>
        );

      case FieldType.FILE:
        return (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Drag and drop files or click to browse
            </p>
          </div>
        );

      case FieldType.SIGNATURE:
        return (
          <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Signature capture area
            </p>
          </div>
        );

      default:
        return (
          <Input
            placeholder="Field preview"
            disabled
            className="bg-background"
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="font-medium">
          {field.name}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
        {field.isSensitive && (
          <Badge variant="outline" className="h-5 text-[10px]">
            <Lock className="h-2.5 w-2.5 mr-1" />
            Encrypted
          </Badge>
        )}
      </div>
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {renderField()}
    </div>
  );
}

export function PreviewStep() {
  const state = useAtomValue(formBuilderAtom);
  const fieldsBySection = useAtomValue(fieldsBySectionAtom);
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");

  const form = state.form;
  const sectionNames = Object.keys(fieldsBySection);

  const containerClass = cn(
    "mx-auto transition-all duration-300",
    viewMode === "desktop" && "max-w-3xl",
    viewMode === "tablet" && "max-w-lg",
    viewMode === "mobile" && "max-w-sm"
  );

  return (
    <div className="space-y-4">
      {/* View Mode Selector */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="inline-flex items-center rounded-lg border p-1">
          <button
            onClick={() => setViewMode("desktop")}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              viewMode === "desktop"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <Monitor className="h-4 w-4 inline mr-2" />
            Desktop
          </button>
          <button
            onClick={() => setViewMode("tablet")}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              viewMode === "tablet"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <Tablet className="h-4 w-4 inline mr-2" />
            Tablet
          </button>
          <button
            onClick={() => setViewMode("mobile")}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              viewMode === "mobile"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <Smartphone className="h-4 w-4 inline mr-2" />
            Mobile
          </button>
        </div>
      </div>

      {/* Form Preview */}
      <div className={containerClass}>
        <Card>
          <CardHeader>
            <CardTitle>{form.name || "Untitled Form"}</CardTitle>
            {form.description && (
              <CardDescription>{form.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            {sectionNames.length === 0 ||
            (sectionNames.length === 1 && sectionNames[0] === "default") ? (
              // No sections, just render all fields
              <div className="space-y-6">
                {fieldsBySection["default"]?.map((field) => (
                  <FieldPreview key={field.id} field={field} />
                ))}
              </div>
            ) : (
              // Render fields by section
              sectionNames.map((sectionName) => (
                <div key={sectionName} className="space-y-4">
                  {sectionName !== "default" && (
                    <>
                      <h3 className="text-lg font-semibold">{sectionName}</h3>
                      <Separator />
                    </>
                  )}
                  <div className="space-y-6">
                    {fieldsBySection[sectionName]?.map((field) => (
                      <FieldPreview key={field.id} field={field} />
                    ))}
                  </div>
                </div>
              ))
            )}

            {state.fields.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>No fields to preview.</p>
                <p className="text-sm">
                  Go back to the Fields step to add some.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
