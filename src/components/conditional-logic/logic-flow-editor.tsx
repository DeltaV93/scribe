"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Panel,
  MarkerType,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Maximize2, Minimize2, X } from "lucide-react";

import { FieldNode } from "./field-node";
import { ConditionNode } from "./condition-node";
import { ConditionBuilder } from "./condition-builder";
import type { FieldNodeData, ConditionNodeData, LogicNode } from "./types";
import type { FormFieldData, ConditionalLogic } from "@/types";

// Custom node types
const nodeTypes = {
  field: FieldNode,
  condition: ConditionNode,
};

interface LogicFlowEditorProps {
  fields: FormFieldData[];
  onUpdateField: (fieldId: string, updates: Partial<FormFieldData>) => void;
}

export function LogicFlowEditor({
  fields,
  onUpdateField,
}: LogicFlowEditorProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Convert fields to nodes
  const initialNodes = useMemo(() => {
    const sortedFields = [...fields].sort((a, b) => a.order - b.order);
    const nodes: LogicNode[] = [];

    // Calculate grid layout
    const FIELD_WIDTH = 200;
    const FIELD_HEIGHT = 80;
    const CONDITION_WIDTH = 180;
    const GAP_X = 100;
    const GAP_Y = 40;
    const START_X = 50;
    const START_Y = 50;

    sortedFields.forEach((field, index) => {
      const hasConditions = !!field.conditionalLogic;
      const yPos = START_Y + index * (FIELD_HEIGHT + GAP_Y);

      // Add field node
      nodes.push({
        id: field.id,
        type: "field",
        position: { x: START_X + FIELD_WIDTH + GAP_X + CONDITION_WIDTH + GAP_X, y: yPos },
        data: { field, hasConditions },
      });

      // If field has conditions, add a condition node
      if (hasConditions && field.conditionalLogic) {
        const conditionNodeId = `condition-${field.id}`;
        nodes.push({
          id: conditionNodeId,
          type: "condition",
          position: { x: START_X + FIELD_WIDTH + GAP_X, y: yPos },
          data: {
            targetFieldId: field.id,
            action: field.conditionalLogic.action,
            operator: field.conditionalLogic.operator,
            groups: field.conditionalLogic.groups,
          },
        });
      }
    });

    return nodes;
  }, [fields]);

  // Create edges based on conditional logic
  const initialEdges = useMemo(() => {
    const edges: Edge[] = [];

    fields.forEach((field) => {
      if (field.conditionalLogic) {
        const conditionNodeId = `condition-${field.id}`;

        // Edge from condition node to target field
        edges.push({
          id: `${conditionNodeId}-to-${field.id}`,
          source: conditionNodeId,
          target: field.id,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#f59e0b", strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#f59e0b",
          },
        });

        // Edges from source fields to condition node
        field.conditionalLogic.groups.forEach((group) => {
          group.conditions.forEach((condition) => {
            const edgeId = `${condition.fieldId}-to-${conditionNodeId}-${condition.id}`;
            // Check if edge already exists
            if (!edges.find((e) => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: condition.fieldId,
                target: conditionNodeId,
                type: "smoothstep",
                style: { stroke: "#94a3b8", strokeWidth: 1.5 },
              });
            }
          });
        });
      }
    });

    return edges;
  }, [fields]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when fields change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const selectedField = useMemo(
    () => fields.find((f) => f.id === selectedFieldId) || null,
    [fields, selectedFieldId]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Only select field nodes, not condition nodes
      if (node.type === "field") {
        setSelectedFieldId(node.id);
      } else if (node.type === "condition") {
        // Select the target field when clicking a condition node
        const targetFieldId = (node.data as ConditionNodeData).targetFieldId;
        setSelectedFieldId(targetFieldId);
      }
    },
    []
  );

  const handleConditionChange = useCallback(
    (logic: ConditionalLogic | null) => {
      if (selectedFieldId) {
        onUpdateField(selectedFieldId, { conditionalLogic: logic });
      }
    },
    [selectedFieldId, onUpdateField]
  );

  const fieldsWithConditions = useMemo(
    () => fields.filter((f) => f.conditionalLogic).length,
    [fields]
  );

  return (
    <div
      className={cn(
        "relative border rounded-lg overflow-hidden bg-muted/30",
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : "h-[500px]"
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            if (node.type === "condition") return "#f59e0b";
            return "#6366f1";
          }}
          className="!bg-background/80 !border"
        />

        {/* Top panel with stats */}
        <Panel position="top-left" className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <GitBranch className="h-3 w-3" />
            {fieldsWithConditions} field{fieldsWithConditions !== 1 ? "s" : ""} with
            conditions
          </Badge>
        </Panel>

        {/* Fullscreen toggle */}
        <Panel position="top-right">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </Panel>

        {/* Instructions panel */}
        <Panel position="bottom-left" className="max-w-xs">
          <div className="bg-background/90 backdrop-blur-sm rounded-md p-3 text-xs text-muted-foreground border">
            <p className="font-medium mb-1">How to use:</p>
            <ul className="space-y-0.5">
              <li>• Click a field to add/edit conditions</li>
              <li>• Conditions control when fields are shown/hidden</li>
              <li>• Orange nodes represent condition logic</li>
            </ul>
          </div>
        </Panel>
      </ReactFlow>

      {/* Condition editor sheet */}
      <Sheet
        open={!!selectedFieldId}
        onOpenChange={(open) => !open && setSelectedFieldId(null)}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Conditional Logic for &ldquo;{selectedField?.name}&rdquo;
            </SheetTitle>
            <SheetDescription>
              Define when this field should be shown or hidden based on other
              field values.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {selectedField && (
              <ConditionBuilder
                targetField={selectedField}
                availableFields={fields}
                value={selectedField.conditionalLogic || null}
                onChange={handleConditionChange}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
