"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Eye, Users, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { VariablePicker } from "@/components/note-templates/variable-picker";

interface MassNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionTitle: string;
  programId: string;
}

interface Attendee {
  clientId: string;
  clientName: string;
  status: string;
  attendanceType: string | null;
  hoursAttended: number | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  scope: string;
  isDefault: boolean;
}

interface Preview {
  clientId: string;
  clientName: string;
  resolvedContent: string;
}

export function MassNoteDialog({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
  programId,
}: MassNoteDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "compose" | "preview" | "confirm">("select");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);

  // Form state
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState<"INTERNAL" | "SHAREABLE">("INTERNAL");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Preview
  const [previews, setPreviews] = useState<Preview[]>([]);

  // Load attendees and templates
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, sessionId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [attendeesRes, templatesRes] = await Promise.all([
        fetch(`/api/mass-notes?sessionId=${sessionId}`),
        fetch(`/api/note-templates?programId=${programId}`),
      ]);

      if (attendeesRes.ok) {
        const data = await attendeesRes.json();
        setAttendees(data.data.attendees || []);
        // Select all by default
        setSelectedClients(data.data.attendees?.map((a: Attendee) => a.clientId) || []);
      }

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.data || []);
        setAvailableVariables(data.meta?.availableVariables || []);

        // Use default template if available
        const defaultTemplate = data.data?.find((t: Template) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id);
          setNoteContent(defaultTemplate.content);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setNoteContent(template.content);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClients(attendees.map((a) => a.clientId));
    } else {
      setSelectedClients([]);
    }
  };

  const handleClientToggle = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleInsertVariable = (variable: string) => {
    setNoteContent(noteContent + `{{${variable}}}`);
  };

  const handlePreview = async () => {
    if (selectedClients.length === 0) {
      toast.error("Please select at least one client");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/mass-notes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          templateContent: noteContent,
          clientIds: selectedClients.slice(0, 5), // Preview first 5
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate preview");
      }

      const data = await response.json();
      setPreviews(data.data);
      setStep("preview");
    } catch (error) {
      toast.error("Failed to generate preview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedClients.length === 0) {
      toast.error("Please select at least one client");
      return;
    }

    if (!noteContent.trim()) {
      toast.error("Note content is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/mass-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          templateId: selectedTemplate || undefined,
          templateContent: noteContent,
          noteType,
          tags,
          clientIds: selectedClients,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to create mass notes");
      }

      const data = await response.json();
      toast.success(data.message);
      onOpenChange(false);

      // Reset form
      setStep("select");
      setNoteContent("");
      setTags([]);
      setPreviews([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create mass notes");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Mass Notes</DialogTitle>
          <DialogDescription>
            Create notes for multiple clients who attended "{sessionTitle}"
          </DialogDescription>
        </DialogHeader>

        {isLoading && step === "select" ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Tabs value={step} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="select" onClick={() => setStep("select")}>
                <Users className="mr-2 h-4 w-4" />
                Select
              </TabsTrigger>
              <TabsTrigger value="compose" onClick={() => setStep("compose")}>
                <FileText className="mr-2 h-4 w-4" />
                Compose
              </TabsTrigger>
              <TabsTrigger value="preview" disabled={!noteContent}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="confirm" disabled={previews.length === 0}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              {/* Step 1: Select Clients */}
              <TabsContent value="select" className="h-full overflow-hidden">
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedClients.length === attendees.length}
                        onCheckedChange={handleSelectAll}
                      />
                      <Label htmlFor="select-all">Select All ({attendees.length})</Label>
                    </div>
                    <Badge variant="secondary">
                      {selectedClients.length} selected
                    </Badge>
                  </div>

                  <ScrollArea className="flex-1 border rounded-md">
                    <div className="p-4 space-y-2">
                      {attendees.map((attendee) => (
                        <div
                          key={attendee.clientId}
                          className="flex items-center gap-3 p-2 hover:bg-muted rounded"
                        >
                          <Checkbox
                            checked={selectedClients.includes(attendee.clientId)}
                            onCheckedChange={() => handleClientToggle(attendee.clientId)}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{attendee.clientName}</div>
                            <div className="text-sm text-muted-foreground">
                              {attendee.attendanceType || "Present"}
                              {attendee.hoursAttended && ` • ${attendee.hoursAttended} hours`}
                            </div>
                          </div>
                        </div>
                      ))}

                      {attendees.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          No attendees found for this session
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => setStep("compose")}
                      disabled={selectedClients.length === 0}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Step 2: Compose Note */}
              <TabsContent value="compose" className="h-full overflow-auto">
                <div className="space-y-4">
                  {/* Template Selection */}
                  {templates.length > 0 && (
                    <div className="space-y-2">
                      <Label>Template</Label>
                      <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No template</SelectItem>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                              {template.isDefault && " (Default)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Note Content */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="note-content">Note Content</Label>
                      <VariablePicker
                        variables={availableVariables}
                        onInsert={handleInsertVariable}
                      />
                    </div>
                    <Textarea
                      id="note-content"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Enter the note content. Use {{variables}} for client-specific values."
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Note Type */}
                  <div className="space-y-2">
                    <Label>Note Type</Label>
                    <Select
                      value={noteType}
                      onValueChange={(value: "INTERNAL" | "SHAREABLE") => setNoteType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTERNAL">Internal</SelectItem>
                        <SelectItem value="SHAREABLE">Shareable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                        placeholder="Add a tag"
                        className="flex-1"
                      />
                      <Button type="button" variant="secondary" onClick={handleAddTag}>
                        Add
                      </Button>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => handleRemoveTag(tag)}
                          >
                            {tag} ×
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep("select")}>
                      Back
                    </Button>
                    <Button onClick={handlePreview} disabled={isLoading || !noteContent.trim()}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Preview
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Step 3: Preview */}
              <TabsContent value="preview" className="h-full overflow-hidden">
                <div className="space-y-4 h-full flex flex-col">
                  <div className="text-sm text-muted-foreground">
                    Preview of notes for the first {previews.length} clients:
                  </div>

                  <ScrollArea className="flex-1 border rounded-md">
                    <div className="p-4 space-y-4">
                      {previews.map((preview) => (
                        <div key={preview.clientId} className="border rounded-lg p-4">
                          <div className="font-medium mb-2">{preview.clientName}</div>
                          <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                            {preview.resolvedContent}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep("compose")}>
                      Back to Edit
                    </Button>
                    <Button onClick={() => setStep("confirm")}>
                      Continue to Confirm
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Step 4: Confirm */}
              <TabsContent value="confirm" className="h-full">
                <div className="space-y-6 p-4">
                  <div className="text-center space-y-4">
                    <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                    <h3 className="text-lg font-medium">Ready to Create Notes</h3>
                    <p className="text-muted-foreground">
                      You're about to create {selectedClients.length} notes for session
                      "{sessionTitle}"
                    </p>
                  </div>

                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Clients:</span>
                      <span className="font-medium">{selectedClients.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Note Type:</span>
                      <span className="font-medium">{noteType}</span>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Tags:</span>
                        <span className="font-medium">{tags.join(", ")}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep("preview")}>
                      Back
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create {selectedClients.length} Notes
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
