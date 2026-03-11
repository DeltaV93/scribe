"use client";

import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Edit, Clock, User, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientNote } from "@/hooks/use-client-notes";
import { getTagColor } from "./notes-filter-bar";

interface NoteDetailDrawerProps {
  note: ClientNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  onEdit?: (note: ClientNote) => void;
}

function getStatusBadge(status: ClientNote["status"]) {
  switch (status) {
    case "DRAFT":
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
          Draft
        </Badge>
      );
    case "PENDING_APPROVAL":
      return (
        <Badge variant="warning" className="bg-yellow-100 text-yellow-800">
          Pending Approval
        </Badge>
      );
    case "PUBLISHED":
      return (
        <Badge variant="success" className="bg-green-100 text-green-800">
          Published
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800">
          Rejected
        </Badge>
      );
    default:
      return null;
  }
}

function getTypeBadge(type: ClientNote["type"]) {
  if (type === "SHAREABLE") {
    return (
      <Badge variant="outline" className="border-blue-300 text-blue-700">
        Shareable
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-gray-300 text-gray-600">
      Internal
    </Badge>
  );
}

export function NoteDetailDrawer({
  note,
  open,
  onOpenChange,
  currentUserId,
  onEdit,
}: NoteDetailDrawerProps) {
  if (!note) return null;

  const isAuthor = currentUserId === note.author.id;
  const canEdit = isAuthor && note.status !== "PENDING_APPROVAL";
  const wasEdited = note.createdAt !== note.updatedAt;
  const authorName = note.author.name || note.author.email;

  const handleEdit = () => {
    if (canEdit && onEdit) {
      onEdit(note);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <SheetTitle className="text-lg font-semibold">
                Note Details
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                View note information
              </SheetDescription>
            </div>
            {canEdit && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="shrink-0"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {getTypeBadge(note.type)}
            {getStatusBadge(note.status)}
            {note.isDraft && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                Unsaved Draft
              </Badge>
            )}
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        {/* Author & Date Info */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>
              By <span className="font-medium text-foreground">{authorName}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Created {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
          {wasEdited && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Edit className="h-4 w-4" />
              <span>
                Edited {format(new Date(note.updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border",
                    getTagColor(tag)
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Note Content */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Content</p>
          <div
            className="prose prose-sm max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        </div>

        {/* Rejection info */}
        {note.status === "REJECTED" && note.rejectionReason && (
          <>
            <Separator className="my-4" />
            <div className="rounded-md bg-red-50 p-4 border border-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Rejection Reason
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {note.rejectionReason}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Approval info */}
        {note.status === "PUBLISHED" && note.approvedBy && note.approvedAt && (
          <>
            <Separator className="my-4" />
            <div className="rounded-md bg-green-50 p-4 border border-green-100">
              <p className="text-sm text-green-700">
                Approved by{" "}
                <span className="font-medium">
                  {note.approvedBy.name || note.approvedBy.email}
                </span>{" "}
                on {format(new Date(note.approvedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </>
        )}

        {/* Warning for pending notes */}
        {note.status === "PENDING_APPROVAL" && isAuthor && (
          <>
            <Separator className="my-4" />
            <div className="rounded-md bg-yellow-50 p-4 border border-yellow-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Pending Review
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    This note is awaiting supervisor approval. Editing is disabled
                    until the review is complete.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
