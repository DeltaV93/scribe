"use client";

import { useState } from "react";
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
import { MetricType } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeliverableFormProps {
  grantId: string;
  deliverable?: {
    id: string;
    name: string;
    description: string | null;
    metricType: MetricType;
    targetValue: number;
    dueDate: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const metricTypeOptions: { value: MetricType; label: string }[] = [
  { value: "CLIENT_CONTACTS", label: "Client Contacts" },
  { value: "CLIENTS_ENROLLED", label: "Clients Enrolled" },
  { value: "PROGRAM_COMPLETIONS", label: "Program Completions" },
  { value: "CLIENTS_HOUSED", label: "Clients Housed" },
  { value: "SESSIONS_DELIVERED", label: "Sessions Delivered" },
  { value: "FORM_SUBMISSIONS", label: "Form Submissions" },
  { value: "CUSTOM", label: "Custom Metric" },
];

export function DeliverableForm({
  grantId,
  deliverable,
  open,
  onOpenChange,
  onSuccess,
}: DeliverableFormProps) {
  const mode = deliverable ? "edit" : "create";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: deliverable?.name || "",
    description: deliverable?.description || "",
    metricType: deliverable?.metricType || ("" as MetricType | ""),
    targetValue: deliverable?.targetValue?.toString() || "",
    dueDate: deliverable?.dueDate
      ? new Date(deliverable.dueDate).toISOString().split("T")[0]
      : "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        metricType: formData.metricType,
        targetValue: parseInt(formData.targetValue, 10),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
      };

      const url =
        mode === "create"
          ? `/api/grants/${grantId}/deliverables`
          : `/api/grants/${grantId}/deliverables/${deliverable?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save deliverable");
      }

      toast.success(
        mode === "create"
          ? "Deliverable created successfully"
          : "Deliverable updated successfully"
      );
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving deliverable:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save deliverable");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Deliverable" : "Edit Deliverable"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Deliverable Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Enroll 50 clients in job training"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this deliverable measures..."
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="metricType">Metric Type *</Label>
              <Select
                value={formData.metricType}
                onValueChange={(value) =>
                  setFormData({ ...formData, metricType: value as MetricType })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {metricTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetValue">Target Value *</Label>
              <Input
                id="targetValue"
                type="number"
                min="1"
                value={formData.targetValue}
                onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                placeholder="e.g., 50"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add Deliverable" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
