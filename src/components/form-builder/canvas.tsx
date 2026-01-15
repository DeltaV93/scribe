"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  sortedFieldsAtom,
  reorderFieldsAtom,
  addFieldAtom,
  selectFieldAtom,
  formBuilderAtom,
} from "@/lib/form-builder/store";
import { FieldType, type FormFieldData } from "@/types";
import { FieldCard, FieldDragOverlay } from "./field-card";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, MousePointer2 } from "lucide-react";

interface FormCanvasProps {
  className?: string;
}

export function FormCanvas({ className }: FormCanvasProps) {
  const fields = useAtomValue(sortedFieldsAtom);
  const [state] = useAtom(formBuilderAtom);
  const reorderFields = useSetAtom(reorderFieldsAtom);
  const addField = useSetAtom(addFieldAtom);
  const selectField = useSetAtom(selectFieldAtom);

  const [activeField, setActiveField] = useState<FormFieldData | null>(null);
  const [isDraggingFromPalette, setIsDraggingFromPalette] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    if (data?.type === "canvas-field") {
      setActiveField(data.field);
      setIsDraggingFromPalette(false);
    } else if (data?.type === "palette-field") {
      setIsDraggingFromPalette(true);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over events if needed for drop zones
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveField(null);
    setIsDraggingFromPalette(false);

    if (!over) return;

    const activeData = active.data.current;

    // Handle dropping from palette
    if (activeData?.type === "palette-field") {
      const fieldType = activeData.fieldType as FieldType;
      addField({ type: fieldType });
      return;
    }

    // Handle reordering within canvas
    if (activeData?.type === "canvas-field" && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderFields(oldIndex, newIndex);
      }
    }
  };

  const handleCanvasClick = () => {
    selectField(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Card
        className={cn(
          "h-full overflow-hidden flex flex-col",
          isDraggingFromPalette && "ring-2 ring-primary ring-dashed",
          className
        )}
        onClick={handleCanvasClick}
      >
        <CardContent className="flex-1 overflow-y-auto p-4">
          {fields.length === 0 ? (
            <EmptyCanvas />
          ) : (
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {fields.map((field) => (
                  <FieldCard
                    key={field.id}
                    field={field}
                    isSelected={state.selectedFieldId === field.id}
                  />
                ))}
              </div>
            </SortableContext>
          )}

          {/* Drop zone indicator when dragging from palette */}
          {isDraggingFromPalette && fields.length > 0 && (
            <div className="mt-3 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 p-8 text-center">
              <p className="text-sm text-primary">Drop here to add field</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drag overlay */}
      <DragOverlay>
        {activeField && <FieldDragOverlay field={activeField} />}
      </DragOverlay>
    </DndContext>
  );
}

function EmptyCanvas() {
  const addField = useSetAtom(addFieldAtom);

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <MousePointer2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No fields yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Start building your form by dragging fields from the palette or clicking
        to add them.
      </p>
      <button
        onClick={() => addField({ type: FieldType.TEXT_SHORT })}
        className={cn(
          "flex items-center gap-2 rounded-lg border-2 border-dashed px-6 py-3",
          "text-sm font-medium text-muted-foreground",
          "hover:border-primary hover:text-primary transition-colors"
        )}
      >
        <Plus className="h-4 w-4" />
        Add your first field
      </button>
    </div>
  );
}
