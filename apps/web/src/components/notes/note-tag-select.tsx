"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NoteTag {
  id: string;
  name: string;
  colorHash: string;
  isRestricted: boolean;
  programId?: string | null;
}

interface NoteTagSelectProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  noteType?: "INTERNAL" | "SHAREABLE";
}

/**
 * Generate a consistent color from a string hash.
 * Uses HSL with fixed saturation and lightness for readable badge colors.
 */
function getTagColor(colorHash: string): { bg: string; text: string } {
  // Parse the colorHash as a hex value or generate from string
  let hash = 0;
  for (let i = 0; i < colorHash.length; i++) {
    const char = colorHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Generate hue from 0-360
  const hue = Math.abs(hash) % 360;

  return {
    bg: `hsl(${hue}, 70%, 90%)`,
    text: `hsl(${hue}, 70%, 30%)`,
  };
}

export function NoteTagSelect({
  selectedTags,
  onChange,
  disabled = false,
  noteType = "INTERNAL",
}: NoteTagSelectProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/note-tags");
        if (response.ok) {
          const data = await response.json();
          setTags(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching note tags:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, []);

  // Focus search input when popover opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  // Filter tags based on search query and note type
  const filteredTags = tags.filter((tag) => {
    // Filter by search query
    const matchesSearch = tag.name.toLowerCase().includes(searchQuery.toLowerCase());

    // If shareable note, exclude restricted tags
    if (noteType === "SHAREABLE" && tag.isRestricted) {
      return false;
    }

    return matchesSearch;
  });

  const toggleTag = useCallback(
    (tagName: string) => {
      if (selectedTags.includes(tagName)) {
        onChange(selectedTags.filter((t) => t !== tagName));
      } else {
        onChange([...selectedTags, tagName]);
      }
    },
    [selectedTags, onChange]
  );

  const removeTag = useCallback(
    (tagName: string) => {
      onChange(selectedTags.filter((t) => t !== tagName));
    },
    [selectedTags, onChange]
  );

  // Find tag objects for selected tags
  const selectedTagObjects = selectedTags
    .map((name) => tags.find((t) => t.name === name))
    .filter((t): t is NoteTag => t !== undefined);

  // Get tags that would be invalid for shareable notes
  const restrictedSelectedTags = noteType === "SHAREABLE"
    ? selectedTags.filter((name) => {
        const tag = tags.find((t) => t.name === name);
        return tag?.isRestricted;
      })
    : [];

  return (
    <div className="space-y-2">
      <Label htmlFor="note-tags">Tags</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="note-tags"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            {selectedTags.length > 0 ? (
              <span className="text-muted-foreground">
                {selectedTags.length} tag{selectedTags.length !== 1 ? "s" : ""} selected
              </span>
            ) : (
              <span className="text-muted-foreground">Select tags...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              ref={searchInputRef}
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>
          <div
            className="max-h-[200px] overflow-y-auto p-1"
            role="listbox"
            aria-multiselectable="true"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {searchQuery ? "No tags found" : "No tags available"}
              </div>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.name);
                const colors = getTagColor(tag.colorHash);

                return (
                  <button
                    key={tag.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground",
                      isSelected && "bg-accent/50"
                    )}
                    onClick={() => toggleTag(tag.name)}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <Badge
                      variant="outline"
                      className="border-0"
                      style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                      }}
                    >
                      {tag.name}
                    </Badge>
                    {tag.isRestricted && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Internal only
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected tags display */}
      {selectedTagObjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedTagObjects.map((tag) => {
            const colors = getTagColor(tag.colorHash);
            const isRestricted = restrictedSelectedTags.includes(tag.name);

            return (
              <Badge
                key={tag.id}
                variant="outline"
                className={cn(
                  "border-0 pr-1 gap-1",
                  isRestricted && "ring-2 ring-destructive ring-offset-1"
                )}
                style={{
                  backgroundColor: colors.bg,
                  color: colors.text,
                }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => removeTag(tag.name)}
                  className="ml-1 rounded-full hover:bg-black/10 p-0.5"
                  aria-label={`Remove ${tag.name} tag`}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Warning for restricted tags on shareable notes */}
      {restrictedSelectedTags.length > 0 && (
        <p className="text-xs text-destructive mt-1">
          Remove restricted tags before publishing as shareable:{" "}
          {restrictedSelectedTags.join(", ")}
        </p>
      )}
    </div>
  );
}
