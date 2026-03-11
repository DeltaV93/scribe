"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ArrowLeft,
  Loader2,
  Edit,
  Trash2,
  Archive,
  Video,
  FileText,
  PenLine,
  Calendar,
  User,
  Tag,
} from "lucide-react";
import { format } from "date-fns";

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  source: "MEETING" | "DOCUMENT" | "MANUAL";
  category: string | null;
  tags: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  lastUpdatedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  meeting?: {
    id: string;
    title: string;
    actualStartAt: string | null;
  } | null;
}

const sourceConfig = {
  MEETING: { label: "Meeting", icon: Video, color: "bg-blue-100 text-blue-800" },
  DOCUMENT: { label: "Document", icon: FileText, color: "bg-green-100 text-green-800" },
  MANUAL: { label: "Manual", icon: PenLine, color: "bg-purple-100 text-purple-800" },
};

export default function KnowledgeEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    summary: "",
    category: "",
    tags: "",
  });

  // Delete dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEntry = async () => {
    try {
      const response = await fetch(`/api/knowledge/${id}`);
      if (response.ok) {
        const data = await response.json();
        setEntry(data.data);
        setEditForm({
          title: data.data.title,
          content: data.data.content,
          summary: data.data.summary || "",
          category: data.data.category || "",
          tags: data.data.tags.join(", "),
        });
      } else {
        router.push("/knowledge");
      }
    } catch (error) {
      console.error("Error fetching entry:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntry();
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          content: editForm.content,
          summary: editForm.summary || null,
          category: editForm.category || null,
          tags: editForm.tags
            ? editForm.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [],
        }),
      });

      if (response.ok) {
        setIsEditOpen(false);
        fetchEntry();
      }
    } catch (error) {
      console.error("Error saving entry:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/knowledge");
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isArchived: !entry?.isArchived,
        }),
      });

      if (response.ok) {
        fetchEntry();
      }
    } catch (error) {
      console.error("Error archiving entry:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="p-6">
        <p>Knowledge entry not found</p>
      </div>
    );
  }

  const SourceIcon = sourceConfig[entry.source].icon;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/knowledge")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Base
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{entry.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge className={sourceConfig[entry.source].color}>
              <SourceIcon className="h-3 w-3 mr-1" />
              {sourceConfig[entry.source].label}
            </Badge>
            {entry.category && (
              <Badge variant="outline">{entry.category}</Badge>
            )}
            {entry.isArchived && (
              <Badge variant="secondary">Archived</Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleArchive}>
            <Archive className="h-4 w-4 mr-2" />
            {entry.isArchived ? "Unarchive" : "Archive"}
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Summary */}
      {entry.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{entry.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {entry.content}
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tags */}
        {entry.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Source Info */}
        {entry.meeting && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-4 w-4" />
                Source Meeting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => router.push(`/meetings/${entry.meeting!.id}`)}
              >
                {entry.meeting.title}
              </Button>
              {entry.meeting.actualStartAt && (
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(entry.meeting.actualStartAt), "MMMM d, yyyy")}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Created by {entry.createdBy.name || entry.createdBy.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Created {format(new Date(entry.createdAt), "MMMM d, yyyy 'at' h:mm a")}</span>
            </div>
            {entry.lastUpdatedBy && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>
                  Last updated by {entry.lastUpdatedBy.name || entry.lastUpdatedBy.email} on{" "}
                  {format(new Date(entry.updatedAt), "MMMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Knowledge Entry</DialogTitle>
            <DialogDescription>
              Update this knowledge entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                className="min-h-[200px]"
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-summary">Summary (optional)</Label>
              <Textarea
                id="edit-summary"
                value={editForm.summary}
                onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category (optional)</Label>
                <Input
                  id="edit-category"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                <Input
                  id="edit-tags"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !editForm.title.trim() || !editForm.content.trim()}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{entry.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
