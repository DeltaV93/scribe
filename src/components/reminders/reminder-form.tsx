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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addDays, format } from "date-fns";

interface ReminderFormProps {
  clientId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

export function ReminderForm({
  clientId,
  open,
  onOpenChange,
  onSuccess,
}: ReminderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    priority: "2",
    assignedToId: "",
  });

  // Fetch org users for assignment dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users");
        if (response.ok) {
          const data = await response.json();
          setUsers(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    if (open) {
      fetchUsers();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        dueDate: new Date(formData.dueDate).toISOString(),
        priority: parseInt(formData.priority, 10),
        assignedToId: formData.assignedToId || undefined,
      };

      const url = clientId ? `/api/clients/${clientId}/reminders` : "/api/reminders";
      const body = clientId ? payload : { ...payload, clientId };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to create reminder");
      }

      toast.success("Reminder created successfully");
      setFormData({
        title: "",
        description: "",
        dueDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
        priority: "2",
        assignedToId: "",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating reminder:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create reminder");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Reminder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Follow up with client"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add any additional details..."
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">High</SelectItem>
                  <SelectItem value="2">Normal</SelectItem>
                  <SelectItem value="3">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {users.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="assignedToId">Assign To</Label>
              <Select
                value={formData.assignedToId}
                onValueChange={(value) => setFormData({ ...formData, assignedToId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign to self (default)" />
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
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Reminder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
