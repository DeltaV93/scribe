"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgramStatus, ProgramLabelType } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProgramFormProps {
  initialData?: {
    id?: string;
    name: string;
    labelType: ProgramLabelType;
    description: string | null;
    requiredHours: number | null;
    startDate: string | null;
    endDate: string | null;
    location: string | null;
    maxEnrollment: number | null;
    status: ProgramStatus;
  };
  mode?: "create" | "edit";
}

export function ProgramForm({ initialData, mode = "create" }: ProgramFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    labelType: initialData?.labelType || ProgramLabelType.PROGRAM,
    description: initialData?.description || "",
    requiredHours: initialData?.requiredHours?.toString() || "",
    startDate: initialData?.startDate
      ? new Date(initialData.startDate).toISOString().split("T")[0]
      : "",
    endDate: initialData?.endDate
      ? new Date(initialData.endDate).toISOString().split("T")[0]
      : "",
    location: initialData?.location || "",
    maxEnrollment: initialData?.maxEnrollment?.toString() || "",
    status: initialData?.status || ProgramStatus.DRAFT,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        labelType: formData.labelType,
        description: formData.description || null,
        requiredHours: formData.requiredHours ? parseInt(formData.requiredHours) : null,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
        location: formData.location || null,
        maxEnrollment: formData.maxEnrollment ? parseInt(formData.maxEnrollment) : null,
        status: formData.status,
      };

      const url =
        mode === "edit" && initialData?.id
          ? `/api/programs/${initialData.id}`
          : "/api/programs";
      const method = mode === "edit" ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save program");
      }

      const data = await response.json();
      toast.success(mode === "edit" ? "Program updated" : "Program created");
      router.push(`/programs/${data.data.id}`);
    } catch (error) {
      console.error("Error saving program:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save program");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Program Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Financial Literacy Workshop"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labelType">Type</Label>
              <Select
                value={formData.labelType}
                onValueChange={(value) =>
                  setFormData({ ...formData, labelType: value as ProgramLabelType })
                }
              >
                <SelectTrigger id="labelType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ProgramLabelType.PROGRAM}>Program</SelectItem>
                  <SelectItem value={ProgramLabelType.COURSE}>Course</SelectItem>
                  <SelectItem value={ProgramLabelType.CLASS}>Class</SelectItem>
                  <SelectItem value={ProgramLabelType.WORKSHOP}>Workshop</SelectItem>
                  <SelectItem value={ProgramLabelType.TRAINING}>Training</SelectItem>
                  <SelectItem value={ProgramLabelType.GROUP}>Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the program objectives and content..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as ProgramStatus })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ProgramStatus.DRAFT}>Draft</SelectItem>
                <SelectItem value={ProgramStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={ProgramStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={ProgramStatus.CANCELLED}>Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule & Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="requiredHours">Required Hours</Label>
              <Input
                id="requiredHours"
                type="number"
                min="0"
                value={formData.requiredHours}
                onChange={(e) => setFormData({ ...formData, requiredHours: e.target.value })}
                placeholder="e.g., 40"
              />
              <p className="text-xs text-muted-foreground">
                Total hours needed for program completion
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxEnrollment">Max Enrollment</Label>
              <Input
                id="maxEnrollment"
                type="number"
                min="1"
                value={formData.maxEnrollment}
                onChange={(e) => setFormData({ ...formData, maxEnrollment: e.target.value })}
                placeholder="e.g., 30"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for unlimited enrollment
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Room 101 or Online via Zoom"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !formData.name}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "edit" ? "Update Program" : "Create Program"}
        </Button>
      </div>
    </form>
  );
}
