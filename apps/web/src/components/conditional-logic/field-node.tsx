"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_CONFIG } from "@/types";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Type, Hash, Calendar, Phone, Mail, MapPin, ChevronDown, CheckSquare, ToggleLeft, Upload, PenTool, AlignLeft } from "lucide-react";
import type { FieldNode as FieldNodeType, FieldNodeData } from "./types";
import type { FieldType } from "@/types";

// Map field types to icons
const FIELD_ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  TEXT_SHORT: Type,
  TEXT_LONG: AlignLeft,
  NUMBER: Hash,
  DATE: Calendar,
  PHONE: Phone,
  EMAIL: Mail,
  ADDRESS: MapPin,
  DROPDOWN: ChevronDown,
  CHECKBOX: CheckSquare,
  YES_NO: ToggleLeft,
  FILE: Upload,
  SIGNATURE: PenTool,
};

function FieldNodeComponent({ data, selected }: NodeProps<FieldNodeType>) {
  const config = FIELD_TYPE_CONFIG[data.field.type];
  const Icon = FIELD_ICONS[data.field.type] || Type;

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 bg-background shadow-sm min-w-[180px]",
        selected ? "border-primary" : "border-border",
        data.hasConditions && "ring-2 ring-primary/20"
      )}
    >
      {/* Input handle - this field can be controlled by conditions */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{data.field.name}</p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
      </div>

      {data.hasConditions && (
        <div className="mt-2 flex items-center gap-1">
          <Badge variant="secondary" className="text-xs gap-1">
            <GitBranch className="h-3 w-3" />
            Has conditions
          </Badge>
        </div>
      )}

      {/* Output handle - this field can control other fields */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
}

export const FieldNode = memo(FieldNodeComponent);
