"use client";

import { useSetAtom } from "jotai";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { addFieldAtom } from "@/lib/form-builder/store";
import { FieldType, FIELD_TYPE_CONFIG } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  CheckSquare,
  ToggleLeft,
  Paperclip,
  PenTool,
  Sparkles,
  GripVertical,
} from "lucide-react";

// Map field types to Lucide icons
const fieldIcons: Record<FieldType, React.ComponentType<{ className?: string }>> = {
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
  FILE: Paperclip,
  SIGNATURE: PenTool,
};

interface DraggableFieldProps {
  type: FieldType;
}

function DraggableField({ type }: DraggableFieldProps) {
  const addField = useSetAtom(addFieldAtom);
  const config = FIELD_TYPE_CONFIG[type];
  const Icon = fieldIcons[type];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: {
      type: "palette-field",
      fieldType: type,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const handleClick = () => {
    addField({ type });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={handleClick}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all",
              "hover:border-primary hover:shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isDragging && "opacity-50 shadow-lg"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium truncate">
                {config.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {config.aiExtractable && (
                <Sparkles className="h-3 w-3 text-amber-500" />
              )}
              <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
          {config.aiExtractable && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>AI Confidence: {config.aiConfidence}%</span>
            </div>
          )}
          {config.aiWarning && (
            <p className="mt-1 text-xs text-amber-600">{config.aiWarning}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FieldPaletteProps {
  className?: string;
}

export function FieldPalette({ className }: FieldPaletteProps) {
  const basicFields: FieldType[] = [
    FieldType.TEXT_SHORT,
    FieldType.TEXT_LONG,
    FieldType.NUMBER,
    FieldType.DATE,
  ];

  const contactFields: FieldType[] = [
    FieldType.PHONE,
    FieldType.EMAIL,
    FieldType.ADDRESS,
  ];

  const choiceFields: FieldType[] = [
    FieldType.DROPDOWN,
    FieldType.CHECKBOX,
    FieldType.YES_NO,
  ];

  const specialFields: FieldType[] = [
    FieldType.FILE,
    FieldType.SIGNATURE,
  ];

  return (
    <Card className={cn("h-full overflow-hidden", className)}>
      <CardHeader className="border-b py-4">
        <CardTitle className="text-base">Field Types</CardTitle>
        <p className="text-xs text-muted-foreground">
          Click or drag to add fields
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto h-[calc(100%-5rem)]">
        <div className="space-y-6 p-4">
          {/* Basic Fields */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Basic
            </h4>
            <div className="space-y-2">
              {basicFields.map((type) => (
                <DraggableField key={type} type={type} />
              ))}
            </div>
          </div>

          {/* Contact Fields */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Contact
            </h4>
            <div className="space-y-2">
              {contactFields.map((type) => (
                <DraggableField key={type} type={type} />
              ))}
            </div>
          </div>

          {/* Choice Fields */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Choices
            </h4>
            <div className="space-y-2">
              {choiceFields.map((type) => (
                <DraggableField key={type} type={type} />
              ))}
            </div>
          </div>

          {/* Special Fields */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Special
            </h4>
            <div className="space-y-2">
              {specialFields.map((type) => (
                <DraggableField key={type} type={type} />
              ))}
            </div>
          </div>

          {/* AI Legend */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>AI-extractable from calls</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Field type selector for dialogs/popovers
export function FieldTypeSelector({
  onSelect,
  className,
}: {
  onSelect: (type: FieldType) => void;
  className?: string;
}) {
  const allTypes = Object.values(FieldType);

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {allTypes.map((type) => {
        const config = FIELD_TYPE_CONFIG[type];
        const Icon = fieldIcons[type];

        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-3 transition-all",
              "hover:border-primary hover:bg-primary/5"
            )}
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
