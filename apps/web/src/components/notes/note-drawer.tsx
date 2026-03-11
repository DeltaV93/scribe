"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TipTapEditor, MentionableUser } from "@/components/editor";
import { NoteTypeSelect, NoteType } from "./note-type-select";
import { NoteTagSelect } from "./note-tag-select";
import { RecentNotesPreview } from "./recent-notes-preview";
import { ShareableWarningDialog } from "./shareable-warning-dialog";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Send,
  Lock,
  AlertTriangle,
  Check,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface Note {
  id: string;
  content: string;
  type: "INTERNAL" | "SHAREABLE";
  status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "REJECTED";
  tags: string[];
  isDraft: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string | null;
  author?: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface NoteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  note?: Note | null;
  onSave?: (note: Note) => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY = 2000; // 2 seconds debounce

export function NoteDrawer({
  open,
  onOpenChange,
  clientId,
  note,
  onSave,
}: NoteDrawerProps) {
  // Form state
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("INTERNAL");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);

  // UI state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showShareableWarning, setShowShareableWarning] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Refs for autosave debouncing
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const noteTypeRef = useRef(noteType);
  const tagsRef = useRef(selectedTags);
  const mentionsRef = useRef(mentionedUserIds);

  // Update refs when state changes
  useEffect(() => {
    contentRef.current = content;
    noteTypeRef.current = noteType;
    tagsRef.current = selectedTags;
    mentionsRef.current = mentionedUserIds;
  }, [content, noteType, selectedTags, mentionedUserIds]);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch mentionable users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users/mentionable");
        if (response.ok) {
          const data = await response.json();
          setMentionableUsers(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching mentionable users:", error);
      }
    };

    if (open) {
      fetchUsers();
    }
  }, [open]);

  // Initialize form state when opening drawer
  useEffect(() => {
    if (open) {
      if (note) {
        // Edit mode - populate from existing note
        setContent(note.content);
        setNoteType(note.type);
        setSelectedTags(note.tags);
        setDraftId(note.id);
        setLastSavedAt(new Date(note.updatedAt));
      } else {
        // Create mode - reset form
        setContent("");
        setNoteType("INTERNAL");
        setSelectedTags([]);
        setDraftId(null);
        setLastSavedAt(null);
      }
      setMentionedUserIds([]);
      setIsDirty(false);
      setSaveStatus("idle");
    }
  }, [open, note]);

  // Check if note is locked for editing
  const isLocked = note?.status === "PENDING_APPROVAL";

  // Check if user can edit (author only, and not locked)
  const canEdit = !note || (!isLocked && note.status !== "PUBLISHED");

  // Save draft to server
  const saveDraft = useCallback(async () => {
    if (!isDirty || isLocked) return;

    setSaveStatus("saving");

    try {
      const payload = {
        content: contentRef.current,
        type: noteTypeRef.current,
        tags: tagsRef.current,
        isDraft: true,
        mentions: mentionsRef.current,
      };

      let response: Response;

      if (draftId) {
        // Update existing draft
        response = await fetch(`/api/notes/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new draft
        response = await fetch(`/api/clients/${clientId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        const data = await response.json();
        if (!draftId && data.data?.id) {
          setDraftId(data.data.id);
        }
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        setIsDirty(false);
      } else {
        throw new Error("Failed to save draft");
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      setSaveStatus("error");
    }
  }, [clientId, draftId, isDirty, isLocked]);

  // Trigger autosave when form changes
  useEffect(() => {
    if (!open || isLocked) return;

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Set new timer for autosave
    if (isDirty) {
      autosaveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, AUTOSAVE_DELAY);
    }

    // Cleanup
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isDirty, open, isLocked, saveDraft]);

  // Handle content change
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
    setSaveStatus("idle");
  };

  // Handle mention callback
  const handleMention = (userId: string) => {
    if (!mentionedUserIds.includes(userId)) {
      setMentionedUserIds((prev) => [...prev, userId]);
    }
  };

  // Handle type change
  const handleTypeChange = (newType: NoteType) => {
    setNoteType(newType);
    setIsDirty(true);
    setSaveStatus("idle");
  };

  // Handle tags change
  const handleTagsChange = (newTags: string[]) => {
    setSelectedTags(newTags);
    setIsDirty(true);
    setSaveStatus("idle");
  };

  // Publish note
  const publishNote = async () => {
    // Validate content
    const plainText = content.replace(/<[^>]*>/g, "").trim();
    if (!plainText) {
      toast.error("Please enter note content before publishing");
      return;
    }

    setIsPublishing(true);

    try {
      // First ensure we have a draft saved
      let noteId = draftId;

      if (!noteId) {
        // Create the note first
        const createResponse = await fetch(`/api/clients/${clientId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            type: noteType,
            tags: selectedTags,
            isDraft: true,
            mentions: mentionedUserIds,
          }),
        });

        if (!createResponse.ok) {
          throw new Error("Failed to create note");
        }

        const createData = await createResponse.json();
        noteId = createData.data.id;
      }

      // Now publish the note
      const publishResponse = await fetch(`/api/notes/${noteId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: noteType }),
      });

      if (!publishResponse.ok) {
        const errorData = await publishResponse.json();
        throw new Error(errorData.error?.message || "Failed to publish note");
      }

      const publishData = await publishResponse.json();

      // Show success message based on note type
      if (noteType === "SHAREABLE") {
        toast.success("Note submitted for approval");
      } else {
        toast.success("Note published successfully");
      }

      // Callback with published note
      onSave?.(publishData.data);
      onOpenChange(false);
    } catch (error) {
      console.error("Error publishing note:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to publish note"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle publish click
  const handlePublish = () => {
    if (noteType === "SHAREABLE") {
      // Show warning dialog for shareable notes
      setShowShareableWarning(true);
    } else {
      // Publish internal note directly
      publishNote();
    }
  };

  // Handle shareable warning confirmation
  const handleShareableConfirm = () => {
    setShowShareableWarning(false);
    publishNote();
  };

  // Handle save as draft click
  const handleSaveAsDraft = async () => {
    await saveDraft();
    toast.success("Draft saved successfully");
  };

  // Handle close
  const handleClose = () => {
    // If there are unsaved changes, save draft before closing
    if (isDirty && content.trim()) {
      saveDraft();
    }
    onOpenChange(false);
  };

  // Get save status indicator
  const getSaveStatusIndicator = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </span>
        );
      case "saved":
        return (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <Check className="h-3 w-3" />
            Saved
            {lastSavedAt && (
              <span className="text-muted-foreground">
                at {format(lastSavedAt, "h:mm a")}
              </span>
            )}
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            Failed to save
          </span>
        );
      default:
        return isDirty ? (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        ) : null;
    }
  };

  // Sheet content styles for mobile vs desktop
  const sheetContentClassName = cn(
    "flex flex-col",
    isMobile
      ? "w-full h-full max-w-none sm:max-w-none inset-0"
      : "w-[500px] sm:max-w-[500px]"
  );

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={sheetContentClassName}
        >
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              {note ? "Edit Note" : "Add Note"}
              {isLocked && (
                <Badge variant="warning" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Pending Approval
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              {note
                ? `Last edited ${format(new Date(note.updatedAt), "MMM d, yyyy 'at' h:mm a")}`
                : "Document your interaction with this client"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
            {/* Locked warning */}
            {isLocked && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
                <Lock className="h-4 w-4 text-warning" />
                <span>
                  This note is pending approval and cannot be edited.
                </span>
              </div>
            )}

            {/* Rejection reason */}
            {note?.status === "REJECTED" && note.rejectionReason && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">
                    Note was rejected
                  </p>
                  <p className="text-muted-foreground">
                    {note.rejectionReason}
                  </p>
                </div>
              </div>
            )}

            {/* Note Type Select */}
            <NoteTypeSelect
              value={noteType}
              onChange={handleTypeChange}
              disabled={isLocked}
            />

            {/* Tags Select */}
            <NoteTagSelect
              selectedTags={selectedTags}
              onChange={handleTagsChange}
              disabled={isLocked}
              noteType={noteType}
            />

            {/* Rich Text Editor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <div className="border rounded-md">
                <TipTapEditor
                  content={content}
                  onChange={handleContentChange}
                  onMention={handleMention}
                  mentionableUsers={mentionableUsers}
                  placeholder="Start typing your note..."
                  editable={!isLocked}
                  className="min-h-[200px]"
                />
              </div>
            </div>

            {/* Save Status */}
            <div className="flex items-center justify-between">
              {getSaveStatusIndicator()}
              {note?.author && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last edited by {note.author.name || note.author.email}
                </span>
              )}
            </div>

            {/* Recent Notes Section */}
            <RecentNotesPreview
              clientId={clientId}
              excludeNoteId={note?.id}
              defaultOpen={false}
            />
          </div>

          <SheetFooter className="flex-shrink-0 border-t pt-4 gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPublishing}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveAsDraft}
              disabled={isPublishing || isLocked || !content.trim()}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save as Draft
            </Button>
            <Button
              onClick={handlePublish}
              disabled={isPublishing || isLocked || !content.trim()}
              className="gap-2"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {noteType === "SHAREABLE" ? "Submit for Approval" : "Publish"}
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Shareable Warning Dialog */}
      <ShareableWarningDialog
        open={showShareableWarning}
        onOpenChange={setShowShareableWarning}
        onConfirm={handleShareableConfirm}
        isSubmitting={isPublishing}
      />
    </>
  );
}
