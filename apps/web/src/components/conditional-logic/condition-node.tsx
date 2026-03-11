"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";
import type { ConditionNodeData, ConditionNode as ConditionNodeType } from "./types";

function ConditionNodeComponent({
  data,
  selected,
}: NodeProps<ConditionNodeType>) {
  const conditionCount = data.groups.reduce(
    (acc, group) => acc + group.conditions.length,
    0
  );

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 bg-amber-50 dark:bg-amber-950/30 shadow-sm min-w-[160px]",
        selected
          ? "border-amber-500"
          : "border-amber-200 dark:border-amber-800"
      )}
    >
      {/* Input handle - receives from source field */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-background"
      />

      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900">
          {data.action === "show" ? (
            <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <EyeOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium capitalize">{data.action} if</p>
          <p className="text-xs text-muted-foreground">
            {conditionCount} condition{conditionCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge
          variant="outline"
          className="text-xs bg-amber-100 dark:bg-amber-900 border-amber-200 dark:border-amber-800"
        >
          {data.operator.toUpperCase()}
        </Badge>
        {data.groups.length > 1 && (
          <Badge variant="secondary" className="text-xs">
            {data.groups.length} groups
          </Badge>
        )}
      </div>

      {/* Output handle - connects to target field */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-background"
      />
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
