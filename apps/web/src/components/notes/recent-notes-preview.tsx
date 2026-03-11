"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronUp, ChevronDown, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface RecentNote {
  id: string;
  content: string;
  type: "INTERNAL" | "SHAREABLE";
  tags: string[];
  createdAt: string;
  author?: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface RecentNotesPreviewProps {
  clientId: string;
  excludeNoteId?: string;
  defaultOpen?: boolean;
}

/**
 * Strip HTML tags and get a plain text preview
 */
function getPlainTextPreview(html: string, maxLength = 100): string {
  // Remove HTML tags
  const text = html.replace(/<[^>]*>/g, "");
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, " ").trim();
  // Truncate
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength).trim() + "...";
}

/**
 * Get author display name
 */
function getAuthorName(author?: { name: string | null; email: string }): string {
  if (!author) return "Unknown";
  if (author.name) {
    // Get first name + last initial
    const parts = author.name.split(" ");
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  }
  // Fall back to email username
  return author.email.split("@")[0];
}

export function RecentNotesPreview({
  clientId,
  excludeNoteId,
  defaultOpen = false,
}: RecentNotesPreviewProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [notes, setNotes] = useState<RecentNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRecentNotes = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/clients/${clientId}/notes?limit=4&status=PUBLISHED`
        );
        if (response.ok) {
          const data = await response.json();
          // Filter out the current note if editing
          let fetchedNotes = data.data || [];
          if (excludeNoteId) {
            fetchedNotes = fetchedNotes.filter(
              (n: RecentNote) => n.id !== excludeNoteId
            );
          }
          // Only keep the 3 most recent
          setNotes(fetchedNotes.slice(0, 3));
        }
      } catch (error) {
        console.error("Error fetching recent notes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentNotes();
  }, [clientId, excludeNoteId]);

  if (isLoading) {
    return (
      <div className="border rounded-lg p-3">
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (notes.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-3 h-auto hover:bg-muted/50"
            aria-expanded={isOpen}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Notes ({notes.length})
            </span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t divide-y">
            {notes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "p-3 text-sm",
                  "hover:bg-muted/30 transition-colors"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-muted-foreground">
                    {getAuthorName(note.author)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(note.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-2">
                  {getPlainTextPreview(note.content, 120)}
                </p>
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {note.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-1.5 py-0.5 text-xs bg-secondary text-secondary-foreground rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{note.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
