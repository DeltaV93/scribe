"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CredentialFormProps {
  clientId: string;
  initialData?: {
    id?: string;
    name: string;
    issuingOrg: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    documentUrl: string | null;
    notes: string | null;
  };
  mode?: "create" | "edit" | "renew";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CredentialForm({
  clientId,
  initialData,
  mode = "create",
  open,
  onOpenChange,
  onSuccess,
}: CredentialFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    issuingOrg: initialData?.issuingOrg || "",
    issueDate: initialData?.issueDate
      ? new Date(initialData.issueDate).toISOString().split("T")[0]
      : "",
    expiryDate: initialData?.expiryDate
      ? new Date(initialData.expiryDate).toISOString().split("T")[0]
      : "",
    documentUrl: initialData?.documentUrl || "",
    notes: initialData?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let url: string;
      let method: string;
      let payload: Record<string, unknown>;

      if (mode === "renew" && initialData?.id) {
        url = `/api/credentials/${initialData.id}/renew`;
        method = "POST";
        payload = {
          newExpiryDate: formData.expiryDate,
          newIssueDate: formData.issueDate || undefined,
          newDocumentUrl: formData.documentUrl || null,
          notes: formData.notes || null,
        };
      } else if (mode === "edit" && initialData?.id) {
        url = `/api/credentials/${initialData.id}`;
        method = "PUT";
        payload = {
          name: formData.name,
          issuingOrg: formData.issuingOrg || null,
          issueDate: formData.issueDate || null,
          expiryDate: formData.expiryDate || null,
          documentUrl: formData.documentUrl || null,
          notes: formData.notes || null,
        };
      } else {
        url = `/api/clients/${clientId}/credentials`;
        method = "POST";
        payload = {
          name: formData.name,
          issuingOrg: formData.issuingOrg || null,
          issueDate: formData.issueDate || null,
          expiryDate: formData.expiryDate || null,
          documentUrl: formData.documentUrl || null,
          notes: formData.notes || null,
        };
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save credential");
      }

      const successMessage =
        mode === "renew"
          ? "Credential renewed"
          : mode === "edit"
            ? "Credential updated"
            : "Credential created";

      toast.success(successMessage);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving credential:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save credential");
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    mode === "renew"
      ? "Renew Credential"
      : mode === "edit"
        ? "Edit Credential"
        : "Add Credential";

  const description =
    mode === "renew"
      ? "Update the credential with a new expiry date."
      : mode === "edit"
        ? "Update the credential details."
        : "Record a new credential or certification for this client.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {mode !== "renew" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Credential Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., CDL Class A, Food Handler Certificate"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issuingOrg">Issuing Organization</Label>
                  <Input
                    id="issuingOrg"
                    value={formData.issuingOrg}
                    onChange={(e) => setFormData({ ...formData, issuingOrg: e.target.value })}
                    placeholder="e.g., State DMV, ServSafe"
                  />
                </div>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issueDate">
                  {mode === "renew" ? "New Issue Date" : "Issue Date"}
                </Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate">
                  {mode === "renew" ? "New Expiry Date *" : "Expiry Date"}
                </Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  required={mode === "renew"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentUrl">Document URL</Label>
              <Input
                id="documentUrl"
                type="url"
                value={formData.documentUrl}
                onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Link to a scanned copy of the credential
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information about the credential..."
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
              {mode === "renew" ? "Renew" : mode === "edit" ? "Save Changes" : "Add Credential"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
