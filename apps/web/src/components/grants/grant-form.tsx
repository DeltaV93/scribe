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
import { GrantStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GrantFormProps {
  grant?: {
    id: string;
    name: string;
    funderName: string | null;
    grantNumber: string | null;
    description: string | null;
    startDate: string;
    endDate: string;
    status: GrantStatus;
    reportingFrequency: string | null;
  };
  mode: "create" | "edit";
}

export function GrantForm({ grant, mode }: GrantFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: grant?.name || "",
    funderName: grant?.funderName || "",
    grantNumber: grant?.grantNumber || "",
    description: grant?.description || "",
    startDate: grant?.startDate ? new Date(grant.startDate).toISOString().split("T")[0] : "",
    endDate: grant?.endDate ? new Date(grant.endDate).toISOString().split("T")[0] : "",
    status: grant?.status || GrantStatus.DRAFT,
    reportingFrequency: grant?.reportingFrequency || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        funderName: formData.funderName || null,
        grantNumber: formData.grantNumber || null,
        description: formData.description || null,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        status: formData.status,
        reportingFrequency: formData.reportingFrequency || null,
      };

      const url = mode === "create" ? "/api/grants" : `/api/grants/${grant?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save grant");
      }

      const data = await response.json();
      toast.success(mode === "create" ? "Grant created successfully" : "Grant updated successfully");
      router.push(`/grants/${data.data.id}`);
    } catch (error) {
      console.error("Error saving grant:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save grant");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Grant Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Grant Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Community Support Initiative 2024"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grantNumber">Grant Number</Label>
              <Input
                id="grantNumber"
                value={formData.grantNumber}
                onChange={(e) => setFormData({ ...formData, grantNumber: e.target.value })}
                placeholder="e.g., GRT-2024-001"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="funderName">Funder Name</Label>
              <Input
                id="funderName"
                value={formData.funderName}
                onChange={(e) => setFormData({ ...formData, funderName: e.target.value })}
                placeholder="e.g., State Department of Health"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as GrantStatus })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GrantStatus.DRAFT}>Draft</SelectItem>
                  <SelectItem value={GrantStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={GrantStatus.COMPLETED}>Completed</SelectItem>
                  <SelectItem value={GrantStatus.EXPIRED}>Expired</SelectItem>
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
              placeholder="Describe the grant's purpose and goals..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grant Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
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
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportingFrequency">Reporting Frequency</Label>
              <Select
                value={formData.reportingFrequency}
                onValueChange={(value) => setFormData({ ...formData, reportingFrequency: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Create Grant" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
