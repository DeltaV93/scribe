"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  selectFieldAtom,
  removeFieldAtom,
  duplicateFieldAtom,
  formBuilderAtom,
  fieldSourcesAtom,
  type FieldSource,
} from "@/lib/form-builder/store";
import { FIELD_TYPE_CONFIG, type FormFieldData } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  GripVertical,
  MoreHorizontal,
  Copy,
  Trash2,
  Sparkles,
  Lock,
  AlertCircle,
  Upload,
} from "lucide-react";
import { FieldType } from "@/types";

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

interface FieldCardProps {
  field: FormFieldData;
  isSelected?: boolean;
  isDragOverlay?: boolean;
}

export function FieldCard({
  field,
  isSelected = false,
  isDragOverlay = false,
}: FieldCardProps) {
  const [state] = useAtom(formBuilderAtom);
  const fieldSources = useAtomValue(fieldSourcesAtom);
  const selectField = useSetAtom(selectFieldAtom);
  const removeField = useSetAtom(removeFieldAtom);
  const duplicateField = useSetAtom(duplicateFieldAtom);

  // Get the source of this field
  const fieldSource = fieldSources[field.id] as FieldSource | undefined;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: {
      type: "canvas-field",
      field,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const config = FIELD_TYPE_CONFIG[field.type];
  const Icon = fieldIcons[field.type];

  const handleClick = () => {
    if (!isDragOverlay) {
      selectField(field.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeField(field.id);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateField(field.id);
  };

  // Check if field has validation issues
  const hasIssues = !field.name?.trim();

  if (isDragOverlay) {
    return (
      <div className="w-full rounded-lg border-2 border-primary bg-card p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-sm font-medium truncate">
              {field.name || config.label}
            </span>
            <span className="text-xs text-muted-foreground">{config.label}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        "group relative rounded-lg border bg-card transition-all",
        "hover:border-primary/50 hover:shadow-sm",
        isSelected && "border-primary ring-2 ring-primary/20",
        isDragging && "opacity-50",
        hasIssues && "border-destructive/50"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Field Icon */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        {/* Field Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {field.name || (
                <span className="text-muted-foreground italic">Untitled</span>
              )}
            </span>
            {field.isRequired && (
              <span className="text-destructive text-xs">*</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{config.label}</span>
            {field.isSensitive && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                <Lock className="h-2.5 w-2.5 mr-1" />
                Sensitive
              </Badge>
            )}
            {field.isAiExtractable && (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] border-amber-500/50 text-amber-600"
              >
                <Sparkles className="h-2.5 w-2.5 mr-1" />
                AI
              </Badge>
            )}
            {fieldSource === "ai" && (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] border-purple-500/50 text-purple-600 bg-purple-50"
              >
                <Sparkles className="h-2.5 w-2.5 mr-1" />
                AI generated
              </Badge>
            )}
            {fieldSource === "upload" && (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] border-blue-500/50 text-blue-600 bg-blue-50"
              >
                <Upload className="h-2.5 w-2.5 mr-1" />
                From upload
              </Badge>
            )}
          </div>
          {field.helpText && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {field.helpText}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasIssues && (
            <AlertCircle className="h-4 w-4 text-destructive mr-1" />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Conditional Logic Indicator */}
      {field.conditionalLogic && (
        <div className="border-t px-4 py-2 bg-muted/50">
          <span className="text-xs text-muted-foreground">
            Has conditional logic
          </span>
        </div>
      )}
    </div>
  );
}

// Drag overlay component
export function FieldDragOverlay({ field }: { field: FormFieldData }) {
  return <FieldCard field={field} isDragOverlay />;
}
