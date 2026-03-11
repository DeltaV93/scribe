"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Unlink,
} from "lucide-react";

export interface EditorToolbarProps {
  editor: Editor | null;
  className?: string;
  disabled?: boolean;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ToolbarButton({
  icon,
  label,
  shortcut,
  isActive,
  onClick,
  disabled,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          className={cn(
            "h-8 w-8",
            isActive && "bg-accent text-accent-foreground"
          )}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={isActive}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <span>{label}</span>
        {shortcut && (
          <span className="ml-2 text-muted-foreground">{shortcut}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Editor formatting toolbar component
 *
 * Provides buttons for:
 * - Bold (Cmd+B)
 * - Italic (Cmd+I)
 * - Underline (Cmd+U)
 * - Bullet list
 * - Numbered list
 * - Links (add/remove)
 *
 * Features:
 * - Visual active state indicators
 * - Keyboard shortcut hints in tooltips
 * - Mobile-friendly touch targets
 * - Full ARIA support
 */
export function EditorToolbar({
  editor,
  className,
  disabled,
}: EditorToolbarProps) {
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = React.useState(false);

  if (!editor) {
    return null;
  }

  const isMac =
    typeof window !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "Cmd" : "Ctrl";

  const handleAddLink = () => {
    if (linkUrl.trim()) {
      // Add https:// if no protocol specified
      const url = linkUrl.match(/^https?:\/\//)
        ? linkUrl
        : `https://${linkUrl}`;
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
      setLinkUrl("");
      setLinkPopoverOpen(false);
    }
  };

  const handleRemoveLink = () => {
    editor.chain().focus().unsetLink().run();
  };

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddLink();
    }
    if (e.key === "Escape") {
      setLinkPopoverOpen(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 bg-muted/50 p-1",
          className
        )}
        role="toolbar"
        aria-label="Text formatting"
      >
        {/* Text formatting group */}
        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label="Text style"
        >
          <ToolbarButton
            icon={<Bold className="h-4 w-4" />}
            label="Bold"
            shortcut={`${modKey}+B`}
            isActive={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
          />
          <ToolbarButton
            icon={<Italic className="h-4 w-4" />}
            label="Italic"
            shortcut={`${modKey}+I`}
            isActive={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
          />
          <ToolbarButton
            icon={<Underline className="h-4 w-4" />}
            label="Underline"
            shortcut={`${modKey}+U`}
            isActive={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={disabled}
          />
        </div>

        {/* Separator */}
        <div
          className="mx-1 h-6 w-px bg-border"
          role="separator"
          aria-orientation="vertical"
        />

        {/* List formatting group */}
        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label="Lists"
        >
          <ToolbarButton
            icon={<List className="h-4 w-4" />}
            label="Bullet list"
            isActive={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
          />
          <ToolbarButton
            icon={<ListOrdered className="h-4 w-4" />}
            label="Numbered list"
            isActive={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
          />
        </div>

        {/* Separator */}
        <div
          className="mx-1 h-6 w-px bg-border"
          role="separator"
          aria-orientation="vertical"
        />

        {/* Link group */}
        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label="Links"
        >
          <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    className={cn(
                      "h-8 w-8",
                      editor.isActive("link") &&
                        "bg-accent text-accent-foreground"
                    )}
                    disabled={disabled}
                    aria-label="Add link"
                    aria-pressed={editor.isActive("link")}
                  >
                    <Link className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <span>Add link</span>
                <span className="ml-2 text-muted-foreground">{modKey}+K</span>
              </TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80" align="start">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Add Link</h4>
                  <p className="text-sm text-muted-foreground">
                    Enter the URL for this link
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="link-url">URL</Label>
                  <Input
                    id="link-url"
                    placeholder="https://example.com"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={handleLinkKeyDown}
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setLinkPopoverOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" type="button" onClick={handleAddLink}>
                    Add Link
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {editor.isActive("link") && (
            <ToolbarButton
              icon={<Unlink className="h-4 w-4" />}
              label="Remove link"
              onClick={handleRemoveLink}
              disabled={disabled}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
