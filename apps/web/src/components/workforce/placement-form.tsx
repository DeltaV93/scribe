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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlacementStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PlacementFormProps {
  clientId: string;
  initialData?: {
    id?: string;
    employerName: string;
    jobTitle: string;
    hourlyWage: number | null;
    startDate: string;
    endDate: string | null;
    status: PlacementStatus;
    notes: string | null;
  };
  mode?: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PlacementForm({
  clientId,
  initialData,
  mode = "create",
  open,
  onOpenChange,
  onSuccess,
}: PlacementFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    employerName: initialData?.employerName || "",
    jobTitle: initialData?.jobTitle || "",
    hourlyWage: initialData?.hourlyWage?.toString() || "",
    startDate: initialData?.startDate
      ? new Date(initialData.startDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    endDate: initialData?.endDate
      ? new Date(initialData.endDate).toISOString().split("T")[0]
      : "",
    status: initialData?.status || PlacementStatus.ACTIVE,
    notes: initialData?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        employerName: formData.employerName,
        jobTitle: formData.jobTitle,
        hourlyWage: formData.hourlyWage ? parseFloat(formData.hourlyWage) : null,
        startDate: formData.startDate,
        endDate: formData.endDate || null,
        status: formData.status,
        notes: formData.notes || null,
      };

      const url =
        mode === "edit" && initialData?.id
          ? `/api/placements/${initialData.id}`
          : `/api/clients/${clientId}/placements`;
      const method = mode === "edit" ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save placement");
      }

      toast.success(mode === "edit" ? "Placement updated" : "Placement created");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving placement:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save placement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Placement" : "Add Job Placement"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the job placement details."
              : "Record a new job placement for this client."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employerName">Employer Name *</Label>
              <Input
                id="employerName"
                value={formData.employerName}
                onChange={(e) => setFormData({ ...formData, employerName: e.target.value })}
                placeholder="e.g., Acme Corporation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title *</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Customer Service Representative"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hourlyWage">Hourly Wage</Label>
                <Input
                  id="hourlyWage"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyWage}
                  onChange={(e) => setFormData({ ...formData, hourlyWage: e.target.value })}
                  placeholder="15.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as PlacementStatus })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PlacementStatus.ACTIVE}>Active</SelectItem>
                    <SelectItem value={PlacementStatus.ENDED}>Ended</SelectItem>
                    <SelectItem value={PlacementStatus.TERMINATED}>Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information about the placement..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "edit" ? "Save Changes" : "Add Placement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
