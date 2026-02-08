"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ObjectiveStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface ObjectiveFormProps {
  objective?: {
    id: string;
    title: string;
    description: string | null;
    ownerId: string;
    parentId: string | null;
    status: ObjectiveStatus;
    startDate: string | null;
    endDate: string | null;
  };
  parentId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const statusOptions: { value: ObjectiveStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function ObjectiveForm({
  objective,
  parentId,
  open,
  onOpenChange,
  onSuccess,
}: ObjectiveFormProps) {
  const mode = objective ? "edit" : "create";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [formData, setFormData] = useState({
    title: objective?.title || "",
    description: objective?.description || "",
    ownerId: objective?.ownerId || "",
    parentId: objective?.parentId ?? parentId ?? null,
    status: objective?.status || ("DRAFT" as ObjectiveStatus),
    startDate: objective?.startDate
      ? new Date(objective.startDate).toISOString().split("T")[0]
      : "",
    endDate: objective?.endDate
      ? new Date(objective.endDate).toISOString().split("T")[0]
      : "",
  });

  // Fetch users for owner selection
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await fetch("/api/users?limit=100");
        if (response.ok) {
          const data = await response.json();
          setUsers(data.data || []);
          // Set default owner if not editing
          if (!objective && data.data?.length > 0 && !formData.ownerId) {
            // Try to find current user from session or use first user
            const currentUserResponse = await fetch("/api/users/me");
            if (currentUserResponse.ok) {
              const currentUser = await currentUserResponse.json();
              setFormData((prev) => ({ ...prev, ownerId: currentUser.data?.id || data.data[0].id }));
            } else {
              setFormData((prev) => ({ ...prev, ownerId: data.data[0].id }));
            }
          }
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    if (open) {
      fetchUsers();
    }
  }, [open, objective, formData.ownerId]);

  // Reset form when objective changes
  useEffect(() => {
    if (objective) {
      setFormData({
        title: objective.title,
        description: objective.description || "",
        ownerId: objective.ownerId,
        parentId: objective.parentId,
        status: objective.status,
        startDate: objective.startDate
          ? new Date(objective.startDate).toISOString().split("T")[0]
          : "",
        endDate: objective.endDate
          ? new Date(objective.endDate).toISOString().split("T")[0]
          : "",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        ownerId: "",
        parentId: parentId ?? null,
        status: "DRAFT",
        startDate: "",
        endDate: "",
      });
    }
  }, [objective, parentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        ownerId: formData.ownerId,
        parentId: formData.parentId,
        status: formData.status,
        startDate: formData.startDate
          ? new Date(formData.startDate).toISOString()
          : null,
        endDate: formData.endDate
          ? new Date(formData.endDate).toISOString()
          : null,
      };

      const url =
        mode === "create" ? "/api/objectives" : `/api/objectives/${objective?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save objective");
      }

      toast.success(
        mode === "create"
          ? "Objective created successfully"
          : "Objective updated successfully"
      );
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving objective:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save objective"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Objective" : "Edit Objective"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Objective Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Increase customer satisfaction"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe what this objective aims to achieve..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="owner">Owner *</Label>
              <Select
                value={formData.ownerId}
                onValueChange={(value) =>
                  setFormData({ ...formData, ownerId: value })
                }
                disabled={isLoadingUsers}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as ObjectiveStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.ownerId}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create Objective" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
