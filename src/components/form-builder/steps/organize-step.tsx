"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  fieldsBySectionAtom,
  sortedFieldsAtom,
  updateFieldAtom,
  reorderFieldsAtom,
} from "@/lib/form-builder/store";
import { FIELD_TYPE_CONFIG, type FormFieldData } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  GripVertical,
  Plus,
  FolderPlus,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface SectionProps {
  name: string;
  fields: FormFieldData[];
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  isDefault?: boolean;
}

function Section({
  name,
  fields,
  isExpanded,
  onToggle,
  onRename,
  onDelete,
  isDefault = false,
}: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);

  const handleSave = () => {
    if (editName.trim()) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          <button onClick={onToggle} className="p-1 hover:bg-muted rounded">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="h-7 text-sm"
              autoFocus
            />
          ) : (
            <CardTitle
              className="text-sm font-medium cursor-pointer"
              onClick={() => !isDefault && setIsEditing(true)}
            >
              {isDefault ? "Unsectioned Fields" : name}
            </CardTitle>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {fields.length} field{fields.length !== 1 ? "s" : ""}
          </span>

          {!isDefault && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 pb-3 px-4">
          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Drag fields here to add to this section
            </p>
          ) : (
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {fields.map((field) => (
                  <SortableFieldItem key={field.id} field={field} />
                ))}
              </div>
            </SortableContext>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SortableFieldItem({ field }: { field: FormFieldData }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const config = FIELD_TYPE_CONFIG[field.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 bg-muted/50 rounded-md",
        isDragging && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm flex-1 truncate">{field.name}</span>
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  );
}

export function OrganizeStep() {
  const fieldsBySection = useAtomValue(fieldsBySectionAtom);
  const allFields = useAtomValue(sortedFieldsAtom);
  const updateField = useSetAtom(updateFieldAtom);
  const reorderFields = useSetAtom(reorderFieldsAtom);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["default"])
  );
  const [sections, setSections] = useState<string[]>(() => {
    const sectionNames = Object.keys(fieldsBySection).filter(
      (s) => s !== "default"
    );
    return sectionNames;
  });
  const [newSectionName, setNewSectionName] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const addSection = () => {
    if (newSectionName.trim() && !sections.includes(newSectionName.trim())) {
      setSections([...sections, newSectionName.trim()]);
      setExpandedSections(new Set([...expandedSections, newSectionName.trim()]));
      setNewSectionName("");
      setIsAddDialogOpen(false);
    }
  };

  const renameSection = (oldName: string, newName: string) => {
    // Update all fields in this section
    const sectionFields = fieldsBySection[oldName] || [];
    sectionFields.forEach((field) => {
      updateField(field.id, { section: newName });
    });

    // Update sections list
    setSections(sections.map((s) => (s === oldName ? newName : s)));
  };

  const deleteSection = (sectionName: string) => {
    // Move fields to unsectioned
    const sectionFields = fieldsBySection[sectionName] || [];
    sectionFields.forEach((field) => {
      updateField(field.id, { section: null });
    });

    // Remove section
    setSections(sections.filter((s) => s !== sectionName));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = allFields.findIndex((f) => f.id === active.id);
    const newIndex = allFields.findIndex((f) => f.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderFields(oldIndex, newIndex);
    }
  };

  // Get all unique sections from fields + manually created sections
  const allSections = [...new Set([...sections, ...Object.keys(fieldsBySection)])].filter(
    (s) => s !== "default"
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Organize Fields</h2>
          <p className="text-sm text-muted-foreground">
            Group related fields into sections and reorder them
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <FolderPlus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Section</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Section name"
                onKeyDown={(e) => e.key === "Enter" && addSection()}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={addSection}>Add Section</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {/* Named Sections */}
          {allSections.map((sectionName) => (
            <Section
              key={sectionName}
              name={sectionName}
              fields={fieldsBySection[sectionName] || []}
              isExpanded={expandedSections.has(sectionName)}
              onToggle={() => toggleSection(sectionName)}
              onRename={(newName) => renameSection(sectionName, newName)}
              onDelete={() => deleteSection(sectionName)}
            />
          ))}

          {/* Default/Unsectioned Fields */}
          {(fieldsBySection["default"]?.length > 0 || allSections.length === 0) && (
            <Section
              name="Unsectioned Fields"
              fields={fieldsBySection["default"] || []}
              isExpanded={expandedSections.has("default")}
              onToggle={() => toggleSection("default")}
              onRename={() => {}}
              onDelete={() => {}}
              isDefault
            />
          )}
        </div>
      </DndContext>

      {allFields.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No fields to organize. Go back to the Fields step to add some.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
