"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_TITLE_LENGTH = 100;

interface EditableTitleProps {
  conversationId: string;
  title: string | null;
  canEdit: boolean;
  onTitleUpdate?: (newTitle: string | null) => void;
  className?: string;
}

export function EditableTitle({
  conversationId,
  title,
  canEdit,
  onTitleUpdate,
  className,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title || "");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayTitle = title || "Untitled Conversation";
  const isPlaceholder = !title;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (!canEdit) return;
    setEditedTitle(title || "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedTitle(title || "");
  };

  const handleSave = async () => {
    const trimmedTitle = editedTitle.trim();
    const newTitle = trimmedTitle || null;

    // No change
    if (newTitle === title) {
      setIsEditing(false);
      return;
    }

    // Validate length
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      toast.error(`Title must be ${MAX_TITLE_LENGTH} characters or less`);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to update title");
      }

      toast.success("Title updated");
      setIsEditing(false);
      onTitleUpdate?.(newTitle);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update title");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const charsRemaining = MAX_TITLE_LENGTH - editedTitle.length;
  const isNearLimit = charsRemaining <= 20;
  const isOverLimit = charsRemaining < 0;

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            placeholder="Enter conversation title"
            className={cn(
              "text-xl font-bold h-auto py-1 px-2",
              isOverLimit && "border-red-500 focus-visible:ring-red-500"
            )}
            aria-label="Conversation title"
          />
          {isNearLimit && (
            <span
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 text-xs",
                isOverLimit ? "text-red-500" : "text-muted-foreground"
              )}
            >
              {charsRemaining}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          disabled={isSaving || isOverLimit}
          className="h-8 w-8"
          aria-label="Save title"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 text-green-600" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-8 w-8"
          aria-label="Cancel editing"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <h1
        className={cn(
          "text-xl font-bold",
          canEdit && isPlaceholder && "text-muted-foreground cursor-pointer hover:text-foreground",
          canEdit && isPlaceholder && "transition-colors"
        )}
        onClick={canEdit && isPlaceholder ? handleStartEdit : undefined}
      >
        {displayTitle}
      </h1>
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleStartEdit}
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label="Edit title"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
