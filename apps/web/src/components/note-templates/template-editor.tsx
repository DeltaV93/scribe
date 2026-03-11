"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { VariablePicker } from "./variable-picker";

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: {
    id: string;
    name: string;
    content: string;
    scope: string;
    programId?: string;
    sessionType?: string;
    isDefault: boolean;
  };
  programs?: Array<{ id: string; name: string }>;
  availableVariables?: string[];
  onSaved?: () => void;
}

const SCOPES = [
  { value: "ORG", label: "Organization-wide" },
  { value: "PROGRAM", label: "Program-specific" },
  { value: "USER", label: "Personal" },
];

const SESSION_TYPES = [
  { value: "", label: "All session types" },
  { value: "class", label: "Class" },
  { value: "workshop", label: "Workshop" },
  { value: "training", label: "Training" },
  { value: "group", label: "Group session" },
];

export function TemplateEditor({
  open,
  onOpenChange,
  template,
  programs = [],
  availableVariables = [],
  onSaved,
}: TemplateEditorProps) {
  const isEditing = !!template;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState(template?.name || "");
  const [content, setContent] = useState(template?.content || "");
  const [scope, setScope] = useState(template?.scope || "ORG");
  const [programId, setProgramId] = useState(template?.programId || "");
  const [sessionType, setSessionType] = useState(template?.sessionType || "");
  const [isDefault, setIsDefault] = useState(template?.isDefault || false);

  const handleInsertVariable = (variable: string) => {
    setContent(content + `{{${variable}}}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    if (!content.trim()) {
      toast.error("Template content is required");
      return;
    }

    if (scope === "PROGRAM" && !programId) {
      toast.error("Please select a program for program-specific templates");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/note-templates/${template.id}`
        : "/api/note-templates";

      const method = isEditing ? "PUT" : "POST";

      const body = {
        name: name.trim(),
        content: content.trim(),
        scope,
        programId: scope === "PROGRAM" ? programId : undefined,
        sessionType: sessionType || undefined,
        isDefault,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save template");
      }

      toast.success(isEditing ? "Template updated" : "Template created");
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;

    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/note-templates/${template.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete template");
      }

      toast.success("Template deleted");
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error("Failed to delete template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Template" : "Create Template"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your note template settings and content."
              : "Create a reusable template for mass notes."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Group Session Note"
            />
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={setScope} disabled={isEditing}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {scope === "ORG" && "Available to all users in your organization"}
              {scope === "PROGRAM" && "Only available for the selected program"}
              {scope === "USER" && "Only visible to you"}
            </p>
          </div>

          {/* Program (for PROGRAM scope) */}
          {scope === "PROGRAM" && programs.length > 0 && (
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Session Type */}
          <div className="space-y-2">
            <Label>Session Type (optional)</Label>
            <Select value={sessionType} onValueChange={setSessionType}>
              <SelectTrigger>
                <SelectValue placeholder="All session types" />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Template Content</Label>
              <VariablePicker
                variables={availableVariables}
                onInsert={handleInsertVariable}
              />
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the template content. Use {{variables}} for dynamic values."
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use variables like {`{{client.fullName}}`}, {`{{session.date}}`},{" "}
              {`{{attendance.hoursAttended}}`} to personalize notes.
            </p>
          </div>

          {/* Default */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is-default">Set as Default</Label>
              <p className="text-xs text-muted-foreground">
                Use this template by default for new mass notes
              </p>
            </div>
            <Switch
              id="is-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>

          <DialogFooter className="gap-2">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
