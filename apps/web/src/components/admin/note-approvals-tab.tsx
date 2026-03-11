"use client";

/**
 * Note Approvals Tab Component
 *
 * Admin tab for reviewing and approving/rejecting shareable notes.
 * Follows the Phone Requests tab pattern.
 */

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  X,
  FileText,
  User,
  Calendar,
  Tag,
  Eye,
} from "lucide-react";

interface PendingNote {
  id: string;
  content: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// Rejection reasons from spec
const REJECTION_REASONS = [
  { value: "INAPPROPRIATE_CONTENT", label: "Content not appropriate for client viewing" },
  { value: "INTERNAL_JARGON", label: "Contains internal jargon or abbreviations" },
  { value: "MISSING_CONTEXT", label: "Lacks sufficient context for client" },
  { value: "FACTUAL_ERROR", label: "Contains factual errors that need correction" },
  { value: "FORMATTING_ISSUES", label: "Formatting or grammar needs improvement" },
  { value: "WRONG_CLIENT", label: "Note appears to be for wrong client" },
  { value: "DUPLICATE", label: "Duplicates existing information" },
  { value: "OTHER", label: "Other (requires custom feedback)" },
];

interface NoteApprovalsTabProps {
  pendingCount: number;
  onDataChange: () => void;
}

export function NoteApprovalsTab({ pendingCount, onDataChange }: NoteApprovalsTabProps) {
  const [notes, setNotes] = useState<PendingNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingNote, setProcessingNote] = useState<string | null>(null);

  // Preview dialog state
  const [previewNote, setPreviewNote] = useState<PendingNote | null>(null);

  // Approve confirmation state
  const [approvingNote, setApprovingNote] = useState<PendingNote | null>(null);

  // Reject dialog state
  const [rejectingNote, setRejectingNote] = useState<PendingNote | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [customFeedback, setCustomFeedback] = useState("");

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/note-approvals");
      if (response.ok) {
        const data = await response.json();
        setNotes(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch pending approvals:", error);
      toast.error("Failed to load pending approvals");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (noteId: string) => {
    setProcessingNote(noteId);
    try {
      const response = await fetch(`/api/admin/note-approvals/${noteId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve note");
      }

      toast.success("Note approved successfully");
      setApprovingNote(null);
      fetchNotes();
      onDataChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve note");
    } finally {
      setProcessingNote(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingNote || !rejectReason) return;

    if (rejectReason === "OTHER" && !customFeedback.trim()) {
      toast.error("Please provide custom feedback for 'Other' rejection reason");
      return;
    }

    setProcessingNote(rejectingNote.id);
    try {
      const response = await fetch(
        `/api/admin/note-approvals/${rejectingNote.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: rejectReason,
            customFeedback: customFeedback.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reject note");
      }

      toast.success("Note rejected - author has been notified");
      setRejectingNote(null);
      setRejectReason("");
      setCustomFeedback("");
      fetchNotes();
      onDataChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject note");
    } finally {
      setProcessingNote(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getContentPreview = (content: string, maxLength = 150) => {
    // Strip HTML tags for preview
    const text = content.replace(/<[^>]*>/g, "");
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No pending approvals</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">
            Shareable notes submitted by staff will appear here for review before
            being visible to clients.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-yellow-600" />
            Pending Approvals ({notes.length})
          </CardTitle>
          <CardDescription>
            Review and approve shareable notes before they become visible to clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="border rounded-lg p-4 bg-background space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {note.author.name || note.author.email}
                      </span>
                      <span className="text-muted-foreground">wrote for</span>
                      <span className="font-medium">
                        {note.client.firstName} {note.client.lastName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(note.createdAt)}
                    </div>
                  </div>
                  <Badge variant="warning">Pending Review</Badge>
                </div>

                {/* Content Preview */}
                <div className="bg-muted/50 rounded-md p-3 text-sm">
                  {getContentPreview(note.content)}
                </div>

                {/* Tags */}
                {note.tags.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-wrap gap-1">
                      {note.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewNote(note)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setApprovingNote(note)}
                    disabled={processingNote === note.id}
                  >
                    {processingNote === note.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setRejectingNote(note);
                      setRejectReason("");
                      setCustomFeedback("");
                    }}
                    disabled={processingNote === note.id}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewNote} onOpenChange={() => setPreviewNote(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Note Preview</DialogTitle>
            <DialogDescription>
              {previewNote && (
                <>
                  By {previewNote.author.name || previewNote.author.email} for{" "}
                  {previewNote.client.firstName} {previewNote.client.lastName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {previewNote && (
            <div className="space-y-4">
              {/* Full content with HTML rendering */}
              <div
                className="prose prose-sm max-w-none p-4 border rounded-md bg-muted/20"
                dangerouslySetInnerHTML={{ __html: previewNote.content }}
              />

              {/* Tags */}
              {previewNote.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {previewNote.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-muted-foreground">
                Submitted: {formatDate(previewNote.createdAt)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewNote(null)}>
              Close
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setPreviewNote(null);
                if (previewNote) setApprovingNote(previewNote);
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const note = previewNote;
                setPreviewNote(null);
                if (note) {
                  setRejectingNote(note);
                  setRejectReason("");
                  setCustomFeedback("");
                }
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog
        open={!!approvingNote}
        onOpenChange={() => setApprovingNote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this note? Once approved, it will be
              visible to the client ({approvingNote?.client.firstName}{" "}
              {approvingNote?.client.lastName}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approvingNote && handleApprove(approvingNote.id)}
              disabled={!!processingNote}
            >
              {processingNote === approvingNote?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Approve Note"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectingNote}
        onOpenChange={() => {
          setRejectingNote(null);
          setRejectReason("");
          setCustomFeedback("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Note</DialogTitle>
            <DialogDescription>
              Select a reason for rejecting this note. The author will be notified
              and can edit and resubmit the note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Rejection Reason</Label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger id="rejectReason">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customFeedback">
                Additional Feedback{" "}
                {rejectReason === "OTHER" ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                id="customFeedback"
                placeholder="Provide specific feedback to help the author improve the note..."
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingNote(null);
                setRejectReason("");
                setCustomFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={
                !rejectReason ||
                (rejectReason === "OTHER" && !customFeedback.trim()) ||
                !!processingNote
              }
            >
              {processingNote === rejectingNote?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reject Note"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
