"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { sortedFieldsAtom, updateFieldAtom } from "@/lib/form-builder/store";
import { LogicFlowEditor } from "@/components/conditional-logic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, GitBranch } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { FormFieldData } from "@/types";

export function LogicStep() {
  const fields = useAtomValue(sortedFieldsAtom);
  const updateField = useSetAtom(updateFieldAtom);

  const handleUpdateField = (fieldId: string, updates: Partial<FormFieldData>) => {
    updateField(fieldId, updates);
  };

  if (fields.length < 2) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Conditional Logic
            </CardTitle>
            <CardDescription>
              Show or hide fields based on other field values
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Add more fields</AlertTitle>
              <AlertDescription>
                You need at least 2 fields to create conditional logic. Go back to
                the Fields step to add more fields.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Conditional Logic
          </h2>
          <p className="text-sm text-muted-foreground">
            Click on a field to add conditions that control when it&apos;s visible
          </p>
        </div>
      </div>

      <LogicFlowEditor fields={fields} onUpdateField={handleUpdateField} />

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm">How Conditional Logic Works</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="font-medium mb-1">Show/Hide Actions</p>
              <p className="text-muted-foreground text-xs">
                Choose whether a field should be shown or hidden when conditions are met.
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">Condition Groups</p>
              <p className="text-muted-foreground text-xs">
                Create multiple groups connected with AND/OR logic for complex rules.
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">Field Operators</p>
              <p className="text-muted-foreground text-xs">
                Use equals, contains, greater than, and more based on field type.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
