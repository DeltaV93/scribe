"use client";

import { useAtomValue } from "jotai";
import {
  formBuilderAtom,
  canPublishAtom,
  aiExtractableFieldsAtom,
  sensitiveFieldsCountAtom,
} from "@/lib/form-builder/store";
import { FIELD_TYPE_CONFIG, FormType, PURPOSE_CONFIG } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Sparkles,
  Lock,
  Users,
  Rocket,
  Clock,
} from "lucide-react";

interface ChecklistItem {
  label: string;
  passed: boolean;
  warning?: boolean;
  message: string;
}

export function PublishStep() {
  const state = useAtomValue(formBuilderAtom);
  const canPublish = useAtomValue(canPublishAtom);
  const aiFields = useAtomValue(aiExtractableFieldsAtom);
  const sensitiveCount = useAtomValue(sensitiveFieldsCountAtom);

  const form = state.form;
  const fields = state.fields;

  // Build checklist
  const checklist: ChecklistItem[] = [
    {
      label: "Form name",
      passed: !!form.name?.trim(),
      message: form.name?.trim() ? form.name : "No name provided",
    },
    {
      label: "Form description",
      passed: !!form.description?.trim(),
      warning: !form.description?.trim(),
      message: form.description?.trim()
        ? "Description provided"
        : "No description (recommended)",
    },
    {
      label: "Form fields",
      passed: fields.length > 0,
      message:
        fields.length > 0
          ? `${fields.length} field${fields.length !== 1 ? "s" : ""} added`
          : "No fields added",
    },
    {
      label: "Field names",
      passed: fields.every((f) => f.name?.trim()),
      message: fields.every((f) => f.name?.trim())
        ? "All fields have names"
        : "Some fields are missing names",
    },
    {
      label: "Required fields",
      passed: true,
      message: `${fields.filter((f) => f.isRequired).length} required field${
        fields.filter((f) => f.isRequired).length !== 1 ? "s" : ""
      }`,
    },
  ];

  // Check dropdown/checkbox options
  const fieldsNeedingOptions = fields.filter(
    (f) =>
      (f.type === "DROPDOWN" || f.type === "CHECKBOX") &&
      (!f.options || f.options.length === 0)
  );
  if (fieldsNeedingOptions.length > 0) {
    checklist.push({
      label: "Field options",
      passed: false,
      message: `${fieldsNeedingOptions.length} field${
        fieldsNeedingOptions.length !== 1 ? "s" : ""
      } missing options`,
    });
  }

  const allChecksPassed = checklist.every((c) => c.passed);

  // Group fields by purpose
  const fieldsByPurpose = fields.reduce((acc, field) => {
    const purpose = field.purpose;
    if (!acc[purpose]) acc[purpose] = [];
    acc[purpose].push(field);
    return acc;
  }, {} as Record<string, typeof fields>);

  const handlePublish = () => {
    // TODO: Implement actual publish logic in Phase 5
    console.log("Publishing form...", { form, fields });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Summary Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {form.name || "Untitled Form"}
          </CardTitle>
          <CardDescription>{form.description || "No description"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {FormType[form.type as keyof typeof FormType] || form.type}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              {fields.length} fields
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" />
              {aiFields.length} AI-extractable
            </div>
            {sensitiveCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                {sensitiveCount} sensitive
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pre-publish Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre-publish Checklist</CardTitle>
          <CardDescription>
            Review these items before publishing your form
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checklist.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                {item.passed ? (
                  item.warning ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  )
                ) : (
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <div className="flex-1">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground ml-2 text-sm">
                    {item.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Field Summary by Purpose */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fields by Purpose</CardTitle>
          <CardDescription>
            How your fields are categorized
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(fieldsByPurpose).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(fieldsByPurpose).map(([purpose, purposeFields]) => (
                <div key={purpose}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">
                      {PURPOSE_CONFIG[purpose as keyof typeof PURPOSE_CONFIG]?.label ||
                        purpose}
                    </span>
                    <Badge variant="secondary">{purposeFields.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {purposeFields.map((field) => (
                      <Badge key={field.id} variant="outline" className="text-xs">
                        {field.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No fields to categorize</p>
          )}
        </CardContent>
      </Card>

      {/* What happens next */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            What Happens Next
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">
                1
              </span>
              <span>
                Your form will be published and available for use immediately
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">
                2
              </span>
              <span>
                Team members with appropriate permissions can start using the form
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">
                3
              </span>
              <span>
                You can make edits later - existing submissions will keep their
                original version
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Separator />

      {/* Publish Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {canPublish ? (
            <span className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Ready to publish
            </span>
          ) : (
            <span className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              Please fix issues above before publishing
            </span>
          )}
        </div>
        <Button
          size="lg"
          onClick={handlePublish}
          disabled={!canPublish}
          className="gap-2"
        >
          <Rocket className="h-4 w-4" />
          Publish Form
        </Button>
      </div>
    </div>
  );
}
