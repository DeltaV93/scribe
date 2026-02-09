"use client";

/**
 * Note Tags Content Component
 *
 * Client component for managing note tags.
 * Displays tags grouped by scope (org-wide vs program-specific).
 */

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Tag,
  Lock,
  Building2,
  Layers,
} from "lucide-react";

interface NoteTag {
  id: string;
  orgId: string;
  programId: string | null;
  programName: string | null;
  name: string;
  colorHash: string;
  isRestricted: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

interface Program {
  id: string;
  name: string;
}

export function NoteTagsContent() {
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Create form state
  const [newTagName, setNewTagName] = useState("");
  const [newTagProgramId, setNewTagProgramId] = useState<string>("");
  const [newTagIsRestricted, setNewTagIsRestricted] = useState(false);

  // Edit dialog state
  const [editingTag, setEditingTag] = useState<NoteTag | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsRestricted, setEditIsRestricted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog state
  const [deletingTag, setDeletingTag] = useState<NoteTag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tagsRes, programsRes] = await Promise.all([
        fetch("/api/admin/note-tags"),
        fetch("/api/programs"),
      ]);

      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setTags(data.data);
      }

      if (programsRes.ok) {
        const data = await programsRes.json();
        setPrograms(data.data?.programs || data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load tags");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTagName.trim()) {
      toast.error("Tag name is required");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/admin/note-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTagName.trim(),
          programId: newTagProgramId || null,
          isRestricted: newTagIsRestricted,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create tag");
      }

      toast.success("Tag created successfully");
      setNewTagName("");
      setNewTagProgramId("");
      setNewTagIsRestricted(false);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create tag");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditOpen = (tag: NoteTag) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditIsRestricted(tag.isRestricted);
  };

  const handleEditSave = async () => {
    if (!editingTag || !editName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/note-tags/${editingTag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          isRestricted: editIsRestricted,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tag");
      }

      toast.success("Tag updated successfully");
      setEditingTag(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tag");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/note-tags/${deletingTag.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete tag");
      }

      const result = await response.json();
      toast.success(result.data.message);
      setDeletingTag(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete tag");
    } finally {
      setIsDeleting(false);
    }
  };

  // Group tags by scope
  const orgWideTags = tags.filter((t) => !t.programId);
  const programTags = tags.filter((t) => t.programId);

  // Group program tags by program
  const tagsByProgram = programTags.reduce<Record<string, NoteTag[]>>(
    (acc, tag) => {
      const key = tag.programId || "";
      if (!acc[key]) acc[key] = [];
      acc[key].push(tag);
      return acc;
    },
    {}
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Tag Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Tag
          </CardTitle>
          <CardDescription>
            Add a new predefined tag for notes. Tags help categorize and filter client notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="tagName">Tag Name</Label>
                <Input
                  id="tagName"
                  placeholder="e.g., Follow-up, Housing, Benefits"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="w-full sm:w-48 space-y-2">
                <Label htmlFor="tagScope">Scope</Label>
                <Select
                  value={newTagProgramId}
                  onValueChange={setNewTagProgramId}
                >
                  <SelectTrigger id="tagScope">
                    <SelectValue placeholder="Org-wide" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Org-wide</SelectItem>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="restricted"
                    checked={newTagIsRestricted}
                    onCheckedChange={setNewTagIsRestricted}
                  />
                  <Label htmlFor="restricted" className="text-sm whitespace-nowrap">
                    Restricted
                  </Label>
                </div>

                <Button type="submit" disabled={isCreating || !newTagName.trim()}>
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create
                    </>
                  )}
                </Button>
              </div>
            </div>

            {newTagName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Preview:</span>
                <TagBadge name={newTagName} isRestricted={newTagIsRestricted} />
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Org-Wide Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Org-Wide Tags
          </CardTitle>
          <CardDescription>
            These tags are available for all notes across the organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgWideTags.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No org-wide tags yet. Create one above.
            </p>
          ) : (
            <TagTable
              tags={orgWideTags}
              onEdit={handleEditOpen}
              onDelete={setDeletingTag}
            />
          )}
        </CardContent>
      </Card>

      {/* Program-Specific Tags */}
      {Object.entries(tagsByProgram).map(([programId, programTags]) => {
        const programName = programTags[0]?.programName || "Unknown Program";
        return (
          <Card key={programId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                {programName}
              </CardTitle>
              <CardDescription>
                Tags specific to this program.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TagTable
                tags={programTags}
                onEdit={handleEditOpen}
                onDelete={setDeletingTag}
              />
            </CardContent>
          </Card>
        );
      })}

      {/* Edit Dialog */}
      <Dialog open={!!editingTag} onOpenChange={() => setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag name or settings. Changes will apply to all notes using this tag.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Tag Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="editRestricted"
                checked={editIsRestricted}
                onCheckedChange={setEditIsRestricted}
              />
              <Label htmlFor="editRestricted">
                Restricted (cannot be used on shareable notes)
              </Label>
            </div>
            {editName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Preview:</span>
                <TagBadge name={editName} isRestricted={editIsRestricted} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTag(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={isSaving || !editName.trim()}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTag} onOpenChange={() => setDeletingTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTag?.usageCount && deletingTag.usageCount > 0 ? (
                <>
                  This tag is currently used in{" "}
                  <strong>{deletingTag.usageCount} note(s)</strong>. Deleting it will remove the tag from all those notes. This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete the tag &quot;{deletingTag?.name}&quot;? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete Tag"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

interface TagTableProps {
  tags: NoteTag[];
  onEdit: (tag: NoteTag) => void;
  onDelete: (tag: NoteTag) => void;
}

function TagTable({ tags, onEdit, onDelete }: TagTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]">Color</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Usage</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tags.map((tag) => (
          <TableRow key={tag.id}>
            <TableCell>
              <div
                className="w-6 h-6 rounded-full"
                style={{ backgroundColor: tag.colorHash }}
              />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{tag.name}</span>
              </div>
            </TableCell>
            <TableCell>
              {tag.isRestricted ? (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Restricted
                </Badge>
              ) : (
                <Badge variant="outline">Public</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <span className="text-muted-foreground">
                {tag.usageCount} note{tag.usageCount !== 1 ? "s" : ""}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(tag)}
                  title="Edit tag"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(tag)}
                  title="Delete tag"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface TagBadgeProps {
  name: string;
  isRestricted?: boolean;
}

function TagBadge({ name, isRestricted }: TagBadgeProps) {
  // Simple hash for color preview (matching server-side logic)
  const colorPalette = [
    "#3B82F6", "#EF4444", "#10B981", "#8B5CF6", "#F97316", "#06B6D4",
    "#EC4899", "#84CC16", "#6366F1", "#F59E0B", "#14B8A6", "#A855F7",
    "#F43F5E", "#22C55E", "#0EA5E9", "#D946EF",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const colorIndex = Math.abs(hash) % colorPalette.length;
  const color = colorPalette[colorIndex];

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {isRestricted && <Lock className="h-3 w-3" />}
      {name}
    </span>
  );
}
