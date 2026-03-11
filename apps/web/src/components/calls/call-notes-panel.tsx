"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Note {
  id: string;
  content: string;
  createdAt: string;
  author?: {
    name: string | null;
    email: string;
  };
}

interface CallNotesPanelProps {
  currentNote: string;
  onNoteChange: (note: string) => void;
  previousNotes: Note[];
  onSaveNote?: () => void;
  isSaving?: boolean;
}

export function CallNotesPanel({
  currentNote,
  onNoteChange,
  previousNotes,
  onSaveNote,
  isSaving = false,
}: CallNotesPanelProps) {
  const [showPreviousNotes, setShowPreviousNotes] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Current Note */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Call Notes</CardTitle>
          {onSaveNote && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSaveNote}
              disabled={isSaving || !currentNote.trim()}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <Textarea
            placeholder="Take notes during the call..."
            value={currentNote}
            onChange={(e) => onNoteChange(e.target.value)}
            className="flex-1 min-h-[200px] resize-none"
          />
        </CardContent>
      </Card>

      {/* Previous Notes (Collapsible) */}
      {previousNotes.length > 0 && (
        <Card className="mt-4">
          <CardHeader
            className="flex-row items-center justify-between space-y-0 pb-2 cursor-pointer"
            onClick={() => setShowPreviousNotes(!showPreviousNotes)}
          >
            <CardTitle className="text-sm font-medium">
              Previous Notes ({previousNotes.length})
            </CardTitle>
            <Button variant="ghost" size="sm">
              {showPreviousNotes ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          {showPreviousNotes && (
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {previousNotes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 border rounded-lg text-sm"
                    >
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{note.author?.name || note.author?.email}</span>
                        <span>
                          {format(new Date(note.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: note.content.replace(/<[^>]*>/g, ""),
                        }}
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
