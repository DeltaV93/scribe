"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CreateFromTemplateModalProps {
  templateId: string;
  templateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFromTemplateModal({
  templateId,
  templateName,
  open,
  onOpenChange,
}: CreateFromTemplateModalProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    setCreating(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/create-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Form created successfully");
        onOpenChange(false);
        // Navigate to the new form's builder
        router.push(`/forms/${data.data.id}/edit`);
      } else {
        toast.error(data.error?.message || "Failed to create form");
      }
    } catch (error) {
      toast.error("Failed to create form");
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Form from Template</DialogTitle>
          <DialogDescription>
            Create a new form based on the &ldquo;{templateName}&rdquo; template.
            You can customize it after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="form-name">Form Name (optional)</Label>
            <Input
              id="form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={templateName}
            />
            <p className="text-sm text-muted-foreground">
              Leave blank to use the template name
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
