import type { Node, Edge } from "@xyflow/react";
import type {
  FormFieldData,
  ConditionalLogic,
  ConditionGroup,
  Condition,
  ConditionOperator,
} from "@/types";

// Node types for React Flow
export type FieldNodeData = {
  field: FormFieldData;
  hasConditions: boolean;
};

export type ConditionNodeData = {
  targetFieldId: string;
  action: "show" | "hide";
  operator: "and" | "or";
  groups: ConditionGroup[];
};

export type FieldNode = Node<FieldNodeData, "field">;
export type ConditionNode = Node<ConditionNodeData, "condition">;
export type LogicNode = FieldNode | ConditionNode;

// Editor state
export interface ConditionalLogicEditorState {
  nodes: LogicNode[];
  edges: Edge[];
  selectedNodeId: string | null;
}

// Utility type for condition builder
export interface ConditionBuilderField {
  id: string;
  name: string;
  type: string;
  options?: { value: string; label: string }[] | null;
}

// Available operators for each field type
export const OPERATORS_BY_TYPE: Record<string, ConditionOperator[]> = {
  TEXT_SHORT: [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "is_empty",
    "is_not_empty",
  ],
  TEXT_LONG: [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "is_empty",
    "is_not_empty",
  ],
  NUMBER: [
    "equals",
    "not_equals",
    "greater_than",
    "less_than",
    "is_empty",
    "is_not_empty",
  ],
  DATE: ["equals", "not_equals", "before", "after", "is_empty", "is_not_empty"],
  PHONE: ["equals", "not_equals", "is_empty", "is_not_empty"],
  EMAIL: [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "is_empty",
    "is_not_empty",
  ],
  ADDRESS: ["is_empty", "is_not_empty"],
  DROPDOWN: ["equals", "not_equals", "is_empty", "is_not_empty"],
  CHECKBOX: ["equals", "not_equals", "is_empty", "is_not_empty"],
  YES_NO: ["equals", "not_equals"],
  FILE: ["is_empty", "is_not_empty"],
  SIGNATURE: ["is_empty", "is_not_empty"],
};

// Operator labels for display
export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  greater_than: "is greater than",
  less_than: "is less than",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  before: "is before",
  after: "is after",
};

// Check if operator needs a value input
export function operatorNeedsValue(operator: ConditionOperator): boolean {
  return !["is_empty", "is_not_empty"].includes(operator);
}
