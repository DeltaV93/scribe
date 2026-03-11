"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ClientStatus } from "@prisma/client";
import { toast } from "sonner";
import { AlertTriangle, Loader2, User } from "lucide-react";

interface DuplicateMatch {
  clientId: string;
  clientName: string;
  matchReasons: string[];
  score: number;
}

interface DuplicateCheckResult {
  hasPotentialDuplicate: boolean;
  score: number;
  matches: DuplicateMatch[];
}

interface ClientFormProps {
  mode: "create" | "edit";
  initialData?: {
    id?: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    internalId?: string | null;
    status?: ClientStatus;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    } | null;
  };
}

export function ClientForm({ mode, initialData }: ClientFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    internalId: initialData?.internalId || "",
    status: initialData?.status || ClientStatus.ACTIVE,
    address: {
      street: initialData?.address?.street || "",
      city: initialData?.address?.city || "",
      state: initialData?.address?.state || "",
      zip: initialData?.address?.zip || "",
    },
  });

  // Check for duplicates when phone number changes (on blur)
  const handlePhoneBlur = async () => {
    if (mode === "edit") return; // Skip duplicate check in edit mode
    if (formData.phone.length < 10) return;

    setIsCheckingDuplicates(true);
    try {
      const response = await fetch("/api/clients/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data.hasPotentialDuplicate) {
          setDuplicateResult(data.data);
          setShowDuplicateDialog(true);
        }
      }
    } catch (error) {
      console.error("Error checking duplicates:", error);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = mode === "create" ? "/api/clients" : `/api/clients/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          email: formData.email || null,
          internalId: formData.internalId || null,
          address:
            formData.address.street ||
            formData.address.city ||
            formData.address.state ||
            formData.address.zip
              ? formData.address
              : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save client");
      }

      const data = await response.json();
      toast.success(mode === "create" ? "Client created successfully" : "Client updated successfully");
      router.push(`/clients/${data.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save client");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{mode === "create" ? "New Client" : "Edit Client"}</CardTitle>
            <CardDescription>
              {mode === "create"
                ? "Enter the client's basic information to create their record."
                : "Update the client's information."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Required Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
                    onBlur={handlePhoneBlur}
                    required
                    placeholder="(555) 123-4567"
                  />
                  {isCheckingDuplicates && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john.smith@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="internalId">Internal ID</Label>
                <Input
                  id="internalId"
                  value={formData.internalId}
                  onChange={(e) => setFormData({ ...formData, internalId: e.target.value })}
                  placeholder="Optional org-specific ID"
                />
              </div>
              {mode === "edit" && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as ClientStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ClientStatus.ACTIVE}>Active</SelectItem>
                      <SelectItem value={ClientStatus.ON_HOLD}>On Hold</SelectItem>
                      <SelectItem value={ClientStatus.PENDING}>Pending</SelectItem>
                      <SelectItem value={ClientStatus.CLOSED}>Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Address Section */}
            <div className="space-y-4">
              <Label>Address (Optional)</Label>
              <div className="grid grid-cols-1 gap-4">
                <Input
                  placeholder="Street Address"
                  value={formData.address.street}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      address: { ...formData.address, street: e.target.value },
                    })
                  }
                />
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    placeholder="City"
                    value={formData.address.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder="State"
                    value={formData.address.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder="ZIP Code"
                    value={formData.address.zip}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, zip: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Client" : "Save Changes"}
          </Button>
        </div>
      </form>

      {/* Duplicate Warning Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Potential Duplicate Found
            </DialogTitle>
            <DialogDescription>
              We found records that may match this client. Please review before continuing.
            </DialogDescription>
          </DialogHeader>

          {duplicateResult && (
            <div className="space-y-4">
              {duplicateResult.matches.map((match) => (
                <Alert key={match.clientId}>
                  <User className="h-4 w-4" />
                  <AlertTitle>{match.clientName}</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm mt-1">
                      {match.matchReasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto mt-2"
                      onClick={() => router.push(`/clients/${match.clientId}`)}
                    >
                      View existing record
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Continue Creating New Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
