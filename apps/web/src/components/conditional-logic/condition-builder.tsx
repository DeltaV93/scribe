"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type {
  ConditionalLogic,
  ConditionGroup,
  Condition,
  ConditionOperator,
  FormFieldData,
} from "@/types";
import {
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  operatorNeedsValue,
} from "./types";

interface ConditionBuilderProps {
  targetField: FormFieldData;
  availableFields: FormFieldData[];
  value: ConditionalLogic | null;
  onChange: (logic: ConditionalLogic | null) => void;
}

export function ConditionBuilder({
  targetField,
  availableFields,
  value,
  onChange,
}: ConditionBuilderProps) {
  // Filter out the target field from available fields (can't condition on itself)
  const sourceFields = availableFields.filter((f) => f.id !== targetField.id);

  const createEmptyCondition = (): Condition => ({
    id: crypto.randomUUID(),
    fieldId: sourceFields[0]?.id || "",
    operator: "equals",
    value: "",
  });

  const createEmptyGroup = (): ConditionGroup => ({
    id: crypto.randomUUID(),
    conditions: [createEmptyCondition()],
    operator: "and",
  });

  const createEmptyLogic = (): ConditionalLogic => ({
    id: crypto.randomUUID(),
    targetFieldId: targetField.id,
    action: "show",
    groups: [createEmptyGroup()],
    operator: "and",
  });

  const handleAddGroup = () => {
    const current = value || createEmptyLogic();
    onChange({
      ...current,
      groups: [...current.groups, createEmptyGroup()],
    });
  };

  const handleRemoveGroup = (groupId: string) => {
    if (!value) return;
    const newGroups = value.groups.filter((g) => g.id !== groupId);
    if (newGroups.length === 0) {
      onChange(null);
    } else {
      onChange({ ...value, groups: newGroups });
    }
  };

  const handleUpdateGroup = (
    groupId: string,
    updates: Partial<ConditionGroup>
  ) => {
    if (!value) return;
    onChange({
      ...value,
      groups: value.groups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g
      ),
    });
  };

  const handleAddCondition = (groupId: string) => {
    if (!value) return;
    onChange({
      ...value,
      groups: value.groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: [...g.conditions, createEmptyCondition()] }
          : g
      ),
    });
  };

  const handleRemoveCondition = (groupId: string, conditionId: string) => {
    if (!value) return;
    const group = value.groups.find((g) => g.id === groupId);
    if (!group) return;

    if (group.conditions.length === 1) {
      // Remove the entire group if it's the last condition
      handleRemoveGroup(groupId);
    } else {
      onChange({
        ...value,
        groups: value.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                conditions: g.conditions.filter((c) => c.id !== conditionId),
              }
            : g
        ),
      });
    }
  };

  const handleUpdateCondition = (
    groupId: string,
    conditionId: string,
    updates: Partial<Condition>
  ) => {
    if (!value) return;
    onChange({
      ...value,
      groups: value.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map((c) =>
                c.id === conditionId ? { ...c, ...updates } : c
              ),
            }
          : g
      ),
    });
  };

  const handleActionChange = (action: "show" | "hide") => {
    const current = value || createEmptyLogic();
    onChange({ ...current, action });
  };

  const handleOperatorChange = (operator: "and" | "or") => {
    const current = value || createEmptyLogic();
    onChange({ ...current, operator });
  };

  if (sourceFields.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Add more fields to create conditions.</p>
        <p className="text-sm mt-1">
          Conditions require at least one other field to check against.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action and operator selectors */}
      <div className="flex items-center gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Select
            value={value?.action || "show"}
            onValueChange={(v) => handleActionChange(v as "show" | "hide")}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="show">Show</SelectItem>
              <SelectItem value="hide">Hide</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground pt-5">this field when</p>

        {(value?.groups?.length || 0) > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Groups match</Label>
            <Select
              value={value?.operator || "and"}
              onValueChange={(v) => handleOperatorChange(v as "and" | "or")}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">All (AND)</SelectItem>
                <SelectItem value="or">Any (OR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Condition groups */}
      <div className="space-y-4">
        {(value?.groups || []).map((group, groupIndex) => (
          <Card key={group.id}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {groupIndex === 0 ? "When" : "Or when"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {group.conditions.length > 1 && (
                    <Select
                      value={group.operator}
                      onValueChange={(v) =>
                        handleUpdateGroup(group.id, {
                          operator: v as "and" | "or",
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-[90px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">All (AND)</SelectItem>
                        <SelectItem value="or">Any (OR)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemoveGroup(group.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-3 px-4 space-y-2">
              {group.conditions.map((condition, condIndex) => (
                <ConditionRow
                  key={condition.id}
                  condition={condition}
                  sourceFields={sourceFields}
                  showAndLabel={condIndex > 0}
                  groupOperator={group.operator}
                  onUpdate={(updates) =>
                    handleUpdateCondition(group.id, condition.id, updates)
                  }
                  onRemove={() =>
                    handleRemoveCondition(group.id, condition.id)
                  }
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => handleAddCondition(group.id)}
              >
                <Plus className="h-3 w-3 mr-2" />
                Add Condition
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add group button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleAddGroup}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Condition Group
      </Button>

      {/* Clear all button */}
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive"
          onClick={() => onChange(null)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remove All Conditions
        </Button>
      )}
    </div>
  );
}

interface ConditionRowProps {
  condition: Condition;
  sourceFields: FormFieldData[];
  showAndLabel: boolean;
  groupOperator: "and" | "or";
  onUpdate: (updates: Partial<Condition>) => void;
  onRemove: () => void;
}

function ConditionRow({
  condition,
  sourceFields,
  showAndLabel,
  groupOperator,
  onUpdate,
  onRemove,
}: ConditionRowProps) {
  const selectedField = sourceFields.find((f) => f.id === condition.fieldId);
  const operators = selectedField
    ? OPERATORS_BY_TYPE[selectedField.type] || ["equals", "not_equals"]
    : ["equals", "not_equals"];
  const needsValue = operatorNeedsValue(condition.operator);

  // Get options for dropdown/checkbox fields
  const fieldOptions = selectedField?.options || [];

  return (
    <div className="flex items-center gap-2">
      {showAndLabel && (
        <span className="text-xs text-muted-foreground w-8">
          {groupOperator === "and" ? "AND" : "OR"}
        </span>
      )}

      <div className={cn("flex-1 flex items-center gap-2", !showAndLabel && "ml-8")}>
        {/* Field selector */}
        <Select
          value={condition.fieldId}
          onValueChange={(v) => onUpdate({ fieldId: v, value: "" })}
        >
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue placeholder="Select field" />
          </SelectTrigger>
          <SelectContent>
            {sourceFields.map((field) => (
              <SelectItem key={field.id} value={field.id}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operator selector */}
        <Select
          value={condition.operator}
          onValueChange={(v) => onUpdate({ operator: v as ConditionOperator })}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op as ConditionOperator]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value input */}
        {needsValue && (
          <>
            {fieldOptions.length > 0 ? (
              <Select
                value={String(condition.value || "")}
                onValueChange={(v) => onUpdate({ value: v })}
              >
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : selectedField?.type === "YES_NO" ? (
              <Select
                value={String(condition.value || "")}
                onValueChange={(v) => onUpdate({ value: v === "true" })}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={String(condition.value || "")}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder="Value"
                className="flex-1 h-8 text-xs"
              />
            )}
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
